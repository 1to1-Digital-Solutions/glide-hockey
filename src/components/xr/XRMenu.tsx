'use client'

import {
  DIFFICULTY_ORDER,
  MAX_GOALS,
  MIN_GOALS,
} from '../../lib/gameConfig'
import { useGame } from '../../lib/gameStore'
import { GAME_MODE_ORDER } from '../../lib/gameMode'
import { DIFFICULTY_COLORS, PALETTE } from '../../lib/palette'
import { useExit } from '../../game/exit'
import {
  DIM_COLOR,
  XRCloseIcon,
  XRNumber,
  XRPanel,
  XRPlate,
  XRPlayIcon,
  XRPressable,
  XRSignIcon,
  XRSoundIcon,
  type XrHitBox,
} from './XRUi'

/**
 * El menú, dentro del visor.
 *
 * Es el equivalente inmersivo de `ui/StartScreen`: las mismas tres decisiones
 * —modo, nivel y a cuántos goles— y el mismo botón de empezar, pero en
 * geometría, porque dentro de un Canvas no cabe una etiqueta de DOM.
 *
 * **Sin una sola letra**: las fuentes se descargan de un CDN y aquí no hay red
 * (ver `lib/xrDigits.ts`). Cada opción se dice con forma y color: el modo con
 * dos siluetas distintas, el nivel con una escalera de barras que además va del
 * verde al rojo, y los goles con cifras de siete segmentos.
 *
 * En modo reto el nivel y los goles se enseñan **apagados**: siguen ahí para
 * que se vea qué toca en la ronda, pero los manda la escalera y no el jugador.
 */

/** Medidas del panel y de sus filas, en metros. */
const PANEL = { width: 0.78, height: 0.74 }
const MODE_BUTTON: [number, number] = [0.3, 0.13]
const LEVEL_BUTTON: [number, number] = [0.12, 0.11]
const SMALL_BUTTON: [number, number] = [0.11, 0.11]
const PLAY_BUTTON: [number, number] = [0.28, 0.12]

/**
 * Altura de cada fila dentro del panel.
 *
 * El récord va arriba del todo y no entre el nivel y los goles: una cifra ocupa
 * `1,14 × size` contando el grosor de los segmentos, y ahí solo quedan cuatro
 * centímetros libres. Metido en ese hueco se dibujaba encima del número de
 * goles —dos planos en la misma z, parpadeando— en cuanto hubiera un récord que
 * enseñar, que es a partir de la primera partida.
 */
const ROW = { record: 0.32, mode: 0.22, level: 0.05, goals: -0.11, actions: -0.26 }

function hitBox(
  x: number,
  y: number,
  [width, height]: [number, number],
): XrHitBox {
  return { position: [x, y, 0], size: [width, height, 0.04] }
}

/** Silueta de cada modo: un mazo para la prueba, una escalera para el reto. */
function ModeIcon({ mode, lit }: { mode: 'practice' | 'challenge'; lit: boolean }) {
  const color = lit ? PALETTE.primary : DIM_COLOR

  if (mode === 'practice') {
    return (
      <mesh>
        <circleGeometry args={[0.032, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    )
  }

  return (
    <group>
      {[0, 1, 2].map((step) => (
        <mesh
          key={step}
          position={[(step - 1) * 0.03, -0.024 + step * 0.016, 0]}
        >
          <planeGeometry args={[0.024, 0.016 + step * 0.032]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

export function XRMenu() {
  const {
    gameMode,
    setGameMode,
    difficulty,
    setDifficulty,
    activeDifficulty,
    goalTarget,
    setGoalTarget,
    activeGoalTarget,
    muted,
    setMuted,
    bestPoints,
    startGame,
    gameState,
  } = useGame()
  const exit = useExit()

  if (gameState !== 'menu') return null

  const challenge = gameMode === 'challenge'
  // En reto se enseña lo que toca en la ronda; en prueba, lo elegido.
  const shownDifficulty = challenge ? activeDifficulty : difficulty
  const shownGoals = challenge ? activeGoalTarget : goalTarget

  return (
    <group>
      <XRPanel width={PANEL.width} height={PANEL.height} />

      {GAME_MODE_ORDER.map((mode, index) => {
        const selected = mode === gameMode
        return (
          <XRPressable
            key={mode}
            box={hitBox((index - 0.5) * 0.34, ROW.mode, MODE_BUTTON)}
            onSelect={() => setGameMode(mode)}
          >
            <XRPlate
              width={MODE_BUTTON[0]}
              height={MODE_BUTTON[1]}
              color={selected ? PALETTE.primaryDeep : PALETTE.rail}
              opacity={selected ? 0.95 : 0.7}
            />
            <ModeIcon mode={mode} lit={selected} />
          </XRPressable>
        )
      })}

      {/* Escalera de nivel: la barra crece y el color va del verde al rojo, así
          que el nivel se lee por forma y por color, no solo por color. */}
      {DIFFICULTY_ORDER.map((level, index) => {
        const selected = level === shownDifficulty
        const height = 0.026 + index * 0.014
        return (
          <XRPressable
            key={level}
            box={hitBox((index - 2) * 0.135, ROW.level, LEVEL_BUTTON)}
            onSelect={() => setDifficulty(level)}
            disabled={challenge}
          >
            <XRPlate
              width={LEVEL_BUTTON[0]}
              height={LEVEL_BUTTON[1]}
              color={selected ? DIFFICULTY_COLORS[level] : PALETTE.rail}
              opacity={challenge && !selected ? 0.35 : 0.85}
            />
            <mesh position={[0, -0.02 + height / 2, 0]}>
              <planeGeometry args={[0.05, height]} />
              <meshBasicMaterial
                color={selected ? PALETTE.foreground : DIM_COLOR}
                toneMapped={false}
              />
            </mesh>
          </XRPressable>
        )
      })}

      {/* A cuántos goles se juega. */}
      <XRPressable
        box={hitBox(-0.19, ROW.goals, SMALL_BUTTON)}
        onSelect={() => setGoalTarget(goalTarget - 1)}
        disabled={challenge || goalTarget <= MIN_GOALS}
      >
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.rail}
          opacity={0.8}
        />
        <XRSignIcon sign="minus" />
      </XRPressable>

      <XRNumber
        value={shownGoals}
        size={0.11}
        color={challenge ? DIM_COLOR : PALETTE.foreground}
        position={[0, ROW.goals, 0]}
      />

      <XRPressable
        box={hitBox(0.19, ROW.goals, SMALL_BUTTON)}
        onSelect={() => setGoalTarget(goalTarget + 1)}
        disabled={challenge || goalTarget >= MAX_GOALS}
      >
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.rail}
          opacity={0.8}
        />
        <XRSignIcon sign="plus" />
      </XRPressable>

      {/* El récord del modo elegido, en pequeño y apagado: es un dato, no una
          decisión. Solo se enseña si hay alguno que batir. */}
      {bestPoints > 0 ? (
        <XRNumber
          value={bestPoints}
          size={0.04}
          color={DIM_COLOR}
          position={[0, ROW.record, 0]}
        />
      ) : null}

      {/* Silencio a un lado de «jugar» y salir al otro: los dos son de la
          sesión, no de la partida, y así la fila queda centrada en el botón
          que de verdad se busca. */}
      <XRPressable
        box={hitBox(-0.28, ROW.actions, SMALL_BUTTON)}
        onSelect={() => setMuted(!muted)}
      >
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.rail}
          opacity={0.8}
        />
        <XRSoundIcon muted={muted} />
      </XRPressable>

      <XRPressable
        box={hitBox(0, ROW.actions, PLAY_BUTTON)}
        onSelect={startGame}
      >
        <XRPlate
          width={PLAY_BUTTON[0]}
          height={PLAY_BUTTON[1]}
          color={PALETTE.primary}
        />
        <XRPlayIcon />
      </XRPressable>

      <XRPressable
        box={hitBox(0.28, ROW.actions, SMALL_BUTTON)}
        onSelect={exit}
      >
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
