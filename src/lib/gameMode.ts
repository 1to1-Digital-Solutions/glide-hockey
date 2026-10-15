/**
 * With what intent a match is played.
 *
 * - **Practice**: the difficulty and how many goals to play to are chosen, and
 *   the match ends when someone gets there. Losing costs nothing. It is for
 *   steadying one's hand or trying a new level.
 * - **Levels**: the same ladder as the challenge, but one match at a time: each
 *   level is a round of `challengeRound`, winning it gives stars according to
 *   what is conceded (`levels.ts`) and unlocks the next one. What is unlocked
 *   is remembered between visits (`progress.ts`): there is no need to start
 *   again from the easy part.
 * - **Challenge**: it starts with the easiest and the machine tightens up by
 *   itself —more goals per match and, afterwards, a higher level (see
 *   `challenge.ts`)—. Each match won chains into the next and the first one
 *   lost closes the challenge. It has no end: one holds out as long as one can,
 *   and the score comes from that. It is the heroic mode: in one go, with no
 *   checkpoints.
 * - **Duel**: two players, taking turns with one controller. Each plays a match against the
 *   same machine —same level, same goals, same seed— and whoever beats it by more wins
 *   (`duel.ts` explains why it is done this way).
 *
 * All of it is pure functions over scores: the state lives in `gameStore` and the
 * interface only draws it, the same as with the scoring.
 */

import { challengeFirst, foldRows, type RowRole } from './menuTemplate'

export type GameMode = 'practice' | 'levels' | 'challenge' | 'duel'

/**
 * Order of the modes in the selectors: the single-player ones, from the gentlest to the most
 * demanding, and at the end the two-player one, which is another way of playing and not one
 * more rung.
 */
export const GAME_MODE_ORDER: GameMode[] = ['practice', 'levels', 'challenge', 'duel']

/**
 * The modes in the «Modo» row of both menus, with the challenge —the one that gives a medal—
 * first, as the common template asks (`challengeFirst` of `menuTemplate.ts`); the rest, in
 * their order.
 */
export const MENU_MODE_ORDER: readonly GameMode[] = challengeFirst(GAME_MODE_ORDER, (mode) => mode === 'challenge')

/**
 * The menu rows that depend on the mode, in the three menus (the headset one, the start screen
 * and Godot): the machine's level, the goals one (how many to play to in practice, or which
 * level in levels) and the settings of whoever plays (the scenery and the comfort of the hit
 * feedback).
 */
export type MenuRow = 'mode' | 'machine' | 'goals' | 'settings'

/** What the menu shows in a mode: which rows and whether it has the «Más opciones» button. */
export interface ModeRows {
  rows: ReadonlySet<MenuRow>
  /** Something is behind «Más opciones»: the button is there, whether it says «Más» or «Menos». */
  foldable: boolean
}

/**
 * Which rows the menu shows in `mode`, with what is behind «Más opciones» unfolded or not
 * (`foldRows` of the common template). The mode row counts as belonging to the mode and, in
 * levels, so does the one for which level is played, which is what pins down the chosen mode;
 * the machine's level and the practice goals (with endless), the scenery and the comfort are
 * folded. With the challenge chosen nothing is folded: it is a fixed match.
 */
export function modeRows(mode: GameMode, moreOptions: boolean): ModeRows {
  const practice = mode === 'practice'
  const rows: MenuRow[] = ['mode']
  if (practice) rows.push('machine')
  if (practice || mode === 'levels') rows.push('goals')
  rows.push('settings')
  const role = (row: MenuRow): RowRole => (row === 'mode' || (row === 'goals' && mode === 'levels') ? 'mode' : 'other')
  const inChallenge = mode === 'challenge'
  return {
    rows: new Set(foldRows(rows, role, { moreOptions, inChallenge }).rows),
    foldable: foldRows(rows, role, { moreOptions: false, inChallenge }).folded > 0,
  }
}

/** Visible label, in English: it is the key it is translated with (see `textos.ts`). */
export const GAME_MODE_LABELS = {
  practice: 'Practice',
  levels: 'Levels',
  challenge: 'Challenge',
  duel: 'Duel',
} as const satisfies Record<GameMode, string>

/** What each mode promises, in one line, for the menu. */
export const GAME_MODE_HINTS = {
  practice: 'You choose the level and the goals. Losing costs nothing.',
  levels: 'One game at a time. The level you win stays unlocked for next time.',
  challenge: 'It steps up on its own, in one run. The first game you lose ends it.',
  duel: 'Take turns with one controller against the same machine: whoever beats it by more wins.',
} as const satisfies Record<GameMode, string>

/**
 * The endless match of practice: it is not played to any number of goals, it
 * goes on until the player ends it. It is represented as a match to infinite
 * goals, which is exactly what it is: `runOutcome` never closes it. The points
 * grow without a cap, so its record is the best streak.
 */
export const ENDLESS = Number.POSITIVE_INFINITY

export function isEndless(goalTarget: number): boolean {
  return !Number.isFinite(goalTarget)
}

/**
 * How a match has ended.
 *
 * - `won`: the player reached the agreed goals first. In challenge it means
 *   having passed the round and carrying on.
 * - `lost`: the machine got there first.
 */
export type RunOutcome = 'won' | 'lost'

/** What needs to be known about a match to decide whether it is still alive. */
export interface RunProgress {
  /** The player's goals in the match in progress. */
  playerGoals: number
  /** The machine's goals in the match in progress. */
  opponentGoals: number
  /** How many goals this match is played to. */
  goalTarget: number
}

/**
 * How the match has ended, or `null` if it is still going.
 *
 * Both scores are checked, and the player's wins in an impossible tie: there
 * is no way for both to get there at once —the puck stops on going in—, but
 * an outcome that depends on the order of two `if`s is a trap waiting for a
 * change in the simulation.
 */
export function runOutcome({
  playerGoals,
  opponentGoals,
  goalTarget,
}: RunProgress): RunOutcome | null {
  if (playerGoals >= goalTarget) return 'won'
  if (opponentGoals >= goalTarget) return 'lost'
  return null
}
