/**
 * The goal sign in this game: where it hangs and which run it is told about.
 *
 * The sign is common to every game of the hall (`goal.ts` and `GoalSign.tsx`); what belongs to
 * air hockey is here: that it goes **above the back scoreboard**, over the machine's goal, which
 * is where one already looks while playing; that the run that counts is the challenge, and that
 * what remains for whoever plays is the round, how many goals it is played to and what the next
 * goal is worth.
 *
 * Without three or React: the scene places what comes out of here, the tests measure it and the
 * Godot port reads it as is.
 */

import { challengeRound } from './challenge'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from './gameConfig'
import { GAME_MODE_LABELS, type GameMode } from './gameMode'
import { MENU_EN } from './menuWords'
import { MEDALS, countsForMedal, type Medal, type Goal, type Run, type Translate, type GoalSignView } from './goal'
import { distanceFromEyes, eyesAt, panelRotation, pointOnPanel, type PanelPose, type Triple } from './panelReading'
import { HALF_LENGTH } from './puckPhysics'
import { goalPoints } from './scoring'
import { HAPTIC_RECIPES, pulsesFor, type HandSide, type HandPulse } from './hapticFeedback'
import { REFERENCE_EYE_HEIGHT } from './uiHeight'

/**
 * The back scoreboard, in table space (its centre, at the height of the board): over the
 * machine's goal and tilted towards whoever plays. It is where the sign hangs from, and that is
 * why its measurements live here and the scene reads them.
 */
export const BACK_SCOREBOARD = {
  center: [0, 0.5, -HALF_LENGTH - 0.05] as [number, number, number],
  /** Like three's `rotation.x`: leaning back, facing the eyes. */
  tilt: -0.18,
  width: 0.52,
  height: 0.34,
} as const

/** The air between the top edge of the scoreboard and the sign, in metres. */
export const GAP_ABOVE_SCOREBOARD = 0.03

/** What the sign measures per metre of reading distance: its width and its height. */
export interface SignProportion {
  readonly width: number
  readonly height: number
}

/** Where the sign ends up and how it is oriented. */
export interface SignPlacement {
  /** Its centre, in table space, which is where the interface hangs from. */
  readonly position: [number, number, number]
  /** Like three's `rotation`: facing the eyes and tilted towards them. */
  readonly rotation: [number, number, number, 'YXZ']
  /** From the eyes to the centre of the sign, in metres: its size comes from there. */
  readonly distance: number
}

/** From table space to the player's: the feet at the origin and `−Z` ahead. */
function toPlayerSpace(part: Triple): [number, number, number] {
  return [part[0], part[1] + TABLE_HEIGHT, part[2] + TABLE_CENTER_Z]
}

/** The centre of the top edge of the scoreboard, in the player's space. */
export function scoreboardTopEdge(): { x: number; y: number; z: number } {
  const pose: PanelPose = {
    position: toPlayerSpace(BACK_SCOREBOARD.center),
    rotation: [BACK_SCOREBOARD.tilt, 0, 0],
  }
  return pointOnPanel(pose, 0, BACK_SCOREBOARD.height / 2)
}

/** The pose of the sign once placed, in the player's space: to measure it. */
export function signPose(placement: SignPlacement): PanelPose {
  return { position: toPlayerSpace(placement.position), rotation: placement.rotation }
}

/**
 * Where the sign goes: **above the back scoreboard, centred**, with its bottom edge a finger
 * away from the top edge of the scoreboard and facing the eyes of whoever plays.
 *
 * There it sits at eye level and straight ahead: it is read without turning the head or raising
 * it, and above the whole table, so it covers neither the puck nor the goal. It hangs from the
 * interface, which goes up and down with the eyes (`XRUiHeight`), just like the scoreboard: what
 * it measures from them does not change with height.
 *
 * The size depends on the distance and the distance on where the centre ends up, which in turn
 * depends on the size and on the tilt: the centre is corrected by what is missing, a few passes.
 *
 * @param proportion What the sign measures per metre of reading distance.
 */
export function signPlacement(proportion: SignProportion): SignPlacement {
  const eyes = eyesAt(REFERENCE_EYE_HEIGHT)
  const edge = scoreboardTopEdge()
  const rest = { x: edge.x, y: edge.y + GAP_ABOVE_SCOREBOARD, z: edge.z }

  let center: [number, number, number] = [rest.x, rest.y, rest.z]
  for (let pass = 0; pass < 12; pass++) {
    const pose: PanelPose = { position: center, rotation: panelRotation(center, eyes) }
    const bottom = pointOnPanel(pose, 0, (-proportion.height * distanceFromEyes(center, eyes)) / 2)
    center = [center[0] + rest.x - bottom.x, center[1] + rest.y - bottom.y, center[2] + rest.z - bottom.z]
  }
  return {
    position: [center[0], center[1] - TABLE_HEIGHT, center[2] - TABLE_CENTER_Z],
    rotation: panelRotation(center, eyes),
    distance: distanceFromEyes(center, eyes),
  }
}

/**
 * Where the first-time tutorial goes: **to one side of the sign**, on the right.
 *
 * It used to be straight ahead, above the table and at 1.2 m: 36° wide by 28° high right in front
 * of the scoreboard (13° wide) and of the sign (24°), which were wholly covered while it lasted
 * —and the first run is the challenge, the one that has a goal to read—. Above there is no room
 * without raising the head 19° and below it would cover the table, so it moves aside: at the same
 * distance and at the same height, turned towards the eyes, so each letter takes up the same
 * degrees it did. At 32° its left edge is 14° from straight ahead and the sign ends at 12°: two
 * degrees of air. On the right, because the stop button is on the left (55°). TO BE CALIBRATED
 * WITH THE HEADSET.
 */
export const TUTORIAL_TO_ONE_SIDE = {
  /** Degrees to the right of straight ahead. */
  azimuth: 32,
  /** From the eyes to the panel, horizontally. */
  distance: 1.2,
  /** How far its centre rises above the reference eyes. */
  aboveEyes: 0.02,
} as const

/**
 * The centre of the tutorial, in table space.
 *
 * @param azimuth Degrees to the right of straight ahead; with zero, straight ahead: where it used
 *   to be, and where it still is on a flat screen, which has nowhere to turn the head to.
 */
export function tutorialPlacement(azimuth: number = TUTORIAL_TO_ONE_SIDE.azimuth): [number, number, number] {
  const angle = (azimuth * Math.PI) / 180
  return [
    TUTORIAL_TO_ONE_SIDE.distance * Math.sin(angle),
    REFERENCE_EYE_HEIGHT + TUTORIAL_TO_ONE_SIDE.aboveEyes - TABLE_HEIGHT,
    -TUTORIAL_TO_ONE_SIDE.distance * Math.cos(angle) - TABLE_CENTER_Z,
  ]
}

/**
 * The two neon strips of the back wall: at what height the centre of each one goes and how much
 * they measure, in metres. They are drawn by `Room.tsx` and, in Godot, `room.ts`.
 *
 * **Their height depends on the sign.** The sign rises with the eyes and the wall does not: from
 * 1.6 m it sat 1.9° below the lower strip, but from 1.8 m on it reached it and at 1.9 m it had it
 * wholly behind, glowing through the background of the sign. With both fifteen centimetres higher
 * —the separation between them does not change— 0.4° of air is left with the eyes at 1.9 m;
 * lower down, more (`scoreboardSign.legible.test.ts`).
 */
export const BACK_NEONS = {
  thickness: 0.06,
  strips: [
    { y: 2.75, width: 5 },
    { y: 2.45, width: 3.6 },
  ],
} as const

/** The mode the medals come from: the one of the cabinet's record. */
const MODE_THAT_COUNTS: GameMode = 'challenge'

/** The challenge's mission in one phrase. */
export const CHALLENGE_MISSION = 'Win games until you lose one'

/** What remains for whoever plays: the round, how many goals it goes to and what the next one is worth. */
export const REMAINING_TEMPLATE = 'Round {round} · to {goals} goals · goal +{points}'

/**
 * What remains, written. **That is where the thousands of the thresholds come from**: the next
 * goal is worth whatever the round says —the machine goes up a level and the goals are worth
 * more— and the streak so far.
 */
export function remainingText(round: number, streak: number, t: Translate): string {
  const current = challengeRound(round)
  return t(REMAINING_TEMPLATE, {
    round: current.round,
    goals: current.goalTarget,
    points: goalPoints({ difficulty: current.difficulty, streak: streak + 1, lap: current.multiplier }),
  })
}

/** Whether that mode gives a medal: what the menu says about each one. */
export function givesMedal(goal: Goal | null | undefined, mode: GameMode): boolean {
  return mode === MODE_THAT_COUNTS && countsForMedal(goal, mode)
}

/** What the menu says about a mode: whether it counts for a medal or not. */
export function medalPhrase(goal: Goal | null | undefined, mode: GameMode) {
  return givesMedal(goal, mode) ? ('Counts for a medal' as const) : ('Does not count for a medal' as const)
}

/** What the sign needs to know about what is being played. */
export interface GameInPlay {
  /** What the hall passed, if it passed it. */
  goal?: Goal | null
  gameMode: GameMode
  gameState: 'menu' | 'countdown' | 'playing' | 'finished'
  /** The round of the challenge currently in play (1 outside it). */
  round: number
  /** The goals of the whole run, by both: with any, play is already under way. */
  goals: number
  points: number
  /** Goals in a row without conceding. */
  streak: number
  /** The record of the mode stored here at the start; zero if there is none. */
  record: number
}

/**
 * The run the sign is told about, or `null` if there is nothing to hang.
 *
 * The one that counts is the challenge —or the mode the hall says—: during the first countdown,
 * the mission and the thresholds; afterwards, the threshold that is missing and what remains; at
 * the end, what was missing. In any other mode, inside the hall the sign says quietly that it
 * does not count for a medal; with the game opened on its own there is no medal to talk about and
 * it is not hung. In the menu, never.
 */
export function signRun(game: GameInPlay, t: Translate): Run | null {
  const { gameMode, gameState } = game
  if (gameState === 'menu') return null
  const goal = game.goal ?? null
  const mission = t(CHALLENGE_MISSION)
  if (!givesMedal(goal, gameMode)) {
    if (goal == null) return null
    return { goal, phase: 'playing', points: 0, mission, counts: false, mode: t(GAME_MODE_LABELS[gameMode]) }
  }
  const notStarted = gameState === 'countdown' && game.round === 1 && game.goals === 0
  return {
    goal,
    phase: gameState === 'finished' ? 'end' : notStarted ? 'before' : 'playing',
    points: game.points,
    mission,
    remaining: remainingText(game.round, game.streak, t),
    record: game.record > 0 ? game.record : null,
  }
}

/**
 * What the back scoreboard omits because the sign above it already says it.
 *
 * With the goal straight ahead, repeating the points below forced a choice of where to look; and
 * the round is written on the sign while playing. At the end the sign says what was missing, so
 * the round goes back to the scoreboard: it is the one the challenge stopped at.
 */
export function scoreboardOmits(run: Run | null): { points: boolean; round: boolean } {
  const counts = run != null && run.counts !== false
  return { points: counts, round: counts && run.phase !== 'end' }
}

/** What the sound of each crossed threshold is called (`audioEngine.ts`; in Godot, its rendered effect). */
export const THRESHOLD_SOUND = { bronze: 'medal-bronze', silver: 'medal-silver', gold: 'medal-gold' } as const

/**
 * What is felt in the mallet hand on crossing a threshold: something far away has arrived,
 * stronger the better the medal is. It comes out after the pulse of the goal that crossed it,
 * which would otherwise cut it off. TO BE CALIBRATED WITH THE HEADSET.
 */
export function thresholdPulses(medal: Medal, hand: HandSide | null): HandPulse[] {
  if (hand == null) return []
  return pulsesFor({ type: 'arrival', hand, strength: 0.5 + 0.25 * MEDALS.indexOf(medal) }).map((pulse) => ({
    ...pulse,
    delay: pulse.delay + HAPTIC_RECIPES.arrival.ms,
  }))
}

/**
 * How long the notice that the run now counts lasts, in milliseconds: just enough to read one
 * line before the countdown reaches the serve.
 */
export const NOW_IT_COUNTS_MS = 2500

/** The phrase of the notice: the hall's common one (`menuWords.ts`). */
export const NOW_IT_COUNTS_NOTICE = MENU_EN.nowItCounts

/**
 * The sign right when the tutorial closes in the challenge: its big line says that **now it
 * counts for a medal**, and then it goes back to the usual.
 *
 * While learning, the goals conceded do not count; when the tutorial closes —through its steps,
 * through «Siguiente» or through «Saltar»— the challenge starts from zero, and whoever plays has
 * to know that what comes now does count. Only in the challenge, which is the only thing that
 * gives a medal.
 */
export function withNowItCountsNotice(
  view: GoalSignView | null,
  gameMode: GameMode,
  announcing: boolean,
  t: Translate,
): GoalSignView | null {
  if (view == null || view.subdued || gameMode !== 'challenge' || !announcing) return view
  return { ...view, title: t(NOW_IT_COUNTS_NOTICE) }
}
