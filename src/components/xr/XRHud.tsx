'use client'

import { useGame } from '../../lib/gameStore'
import { PALETTE } from '../../lib/palette'
import { useExit } from '../../game/exit'
import {
  DIM_COLOR,
  XRCloseIcon,
  XRMenuIcon,
  XRNumber,
  XRPanel,
  XRPlate,
  XRPlayIcon,
  XRPressable,
  type XrHitBox,
} from './XRUi'

/**
 * El marcador y el final de partida, dentro del visor.
 *
 * Es el equivalente inmersivo de `ui/HUD`. Todo son cifras de siete segmentos y
 * placas de color (ver `lib/xrDigits.ts` para el porqué de no usar texto): el
 * marcador en cian es el del jugador y el rojo el de la máquina, los mismos
 * colores que llevan sus mazos en la mesa.
 *
 * Quien lo monta decide dónde va; aquí solo se compone (ver `GameWorld`).
 */

const SMALL_BUTTON: [number, number] = [0.1, 0.1]
const ACTION_BUTTON: [number, number] = [0.24, 0.11]

/** Altura de cada fila del marcador dentro de su panel, en metros. */
const ROW = { goals: 0.06, points: -0.065, round: -0.135 }

function hitBox(
  x: number,
  y: number,
  [width, height]: [number, number],
): XrHitBox {
  return { position: [x, y, 0], size: [width, height, 0.04] }
}

/** El marcador de la partida en curso, con los puntos debajo. */
export function XRScoreboard() {
  const { gameState, playerGoals, opponentGoals, points, round } = useGame()

  if (gameState === 'menu') return null

  return (
    <group>
      {/* Alto para las tres filas: marcador, puntos y —en reto— la ronda. Una
          cifra ocupa `1,14 × size` contando el grosor de los segmentos, y con
          el panel más corto la ronda se dibujaba encima de los puntos y se
          salía por abajo. */}
      <XRPanel width={0.52} height={0.34} opacity={0.7} />

      <XRNumber
        value={playerGoals}
        size={0.13}
        color={PALETTE.primary}
        position={[-0.12, ROW.goals, 0]}
      />
      {/* Separador de marcador: dos puntos, que es lo que se lee como «a». */}
      {[-0.03, 0.03].map((y) => (
        <mesh key={y} position={[0, ROW.goals + y, 0]}>
          <planeGeometry args={[0.016, 0.016]} />
          <meshBasicMaterial color={DIM_COLOR} toneMapped={false} />
        </mesh>
      ))}
      <XRNumber
        value={opponentGoals}
        size={0.13}
        color={PALETTE.rival}
        position={[0.12, ROW.goals, 0]}
      />

      <XRNumber
        value={points}
        size={0.055}
        color={PALETTE.puck}
        position={[0, ROW.points, 0]}
      />

      {/* En reto, la ronda por la que va. En prueba no hay rondas que enseñar. */}
      {round != null ? (
        <XRNumber
          value={round}
          size={0.04}
          color={DIM_COLOR}
          position={[0, ROW.round, 0]}
        />
      ) : null}
    </group>
  )
}

/** La cuenta atrás antes del saque, grande y sobre la mesa. */
export function XRCountdown() {
  const { gameState, countdown } = useGame()

  if (gameState !== 'countdown') return null

  return (
    <XRNumber value={countdown} size={0.26} color={PALETTE.primaryBright} />
  )
}

/**
 * El final de partida: cuántos puntos, y qué hacer ahora.
 *
 * Sin texto tampoco aquí, así que el resultado se dice con el color de la
 * placa —el cian del jugador si ganó, el rojo de la máquina si perdió— y con
 * el marcador, que sigue a la vista al lado.
 */
export function XRGameOver() {
  const { gameState, outcome, points, isRecord, startGame, resetGame } =
    useGame()
  const exit = useExit()

  if (gameState !== 'finished') return null

  const won = outcome === 'won'

  return (
    <group>
      <XRPanel width={0.6} height={0.42} />

      <mesh position={[0, 0.13, -0.01]}>
        <planeGeometry args={[0.5, 0.06]} />
        <meshBasicMaterial
          color={won ? PALETTE.primary : PALETTE.rival}
          toneMapped={false}
        />
      </mesh>

      <XRNumber
        value={points}
        size={0.11}
        color={isRecord ? PALETTE.puck : PALETTE.foreground}
        position={[0, 0.02, 0]}
      />

      <XRPressable
        box={hitBox(-0.12, -0.13, ACTION_BUTTON)}
        onSelect={startGame}
      >
        <XRPlate
          width={ACTION_BUTTON[0]}
          height={ACTION_BUTTON[1]}
          color={PALETTE.primary}
        />
        <XRPlayIcon size={0.045} />
      </XRPressable>

      {/* Volver al menú y salir del juego son cosas distintas, así que llevan
          iconos distintos: dos aspas iguales no se pueden diferenciar. */}
      <XRPressable box={hitBox(0.11, -0.13, SMALL_BUTTON)} onSelect={resetGame}>
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.rail}
          opacity={0.8}
        />
        <XRMenuIcon color={DIM_COLOR} />
      </XRPressable>

      <XRPressable box={hitBox(0.24, -0.13, SMALL_BUTTON)} onSelect={exit}>
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.rail}
          opacity={0.8}
        />
        <XRCloseIcon />
      </XRPressable>
    </group>
  )
}

/** Dejar la partida sin llegar al final. */
export function XRQuitButton() {
  const { gameState, resetGame } = useGame()

  if (gameState !== 'playing' && gameState !== 'countdown') return null

  return (
    <XRPressable box={hitBox(0, 0, SMALL_BUTTON)} onSelect={resetGame}>
      <XRPlate
        width={SMALL_BUTTON[0]}
        height={SMALL_BUTTON[1]}
        color={PALETTE.rail}
        opacity={0.7}
      />
      <XRMenuIcon color={DIM_COLOR} />
    </XRPressable>
  )
}
