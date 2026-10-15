'use client'

import { useCallback, useState } from 'react'
import { useXR } from '@react-three/xr'

import {
  DIFFICULTY_ORDER,
  MAX_GOALS,
  MIN_GOALS,
} from '../../lib/gameConfig'
import { useGame } from '../../lib/gameStore'
import { useLang } from '../../lib/settingsClient'
import { translator, type TextKey } from '../../lib/textos'
import { CanvasPanel, drawParagraph, drawText } from './canvasPanel'
import { GAME_MODE_HINTS, GAME_MODE_LABELS, MENU_MODE_ORDER, modeRows, type GameMode } from '../../lib/gameMode'
import { givesMedal, medalPhrase } from '../../lib/scoreboardSign'
import type { Goal } from '../../lib/goal'
import { LEVEL_COUNT } from '../../lib/levels'
import { MENU_EN } from '../../lib/menuWords'
import { gameName } from '../../lib/menuTemplate'
import { DIFFICULTY_COLORS, PALETTE } from '../../lib/palette'
import { COMMON_PALETTE } from '../../lib/commonPalette'
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
import { COMFORT_LEVELS, type Comfort } from '../../lib/hitFeedback'
import { COMFORT_LEGEND, useComfort } from '../../lib/comfort'
import type { Scenery } from '../../lib/settings'
import { SCENERY_LABELS } from '../../lib/scenery'
import { useExit } from '../../game/exit'
import {
  DIM_COLOR,
  XRExitIcon,
  XRNumber,
  XRPanel,
  XRPlate,
  XRPlayIcon,
  XRPressable,
  XRSignIcon,
  XRSceneryIcon,
} from './XRUi'

/**
 * The menu, inside the headset.
 *
 * It is the immersive equivalent of `ui/StartScreen`: the same three decisions
 * —mode, level and how many goals to play to— and the same start button, but in
 * geometry, because a DOM tag does not fit inside a Canvas.
 *
 * **Without a single letter**: fonts are downloaded from a CDN and here there
 * is no network (see `lib/xrDigits.ts`). Each option is said with shape and
 * colour: the mode with two different silhouettes, the level with a ladder of
 * bars that also goes from green to red, and the goals with seven-segment digits.
 *
 * It follows the common template (`lib/menuTemplate.ts`): the mode with the
 * challenge first, and what does not belong to the mode —the machine's level and
 * the goals of practice, the scenery and the comfort— behind «Más opciones», in
 * the band at the top, folded every time the menu is opened (`modeRows`). With
 * the challenge chosen there is nothing folded and no button: it is a fixed match.
 */

/** Measurements of the panel and of its rows, in metres. */
const PANEL = MENU_PANEL
const MODE_BUTTON = MENU_BUTTON.mode
const SMALL_BUTTON = MENU_BUTTON.small
const PLAY_BUTTON = MENU_BUTTON.play

/**
 * Height of each row inside the panel.
 *
 * The record goes at the very top and not between the level and the goals: a
 * digit takes up `1.14 × size` counting the thickness of the segments, and only
 * four centimetres are left free there. Squeezed into that gap it was drawn on
 * top of the number of goals —two planes at the same z, flickering— as soon as
 * there was a record to show, which is from the first match on.
 */
const ROW = MENU_ROW

const ROW_LABEL_RISE = MENU_ROW_LABEL_RISE

/** The radius of the mark of the mode that gives a medal, in metres. */
const MEDAL_MARK = 0.011




/** Three stars —diamonds— per level: the ones earned, lit. */
function StarsRow({ lit, size = 0.02, color = COMMON_PALETTE.gold }: { lit: number; size?: number; color?: string }) {
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
 * Silhouette of each mode: one puck for practice, three stars for the
 * levels, a ladder for the challenge and two pucks for the duel, the same
 * drawing as table-tennis's duel (two balls): two who play the same thing.
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
 * The drawing of each comfort, **by shape**: off is a struck-through ring; gentle, a dot with
 * one wave; full, a dot with two. The waves are counted without telling colours apart.
 */
function ComfortIcon({ comfort: level, lit }: { comfort: Comfort; lit: boolean }) {
  const color = lit ? PALETTE.foreground : DIM_COLOR
  if (level === 'off') {
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
  const waves = level === 'gentle' ? 1 : 2
  return (
    <group>
      <mesh>
        <circleGeometry args={[0.01, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {Array.from({ length: waves }, (_, i) => (
        <mesh key={i}>
          <ringGeometry args={[0.02 + i * 0.014, 0.026 + i * 0.014, 24]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * What each row of the menu is about, outside the component **so that it can be measured**.
 *
 * The labels of this menu already overlapped once —«Modo» was painted on top of the record
 * button— and that cannot be seen from a screen. Taken out here, `legibility.test.ts` writes
 * them on a canvas that takes notes and checks that none overlaps another or leaves the panel.
 */
export function drawRowNames(
  ctx: CanvasRenderingContext2D,
  t: (key: TextKey) => string,
  levels: boolean,
  gameMode: GameMode = 'practice',
  scenery: Scenery = 'place',
  hallGoal: Goal | null = null,
  moreOptions = false,
): void {
  // Only practice asks for the machine's level and the goals; in levels, the goals row becomes
  // that of the level being played, and in the challenge neither of the two is left. What does
  // not belong to the mode, only with «Más opciones» unfolded.
  const { rows: shown, foldable: canFold } = modeRows(gameMode, moreOptions)
  const rowLabels: (readonly [number, string])[] = [
    [ROW.mode, t(MENU_EN.mode)],
    ...(shown.has('machine') ? [[ROW.level, t('Level')] as const] : []),
    ...(shown.has('goals') ? [[ROW.goals, levels ? t('Stage') : t('Goals')] as const] : []),
  ]
  // The name of the cabinet, top left, up to the «Más opciones» button: it is a proper name and
  // is not translated. With it the menu is recognised as that of the other cabinets.
  const left = -PANEL.width / 2 + 0.05
  const moreBox = MENU_BOXES['more options']
  drawText(ctx, gameName(), left, ROW.title, {
    size: MENU_TEXT.title,
    color: PALETTE.foreground,
    align: 'left',
    maxWidth: moreBox.position[0] - moreBox.size[0] / 2 - 0.02 - left,
  })
  // «Más opciones» —or «Menos», unfolded— over its button, if there is anything folded in this
  // mode.
  if (canFold) {
    const { position, size } = moreBox
    drawText(ctx, t(moreOptions ? MENU_EN.fewerOptions : MENU_EN.moreOptions), position[0], ROW.title, {
      size: MENU_TEXT.toggle,
      color: PALETTE.foreground,
      maxWidth: size[0] - 0.01,
    })
  }
  // The comfort carries its name on its own line and to the left of its buttons: above it is
  // the «Más opciones» band.
  if (shown.has('settings')) {
    drawText(ctx, t(COMFORT_LEGEND), -PANEL.width / 2 + 0.05, ROW.comfort, {
      size: MENU_TEXT.comfort,
      color: DIM_COLOR,
      align: 'left',
      maxWidth: MENU_BOXES['comfort off'].position[0] - MENU_BUTTON.small[0] / 2 - 0.02 - (-PANEL.width / 2 + 0.05),
    })
  }
  for (const [y, label] of rowLabels) {
    drawText(ctx, label, -PANEL.width / 2 + 0.05, y + ROW_LABEL_RISE, {
      size: MENU_ROW_LABEL_SIZE,
      color: DIM_COLOR,
      align: 'left',
      maxWidth: PANEL.width / 2,
    })
  }

  // The scenery switch was **an icon and nothing else**: with the goggles on there is no
  // way of knowing what it does until it is pressed. Beside it goes what is set now —to the
  // right and not underneath: underneath it fell right on top of the «Modo» label—.
  if (shown.has('settings')) {
    const startX = MENU_BOXES.scenery.position[0] + MENU_BUTTON.small[0] / 2 + 0.02
    drawText(ctx, t(SCENERY_LABELS[scenery]), startX, ROW.record, {
      size: MENU_TEXT.scenery,
      color: DIM_COLOR,
      align: 'left',
      // Up to the digits of the record, which go to its right (`MENU_RECORD_X`).
      maxWidth: MENU_RECORD_X - 0.07 - startX,
    })
  }

  // Whether the chosen mode counts for a medal, on the line of the «Modo» label and to its right:
  // next to the buttons it talks about. In gold the one that counts, which also carries its mark
  // on the button.
  drawText(ctx, t(medalPhrase(hallGoal, gameMode)), PANEL.width / 2 - 0.05, ROW.mode + ROW_LABEL_RISE, {
    size: MENU_TEXT.medal,
    color: givesMedal(hallGoal, gameMode) ? COMMON_PALETTE.gold : DIM_COLOR,
    align: 'right',
    maxWidth: MENU_MEDAL_WIDTH,
  })

  // The name of each mode, in the strip at the bottom of its button (`MENU_MODE_LABEL_DROP`): the
  // icons alone do not say which mode each one is. The chosen one, in light, like its icon.
  for (const mode of MENU_MODE_ORDER) {
    const [x, y] = MENU_BOXES[`mode ${mode}`].position
    drawText(ctx, t(GAME_MODE_LABELS[mode]), x, y + MENU_MODE_LABEL_DROP, {
      size: MENU_TEXT.mode,
      color: mode === gameMode ? PALETTE.foreground : DIM_COLOR,
      weight: '600',
      maxWidth: MENU_BUTTON.mode[0] - 0.004,
    })
  }

  // And what the chosen mode is. The three were called «Práctica», «Niveles» and «Reto»
  // and nothing else: what tells them apart was only told by the website's screen, which
  // with the headset on cannot be seen.
  drawParagraph(ctx, t(GAME_MODE_HINTS[gameMode]), 0, MENU_HINT_Y, {
    size: MENU_TEXT.hint,
    color: DIM_COLOR,
    maxWidth: PANEL.width - 0.1,
    anchor: 'top',
  })
}

/**
 * The menu, only in its phase. It is mounted anew every time the player comes back to it, and so
 * it always opens with «Más opciones» folded: what is unfolded belongs to the interface and is
 * not stored.
 */
export function XRMenu() {
  const gameState = useGame().gameState
  return gameState === 'menu' ? <OpenMenu /> : null
}

function OpenMenu() {
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
    goal: hallGoal,
  } = useGame()
  const [moreOptions, setMoreOptions] = useState(false)
  const exit = useExit()
  const [comfort, setComfort] = useComfort()
  // Outside an augmented reality session there is no room to show: the
  // headset does not deliver the passthrough in virtual reality.
  const passthroughAvailable = useXR((state) => state.mode) === 'immersive-ar'
  const t = translator(useLang())

  // **Only practice asks**: level and goals are dictated by the ladder in the challenge and in
  // levels, so there the match is already made and its rows are not painted —not even switched
  // off—. Levels keeps its own, which is which unlocked level is played. And what does not
  // belong to the mode, only with «Más opciones» unfolded.
  const { rows: shown, foldable: canFold } = modeRows(gameMode, moreOptions)
  const practice = shown.has('machine')
  const levels = gameMode === 'levels'

  // The names of the rows, on a separate canvas: the rest of the panel is geometry and a
  // letter does not fit there. The third row changes its question with the mode, so it
  // changes its name with it.
  const nameRows = useCallback(
    (ctx: CanvasRenderingContext2D) => drawRowNames(ctx, t, levels, gameMode, scenery, hallGoal, moreOptions),
    [levels, t, gameMode, scenery, hallGoal, moreOptions],
  )

  return (
    <group>
      <XRPanel width={PANEL.width} height={PANEL.height} />

      {/* What each row is about. It goes above its buttons and not inside: inside one would
          have to choose between the name and the icon, and the icon is what is pressed. */}
      <group position={[0, 0, 0.004]}>
        <CanvasPanel
          width={PANEL.width}
          height={PANEL.height}
          draw={nameRows}
          fallbackColor={PALETTE.background}
        />
      </group>

      {/* «Más opciones» or «Menos opciones»: the writing goes on the canvas of the labels. */}
      {canFold ? (
        <XRPressable box={MENU_BOXES['more options']} onSelect={() => setMoreOptions(!moreOptions)}>
          <XRPlate
            width={MENU_BUTTON.toggle[0]}
            height={MENU_BUTTON.toggle[1]}
            color={moreOptions ? PALETTE.primaryDeep : PALETTE.rail}
            opacity={moreOptions ? 0.95 : 0.8}
          />
        </XRPressable>
      ) : null}

      {/* How much a goal against is felt (`lib/hitFeedback.ts`). Here and not only on the
          website because it is with the headset on that one knows whether it causes dizziness.
          Behind «Más opciones». */}
      {shown.has('settings') && COMFORT_LEVELS.map((option) => {
        const selected = option === comfort
        return (
          <XRPressable key={option} box={MENU_BOXES[`comfort ${option}`]} onSelect={() => setComfort(option)}>
            <XRPlate
              width={SMALL_BUTTON[0]}
              height={SMALL_BUTTON[1]}
              color={selected ? PALETTE.primaryDeep : PALETTE.rail}
              opacity={selected ? 0.95 : 0.7}
            />
            <ComfortIcon comfort={option} lit={selected} />
          </XRPressable>
        )
      })}

      {MENU_MODE_ORDER.map((mode) => {
        const selected = mode === gameMode
        return (
          <XRPressable
            key={mode}
            box={MENU_BOXES[`mode ${mode}`]}
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
            {/* The mode that gives a medal carries its mark in the corner: a gold disc, which
                is told apart by being there or not, besides the phrase below saying so. */}
            {givesMedal(hallGoal, mode) ? (
              <mesh position={[MODE_BUTTON[0] / 2 - MEDAL_MARK * 1.6, MODE_BUTTON[1] / 2 - MEDAL_MARK * 1.6, 0.002]}>
                <circleGeometry args={[MEDAL_MARK, 20]} />
                <meshBasicMaterial color={COMMON_PALETTE.gold} toneMapped={false} />
              </mesh>
            ) : null}
          </XRPressable>
        )
      })}

      {/* Level ladder: the bar grows and the colour goes from green to red, so
          the level is read by shape and by colour, not only by colour. */}
      {practice ? DIFFICULTY_ORDER.map((level, index) => {
        const selected = level === difficulty
        const height = levelBarHeight(index, DIFFICULTY_ORDER.length)
        return (
          <XRPressable
            key={level}
            box={MENU_BOXES[`level ${level}`]}
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

      {/* The goals row: how many to play to in practice, or the level in Levels
          (with its stars underneath). The same two buttons, another question. In
          the challenge there is no question and it is not painted. */}
      {shown.has('goals') ? (
        <>
          <XRPressable
            box={MENU_BOXES.minus}
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
            // Endless: a ring instead of a digit, which is «this does not end».
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
            box={MENU_BOXES.plus}
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

          {/* Endless, beside the goals: the same question —how much— with the other
              answer. In the challenge and levels there is nothing to choose. */}
          {practice ? (
            <XRPressable
              box={MENU_BOXES.endless}
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

      {/* The record of the chosen mode, small and dimmed: it is a fact, not a
          decision. It is only shown if there is one to beat. */}
      {bestPoints > 0 && !levels ? (
        <XRNumber
          value={bestPoints}
          size={0.04}
          color={DIM_COLOR}
          position={[MENU_RECORD_X, ROW.record, 0]}
        />
      ) : null}

      {/* What is painted around, in the record's band, which is the only one
          with room. It is here and not only in the website's menu because this
          is where it is useful: with the goggles on it is changed without
          leaving the session. Outside an augmented reality session there is no
          room to show, so the button switches off instead of promising it. It
          writes the hall's scenery: the hall's panel and this button show the same. */}
      {shown.has('settings') ? (
        <XRPressable
          box={MENU_BOXES.scenery}
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
      ) : null}

      <XRPressable
        box={MENU_BOXES.play}
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
        box={MENU_BOXES.exit}
        onSelect={exit}
      >
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.rail}
          opacity={0.8}
        />
        <XRExitIcon />
      </XRPressable>
    </group>
  )
}
