'use client'

import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useMemo, useRef, useState } from 'react'
import { Group, Mesh, MeshBasicMaterial } from 'three'

import {
  HINT_MARK_COLOR,
  THROB,
  moveToward,
  advanceHints,
  throb,
  sweepPhase,
  noHints,
} from '../../lib/hints'
import type { Hand } from '../../lib/settings'
import { useHand } from '../../lib/settingsClient'
import { MALLET_RADIUS, TABLE_CENTER_Z, TABLE_HEIGHT } from '../../lib/gameConfig'
import { useGame } from '../../lib/gameStore'
import {
  CALCO_Y,
  EMPUJE,
  GUION_DE_AYUDAS,
  HUELLA,
  HUELLAS,
  HUELLAS_Y,
  MARCA_DE_PORTERIA,
  mazoFantasmaEn,
  mandoJuntoAlMazo,
  MANDO_JUNTO_AL_MAZO,
  type AyudaDelMazo,
  type HechoDeLasAyudas,
} from '../../lib/guionDeAyudas'
import { RealController } from '../xr/RealController'
import { NO_RAYCAST } from '../raycast'

/**
 * Las ayudas visuales: lo que hay que hacer, enseñado sin una sola letra.
 *
 * **Por qué existe.** El tutorial explica el juego y se queda como red de seguridad, pero lo
 * primero que hace alguien al entrar no es leer: es mirar alrededor. Si mirando alrededor no se
 * ve dónde ponerse, qué coger ni qué hacer con ello, el juego empieza con una pregunta — y lo
 * que se lee después ya llega tarde. Aquí están las respuestas, dibujadas: las huellas del
 * suelo, el mazo fantasma empujando hacia el disco, la marca de la portería contraria y el
 * mando de verdad con el botón de agarre encendido.
 *
 * **Y ninguna se queda puesta.** Cada una se apaga sola en cuanto el gesto se hace una vez, o
 * al agotarse su plazo; lo decide `lib/guionDeAyudas.ts` sobre el motor de `lib/ayudas.ts`, los
 * dos probados sin navegador. Aquí solo se pinta.
 *
 * **Todo se monta de una vez y no se desmonta nunca**, aunque no se vea. Montar una malla nueva
 * a mitad de partida obliga a three a compilar su material, y compilar un shader bloquea el
 * hilo: con el visor puesto eso es un tirón, y justo en el momento en que la ayuda quiere que
 * se mire. Montado desde el principio lo compila `Calentar` con todo lo demás. Lo que se
 * enciende y se apaga es `visible` y la opacidad — y una ayuda apagada es invisible, así que
 * tampoco cuesta una llamada de dibujo.
 *
 * **Los hitos no se escuchan, se deducen.** El mazo ya apunta cuándo se coge y la mesa cuándo
 * se golpea y cuándo se marca (`lib/gameStore.ts`), que es de donde bebe también el tutorial.
 * Así esta ayuda no se entera de nada ni le para el juego a nadie.
 *
 * **Solo dentro del visor.** Fuera de la sesión se juega con el ratón sobre una pantalla, y ahí
 * la web lo cuenta con letras, que se leen antes de empezar y sin tener las manos ocupadas.
 */

/** Lo transparente que llega a ponerse cada ayuda encendida del todo. */
const OPACIDAD = { suelo: 0.75, gesto: 0.7, porteria: 0.72 } as const

/**
 * Lo pintado sobre una superficie se separa sesgando la profundidad al rasterizar y no
 * levantándolo un milímetro: el milímetro basta en el navegador y no basta con el visor puesto.
 */
const CALCO = {
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4,
} as const

/** Lo que llevan todos los materiales de una ayuda: ámbar, translúcido y sin tono. */
const PINTURA = {
  color: HINT_MARK_COLOR,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  toneMapped: false,
} as const

/**
 * Lo que mide el mazo fantasma.
 *
 * El aro va al radio del mazo de verdad, que es lo que hace que se lea como «este de aquí» y no
 * como una mancha: puesto más gordo enseñaría un mazo que no existe. El mango es un apunte, lo
 * justo para que el aro no se lea como un agujero en la mesa.
 */
const FANTASMA = { grosor: 0.008, mango: { radio: 0.02, alto: 0.05 } } as const

/** Dónde va el mando de la ayuda: solo depende de la mano, así que se calcula una vez por mano. */
function juntoAlMazo(mano: Hand) {
  const { posicion, giro } = mandoJuntoAlMazo(mano)
  return {
    position: [posicion.x, posicion.y, posicion.z] as const,
    rotation: [0, giro, 0] as const,
    escala: MANDO_JUNTO_AL_MAZO.escala,
  }
}

/** ¿Ha pedido quien juega que las cosas no se muevan solas? */
function sinMovimiento(): boolean {
  if (typeof window === 'undefined' || window.matchMedia == null) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Ayudas() {
  const enSesion = useXR((state) => state.mode != null)
  const { gameState, hitos } = useGame()

  const [quieto] = useState(sinMovimiento)
  /** La mano buena del salón: su mando es el que se enseña, y de su lado del mazo. */
  const mano = useHand()
  const junto = useMemo(() => juntoAlMazo(mano), [mano])

  /** El reloj de cada ayuda y cuáles se enseñan, sin pasar por el estado de React. */
  const estado = useRef(noHints())
  /**
   * Lo que el guion da por hecho. Se **muta** el mismo objeto en cada fotograma en vez de armar
   * uno nuevo: noventa objetos por segundo son noventa objetos que recoger, y esto no sale de
   * aquí.
   */
  const hechos = useRef<Record<HechoDeLasAyudas, boolean>>({
    tanda: false,
    grab: false,
    hit: false,
    goal: false,
  })
  /** Lo que se ve de cada una ahora mismo, de 0 a 1. */
  const fuerza = useRef<Record<AyudaDelMazo, number>>({
    suelo: 0,
    mando: 0,
    gesto: 0,
    porteria: 0,
  })

  const huellas = useRef<(Mesh | null)[]>([])
  const fantasma = useRef<Group>(null)
  const pinturaDelFantasma = useRef<(MeshBasicMaterial | null)[]>([])
  const porteria = useRef<Mesh>(null)
  const mando = useRef<Group>(null)

  useFrame(({ clock }, delta) => {
    // Desde que se entra en la cabina, que es cuando ya se puede uno colocar; lo que necesita
    // mazo o disco lo espera el propio guion con `tanda`.
    const dando = enSesion
    hechos.current.tanda = gameState !== 'menu'
    hechos.current.grab = hitos.grab
    hechos.current.hit = hitos.hit
    hechos.current.goal = hitos.goal
    const paso = advanceHints(GUION_DE_AYUDAS, hechos.current, estado.current, dando ? delta : 0)
    const reloj = clock.elapsedTime
    const pulso = quieto ? 1 : throb(reloj, THROB.strength)

    for (const ayuda of GUION_DE_AYUDAS) {
      const quiere = dando && paso.lit.has(ayuda.id) ? 1 : 0
      fuerza.current[ayuda.id] = moveToward(fuerza.current[ayuda.id], quiere, delta)
    }

    // Las huellas del suelo, latiendo: es lo que las separa de una mancha de la moqueta.
    const enElSuelo = fuerza.current.suelo
    for (const pieza of huellas.current) {
      if (pieza == null) continue
      pieza.visible = enElSuelo > 0.004
      ;(pieza.material as MeshBasicMaterial).opacity = enElSuelo * OPACIDAD.suelo * pulso
    }

    // El mazo fantasma, dando su empujón: se recoge despacio y empuja deprisa hasta tocar el
    // disco. Quieto en su sitio si se ha pedido que nada se mueva solo.
    const conGesto = fuerza.current.gesto
    const grupo = fantasma.current
    if (grupo != null) {
      grupo.visible = conGesto > 0.004
      const avance = quieto ? 0 : sweepPhase(reloj, EMPUJE.periodo).progress
      const donde = mazoFantasmaEn(avance)
      grupo.position.set(donde.x, 0, donde.z)
    }
    for (const material of pinturaDelFantasma.current) {
      if (material != null) material.opacity = conGesto * OPACIDAD.gesto * pulso
    }

    // La marca de la portería contraria. **No late**: se queda puesta mientras se juega —va
    // calcada en el fondo, donde no puede tapar nada—, y algo que palpita mientras el disco
    // cruza la mesa roba la mirada justo cuando hace falta en otro sitio.
    const enLaPorteria = fuerza.current.porteria
    if (porteria.current != null) {
      porteria.current.visible = enLaPorteria > 0.004
      ;(porteria.current.material as MeshBasicMaterial).opacity = enLaPorteria * OPACIDAD.porteria
    }

    // El mando de verdad. Se apaga escondiendo el grupo y no desmontándolo: desmontarlo libera
    // los materiales del modelo y volver a enseñarlo los recompilaría.
    if (mando.current != null) mando.current.visible = fuerza.current.mando > 0.004
  })

  return (
    <group name="ayudas">
      {/* Las huellas, en el suelo y a los pies de quien entra: ahí es donde el anclaje lo deja.
          A la par y de frente, que es la postura del air hockey. */}
      {HUELLAS.map((huella, indice) => (
        <mesh
          key={indice}
          ref={(pieza) => {
            huellas.current[indice] = pieza
          }}
          visible={false}
          raycast={NO_RAYCAST}
          position={[huella.x, HUELLAS_Y, huella.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          // Una huella es un óvalo: el círculo de doce lados estirado a lo largo del pie.
          scale={[HUELLA.ancho / 2, HUELLA.largo / 2, 1]}
        >
          <circleGeometry args={[1, 12]} />
          <meshBasicMaterial {...PINTURA} {...CALCO} />
        </mesh>
      ))}

      {/* Lo que va sobre la mesa, en sus coordenadas: el mismo sitio en el que se plantan el
          tablero y la partida (`GameWorld`), para que estas cotas sean las de `guionDeAyudas`
          y no una traducción suya. */}
      <group position={[0, TABLE_HEIGHT, TABLE_CENTER_Z]}>
        {/* El mazo fantasma. El grupo se planta donde estaría el mazo, y el empujón lo lleva
            de un lado a otro de la mitad del jugador. */}
        <group ref={fantasma} visible={false}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, CALCO_Y, 0]} raycast={NO_RAYCAST}>
            <torusGeometry args={[MALLET_RADIUS, FANTASMA.grosor, 8, 24]} />
            <meshBasicMaterial
              ref={(material) => {
                pinturaDelFantasma.current[0] = material
              }}
              {...PINTURA}
            />
          </mesh>
          {/* El mango, apuntado: sin él el aro se lee como un agujero en la mesa y no como
              algo que se coge. */}
          <mesh position={[0, FANTASMA.mango.alto / 2, 0]} raycast={NO_RAYCAST}>
            <cylinderGeometry
              args={[FANTASMA.mango.radio, FANTASMA.mango.radio, FANTASMA.mango.alto, 10]}
            />
            <meshBasicMaterial
              ref={(material) => {
                pinturaDelFantasma.current[1] = material
              }}
              {...PINTURA}
            />
          </mesh>
        </group>

        {/* La marca de la portería contraria, calcada en el fondo: adónde va lo que se golpea.
            Pintada y no levantada, que por ahí pasa el disco. */}
        <mesh
          ref={porteria}
          visible={false}
          raycast={NO_RAYCAST}
          position={[0, CALCO_Y, MARCA_DE_PORTERIA.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[MARCA_DE_PORTERIA.ancho, MARCA_DE_PORTERIA.fondo]} />
          <meshBasicMaterial {...PINTURA} {...CALCO} />
        </mesh>
      </group>

      {/* El mando de verdad con el botón de agarre latiendo, **al lado del mazo fantasma** y no
          sobre la mano: la mano la ocupa la copia del tutorial, y dos copias del mismo modelo en
          el mismo sitio se pisan. Así sale desde la primera vez. Dentro de un grupo propio para
          apagarlo sin desmontarlo, y en las coordenadas de la mesa (`mandoJuntoAlMazo`). */}
      <group ref={mando} visible={false} position={[0, TABLE_HEIGHT, TABLE_CENTER_Z]}>
        <RealController hand={mano} button="agarre" beside={junto} />
      </group>
    </group>
  )
}
