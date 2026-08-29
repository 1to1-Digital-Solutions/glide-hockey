'use client'

import { useXR } from '@react-three/xr'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from '../../lib/gameConfig'
import { useGame } from '../../lib/gameStore'
import { HALF_LENGTH } from '../../lib/puckPhysics'
import { useGameAudio } from '../../lib/useGameAudio'
import {
  XRCountdown,
  XRGameOver,
  XRQuitButton,
  XRScoreboard,
} from '../xr/XRHud'
import { XRMenu } from '../xr/XRMenu'
import { XRSessionController } from '../xr/XRSessionController'
import { Rink } from './Rink'
import { Room } from './Room'
import { Table } from './Table'
import { WorldAnchor } from './WorldAnchor'

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
  /** Dejar la partida: a un lado, donde no estorbe al juego. */
  quit: [0.42, 0.26, HALF_LENGTH * 0.55] as [number, number, number],
}

export function GameWorld() {
  const { gameState, runId } = useGame()
  const mode = useXR((state) => state.mode)

  // El sonido cuelga de la escena y no de la mesa: la mesa se estrena en cada
  // partida y en cada ronda del reto, y con el audio dentro, la ronda ganada se
  // llevaba por delante el gol que la ganaba —el contexto se cerraba mientras
  // sonaba— y estrenaba otro contexto por ronda (ver `lib/useGameAudio.ts`).
  const play = useGameAudio()

  // En realidad mixta el escenario es la habitación del jugador: dibujar la
  // sala la taparía y rompería el passthrough.
  const passthrough = mode === 'immersive-ar'
  const immersive = mode != null

  return (
    <>
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
        {!passthrough ? <Room /> : null}

        <group position={[0, TABLE_HEIGHT, TABLE_CENTER_Z]}>
          <Table />

          {/* El disco y los mazos solo durante la partida: en el menú la mesa
              se ve vacía, que es lo que hace que empezar se note. `key` la
              estrena en cada partida y en cada ronda del reto. */}
          {gameState !== 'menu' ? <Rink key={runId} play={play} /> : null}

          {/* La interfaz del visor no se monta siquiera en escritorio. No es
              solo que sobre —ahí manda el DOM—: los punteros miran si hay
              listeners y no si se ve, así que sus botones cazarían clics del
              ratón por delante de la mesa. */}
          {immersive ? (
            <>
              <group position={XR_UI.scoreboard} rotation={[-0.18, 0, 0]}>
                <XRScoreboard />
              </group>
              <group position={XR_UI.panel} rotation={[-0.2, 0, 0]}>
                <XRMenu />
                <XRGameOver />
              </group>
              <group position={XR_UI.countdown}>
                <XRCountdown />
              </group>
              <group position={XR_UI.quit} rotation={[-0.3, 0, 0]}>
                <XRQuitButton />
              </group>
            </>
          ) : null}
        </group>
      </WorldAnchor>
    </>
  )
}
