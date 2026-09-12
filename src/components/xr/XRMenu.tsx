'use client'

import { useCallback } from 'react'
import { useXR } from '@react-three/xr'

import {
  DIFFICULTY_ORDER,
  MAX_GOALS,
  MIN_GOALS,
} from '../../lib/gameConfig'
import { useGame } from '../../lib/gameStore'
import { useLang } from '../../lib/ajustesCliente'
import { traductor, type TextKey } from '../../lib/textos'
import { CanvasPanel, drawText } from './canvasPanel'
import { GAME_MODE_ORDER, type GameMode } from '../../lib/gameMode'
import { LEVEL_COUNT } from '../../lib/levels'
import { DIFFICULTY_COLORS, PALETTE } from '../../lib/palette'
import {
  LEVEL_BAR_BOTTOM,
  LEVEL_BUTTON,
  MENU_BUTTON,
  MENU_PANEL,
  MENU_ROW,
  MENU_ROW_LABEL_RISE,
  MENU_ROW_LABEL_SIZE,
  levelBarHeight,
} from '../../lib/xrMenuLayout'
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
  XRSceneryIcon,
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
const PANEL = MENU_PANEL
const MODE_BUTTON = MENU_BUTTON.mode
const SMALL_BUTTON = MENU_BUTTON.small
const PLAY_BUTTON = MENU_BUTTON.play

/**
 * Altura de cada fila dentro del panel.
 *
 * El récord va arriba del todo y no entre el nivel y los goles: una cifra ocupa
 * `1,14 × size` contando el grosor de los segmentos, y ahí solo quedan cuatro
 * centímetros libres. Metido en ese hueco se dibujaba encima del número de
 * goles —dos planos en la misma z, parpadeando— en cuanto hubiera un récord que
 * enseñar, que es a partir de la primera partida.
 */
const ROW = MENU_ROW

const ROW_LABEL_RISE = MENU_ROW_LABEL_RISE



function hitBox(
  x: number,
  y: number,
  [width, height]: [number, number],
): XrHitBox {
  return { position: [x, y, 0], size: [width, height, 0.04] }
}

/** Tres estrellas —rombos— por nivel: las ganadas, encendidas. */
function StarsRow({ lit, size = 0.02, color = PALETTE.puck }: { lit: number; size?: number; color?: string }) {
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[(i - 1) * size * 1.9, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
          <planeGeometry args={[size, size]} />
          <meshBasicMaterial color={i < lit ? color : DIM_COLOR} toneMapped={false} transparent opacity={i < lit ? 1 : 0.35} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Silueta de cada modo: un disco para la prueba, tres estrellas para los
 * niveles, una escalera para el reto.
 */
function ModeIcon({ mode, lit }: { mode: GameMode; lit: boolean }) {
  const color = lit ? PALETTE.primary : DIM_COLOR

  if (mode === 'practice') {
    return (
      <mesh>
        <circleGeometry args={[0.032, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    )
  }

  if (mode === 'levels') return <StarsRow lit={lit ? 3 : 0} color={color} />
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

/**
 * De qué es cada fila del menú, fuera del componente **para poder medirlo**.
 *
 * Los rótulos de este menú ya se pisaron una vez —«Modo» se pintaba encima del botón del
 * récord— y eso no se ve desde una pantalla. Sacado aquí, `legibilidad.test.ts` los escribe
 * en un lienzo que apunta y comprueba que ninguno se pisa con otro ni se sale del panel.
 */
export function dibujarLosNombres(
  ctx: CanvasRenderingContext2D,
  t: (clave: TextKey) => string,
  levels: boolean,
): void {
  const filas = [
    [ROW.mode, t('Mode')],
    [ROW.level, t('Level')],
    [ROW.goals, levels ? t('Stage') : t('Goals')],
  ] as const
  for (const [y, nombre] of filas) {
    drawText(ctx, nombre, -PANEL.width / 2 + 0.05, y + ROW_LABEL_RISE, {
      size: MENU_ROW_LABEL_SIZE,
      color: DIM_COLOR,
      align: 'left',
      maxWidth: PANEL.width / 2,
    })
  }
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
    endless,
    setEndless,
    activeLevel,
    unlockedLevel,
    levelStars,
    setLevel,
    scenery,
    setScenery,
    bestPoints,
    startGame,
    gameState,
  } = useGame()
  const exit = useExit()
  // Fuera de una sesión de realidad aumentada no hay habitación que enseñar: el
  // visor no entrega el passthrough en realidad virtual.
  const passthroughAvailable = useXR((state) => state.mode) === 'immersive-ar'
  const t = traductor(useLang())

  // Nivel y goles los manda la escalera en reto y en niveles.
  const challenge = gameMode !== 'practice'
  const levels = gameMode === 'levels'

  // Los nombres de las filas, en un lienzo aparte: el resto del panel es geometría y ahí no
  // cabe una letra. La tercera fila cambia de pregunta con el modo, así que cambia de
  // nombre con ella.
  const nombrarFilas = useCallback(
    (ctx: CanvasRenderingContext2D) => dibujarLosNombres(ctx, t, levels),
    [levels, t],
  )

  if (gameState !== 'menu') return null
  // En reto se enseña lo que toca en la ronda; en prueba, lo elegido.
  const shownDifficulty = challenge ? activeDifficulty : difficulty
  const shownGoals = challenge ? activeGoalTarget : goalTarget
  return (
    <group>
      <XRPanel width={PANEL.width} height={PANEL.height} />

      {/* De qué es cada fila. Va encima de sus botones y no dentro: dentro habría que
          elegir entre el nombre y el icono, y el icono es lo que se pulsa. */}
      <group position={[0, 0, 0.004]}>
        <CanvasPanel
          width={PANEL.width}
          height={PANEL.height}
          draw={nombrarFilas}
          fallbackColor={PALETTE.background}
        />
      </group>

      {GAME_MODE_ORDER.map((mode, index) => {
        const selected = mode === gameMode
        return (
          <XRPressable
            key={mode}
            box={hitBox((index - 1) * 0.25, ROW.mode, MODE_BUTTON)}
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
        const height = levelBarHeight(index, DIFFICULTY_ORDER.length)
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
            <mesh position={[0, LEVEL_BAR_BOTTOM + height / 2, 0]}>
              <planeGeometry args={[0.05, height]} />
              <meshBasicMaterial
                color={selected ? PALETTE.foreground : DIM_COLOR}
                toneMapped={false}
              />
            </mesh>
          </XRPressable>
        )
      })}

      {/* La fila de goles: a cuántos se juega en prueba, o el nivel en Niveles
          (con sus estrellas debajo). Los mismos dos botones, otra pregunta. */}
      <XRPressable
        box={hitBox(-0.19, ROW.goals, SMALL_BUTTON)}
        onSelect={() => (levels ? setLevel(activeLevel - 1) : setGoalTarget(goalTarget - 1))}
        disabled={levels ? activeLevel <= 1 : challenge || endless || goalTarget <= MIN_GOALS}
      >
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.rail}
          opacity={0.8}
        />
        <XRSignIcon sign="minus" />
      </XRPressable>

      {levels ? (
        <group>
          <XRNumber
            value={activeLevel}
            size={0.1}
            color={PALETTE.foreground}
            position={[-0.03, ROW.goals + 0.01, 0]}
          />
          <XRNumber
            value={LEVEL_COUNT}
            size={0.04}
            color={DIM_COLOR}
            position={[0.07, ROW.goals + 0.01, 0]}
          />
          <group position={[0, ROW.goals - 0.07, 0]}>
            <StarsRow lit={levelStars[activeLevel - 1] ?? 0} size={0.016} />
          </group>
        </group>
      ) : endless && !challenge ? (
        // Sin fin: un anillo en vez de una cifra, que es «esto no se acaba».
        <mesh position={[0, ROW.goals, 0]}>
          <ringGeometry args={[0.03, 0.045, 32]} />
          <meshBasicMaterial color={PALETTE.foreground} toneMapped={false} />
        </mesh>
      ) : (
        <XRNumber
          value={shownGoals}
          size={0.11}
          color={challenge ? DIM_COLOR : PALETTE.foreground}
          position={[0, ROW.goals, 0]}
        />
      )}

      <XRPressable
        box={hitBox(0.19, ROW.goals, SMALL_BUTTON)}
        onSelect={() => (levels ? setLevel(activeLevel + 1) : setGoalTarget(goalTarget + 1))}
        disabled={
          levels ? activeLevel >= unlockedLevel : challenge || endless || goalTarget >= MAX_GOALS
        }
      >
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.rail}
          opacity={0.8}
        />
        <XRSignIcon sign="plus" />
      </XRPressable>

      {/* Sin fin, al lado de los goles: la misma pregunta —cuánto— con la otra
          respuesta. En reto y niveles no hay nada que elegir. */}
      {!challenge ? (
        <XRPressable
          box={hitBox(0.32, ROW.goals, SMALL_BUTTON)}
          onSelect={() => setEndless(!endless)}
        >
          <XRPlate
            width={SMALL_BUTTON[0]}
            height={SMALL_BUTTON[1]}
            color={endless ? PALETTE.primaryDeep : PALETTE.rail}
            opacity={endless ? 0.95 : 0.8}
          />
          <mesh>
            <ringGeometry args={[0.018, 0.028, 24]} />
            <meshBasicMaterial color={endless ? PALETTE.foreground : DIM_COLOR} toneMapped={false} />
          </mesh>
        </XRPressable>
      ) : null}
      {/* El récord del modo elegido, en pequeño y apagado: es un dato, no una
          decisión. Solo se enseña si hay alguno que batir. */}
      {bestPoints > 0 && !levels ? (
        <XRNumber
          value={bestPoints}
          size={0.04}
          color={DIM_COLOR}
          position={[0, ROW.record, 0]}
        />
      ) : null}

      {/* Lo que se pinta alrededor, en la banda del récord, que es la única
          con hueco. Está aquí y no solo en el menú de la web porque es aquí
          donde sirve: con las gafas puestas se cambia sin salir de la sesión.
          Fuera de una sesión de realidad aumentada no hay habitación que
          enseñar, así que el botón se apaga en vez de prometerla. */}
      <XRPressable
        box={hitBox(-0.28, ROW.record, SMALL_BUTTON)}
        onSelect={() => setScenery(scenery === 'room' ? 'place' : 'room')}
        disabled={!passthroughAvailable}
      >
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.rail}
          opacity={passthroughAvailable ? 0.8 : 0.4}
        />
        <XRSceneryIcon room={scenery === 'room'} lit={passthroughAvailable} />
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
