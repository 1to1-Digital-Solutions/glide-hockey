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
import { CanvasPanel, drawParagraph, drawText } from './canvasPanel'
import { GAME_MODE_HINTS, GAME_MODE_LABELS, MODOS_DEL_MENU, type GameMode } from '../../lib/gameMode'
import { daMedalla, fraseDeLaMedalla } from '../../lib/cartelDelMarcador'
import type { Objetivo } from '../../lib/objetivo'
import { LEVEL_COUNT } from '../../lib/levels'
import { MENU_EN } from '../../lib/palabras'
import { DIFFICULTY_COLORS, PALETTE } from '../../lib/palette'
import { PALETA } from '../../lib/paleta'
import {
  LEVEL_BAR_BOTTOM,
  LEVEL_BUTTON,
  MENU_BUTTON,
  MENU_HINT_Y,
  MENU_MEDAL_WIDTH,
  MENU_MODE_ICON_RISE,
  MENU_MODE_LABEL_DROP,
  MENU_PANEL,
  MENU_ROW,
  MENU_ROW_LABEL_RISE,
  MENU_BOXES,
  MENU_RECORD_X,
  MENU_TEXT,
  MENU_ROW_LABEL_SIZE,
  levelBarHeight,
} from '../../lib/xrMenuLayout'
import { CONFORTS, type Confort } from '../../lib/golpeRecibido'
import { CONFORT_LEGEND, useConfort } from '../../lib/confort'
import type { Scenery } from '../../lib/ajustes'
import { SCENERY_LABELS } from '../../lib/scenery'
import { useExit } from '../../game/exit'
import {
  DIM_COLOR,
  XRSalirIcon,
  XRNumber,
  XRPanel,
  XRPlate,
  XRPlayIcon,
  XRPressable,
  XRSignIcon,
  XRSceneryIcon,
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

/** El radio de la marca del modo que da medalla, en metros. */
const MARCA_DE_MEDALLA = 0.011




/** Tres estrellas —rombos— por nivel: las ganadas, encendidas. */
function StarsRow({ lit, size = 0.02, color = PALETA.oro }: { lit: number; size?: number; color?: string }) {
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
 * niveles, una escalera para el reto y dos discos para el duelo, el mismo
 * dibujo que el duelo de table-tennis (dos pelotas): dos que juegan lo mismo.
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
  if (mode === 'duel') {
    return (
      <group>
        {[-0.03, 0.03].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <circleGeometry args={[0.022, 20]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        ))}
      </group>
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

/**
 * El dibujo de cada confort, **por forma**: apagado es un aro tachado; suave, un punto con una
 * onda; entero, un punto con dos. Se cuentan las ondas sin distinguir colores.
 */
function ConfortIcon({ confort, lit }: { confort: Confort; lit: boolean }) {
  const color = lit ? PALETTE.foreground : DIM_COLOR
  if (confort === 'off') {
    return (
      <group>
        <mesh>
          <ringGeometry args={[0.024, 0.032, 24]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <planeGeometry args={[0.07, 0.008]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
    )
  }
  const ondas = confort === 'gentle' ? 1 : 2
  return (
    <group>
      <mesh>
        <circleGeometry args={[0.01, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {Array.from({ length: ondas }, (_, i) => (
        <mesh key={i}>
          <ringGeometry args={[0.02 + i * 0.014, 0.026 + i * 0.014, 24]} />
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
  gameMode: GameMode = 'practice',
  scenery: Scenery = 'place',
  objetivo: Objetivo | null = null,
): void {
  // Solo la práctica pregunta el nivel de la máquina y los goles; en niveles, la fila de los
  // goles pasa a ser la del nivel que se juega, y en el reto no queda ninguna de las dos.
  const practice = gameMode === 'practice'
  const filas: (readonly [number, string])[] = [
    [ROW.mode, t(MENU_EN.modo)],
    ...(practice ? [[ROW.level, t('Level')] as const] : []),
    ...(practice || levels ? [[ROW.goals, levels ? t('Stage') : t('Goals')] as const] : []),
  ]
  // El confort lleva el nombre en su misma línea y a la izquierda de sus botones: encima está
  // el borde del panel.
  drawText(ctx, t(CONFORT_LEGEND), -PANEL.width / 2 + 0.05, ROW.comfort, {
    size: MENU_TEXT.comfort,
    color: DIM_COLOR,
    align: 'left',
    maxWidth: MENU_BOXES['confort off'].position[0] - MENU_BUTTON.small[0] / 2 - 0.02 - (-PANEL.width / 2 + 0.05),
  })
  for (const [y, nombre] of filas) {
    drawText(ctx, nombre, -PANEL.width / 2 + 0.05, y + ROW_LABEL_RISE, {
      size: MENU_ROW_LABEL_SIZE,
      color: DIM_COLOR,
      align: 'left',
      maxWidth: PANEL.width / 2,
    })
  }

  // El interruptor del decorado era **un icono y nada más**: con las gafas puestas no
  // hay forma de saber qué hace hasta pulsarlo. Al lado va lo que está puesto ahora —a la
  // derecha y no debajo: debajo caía justo encima del rótulo «Modo»—.
  const desde = MENU_BOXES.escenario.position[0] + MENU_BUTTON.small[0] / 2 + 0.02
  drawText(ctx, t(SCENERY_LABELS[scenery]), desde, ROW.record, {
    size: MENU_TEXT.scenery,
    color: DIM_COLOR,
    align: 'left',
    // Hasta las cifras del récord, que van a su derecha (`MENU_RECORD_X`).
    maxWidth: MENU_RECORD_X - 0.07 - desde,
  })

  // Si el modo elegido cuenta para medalla, en la línea del rótulo «Modo» y a su derecha: junto a
  // los botones de los que habla. En dorado el que cuenta, que además lleva su marca en el botón.
  drawText(ctx, t(fraseDeLaMedalla(objetivo, gameMode)), PANEL.width / 2 - 0.05, ROW.mode + ROW_LABEL_RISE, {
    size: MENU_TEXT.medal,
    color: daMedalla(objetivo, gameMode) ? PALETA.oro : DIM_COLOR,
    align: 'right',
    maxWidth: MENU_MEDAL_WIDTH,
  })

  // El nombre de cada modo, en la franja de abajo de su botón (`MENU_MODE_LABEL_DROP`): los iconos
  // solos no dicen qué modo es cada uno. El elegido, en claro, como su icono.
  for (const modo of MODOS_DEL_MENU) {
    const [x, y] = MENU_BOXES[`modo ${modo}`].position
    drawText(ctx, t(GAME_MODE_LABELS[modo]), x, y + MENU_MODE_LABEL_DROP, {
      size: MENU_TEXT.mode,
      color: modo === gameMode ? PALETTE.foreground : DIM_COLOR,
      weight: '600',
      maxWidth: MENU_BUTTON.mode[0] - 0.004,
    })
  }

  // Y qué es el modo elegido. Los tres se llamaban «Práctica», «Niveles» y «Reto» y
  // nada más: lo que los distingue solo lo contaba la pantalla de la web, que con el
  // visor puesto no se ve.
  drawParagraph(ctx, t(GAME_MODE_HINTS[gameMode]), 0, MENU_HINT_Y, {
    size: MENU_TEXT.hint,
    color: DIM_COLOR,
    maxWidth: PANEL.width - 0.1,
    anchor: 'top',
  })
}

export function XRMenu() {
  const {
    gameMode,
    setGameMode,
    difficulty,
    setDifficulty,
    goalTarget,
    setGoalTarget,
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
    objetivo,
  } = useGame()
  const exit = useExit()
  const [confort, setConfort] = useConfort()
  // Fuera de una sesión de realidad aumentada no hay habitación que enseñar: el
  // visor no entrega el passthrough en realidad virtual.
  const passthroughAvailable = useXR((state) => state.mode) === 'immersive-ar'
  const t = traductor(useLang())

  // **Solo la práctica pregunta**: nivel y goles los manda la escalera en reto y en niveles, así
  // que ahí la partida ya está hecha y sus filas no se pintan —ni apagadas—. Niveles conserva la
  // suya, que es qué nivel desbloqueado se juega.
  const practice = gameMode === 'practice'
  const levels = gameMode === 'levels'

  // Los nombres de las filas, en un lienzo aparte: el resto del panel es geometría y ahí no
  // cabe una letra. La tercera fila cambia de pregunta con el modo, así que cambia de
  // nombre con ella.
  const nombrarFilas = useCallback(
    (ctx: CanvasRenderingContext2D) => dibujarLosNombres(ctx, t, levels, gameMode, scenery, objetivo),
    [levels, t, gameMode, scenery, objetivo],
  )

  if (gameState !== 'menu') return null
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

      {/* Cuánto se nota un gol en contra (`lib/golpeRecibido.ts`). Aquí y no solo en la web
          porque es con el visor puesto cuando se sabe si marea. */}
      {CONFORTS.map((opcion) => {
        const selected = opcion === confort
        return (
          <XRPressable key={opcion} box={MENU_BOXES[`confort ${opcion}`]} onSelect={() => setConfort(opcion)}>
            <XRPlate
              width={SMALL_BUTTON[0]}
              height={SMALL_BUTTON[1]}
              color={selected ? PALETTE.primaryDeep : PALETTE.rail}
              opacity={selected ? 0.95 : 0.7}
            />
            <ConfortIcon confort={opcion} lit={selected} />
          </XRPressable>
        )
      })}

      {MODOS_DEL_MENU.map((mode) => {
        const selected = mode === gameMode
        return (
          <XRPressable
            key={mode}
            box={MENU_BOXES[`modo ${mode}`]}
            onSelect={() => setGameMode(mode)}
          >
            <XRPlate
              width={MODE_BUTTON[0]}
              height={MODE_BUTTON[1]}
              color={selected ? PALETTE.primaryDeep : PALETTE.rail}
              opacity={selected ? 0.95 : 0.7}
            />
            <group position={[0, MENU_MODE_ICON_RISE, 0]}>
              <ModeIcon mode={mode} lit={selected} />
            </group>
            {/* El modo que da medalla lleva su marca en la esquina: un disco dorado, que se
                distingue por estar o no estar, además de decirlo la frase de abajo. */}
            {daMedalla(objetivo, mode) ? (
              <mesh position={[MODE_BUTTON[0] / 2 - MARCA_DE_MEDALLA * 1.6, MODE_BUTTON[1] / 2 - MARCA_DE_MEDALLA * 1.6, 0.002]}>
                <circleGeometry args={[MARCA_DE_MEDALLA, 20]} />
                <meshBasicMaterial color={PALETA.oro} toneMapped={false} />
              </mesh>
            ) : null}
          </XRPressable>
        )
      })}

      {/* Escalera de nivel: la barra crece y el color va del verde al rojo, así
          que el nivel se lee por forma y por color, no solo por color. */}
      {practice ? DIFFICULTY_ORDER.map((level, index) => {
        const selected = level === difficulty
        const height = levelBarHeight(index, DIFFICULTY_ORDER.length)
        return (
          <XRPressable
            key={level}
            box={MENU_BOXES[`nivel ${level}`]}
            onSelect={() => setDifficulty(level)}
          >
            <XRPlate
              width={LEVEL_BUTTON[0]}
              height={LEVEL_BUTTON[1]}
              color={selected ? DIFFICULTY_COLORS[level] : PALETTE.rail}
              opacity={0.85}
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
      }) : null}

      {/* La fila de goles: a cuántos se juega en prueba, o el nivel en Niveles
          (con sus estrellas debajo). Los mismos dos botones, otra pregunta. En el
          reto no hay pregunta y no se pinta. */}
      {practice || levels ? (
        <>
          <XRPressable
            box={MENU_BOXES.menos}
            onSelect={() => (levels ? setLevel(activeLevel - 1) : setGoalTarget(goalTarget - 1))}
            disabled={levels ? activeLevel <= 1 : endless || goalTarget <= MIN_GOALS}
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
          ) : endless ? (
            // Sin fin: un anillo en vez de una cifra, que es «esto no se acaba».
            <mesh position={[0, ROW.goals, 0]}>
              <ringGeometry args={[0.03, 0.045, 32]} />
              <meshBasicMaterial color={PALETTE.foreground} toneMapped={false} />
            </mesh>
          ) : (
            <XRNumber
              value={goalTarget}
              size={0.11}
              color={PALETTE.foreground}
              position={[0, ROW.goals, 0]}
            />
          )}

          <XRPressable
            box={MENU_BOXES.mas}
            onSelect={() => (levels ? setLevel(activeLevel + 1) : setGoalTarget(goalTarget + 1))}
            disabled={
              levels ? activeLevel >= unlockedLevel : endless || goalTarget >= MAX_GOALS
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
          {practice ? (
            <XRPressable
              box={MENU_BOXES['sin fin']}
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
        </>
      ) : null}

      {/* El récord del modo elegido, en pequeño y apagado: es un dato, no una
          decisión. Solo se enseña si hay alguno que batir. */}
      {bestPoints > 0 && !levels ? (
        <XRNumber
          value={bestPoints}
          size={0.04}
          color={DIM_COLOR}
          position={[MENU_RECORD_X, ROW.record, 0]}
        />
      ) : null}

      {/* Lo que se pinta alrededor, en la banda del récord, que es la única
          con hueco. Está aquí y no solo en el menú de la web porque es aquí
          donde sirve: con las gafas puestas se cambia sin salir de la sesión.
          Fuera de una sesión de realidad aumentada no hay habitación que
          enseñar, así que el botón se apaga en vez de prometerla. Escribe el
          escenario del arcade: el panel del salón y este botón enseñan lo mismo. */}
      <XRPressable
        box={MENU_BOXES.escenario}
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
        box={MENU_BOXES.jugar}
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
        box={MENU_BOXES.salir}
        onSelect={exit}
      >
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.rail}
          opacity={0.8}
        />
        <XRSalirIcon />
      </XRPressable>
    </group>
  )
}
