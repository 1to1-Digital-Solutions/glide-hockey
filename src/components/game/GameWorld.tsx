'use client'

import { useCallback, useEffect, useRef } from 'react'
import { XRUiHeight } from '../xr/XRUiHeight'
import { useXR } from '@react-three/xr'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from '../../lib/gameConfig'
import { contarMontaje } from '../../lib/montajes'
import { useGame } from '../../lib/gameStore'
import { showsPlace } from '../../lib/ajustes'
import { HALF_LENGTH, HALF_WIDTH } from '../../lib/puckPhysics'
import { type GameSound } from '../../lib/audioEngine'
import {
  EYE_HEIGHTS,
  distanceFromEyes,
  eyesAt,
  panelRotation,
  type PanelPose,
  type Point,
} from '../../lib/panelReading'
import { REFERENCE_EYE_HEIGHT, uiRiseOverWorld, worldRise } from '../../lib/uiHeight'
import { useGameAudio } from '../../lib/useGameAudio'
import { useGameMusic } from '../../lib/useGameMusic'
import { useGameHaptics } from '../../lib/useGameHaptics'
import { useRoomEnvironment } from '../../lib/useRoomEnvironment'
import {
  XRCountdown,
  XRGameOver,
  XRQuitButton,
  XRQuitConfirm,
  XRScoreboard,
} from '../xr/XRHud'
import { XRMenu } from '../xr/XRMenu'
import { XRTutorial } from '../xr/XRTutorial'
import { XRSessionController } from '../xr/XRSessionController'
import { Rink } from './Rink'
import { Backdrop } from './Backdrop'
import { ROOM_BACKDROP, Room } from './Room'
import { Table } from './Table'
import { WorldAnchor } from './WorldAnchor'
import { XRWorldHeight } from '../xr/XRWorldHeight'

/**
 * El juego entero como OBJETOS DE THREE, sin Canvas y sin sesión propia.
 *
 * Es lo que se monta dentro del Canvas de quien lo hospeda —su propia web o el
 * salón de xrcade— y por eso aquí no hay `<Canvas>`, ni `<XR>`, ni
 * `<XROrigin>`: WebXR da una sesión por documento y esa sesión va atada al
 * Canvas que la abrió, así que quien es dueño del Canvas es dueño de la sesión.
 * Si la abriera el juego, volver al salón la cerraría, y volver a un salón que
 * es una página 2D significa quitarse el visor.
 *
 * Nada de DOM puede entrar aquí: dentro de un Canvas solo caben objetos de
 * three. El menú y el marcador en 2D se quedan en la web del juego; dentro del
 * visor sus equivalentes son `<XRMenu>` y `<XRScoreboard>`, que sí son
 * geometría, y cuelgan de la mesa para que estén donde se está mirando.
 *
 * **El jugador no se mueve del sitio donde lo puso su anfitrión.** Lo que se
 * mueve es la mesa, y una sola vez por sesión (ver `WorldAnchor`).
 */

/** Dónde va cada pieza de la interfaz inmersiva, en coordenadas de la mesa. */
export const XR_UI = {
  /** Marcador: al fondo, sobre la portería de la máquina. */
  scoreboard: [0, 0.5, -HALF_LENGTH - 0.05] as [number, number, number],
  /**
   * Menú, final de partida y aviso de salir: sobre la mitad de la mesa de quien juega, algo por
   * debajo de la vista.
   *
   * **A un metro y no a metro y medio**, que es donde se leen: allí, con el panel de 1,18 m de
   * alto y medido fila a fila, las letras del menú se quedaban entre 0,79° y 1,15°. Aquí, con
   * ellas a 34 mm, lo más justo es el nombre del decorado en la esquina de arriba, a 1,5°. Se
   * enseña sin partida o con ella parada, así que no tapa ningún disco; y su borde de abajo queda
   * tres centímetros por encima del tablero. Lo miden los `*.legible.test.ts`.
   */
  panel: [0, 0.62, 0.2] as [number, number, number],
  /** Cuenta atrás: flotando sobre el punto de saque. */
  countdown: [0, 0.34, 0] as [number, number, number],
  /**
   * La demostración de cómo se coge el mazo: sobre el sitio del menú y algo más arriba,
   * que es donde se está mirando al empezar, y por encima del pasillo por el que va el
   * disco.
   *
   * A 1,2 m y a la altura de la vista: a metro y medio su contador se quedaba en 1°. Su borde de
   * abajo sigue por encima de la vista del fondo de la mesa (`tutorial.legible.test.ts`).
   */
  tutorial: [0, 0.72, 0] as [number, number, number],
  /**
   * Dejar la partida: **fuera de la mesa, arriba y a la izquierda**.
   *
   * Estaba a 26 cm sobre el tablero y sobre el lado derecho, que es justo por donde pasa
   * el brazo: tapaba el juego y se pulsaba sin querer. Sacarlo del rectángulo de la mesa
   * y subirlo a la altura del pecho lo deja donde se busca cuando se busca, y en ningún
   * otro momento. La izquierda es a propósito: es la mano con la que menos se juega.
   */
  quit: [-HALF_WIDTH - 0.22, 0.72, HALF_LENGTH * 0.7] as [number, number, number],
}

/**
 * Dónde queda una pieza de la interfaz en el espacio de quien juega —los pies en el origen y el
 * `−Z` delante—: la mesa se planta a `TABLE_CENTER_Z` de él y a `TABLE_HEIGHT` del suelo.
 */
export function delEspacioDelJugador(pieza: readonly [number, number, number]): [number, number, number] {
  return [pieza[0], pieza[1] + TABLE_HEIGHT, pieza[2] + TABLE_CENTER_Z]
}

/** A cuántos metros de los ojos de quien juega queda el centro de una pieza, contando la altura. */
export function distanciaDelJugador(pieza: readonly [number, number, number]): number {
  return distanceFromEyes(delEspacioDelJugador(pieza), eyesAt(REFERENCE_EYE_HEIGHT))
}

/**
 * El giro de los paneles con letras: de cara a los ojos de quien juega e inclinados hacia ellos.
 *
 * Inclinados a ojo, la fila más lejana se lee escorzada. La interfaz sube y baja con los ojos
 * (`XRUiHeight`), así que el giro se calcula una vez para los de referencia.
 */
export const XR_UI_ROTATION = {
  panel: panelRotation(delEspacioDelJugador(XR_UI.panel), eyesAt(REFERENCE_EYE_HEIGHT)),
  tutorial: panelRotation(delEspacioDelJugador(XR_UI.tutorial), eyesAt(REFERENCE_EYE_HEIGHT)),
}

/**
 * Desde dónde se lee un panel: con los ojos a cada altura de `EYE_HEIGHTS` y con la altura de
 * juego del salón de pie o a la de los ojos.
 *
 * El panel se mide donde queda de verdad: sube lo que baja o sube el mundo (`XRWorldHeight`) más
 * lo que sube la interfaz sobre él (`XRUiHeight`). Es lo que usan los `*.legible.test.ts`.
 */
export function vistasDelPanel(
  pieza: readonly [number, number, number],
  rotation: PanelPose['rotation'],
): { donde: string; pose: PanelPose; ojos: Point }[] {
  const [x, y, z] = delEspacioDelJugador(pieza)
  return EYE_HEIGHTS.flatMap((ojos) =>
    [false, true].map((aLaAlturaDeLosOjos) => ({
      donde: `ojos a ${ojos} m${aLaAlturaDeLosOjos ? ', mundo a su altura' : ''}`,
      pose: {
        position: [x, y + worldRise(ojos, aLaAlturaDeLosOjos) + uiRiseOverWorld(ojos, aLaAlturaDeLosOjos), z] as const,
        rotation,
      },
      ojos: eyesAt(ojos),
    })),
  )
}

export interface GameWorldProps {
  /**
   * Quien monta la escena pone además interfaz en DOM alrededor. Entonces los
   * paneles de dentro de la escena solo hacen falta con el visor puesto: sus
   * botones cazarían los clics del ratón por delante de la mesa, porque los
   * punteros miran si hay manejadores y no si se ve algo.
   *
   * Montado en el salón de xrcade no hay nada de eso —el hub no pone DOM—, así
   * que los paneles van siempre. Sin esto, el juego se veía en el hub y no
   * había forma de empezar la partida.
   */
  hasDomUi?: boolean
}

export function GameWorld({ hasDomUi = false }: GameWorldProps) {
  // Cuántas veces se monta el mundo, cuando alguien lo está contando (`lib/montajes.ts`).
  // Montarlo dos veces al entrar en la sesión **es** el parpadeo que se reporta del visor.
  useEffect(() => {
    contarMontaje('mundo')
  }, [])

  const {
    gameState,
    runId,
    scenery,
    isRecord,
    totalPlayerGoals,
    totalOpponentGoals,
  } = useGame()
  const mode = useXR((state) => state.mode)

  // El sonido cuelga de la escena y no de la mesa: la mesa se estrena en cada
  // partida y en cada ronda del reto, y con el audio dentro, la ronda ganada se
  // llevaba por delante el gol que la ganaba —el contexto se cerraba mientras
  // sonaba— y estrenaba otro contexto por ronda (ver `lib/useGameAudio.ts`).
  const { play, slide } = useGameAudio()
  useGameMusic()
  const haptics = useGameHaptics()
  // Cada suceso de la mesa suena y se siente a la vez: el sonido obedece al
  // silencio y la vibración no, que con el juego callado es lo único que dice
  // sin mirar qué ha pasado.
  const feedback = useCallback(
    (sound: GameSound, strength?: number) => {
      play(sound, strength)
      haptics.pulse(sound, strength)
    },
    [play, haptics],
  )
  // El final del partido. Antes era silencio: se metía el último gol, sonaba como cualquier
  // otro y la pantalla de fin llegaba sin avisar. Con el visor puesto es peor todavía,
  // porque el marcador está donde uno no siempre está mirando. La marca batida va **encima**
  // del cierre y no en su lugar: se puede batir ganando o perdiendo, y hay que oír las dos.
  const terminado = useRef(false)
  useEffect(() => {
    if (gameState !== 'finished') {
      terminado.current = false
      return
    }
    if (terminado.current) return
    terminado.current = true
    feedback(totalPlayerGoals > totalOpponentGoals ? 'win' : 'loss')
    if (isRecord) feedback('record')
  }, [gameState, feedback, isRecord, totalPlayerGoals, totalOpponentGoals])

  // Los reflejos de la mesa y del disco, calculados una vez (ver el hook).
  const environment = useRoomEnvironment()
  // Qué se pinta alrededor lo dice el escenario del arcade (`xrcade:scenery`) y
  // no el tipo de sesión: el salón entra siempre en realidad aumentada si el
  // visor la tiene, así que el tipo no dice qué se eligió. El modo solo hace de
  // guarda —fuera de `immersive-ar` no hay habitación que enseñar y la sala se
  // pinta igual— y cambiarlo se ve en el fotograma siguiente, sin salirse.
  const passthrough = !showsPlace(mode, scenery)
  const immersive = mode != null
  /** Si toca dibujar los paneles de dentro de la escena. */
  const showPanels = !hasDomUi || immersive

  // TODO EL MUNDO cuelga de `XRWorldHeight`, que lo baja hasta quien juega si
  // lo ha pedido en los ajustes del arcade. Envuelve la escena entera, luces
  // incluidas: mover solo el objetivo lo dejaría flotando sobre su decorado.
  return (
    <XRWorldHeight>
      {/* Arranca y cierra partidas según el estado de la sesión inmersiva. */}
      <XRSessionController />

      {/* Luz de sala: una cenital que hace de foco sobre la mesa y un relleno
          que evita que las sombras salgan negras. */}
      <hemisphereLight args={['#cfe4ff', '#0a1220', 1.1]} />
      <directionalLight
        position={[1.6, 4, 1.2]}
        intensity={2}
        color="#ffffff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-far={14}
      />

      <WorldAnchor>
        {/* El sitio, y **el fondo del sitio**. El color va aquí y no en el
            `<Canvas>` por dos razones: en passthrough no puede haber ninguno —un
            fondo opaco tapa la habitación de verdad— y montado en el salón el
            hub retira el suyo al entrar en la cabina, así que si el juego no
            trae el fondo, no lo trae nadie. Sin él, mirar por encima de las
            paredes enseña el negro del compositor. */}
        {/* El fondo sí se monta y se desmonta: es el color con el que se limpia la imagen, no
            un material, y no compila nada. */}
        {!passthrough ? <Backdrop color={ROOM_BACKDROP} /> : null}
        {/* La sala se **oculta** en tu habitación, no se desmonta. Desmontarla libera sus
            materiales, y los shaders que solo usaba ella se vuelven a compilar al volver: un
            tirón a cada cambio de escenario, con el visor puesto. Oculta no se pinta ni da
            sombra, y se le niegan los punteros, que no miran si algo se ve. */}
        <group visible={!passthrough} pointerEvents={passthrough ? 'none' : undefined}>
          <Room />
        </group>

        <group position={[0, TABLE_HEIGHT, TABLE_CENTER_Z]}>
          <Table environment={environment} />
          {/* El disco y los mazos solo durante la partida: en el menú la mesa
              se ve vacía, que es lo que hace que empezar se note. `key` la
              estrena en cada partida y en cada ronda del reto. */}
          {gameState !== 'menu' ? (
            <Rink
              key={runId}
              play={feedback}
              // El roce del disco no vibra: es un fondo continuo, y un mando
              // zumbando toda la partida cansa la mano. Va solo al audio.
              slide={slide}
              onAim={haptics.noteAim}
              environment={environment}
            />
          ) : null}

          {/* La interfaz de dentro de la escena no se monta cuando el anfitrión
              pone la suya en DOM y no hay visor. No es solo que sobre: los
              punteros miran si hay manejadores y no si se ve algo, así que sus
              botones cazarían clics del ratón por delante de la mesa. Montado
              en el salón —que no pone DOM— va siempre, o el juego se queda sin
              forma de empezar la partida. */}
          {/* A la altura de los ojos de quien juega: las cotas se midieron con una
              persona delante y esa persona se quedó dentro del código (ver `XRUiHeight`). */}
          {showPanels ? (
            <XRUiHeight>
              <group position={XR_UI.scoreboard} rotation={[-0.18, 0, 0]}>
                <XRScoreboard />
              </group>
              <group position={XR_UI.panel} rotation={XR_UI_ROTATION.panel}>
                <XRMenu />
                <XRGameOver />
                <XRQuitConfirm />
              </group>
              <group position={XR_UI.countdown}>
                <XRCountdown />
              </group>
              {/* La demostración va **donde estaba el menú**: quien la ve acaba de pulsar «empezar» y
                  está mirando ahí. Se le pasa el sitio en vez de dejar que se coloque sola —el valor
                  con el que nació es el de darts, y sumado a este grupo la dejaba a tres metros del
                  suelo, girada, metro y medio por encima del menú del que venía—. */}
              <XRTutorial position={XR_UI.tutorial} rotation={XR_UI_ROTATION.tutorial} />
              <group position={XR_UI.quit} rotation={[-0.3, 0, 0]}>
                <XRQuitButton />
              </group>
            </XRUiHeight>
          ) : null}
        </group>
      </WorldAnchor>
    </XRWorldHeight>
  )
}
