'use client'

import { useFrame, useThree } from '@react-three/fiber'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { Group, Mesh, PlaneGeometry, Quaternion, ShaderMaterial, Vector2, Vector3 } from 'three'

import {
  EN_REPOSO,
  GOLPE,
  capasDelGolpe,
  estadoDelGolpe,
  ladoEnLaVista,
  pulsosDelGolpe,
  sumarGolpe,
  unitaria,
  type Confort,
  type Golpe,
  type Punto3,
} from '../../lib/golpeRecibido'
import type { Pulso } from '../../lib/tactos'

/**
 * El golpe que recibe el cuerpo, pintado: la viñeta, la sacudida del decorado, la cámara lenta,
 * el filtro y el háptico, orquestados desde un solo sitio.
 *
 * Es el mismo fichero en todos los juegos que lo usan (`comunes.py` lo vigila), así que aquí no
 * hay nada de ningún juego: **qué** golpea, **cuándo** y **con qué fuerza** lo dice quien lo
 * monta llamando a `golpe`. Las curvas y las cifras están en `lib/golpeRecibido.ts`, probadas
 * sin navegador.
 *
 * **La cámara no se toca en ningún fotograma.** Mover la vista sin que la cabeza se mueva es lo
 * que marea en realidad virtual. Lo que se sacude es el grupo que envuelve a los hijos de este
 * componente —el decorado que le pase el juego—, y la viñeta es un plano que **sigue** a la
 * cabeza leyéndola, nunca escribiéndola. Lo comprueba un e2e fotograma a fotograma.
 *
 * **Cada capa es opcional salvo la viñeta**, porque no todos los juegos tienen de todo:
 *
 * - La **sacudida** mueve los hijos. Sin hijos no se sacude nada.
 * - La **cámara lenta** la lee el juego con `escalaDelReloj()` y la aplica a su reloj de juego,
 *   si lo tiene. Se lee y no se empuja porque cada juego tiene su bucle y su orden de fotograma;
 *   el valor sale de la hora de pared, así que vale leerlo en cualquier punto del fotograma.
 * - El **filtro** llega por `filtrar(hz)` al bus del juego, solo cuando cambia.
 * - El **háptico** llega por `vibrar(pulso)`, con la receta común de `tactos.ts`: el juego pone
 *   el mando, este componente no inventa pulsos.
 *
 * **La dirección va en el espacio donde se monta el componente**, que es el de quien lo llama
 * —el mundo del juego, con su anclaje ya puesto—: de ahí se lleva a la cabeza para saber por
 * qué lado oscurecer, y la sacudida se aplica tal cual a su grupo, que cuelga de ese espacio.
 *
 * **El confort manda** (apagado, suave, normal) y el movimiento reducido del sistema se mira
 * aquí mismo; el del salón, si algún día llega, entra por `movimientoReducido`.
 *
 * **La piel de la viñeta la puede poner el juego** (`material`), que es como un juego que ya
 * tenía su propio borde —una salpicadura, una grieta— lo sigue teniendo sin pintar dos planos
 * delante de los ojos: el plano, su sitio y su curva son de aquí; el aspecto, del juego. El
 * material recibe `uIntensidad` (0–1), `uLado` (el lado del golpe en la vista) y `uSemilla`
 * (distinta en cada golpe).
 */

/** Lo que se le puede pedir desde el juego. */
export interface GolpeRecibidoHandle {
  /**
   * Le han dado a quien juega.
   *
   * @param fuerza de 0 a 1.
   * @param direccion hacia donde viene el golpe **desde** quien juega, en el espacio donde se
   *   monta este componente; sin ella, el golpe es sordo: sin lado y hacia abajo.
   */
  golpe(fuerza: number, direccion?: Punto3 | null): void
  /** A qué ritmo tiene que correr ahora el reloj del juego: 1 es el normal. */
  escalaDelReloj(): number
}

export interface GolpeRecibidoProps {
  confort: Confort
  /** El movimiento reducido del salón, si lo da. El del sistema se mira aquí. */
  movimientoReducido?: boolean
  /** El corte del paso bajo del bus del juego, en hercios. Sin bus, sin filtro. */
  filtrar?: (corteHz: number) => void
  /** Un pulso en un mando. Sin mandos, sin háptico. */
  vibrar?: (pulso: Pulso) => void
  /** La piel de la viñeta; sin ella, un oscurecido. */
  material?: ShaderMaterial
  /** El decorado que se sacude. */
  children?: ReactNode
}

/** A qué distancia de los ojos va el plano de la viñeta, y lo que mide: de sobra para el visor. */
const PLANO = { distancia: 0.2, lado: 1.1 } as const

/** La hora de pared, en segundos: la cámara lenta no puede frenar su propia vuelta. */
const horaDePared = () => performance.now() / 1000

/** Una muestra de lo que pasa en un fotograma, para quien mira desde fuera (un e2e). */
interface Muestra {
  readonly camara: number[]
  readonly sacudida: [number, number, number]
  readonly vineta: number
  readonly escala: number
  readonly corte: number
}

/** Lo que se deja en `window` para probarlo desde fuera: dar un golpe, medirlo y pararlo. */
interface Sonda {
  golpe(fuerza: number, direccion?: Punto3 | null): void
  /** Empieza a apuntar una muestra por fotograma, desde cero. */
  medir(): void
  muestras(): readonly Muestra[]
  /** Deja el reloj de los golpes clavado en esa edad del último, o lo suelta con `null`. */
  fijarEdad(edad: number | null): void
}

declare global {
  interface Window {
    __golpeRecibido?: Sonda
  }
}

/** Lo que pide el sistema: se escucha, porque se puede cambiar con el juego abierto. */
const CONSULTA = '(prefers-reduced-motion: reduce)'
function suscribirseAlSistema(avisar: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const consulta = window.matchMedia(CONSULTA)
  consulta.addEventListener('change', avisar)
  return () => consulta.removeEventListener('change', avisar)
}
function reducidoEnElSistema(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA).matches
}

/**
 * El oscurecido de partida: rojo muy oscuro en el marco, más del lado del golpe, y el centro limpio.
 *
 * Rojo y no negro porque la mayoría de los decorados del salón son oscuros, y un marco negro sobre
 * una sala en penumbra no se ve: el tinte es lo que lo distingue. Solo cambia el color de los
 * bordes y va pegado a la cabeza, así que no mueve nada que el oído interno pueda contradecir.
 */
function vinetaOscura(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: { uIntensidad: { value: 0 }, uLado: { value: new Vector2() }, uSemilla: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vPantalla;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // Dónde cae en la pantalla de cada ojo, de -1 a 1: el borde se mide ahí y no en el plano,
        // para que sea el borde de lo que se ve sea cual sea el campo de visión.
        vPantalla = gl_Position.xy / gl_Position.w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vPantalla;
      uniform float uIntensidad;
      uniform vec2 uLado;
      void main() {
        // El marco entero, no un círculo: llega a 1 en los cuatro bordes.
        vec2 p = abs(vPantalla);
        float r = pow(pow(p.x, 4.0) + pow(p.y, 4.0), 0.25);
        // Del lado del golpe entra más, y del contrario menos.
        float hacia = dot(normalize(vPantalla + vec2(1e-5)), uLado);
        // Cuanto más fuerte, más entra; pero nunca pasa del setenta por ciento del camino al
        // borde: el centro de la vista se queda limpio.
        float frontera = mix(1.2, 0.7, uIntensidad) - 0.2 * hacia * uIntensidad;
        float sombra = smoothstep(frontera, frontera + 0.35, r);
        gl_FragColor = vec4(0.3, 0.0, 0.02, sombra * uIntensidad);
        #include <colorspace_fragment>
      }
    `,
  })
}

/** Reutilizados en cada fotograma. */
const ojos = new Vector3()
const delante = new Vector3()
const giro = new Quaternion()
const delPadre = new Quaternion()
const haciaElGolpe = new Vector3()

export const GolpeRecibido = forwardRef<GolpeRecibidoHandle, GolpeRecibidoProps>(function GolpeRecibido(
  { confort, movimientoReducido = false, filtrar, vibrar, material, children },
  ref,
) {
  const camera = useThree((state) => state.camera)
  const raiz = useRef<Group>(null)
  const sacudido = useRef<Group>(null)
  const plano = useRef<Mesh>(null)

  const delSistema = useSyncExternalStore(suscribirseAlSistema, reducidoEnElSistema, () => false)
  const reducido = movimientoReducido || delSistema

  /** Lo que el juego pide cambia entre renders; el bucle lo lee por referencia. */
  const pide = useRef({ confort, reducido, filtrar, vibrar })
  useEffect(() => {
    pide.current = { confort, reducido, filtrar, vibrar }
  }, [confort, reducido, filtrar, vibrar])

  const golpes = useRef<readonly Golpe[]>([])
  const semilla = useRef(0)
  const ultimoCorte = useRef<number>(GOLPE.filtro.abierto)
  const edadFija = useRef<number | null>(null)
  const muestras = useRef<Muestra[] | null>(null)
  const pendientes = useRef(new Set<ReturnType<typeof setTimeout>>())

  const propia = useMemo(vinetaOscura, [])
  const geometria = useMemo(() => new PlaneGeometry(PLANO.lado, PLANO.lado), [])
  const piel = material ?? propia

  useEffect(
    () => () => {
      propia.dispose()
      geometria.dispose()
    },
    [geometria, propia],
  )

  /** El reloj de los golpes: la hora de pared, o la edad clavada por una prueba. */
  const reloj = () => {
    const fija = edadFija.current
    const ultimo = golpes.current.at(-1)
    return fija !== null && ultimo !== undefined ? ultimo.inicio + fija : horaDePared()
  }

  const golpe = (fuerza: number, direccion?: Punto3 | null) => {
    const { confort: c, reducido: r, vibrar: v } = pide.current
    const capas = capasDelGolpe(fuerza, c, r)
    const hacia = unitaria(direccion)
    // Por qué lado de la vista: la dirección, del espacio del componente al de la cabeza.
    let lado = { x: 0, y: 0 }
    const grupo = raiz.current
    if (direccion != null && grupo !== null) {
      grupo.updateWorldMatrix(true, false)
      haciaElGolpe.set(hacia.x, hacia.y, hacia.z).transformDirection(grupo.matrixWorld)
      haciaElGolpe.applyQuaternion(camera.getWorldQuaternion(giro).invert())
      lado = ladoEnLaVista(haciaElGolpe)
    }
    golpes.current = sumarGolpe(golpes.current, { inicio: horaDePared(), capas, direccion: hacia, lado })
    semilla.current = (semilla.current + 2.39996) % 6.283
    // El háptico sale en el mismo fotograma que el golpe: adelantado a la vista más de veinte
    // milisegundos ya se nota como que no va con él.
    if (v !== undefined) {
      for (const pulso of pulsosDelGolpe(capas)) {
        if (pulso.retardo === 0) {
          v(pulso)
          continue
        }
        const espera = setTimeout(() => {
          pendientes.current.delete(espera)
          v(pulso)
        }, pulso.retardo)
        pendientes.current.add(espera)
      }
    }
  }

  const escalaDelReloj = () => estadoDelGolpe(golpes.current, reloj()).escala

  useImperativeHandle(ref, () => ({ golpe, escalaDelReloj }))

  // La sonda para probarlo desde fuera. Una por página: el juego monta un solo golpe.
  useEffect(() => {
    const sonda: Sonda = {
      golpe,
      medir: () => {
        muestras.current = []
      },
      muestras: () => muestras.current ?? [],
      fijarEdad: (edad) => {
        edadFija.current = edad
      },
    }
    window.__golpeRecibido = sonda
    const esperas = pendientes.current
    return () => {
      if (window.__golpeRecibido === sonda) delete window.__golpeRecibido
      for (const espera of esperas) clearTimeout(espera)
      // Al irse, el bus del juego se queda abierto: un filtro cerrado para siempre es un juego
      // que suena tapado sin que nadie sepa por qué.
      if (ultimoCorte.current !== GOLPE.filtro.abierto) pide.current.filtrar?.(GOLPE.filtro.abierto)
    }
    // La sonda se pone una vez; lo que cambia lo lee por referencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((state) => {
    const estado = estadoDelGolpe(golpes.current, reloj())
    golpes.current = estado === EN_REPOSO ? [] : estado.vivos

    // La sacudida: el decorado, nunca la cámara.
    sacudido.current?.position.set(estado.sacudida.x, estado.sacudida.y, estado.sacudida.z)

    // El filtro, solo cuando cambia: el bus no necesita que se le repita lo mismo cada fotograma.
    if (estado.corte !== ultimoCorte.current) {
      ultimoCorte.current = estado.corte
      pide.current.filtrar?.(estado.corte)
    }

    // La viñeta, delante de los ojos y con su giro, llevada al espacio del padre del plano.
    const malla = plano.current
    if (malla !== null) {
      piel.uniforms.uIntensidad.value = estado.vineta
      ;(piel.uniforms.uLado.value as Vector2).set(estado.lado.x, estado.lado.y)
      piel.uniforms.uSemilla.value = semilla.current
      // Sin golpe se encoge a nada en vez de esconderse: escondida no se compilaría con el resto
      // de la escena, y el primer golpe recompilaría su programa en el peor fotograma posible.
      malla.scale.setScalar(estado.vineta > 0 ? 1 : 0)
      if (estado.vineta > 0) {
        state.camera.getWorldPosition(ojos)
        state.camera.getWorldQuaternion(giro)
        delante.set(0, 0, -PLANO.distancia).applyQuaternion(giro).add(ojos)
        const padre = malla.parent
        if (padre !== null) {
          padre.updateWorldMatrix(true, false)
          padre.worldToLocal(delante)
          giro.premultiply(padre.getWorldQuaternion(delPadre).invert())
        }
        malla.position.copy(delante)
        malla.quaternion.copy(giro)
      }
    }

    if (muestras.current !== null) {
      const s = sacudido.current?.position
      muestras.current.push({
        camara: [...state.camera.matrixWorld.elements, ...state.camera.position.toArray(), ...state.camera.quaternion.toArray()],
        sacudida: s === undefined ? [0, 0, 0] : [s.x, s.y, s.z],
        vineta: estado.vineta,
        escala: estado.escala,
        corte: estado.corte,
      })
    }
  })

  return (
    <group ref={raiz} name="golpe-recibido">
      <group ref={sacudido} name="golpe-sacudida">
        {children}
      </group>
      <mesh
        ref={plano}
        geometry={geometria}
        material={piel}
        scale={0}
        frustumCulled={false}
        // Fuera del alcance de cualquier rayo: está delante de los ojos y se comería los clics.
        raycast={() => {}}
        renderOrder={1000}
        name="golpe-vineta"
      />
    </group>
  )
})
