'use client'

import { useCallback } from 'react'

import { useGame } from '../../lib/gameStore'
import { useLang } from '../../lib/ajustesCliente'
import { traductor } from '../../lib/textos'
import { CanvasPanel, drawParagraph, drawText } from './canvasPanel'
import { isEndless } from '../../lib/gameMode'
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
  const { gameState, playerGoals, opponentGoals, points, round, gameMode, activeLevel } = useGame()
  // La ronda del reto, o el nivel en Niveles: la misma fila.
  const fila = round ?? (gameMode === 'levels' ? activeLevel : null)
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

      {/* En reto, la ronda por la que va; en niveles, el nivel. En prueba no hay
          nada que enseñar aquí. */}
      {fila != null ? (
        <XRNumber
          value={fila}
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
  const { gameState, outcome, points, isRecord, levelResult, startGame, resetGame } =
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

      {/* Las estrellas del nivel, bajo los puntos: las ganadas encendidas. */}
      {levelResult ? (
        <group position={[0, -0.055, 0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[(i - 1) * 0.045, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
              <planeGeometry args={[0.022, 0.022]} />
              <meshBasicMaterial
                color={i < levelResult.stars ? PALETTE.puck : DIM_COLOR}
                toneMapped={false}
                transparent
                opacity={i < levelResult.stars ? 1 : 0.35}
              />
            </mesh>
          ))}
        </group>
      ) : null}
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

/** Dejar la partida sin llegar al final; y en la sin fin, terminarla con resumen. */
export function XRQuitButton() {
  const { gameState, askToQuit, endRun, activeGoalTarget } = useGame()

  if (gameState !== 'playing' && gameState !== 'countdown') return null

  return (
    <group>
      {/* Pregunta antes de dejarla: el brazo pasa por aquí y salir pierde los goles. */}
      <XRPressable box={hitBox(0, 0, SMALL_BUTTON)} onSelect={askToQuit}>
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.rail}
          opacity={0.7}
        />
        <XRMenuIcon color={DIM_COLOR} />
      </XRPressable>
      {isEndless(activeGoalTarget) && gameState === 'playing' ? (
        <XRPressable box={hitBox(0.13, 0, SMALL_BUTTON)} onSelect={endRun}>
          <XRPlate
            width={SMALL_BUTTON[0]}
            height={SMALL_BUTTON[1]}
            color={PALETTE.primaryDeep}
            opacity={0.9}
          />
          <mesh>
            <planeGeometry args={[0.036, 0.036]} />
            <meshBasicMaterial color={PALETTE.foreground} toneMapped={false} />
          </mesh>
        </XRPressable>
      ) : null}
    </group>
  )
}

/** Lo que ocupa el aviso, en metros. */
const CONFIRM_SIZE: [number, number] = [0.72, 0.36]

/** Sus dos botones, en coordenadas del propio aviso. */
const CONFIRM_BOXES = {
  /** Seguir jugando va a la derecha y más grande: es la respuesta que no pierde nada. */
  stay: hitBox(0.16, -0.09, [0.3, 0.1]),
  leave: hitBox(-0.18, -0.09, [0.26, 0.1]),
}

/**
 * El aviso antes de dejar la partida.
 *
 * **No se sale de golpe.** El botón se pulsa sin querer —con el visor puesto no se ve lo
 * que hay a los lados y el brazo pasa por donde pasa—, y salir pierde los goles que se
 * lleven. Así que se para la mesa y se pregunta; mientras se pregunta el disco no corre,
 * porque si no, decidir costaría goles.
 *
 * Va donde el menú, en medio de la mesa y a la altura de la vista: es donde ya se está
 * mirando, y lo que se decide aquí no es un detalle.
 *
 * Es la única parte de la interfaz inmersiva de este juego con letras. El resto son cifras
 * y placas de color a propósito, pero una pregunta no se dibuja: hay que leerla.
 */
export function XRQuitConfirm() {
  const { prompt, resetGame, keepPlaying } = useGame()
  const t = traductor(useLang())

  const escribir = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      drawParagraph(ctx, t('Leave the game?'), 0, 0.09, {
        size: 0.05,
        color: PALETTE.foreground,
        weight: '700',
        maxWidth: CONFIRM_SIZE[0] - 0.08,
      })
      drawParagraph(ctx, t('You lose the goals you have scored.'), 0, 0.01, {
        size: 0.034,
        color: DIM_COLOR,
        maxWidth: CONFIRM_SIZE[0] - 0.08,
      })
      drawText(ctx, t('Leave'), CONFIRM_BOXES.leave.position[0], CONFIRM_BOXES.leave.position[1], {
        size: 0.034,
        color: PALETTE.foreground,
        maxWidth: CONFIRM_BOXES.leave.size[0] - 0.03,
      })
      drawText(ctx, t('Keep playing'), CONFIRM_BOXES.stay.position[0], CONFIRM_BOXES.stay.position[1], {
        size: 0.034,
        color: PALETTE.background,
        weight: '700',
        maxWidth: CONFIRM_BOXES.stay.size[0] - 0.03,
      })
    },
    [t],
  )

  if (prompt !== 'quit') return null

  return (
    <group>
      <XRPanel width={CONFIRM_SIZE[0]} height={CONFIRM_SIZE[1]} opacity={0.96} />

      <XRPressable box={CONFIRM_BOXES.leave} onSelect={resetGame}>
        <XRPlate
          width={CONFIRM_BOXES.leave.size[0]}
          height={CONFIRM_BOXES.leave.size[1]}
          color={PALETTE.rail}
          opacity={0.9}
        />
      </XRPressable>

      <XRPressable box={CONFIRM_BOXES.stay} onSelect={keepPlaying}>
        <XRPlate
          width={CONFIRM_BOXES.stay.size[0]}
          height={CONFIRM_BOXES.stay.size[1]}
          color={PALETTE.primary}
        />
      </XRPressable>

      {/* El texto va encima de las placas: el lienzo es transparente salvo donde escribe. */}
      <group position={[0, 0, 0.03]}>
        <CanvasPanel
          width={CONFIRM_SIZE[0]}
          height={CONFIRM_SIZE[1]}
          draw={escribir}
          fallbackColor={PALETTE.background}
        />
      </group>
    </group>
  )
}
