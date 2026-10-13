'use client'

import { useCallback } from 'react'

import { PLAYER_LABELS, formatMargin, margin, type Player } from '../../lib/duel'
import type { DuelTally } from '../../lib/duelTally'
import { useGame, type DuelView } from '../../lib/gameStore'
import { useDuelTally } from '../../lib/useDuelTally'
import { useGrabMode, useLang } from '../../lib/settingsClient'
import { translator, type TextKey } from '../../lib/textos'
import { CanvasPanel, drawParagraph, drawText } from './canvasPanel'
import { RealController } from './RealController'
import { BACK_SCOREBOARD } from '../../lib/scoreboardSign'
import { isEndless } from '../../lib/gameMode'
import { PALETTE } from '../../lib/palette'
import { emissiveMaterial, COMMON_PALETTE } from '../../lib/commonPalette'
import { useExit } from '../../game/exit'
import {
  DIM_COLOR,
  XRExitIcon,
  XRMenuIcon,
  XRNumber,
  XRPanel,
  XRPlate,
  XRPlayIcon,
  XRPressable,
  type XrHitBox,
} from './XRUi'

/**
 * The scoreboard and the end of the match, inside the headset.
 *
 * It is the immersive equivalent of `ui/HUD`. Everything is seven-segment digits
 * and colour plates (see `lib/xrDigits.ts` for the why of not using text): the
 * scoreboard in cyan is the player's and the red one the machine's, the same
 * colours their mallets carry on the table.
 *
 * Whoever mounts it decides where it goes; here it is only composed (see `GameWorld`).
 */

const SMALL_BUTTON: [number, number] = [0.1, 0.1]
const ACTION_BUTTON: [number, number] = [0.24, 0.11]

/** Height of each row of the scoreboard inside its panel, in metres. */
const ROW = { goals: 0.06, points: -0.065, round: -0.135 }

function hitBox(
  x: number,
  y: number,
  [width, height]: [number, number],
): XrHitBox {
  return { position: [x, y, 0], size: [width, height, 0.04] }
}

/**
 * What the scoreboard plate measures, in metres.
 *
 * It comes out of the component so that it can be checked from outside that no other panel is
 * put in front of it: the settings menu covered it entirely, and that is only seen from the eyes
 * of whoever is playing (`lib/panelOcclusion.ts`).
 */
export const SCOREBOARD_SIZE = { width: BACK_SCOREBOARD.width, height: BACK_SCOREBOARD.height } as const

/**
 * At what height the goals go: in their row at the top, or **in the middle** when the sign above
 * already says the points and the round and nothing is left underneath (`scoreboardOmits`).
 */
export function goalsRow(omitted: { points: boolean; round: boolean }): number {
  return omitted.points && omitted.round ? 0 : ROW.goals
}

/**
 * The scoreboard of the match in progress, with the points underneath.
 *
 * **Minus what the sign above it already says** (`omitted`): in the challenge, the points and
 * the round are read there, in letters, and the goals stay here.
 */
export function XRScoreboard() {
  const { gameState, playerGoals, opponentGoals, points, round, lap, gameMode, activeLevel, duel, omitted: omittedRows } =
    useGame()
  // The round of the challenge, the level in Levels or, in the duel, which player has the
  // controller: the same row. Without letters, the player's number is what says whose the cyan
  // scoreboard is.
  const rowValue = omittedRows.round ? null : (round ?? (gameMode === 'levels' ? activeLevel : duel != null ? duel.player + 1 : null))
  // The lap of the challenge's ladder, only when there is already more than one: on
  // the first it says nothing the round does not already say (see `lib/challenge.ts`).
  const lapCount = !omittedRows.round && lap != null && lap > 1 ? lap : null
  const goalsY = goalsRow(omittedRows)
  if (gameState === 'menu') return null

  return (
    <group>
      {/* Tall enough for the three rows: scoreboard, points and —in the challenge— the
          round. A digit takes up `1.14 × size` counting the thickness of the
          segments, and with the shorter panel the round was drawn on top of the
          points and stuck out at the bottom. */}
      <XRPanel width={SCOREBOARD_SIZE.width} height={SCOREBOARD_SIZE.height} opacity={0.7} />

      <XRNumber
        value={playerGoals}
        size={0.13}
        color={PALETTE.primary}
        position={[-0.12, goalsY, 0]}
      />
      {/* Scoreboard separator: two dots, which is what reads as «a». */}
      {[-0.03, 0.03].map((y) => (
        <mesh key={y} position={[0, goalsY + y, 0]}>
          <planeGeometry args={[0.016, 0.016]} />
          <meshBasicMaterial color={DIM_COLOR} toneMapped={false} />
        </mesh>
      ))}
      <XRNumber
        value={opponentGoals}
        size={0.13}
        color={PALETTE.rival}
        position={[0.12, goalsY, 0]}
      />

      {omittedRows.points ? null : (
        <XRNumber
          value={points}
          size={0.055}
          color={PALETTE.puck}
          position={[0, ROW.points, 0]}
        />
      )}

      {/* In the challenge, the round it is on; in levels, the level. In practice there
          is nothing to show here. With more than one lap of the ladder, the round
          shifts to the left to make room for the lap counter. */}
      {rowValue != null ? (
        <XRNumber
          value={rowValue}
          size={0.04}
          color={DIM_COLOR}
          position={[lapCount != null ? -0.05 : 0, ROW.round, 0]}
        />
      ) : null}

      {/* The lap counter: a cross and the number, in the colour of the points.
          It goes in that colour and not in the round's on purpose: what it says is
          not where things are at, it is that **what is scored now is worth more**
          (see `lib/challenge.ts`). A cross of two crossed strokes and not a letter:
          here there is no typography, there are segments (`XRNumber`). */}
      {lapCount != null ? (
        <group position={[0.05, ROW.round, 0]}>
          {[1, -1].map((turn) => (
            <mesh key={turn} position={[-0.028, 0, 0]} rotation={[0, 0, (turn * Math.PI) / 4]}>
              <planeGeometry args={[0.026, 0.005]} />
              <meshBasicMaterial color={PALETTE.puck} toneMapped={false} />
            </mesh>
          ))}
          <XRNumber value={lapCount} size={0.04} color={PALETTE.puck} position={[0.008, 0, 0]} />
        </group>
      ) : null}
    </group>
  )
}

/**
 * The width and the height of the pick-up-the-mallet notice, in metres.
 *
 * With the height of two rows of its lettering and the paragraph hung near the edge, the first
 * one stuck out of the plate at the top; and in Spanish, with one tap, the phrase takes three.
 * The plate is tall enough for three and the phrase goes centred in it.
 */
export const MALLET_NOTICE: [number, number] = [0.62, 0.2]

/** At what size the pick-up-the-mallet notice is written, in metres of letter height. */
export const MALLET_TEXT = { phrase: 0.036 } as const

/**
 * What the pick-up-the-mallet notice says, outside the component **so that it can be measured**
 * (`countdown.legible.test.ts`): it is headset text like any other panel.
 */
export function drawMalletNotice(
  ctx: CanvasRenderingContext2D,
  t: (key: TextKey) => string,
  oneTap: boolean,
): void {
  drawParagraph(
    ctx,
    t(
      oneTap
        ? 'Press the grip button on the mallet to pick it up'
        : 'Close your hand on the mallet to pick it up',
    ),
    0,
    0,
    { size: MALLET_TEXT.phrase, color: PALETTE.foreground, weight: '700', maxWidth: MALLET_NOTICE[0] - 0.06 },
  )
}

/**
 * The countdown before the serve, large and over the table.
 *
 * **And when it stops, it says why.** In the last second it waits for the mallet to be in the
 * hand —serving with the mallet on the table is starting to lose—, and that was not told: the
 * 1 stayed stuck and from inside it looks as if the game has hung. Reported with the headset
 * on: «the countdown stays stopped on the 1 with no explanation». The phrase is the same one
 * the tutorial shows, and it changes with the way of grabbing chosen in the hall.
 *
 * **And it shows which button it is.** Saying «el botón de agarre» only helps whoever already
 * knows which one it is, and here the tutorial cannot help: its pick-up step is passed **in
 * the countdown**, before the panel ever comes up. So the button lights up where it is, on the
 * controller held in the hand (`RealController.tsx`). On both hands: the mallet is picked up
 * with either.
 */
export function XRCountdown() {
  const { gameState, countdown, waitingForMallet: malletPending } = useGame()
  const t = translator(useLang())
  const oneTap = useGrabMode() === 'toggle'

  const write = useCallback(
    (ctx: CanvasRenderingContext2D) => drawMalletNotice(ctx, t, oneTap),
    [t, oneTap],
  )

  if (gameState !== 'countdown') return null

  if (malletPending) {
    return (
      <>
        {/* Outside the notice's group on purpose: this does not live on the panel, it lives in
            the hand. It places itself, undoing whatever its parents put on it. */}
        <RealController hand="left" button="agarre" />
        <RealController hand="right" button="agarre" />
        <group>
          <XRPanel width={MALLET_NOTICE[0]} height={MALLET_NOTICE[1]} />
          <CanvasPanel
            width={MALLET_NOTICE[0]}
            height={MALLET_NOTICE[1]}
            draw={write}
            fallbackColor={PALETTE.background}
          />
        </group>
      </>
    )
  }

  return (
    <XRNumber value={countdown} size={0.26} color={PALETTE.primaryBright} />
  )
}

/** What the end-of-match panel measures, in metres. */
export const GAME_OVER_SIZE: [number, number] = [0.6, 0.42]

/** The three buttons of the end of the match, in the panel's own coordinates. */
export const GAME_OVER_BOXES = {
  play: hitBox(-0.12, -0.13, ACTION_BUTTON),
  menu: hitBox(0.11, -0.13, SMALL_BUTTON),
  exit: hitBox(0.24, -0.13, SMALL_BUTTON),
}

/**
 * At what size the end of the duel is written, in metres of letter height.
 *
 * A single list for whoever paints and for whoever measures (`duel.legible.test.ts`), the same
 * ones as the exit notice, which goes in the same column and at the same scale.
 */
export const DUEL_TEXT = { title: 0.05, body: 0.034 } as const

/**
 * What is written when a match of the duel ends.
 *
 * It is one of the few things in the headset with letters, and on purpose: «pásale el mando a
 * Jugador 2» is not said with a colour plate. Apart from the component so that it can be
 * **measured** in both languages (`duel.legible.test.ts`): Spanish is longer and it is where
 * the text overflows.
 */
export function drawDuel(
  ctx: CanvasRenderingContext2D,
  t: (key: TextKey, values?: Record<string, string | number>) => string,
  duel: DuelView,
  score: { scored: number; conceded: number },
  tally: DuelTally,
): void {
  const nameOf = (player: Player) => t(PLAYER_LABELS[player])
  const textWidth = GAME_OVER_SIZE[0] - 0.08
  const title = duel.over
    ? duel.winner != null
      ? t('{player} wins', { player: nameOf(duel.winner) })
      : t('Tie')
    : t('{player}: {scored}–{conceded}', { player: nameOf(duel.player), ...score })
  drawText(ctx, title, 0, 0.15, { size: DUEL_TEXT.title, color: PALETTE.foreground, weight: '700', maxWidth: textWidth })

  if (duel.next != null) {
    drawParagraph(ctx, t('Pass the controller to {player}.', { player: nameOf(duel.next) }), 0, 0.05, {
      size: DUEL_TEXT.body,
      color: PALETTE.foreground,
      maxWidth: textWidth,
    })
    return
  }

  ;([0, 1] as const).forEach((player, row) => {
    const match = duel.matches[player]
    if (match == null) return
    drawText(
      ctx,
      t('{player}: {scored}–{conceded} ({margin})', {
        player: nameOf(player),
        scored: match.scored,
        conceded: match.conceded,
        margin: formatMargin(margin(match)),
      }),
      0,
      0.09 - row * 0.05,
      {
        size: DUEL_TEXT.body,
        color: duel.winner === player ? PALETTE.primary : DIM_COLOR,
        weight: duel.winner === player ? '700' : '400',
        maxWidth: textWidth,
      },
    )
  })
  // What the two of them have between them is a phrase with three figures that grow with each
  // duel: it is split into lines and not shrunk, because shrunk it drops below the size that can
  // be read at the column's distance. Anchored at the top it grows only downwards, towards the
  // buttons.
  drawParagraph(
    ctx,
    t('Duels won: {one}–{two} · tied: {ties}', { one: tally.wins[0], two: tally.wins[1], ties: tally.ties }),
    0,
    0.015,
    { size: DUEL_TEXT.body, color: DIM_COLOR, maxWidth: textWidth, anchor: 'top' },
  )
}

/**
 * The end of the match: how many points, and what to do now.
 *
 * Outside the duel, with no text: the result is said with the colour of the
 * plate —the common green of a hit if they won, the red of a miss if they lost,
 * the same ones across the whole hall— and with the scoreboard, which stays in
 * view beside it. The two are also told apart by lightness
 * (`commonPalette.test.ts`), which is what is left without seeing the colour. In
 * the duel it is written (`drawDuel`): whose match it was and whose turn it is,
 * or who wins.
 */
export function XRGameOver() {
  const {
    gameState,
    outcome,
    points,
    isRecord,
    levelResult,
    duel,
    playerGoals,
    opponentGoals,
    startGame,
    resetGame,
  } = useGame()
  const exit = useExit()
  const t = translator(useLang())
  const tally = useDuelTally()

  const writeDuel = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (duel != null) drawDuel(ctx, t, duel, { scored: playerGoals, conceded: opponentGoals }, tally)
    },
    [t, duel, playerGoals, opponentGoals, tally],
  )

  if (gameState !== 'finished') return null

  const won = outcome === 'won'
  return (
    <group>
      <XRPanel width={GAME_OVER_SIZE[0]} height={GAME_OVER_SIZE[1]} />

      {/* In the duel, what is said is written. The play button starts the other player's
          match, or a new duel. */}
      {duel != null ? (
        <group position={[0, 0, 0.004]}>
          <CanvasPanel
            width={GAME_OVER_SIZE[0]}
            height={GAME_OVER_SIZE[1]}
            draw={writeDuel}
            fallbackColor={PALETTE.background}
          />
        </group>
      ) : (
        <>
          <mesh position={[0, 0.13, -0.01]}>
            <planeGeometry args={[0.5, 0.06]} />
            <meshBasicMaterial {...emissiveMaterial(won ? COMMON_PALETTE.hit : COMMON_PALETTE.miss)} />
          </mesh>

          <XRNumber
            value={points}
            size={0.11}
            color={isRecord ? COMMON_PALETTE.gold : PALETTE.foreground}
            position={[0, 0.02, 0]}
          />
        </>
      )}

      {/* The stars of the level, under the points: the ones earned lit. */}
      {levelResult ? (
        <group position={[0, -0.055, 0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[(i - 1) * 0.045, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
              <planeGeometry args={[0.022, 0.022]} />
              <meshBasicMaterial
                color={i < levelResult.stars ? COMMON_PALETTE.gold : DIM_COLOR}
                toneMapped={false}
                transparent
                opacity={i < levelResult.stars ? 1 : 0.35}
              />
            </mesh>
          ))}
        </group>
      ) : null}
      <XRPressable
        box={GAME_OVER_BOXES.play}
        onSelect={startGame}
      >
        <XRPlate
          width={ACTION_BUTTON[0]}
          height={ACTION_BUTTON[1]}
          color={PALETTE.primary}
        />
        <XRPlayIcon size={0.045} />
      </XRPressable>

      {/* Going back to the menu and leaving the game are different things, so they
          carry different icons: two identical crosses cannot be told apart. */}
      <XRPressable box={GAME_OVER_BOXES.menu} onSelect={resetGame}>
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.rail}
          opacity={0.8}
        />
        <XRMenuIcon color={DIM_COLOR} />
      </XRPressable>

      <XRPressable box={GAME_OVER_BOXES.exit} onSelect={exit}>
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

/** Leaving the match without reaching the end; and in the endless one, ending it with a summary. */
export function XRQuitButton() {
  const { gameState, askToQuit, endRun, activeGoalTarget, prompt } = useGame()

  if (gameState !== 'playing' && gameState !== 'countdown') return null
  // With the notice open the button steps aside: the notice comes up right where it is (`XR_QUIT`).
  if (prompt !== null) return null

  return (
    <group>
      {/* It asks before leaving it: the arm passes through here and leaving loses the goals. */}
      {/* In the game's blue and opaque, not grey and translucent: at a metre and a half and with
          the room's machines behind, the grey got lost against them and had to be looked for. */}
      <XRPressable box={hitBox(0, 0, SMALL_BUTTON)} onSelect={askToQuit}>
        <XRPlate
          width={SMALL_BUTTON[0]}
          height={SMALL_BUTTON[1]}
          color={PALETTE.primaryDeep}
          opacity={0.95}
        />
        <XRMenuIcon color={PALETTE.foreground} />
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

/** What the panel takes up, in metres. */
export const CONFIRM_SIZE: [number, number] = [0.72, 0.42]

/**
 * Its three buttons, in the panel's own coordinates.
 *
 * **Three and not two.** The button with the three little bars says «options» and what it did
 * was ask whether to leave: reported with the headset on, «the exit button seems to open the
 * options». Now it opens this, and leaving is one of the things inside — which is the order
 * people expect.
 *
 * Keep playing goes first and widest: it is the answer that loses nothing. «Volver al menú» did
 * not fit in 28 cm with lettering that can be read and shrank to 25 mm: its button measures what
 * the label asks for in English, which is the long one.
 */
export const CONFIRM_BOXES = {
  stay: hitBox(0, -0.04, [0.44, 0.1]),
  menu: hitBox(-0.155, -0.16, [0.37, 0.1]),
  leave: hitBox(0.2, -0.16, [0.26, 0.1]),
}

/** At what size the notice is written, in metres of letter height (`exit.legible.test.ts`). */
export const CONFIRM_TEXT = { title: 0.05, body: 0.034, button: 0.034 } as const

/**
 * The notice before leaving the match.
 *
 * **There is no leaving at a stroke.** The button gets pressed by accident —with the headset
 * on you cannot see what is at the sides and the arm passes where it passes—, and leaving
 * loses the goals scored so far. So the table is stopped and the question is asked; while it
 * is being asked the puck does not run, because otherwise deciding would cost goals.
 *
 * It goes where the menu does, in the middle of the table and at eye height: it is where
 * the player is already looking, and what is decided here is no detail.
 *
 * It is the only part of this game's immersive interface with letters. The rest is digits
 * and colour plates on purpose, but a question cannot be drawn: it has to be read.
 */
/**
 * What the notice says, outside the component **so that it can be measured**.
 *
 * A headset panel is painted on a canvas nobody looks at in the size it is read at, so
 * a text that overflows or two that overlap are only discovered with the goggles on — and
 * that is how this one was discovered. Taken out here, `legibility.test.ts` writes it on a
 * canvas that takes notes and checks that it neither overlaps nor overflows.
 */
export function drawExitNotice(ctx: CanvasRenderingContext2D, t: (key: TextKey) => string): void {
  drawParagraph(ctx, t('Leave the game?'), 0, 0.15, {
    size: CONFIRM_TEXT.title,
    color: PALETTE.foreground,
    weight: '700',
    maxWidth: CONFIRM_SIZE[0] - 0.08,
  })
  drawParagraph(ctx, t('You lose the goals you have scored.'), 0, 0.075, {
    size: CONFIRM_TEXT.body,
    color: DIM_COLOR,
    maxWidth: CONFIRM_SIZE[0] - 0.08,
  })
  drawText(ctx, t('Keep playing'), CONFIRM_BOXES.stay.position[0], CONFIRM_BOXES.stay.position[1], {
    size: CONFIRM_TEXT.button,
    color: PALETTE.background,
    weight: '700',
    maxWidth: CONFIRM_BOXES.stay.size[0] - 0.03,
  })
  drawText(ctx, t('Back to the menu'), CONFIRM_BOXES.menu.position[0], CONFIRM_BOXES.menu.position[1], {
    size: CONFIRM_TEXT.button,
    color: PALETTE.foreground,
    maxWidth: CONFIRM_BOXES.menu.size[0] - 0.03,
  })
  drawText(ctx, t('Leave'), CONFIRM_BOXES.leave.position[0], CONFIRM_BOXES.leave.position[1], {
    size: CONFIRM_TEXT.button,
    color: PALETTE.foreground,
    maxWidth: CONFIRM_BOXES.leave.size[0] - 0.03,
  })
}

export function XRQuitConfirm() {
  const { prompt, resetGame, keepPlaying } = useGame()
  const exit = useExit()
  const t = translator(useLang())

  const write = useCallback((ctx: CanvasRenderingContext2D) => drawExitNotice(ctx, t), [t])

  if (prompt !== 'quit') return null

  return (
    <group>
      <XRPanel width={CONFIRM_SIZE[0]} height={CONFIRM_SIZE[1]} opacity={0.96} />

      {/* Going back to the game's menu and leaving altogether are different things, and until
          now there was only the first one under the name of the second. */}
      <XRPressable box={CONFIRM_BOXES.menu} onSelect={resetGame}>
        <XRPlate
          width={CONFIRM_BOXES.menu.size[0]}
          height={CONFIRM_BOXES.menu.size[1]}
          color={PALETTE.rail}
          opacity={0.9}
        />
      </XRPressable>

      <XRPressable box={CONFIRM_BOXES.leave} onSelect={exit}>
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

      {/* The text goes on top of the plates: the canvas is transparent except where it writes. */}
      <group position={[0, 0, 0.03]}>
        <CanvasPanel
          width={CONFIRM_SIZE[0]}
          height={CONFIRM_SIZE[1]}
          draw={write}
          fallbackColor={PALETTE.background}
        />
      </group>
    </group>
  )
}
