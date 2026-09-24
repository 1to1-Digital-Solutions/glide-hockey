'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useGetXRSpaceMatrix,
  useXRInputSourceState,
  type XRControllerState,
} from '@react-three/xr'
import { Box3, Group, Matrix4, Mesh, Object3D, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { COMPONENTE_DEL_BOTON, type BotonDelMando } from '../../lib/tutorial'
import { NO_RAYCAST } from '../raycast'

/**
 * El mando de verdad, a tamaño real y encima del que se tiene en la mano.
 *
 * **Qué problema resuelve.** El tutorial pide «mantén el botón de agarre» y dibuja un mando a
 * trazos en el panel (`mandoDibujado.ts`). Eso ya es mejor que la frase sola, pero sigue
 * habiendo que traducir de un dibujo plano a lo que se tiene en la mano, que con el visor
 * puesto no se ve: el mando no se dibuja (`xrStore.ts`, `model: false`). Esto quita la
 * traducción: **el botón se enciende donde de verdad está**, sobre el propio mando, a su
 * tamaño y en su sitio. Se probó antes a meter el modelo dentro del panel y no sirve —a un
 * metro y en 7 cm de alto es un borrón blanco—; puesto en la mano se mira y ya está.
 *
 * **Solo mientras el paso lo pide.** Se monta durante el paso que nombra un botón y se va con
 * él. Un mando pintado encima del mando todo el rato estorbaría justo a lo que el juego va:
 * mirarse las manos.
 *
 * **Y es un añadido, no un requisito.** El `.glb` solo se copia para los mandos de Quest
 * (`scripts/sync-xr-profiles.mjs`). Con cualquier otro —o sin red, o si el fichero falla— no
 * pasa nada: no se monta y queda el dibujo del panel, que es lo que había.
 *
 * **Dónde se cuelga da igual.** El sitio del mando lo da WebXR en el espacio del origen, así
 * que el grupo se coloca deshaciendo lo que le hayan hecho sus padres —el anclaje del mundo,
 * la altura de juego—. Colgado tal cual dentro del anclaje, el mando aparecería girado y
 * desplazado respecto a la mano, que es el único sitio donde no puede estar.
 *
 * **O junto al gesto** (`junto`). Las ayudas visuales enseñan el objeto fantasma —la bola que
 * hay que coger— y eso dice *qué* coger, pero no *con qué botón*. Con `junto`, el mando no va
 * sobre la mano sino **al lado del fantasma**, en las coordenadas del padre y a la escala que se
 * pida, con el botón latiendo. Así no se pinta encima de la copia que pone el tutorial en la
 * mano —dos copias del mismo `.glb` en el mismo sitio se pisan— y la ayuda puede enseñarlo
 * desde la primera vez. El modelo sigue siendo el del mando que se tiene en esa mano.
 */

/** Uno para todo el juego: el `.glb` se pide una vez por sesión y como mucho. */
const cargador = new GLTFLoader()

/** Dónde está un botón dentro del modelo y cómo de grande es, en metros. */
interface SitioDelBoton {
  centro: Vector3
  radio: number
}

/** El modelo ya listo para pintar, con el sitio del botón que toca encender. */
interface ModeloDelMando {
  /** El mando entero, tal y como viene del `.glb`. */
  raiz: Object3D
  /** Dónde cae el botón dentro del modelo, o `null` si ese mando no lo tiene. */
  boton: SitioDelBoton | null
}

/**
 * Cómo se llama en el `.glb` la pieza que se mueve al apretar ese botón.
 *
 * Se pregunta por `visualResponses` y **no por `rootNodeName`**, que es lo que parece: en los
 * mandos de Quest ese nombre no existe en el modelo y la búsqueda devuelve nada. El nodo que
 * sí está es el que el perfil anima entre su posición suelta y su posición apretada, y está
 * justo donde está el botón, que es lo único que hace falta aquí.
 */
export function nodoDelBoton(
  layout: XRControllerState['layout'],
  componente: string,
): string | null {
  const pieza = layout.components[componente]
  if (pieza == null) return null
  const [respuesta] = Object.values(pieza.visualResponses)
  return respuesta?.valueNodeName ?? null
}

/**
 * Dónde está esa pieza dentro del modelo, y cuánto abulta.
 *
 * **Se mide la geometría, no el nodo.** El nodo que nombra el perfil es el *pivote* del
 * botón —el eje sobre el que gira al apretarlo—, y en los mandos de Quest está a dos
 * centímetros y medio por delante del botón, arriba, junto al joystick: marcar ahí señalaba
 * a otra cosa. La caja de lo que cuelga de él sí cae donde está el botón, y de paso dice
 * cómo de grande tiene que ser la marca para que lo cubra sin taparle medio mando.
 */
export function sitioDelNodo(raiz: Object3D, nombre: string): SitioDelBoton | null {
  const pieza = raiz.getObjectByName(nombre)
  if (pieza == null) return null
  raiz.updateWorldMatrix(true, true)
  const caja = new Box3().setFromObject(pieza)
  if (caja.isEmpty()) return null
  const centro = caja.getCenter(new Vector3())
  const medidas = caja.getSize(new Vector3())
  centro.applyMatrix4(new Matrix4().copy(raiz.matrixWorld).invert())
  return { centro, radio: Math.max(medidas.x, medidas.y, medidas.z) * 0.6 }
}

/** Lo último que se cargó, y para qué mando y qué botón se pidió. */
interface LoCargado {
  ruta: string
  nodo: string | null
  modelo: ModeloDelMando
}

/**
 * Carga el modelo del mando, o `null` mientras no lo haya.
 *
 * **Cargado a mano y no con `useLoadXRControllerModel`** —que también existe— porque ese
 * suspende, y un `.glb` que no está (otro mando, otro visor) sale por el camino del error: ahí
 * lo que hace falta es no montar nada, no una pantalla de fallo encima del tutorial.
 *
 * Lo cargado se guarda **con la petición que lo trajo**, y se devuelve solo si sigue siendo la
 * que se pide. Así cambiar de mano o de paso no enseña un fotograma del modelo anterior y no
 * hace falta borrarlo a mano al empezar.
 */
function useModeloDelMando(ruta: string | null, nodo: string | null): ModeloDelMando | null {
  const [cargado, setCargado] = useState<LoCargado | null>(null)

  useEffect(() => {
    if (ruta == null) return
    let vivo = true
    cargador
      .loadAsync(ruta)
      .then((gltf) => {
        if (!vivo) return
        const raiz = gltf.scene
        // **Invisible al rayo, entero.** El puntero nace en esta misma mano: una malla que
        // conteste al rayo aquí se lo come en el primer centímetro y deja sin poder apuntar
        // a nada. `raycast` se pone pieza a pieza porque ponerlo en la raíz no baja.
        raiz.traverse((parte) => {
          parte.raycast = NO_RAYCAST
        })
        const boton = nodo == null ? null : sitioDelNodo(raiz, nodo)
        setCargado({ ruta, nodo, modelo: { raiz, boton } })
      })
      // Desenlace previsto, no un fallo: este visor trae un mando del que no se copió el
      // modelo. Sin nada que enseñar, el dibujo del panel sigue diciendo cuál es el botón.
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [ruta, nodo])

  if (cargado == null || cargado.ruta !== ruta || cargado.nodo !== nodo) return null
  return cargado.modelo
}

/** Se reaprovechan en cada fotograma: una matriz nueva por frame es basura que recoger. */
const EN_EL_ORIGEN = new Matrix4()
const DESDE_EL_PADRE = new Matrix4()

/** Dónde plantar el mando cuando va junto al gesto, en las coordenadas del padre. */
export interface JuntoAlGesto {
  readonly position: readonly [number, number, number]
  /** Euler XYZ en radianes. Lo que conviene: el botón de cara a quien mira. */
  readonly rotation?: readonly [number, number, number]
  /** El mando mide unos 12 cm; a más de un metro se agradece crecerlo. */
  readonly escala?: number
}

export function MandoDeVerdad({
  mano,
  boton,
  junto,
}: {
  /** De qué mano es el mando que hay que enseñar. */
  mano: XRHandedness
  /** Qué botón se enciende, o `null` para no encender ninguno. */
  boton: BotonDelMando | null
  /** Si se da, el mando va aquí y no sobre la mano (ver arriba). */
  junto?: JuntoAlGesto
}) {
  const mando = useXRInputSourceState('controller', mano)
  const grupo = useRef<Group>(null)

  const nodo = useMemo(() => {
    if (mando == null || boton == null) return null
    return nodoDelBoton(mando.layout, COMPONENTE_DEL_BOTON[boton])
  }, [mando, boton])
  const modelo = useModeloDelMando(mando?.layout.assetPath ?? null, nodo)

  // El puño, no el rayo: el modelo está dibujado en el espacio del puño, que es de donde
  // cuelga el mando de verdad.
  const situar = useGetXRSpaceMatrix(mando?.inputSource.gripSpace)

  // Antes que nadie (prioridad negativa, como la propia librería), para que el mando ya esté
  // puesto cuando se pinte el fotograma. Negativa no le quita a R3F el pintado: solo ordena.
  useFrame((_estado, _delta, frame) => {
    const nodo3d = grupo.current
    if (nodo3d == null || junto != null) return
    const puesto = situar?.(EN_EL_ORIGEN, frame) ?? false
    nodo3d.visible = puesto
    if (!puesto) return

    // `EN_EL_ORIGEN` está en el espacio que pone el anfitrión (su `<XROrigin>`, en el cero de
    // la escena). Lo que este grupo necesita es su matriz **local**, así que se le quita lo
    // que pongan sus padres: así vale colgado donde sea, también dentro del anclaje del mundo.
    const padre = nodo3d.parent
    if (padre == null) return
    padre.updateWorldMatrix(true, false)
    nodo3d.matrix.multiplyMatrices(
      DESDE_EL_PADRE.copy(padre.matrixWorld).invert(),
      EN_EL_ORIGEN,
    )
  }, -100)

  if (modelo == null) return null

  if (junto != null) {
    return (
      <group
        position={junto.position as [number, number, number]}
        rotation={(junto.rotation ?? [0, 0, 0]) as [number, number, number]}
        scale={junto.escala ?? 1}
      >
        <primitive object={modelo.raiz} />
        {modelo.boton != null ? <BotonEncendido boton={modelo.boton} /> : null}
      </group>
    )
  }

  return (
    <group ref={grupo} matrixAutoUpdate={false}>
      <primitive object={modelo.raiz} />
      {modelo.boton != null ? <BotonEncendido boton={modelo.boton} /> : null}
    </group>
  )
}

/**
 * De qué color se enciende el botón.
 *
 * Escrito aquí y no sacado de la paleta del juego a propósito: lo que hay debajo no es el
 * decorado del juego, es un mando de plástico blanco con una tapa negra, y la marca tiene que
 * separarse de los dos. Un ámbar encendido lo hace en ambos; el color del juego, en la mitad
 * de ellos, no.
 */
const COLOR_DE_LA_MARCA = '#ffc233'

/** Cuánto y cómo de rápido late, para que se vea que es la marca y no una pieza más. */
const LATIDO = { fuerza: 0.18, velocidad: 5 }

/**
 * La marca sobre el botón que toca.
 *
 * **Se pinta por delante de todo** (`depthTest={false}`): el punto que el perfil anima está
 * dentro de la carcasa, y sin esto la marca quedaría enterrada en el plástico justo cuando
 * hace falta verla.
 */
function BotonEncendido({ boton }: { boton: SitioDelBoton }) {
  const halo = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    const node = halo.current
    if (node == null) return
    node.scale.setScalar(1 + LATIDO.fuerza * Math.sin(clock.elapsedTime * LATIDO.velocidad))
  })

  return (
    <group position={boton.centro}>
      <mesh raycast={NO_RAYCAST} renderOrder={11}>
        <sphereGeometry args={[boton.radio * 0.45, 12, 12]} />
        <meshBasicMaterial color={COLOR_DE_LA_MARCA} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh ref={halo} raycast={NO_RAYCAST} renderOrder={10}>
        <sphereGeometry args={[boton.radio, 16, 16]} />
        <meshBasicMaterial
          color={COLOR_DE_LA_MARCA}
          transparent
          opacity={0.35}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
