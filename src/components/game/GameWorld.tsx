'use client'

import { useCallback, useEffect, useRef } from 'react'
import { XRUiHeight } from '../xr/XRUiHeight'
import { useXR } from '@react-three/xr'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from '../../lib/gameConfig'
import { useGame } from '../../lib/gameStore'
import { showsPlace } from '../../lib/scenery'
import { HALF_LENGTH, HALF_WIDTH } from '../../lib/puckPhysics'
import { type GameSound } from '../../lib/audioEngine'
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
const XR_UI = {
  /** Marcador: al fondo, sobre la portería de la máquina. */
  scoreboard: [0, 0.5, -HALF_LENGTH - 0.05] as [number, number, number],
  /** Menú y final de partida: en medio de la mesa, a la altura de la vista. */
  panel: [0, 0.52, -0.25] as [number, number, number],
  /** Cuenta atrás: flotando sobre el punto de saque. */
  countdown: [0, 0.34, 0] as [number, number, number],
  /**
   * La demostración de cómo se coge el mazo: sobre el sitio del menú y algo más arriba,
   * que es donde se está mirando al empezar, y por encima del pasillo por el que va el
   * disco.
   */
  tutorial: [0, 0.66, -0.35] as [number, number, number],
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
  // Qué se pinta alrededor lo elige quien juega y no el modo de sesión: dentro
  // de una sesión de realidad aumentada las dos son la misma sesión pintada de
  // dos formas, así que se puede cambiar sin salirse, que con el visor puesto
  // es lo que importa. Fuera de ella no hay habitación que enseñar y la sala se
  // pinta igual.
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
        {!passthrough ? (
          <>
            <Backdrop color={ROOM_BACKDROP} />
            <Room />
          </>
        ) : null}

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
              <group position={XR_UI.panel} rotation={[-0.2, 0, 0]}>
                <XRMenu />
                <XRGameOver />
                <XRQuitConfirm />
              </group>
              <group position={XR_UI.countdown}>
                <XRCountdown />
              </group>
              <group position={XR_UI.tutorial} rotation={[-0.2, 0, 0]}>
                <XRTutorial />
              </group>
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
