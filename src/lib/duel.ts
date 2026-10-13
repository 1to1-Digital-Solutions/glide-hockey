import { DEFAULT_GOALS, type Difficulty } from './gameConfig'

/**
 * The duel: two people, one controller and the same machine.
 *
 * **Why by matches and not goal by goal.** Without a network, two players can only take turns with
 * the controller, and in air hockey the rhythm is everything: handing over the headset after every
 * goal —taking it off, adjusting it, picking the mallet up again— would break every rally and turn
 * the match into a string of waits. The siblings with a two-player mode change turns by a whole
 * unit of play (a frame in bowling, a hole in minigolf, a match in table-tennis), and here the
 * natural unit is **the match**.
 *
 * **Why against the machine and not one against the other.** There is no way to return to someone
 * a puck that was played a minute ago. What can be done is to give both of them **the same
 * opponent**: the machine, at the same level and to the same goals (`DUEL_SETUP`), and with **the
 * same seed** in both matches (`Duel.seed`). The machine picks each shot with a hash of the seed,
 * the rally and the hit (`opponent.ts`), so on the same rally and the same hit it shoots the same
 * at both: nobody plays against a luckier machine. As the table is chaotic, the puck does not
 * bounce the same —that is decided by how each one plays—, but the machine's decisions are the
 * same.
 *
 * **The winner is whoever gets the bigger lead over the machine**: goals for minus goals against.
 * Winning or losing the match is not enough to compare —both can win it— and neither are the goals
 * for: whoever loses 5–7 has scored more than whoever wins 7–0. The difference does say who
 * dominated the machine. With the same difference it is a tie: breaking the tie by another figure
 * would reward something nobody was after.
 *
 * Pure functions, without React: the whole duel is tested without mounting the game, and the Godot
 * port uses it as is.
 */

export type Player = 0 | 1

/** What each one is called on screen, in English: it is the key it is translated with. */
export const PLAYER_LABELS = ['Player 1', 'Player 2'] as const satisfies readonly [string, string]

/**
 * How the duel is played: the machine on Medium and to 7 goals, the match you enter practice
 * with.
 *
 * Fixed so that both play against the same thing without agreeing on it in the menu, which is
 * exactly what is needed for one's lead to be compared with the other's. Medium and not Easy
 * because on Easy whoever knows how to move the mallet wins 7–0, and two 7–0s are a tie that says
 * nothing.
 */
export const DUEL_SETUP = { difficulty: 'medium', goalTarget: DEFAULT_GOALS } as const satisfies {
  difficulty: Difficulty
  goalTarget: number
}

/** The score of a match against the machine. */
export interface MatchScore {
  /** Goals scored by whoever was playing. */
  readonly scored: number
  /** Goals the machine scored against them. */
  readonly conceded: number
}

/** A duel: the machine's seed and the two matches, in player order. */
export interface Duel {
  /** The seed the machine picks its shots with in both matches (`AimSeed.match`). */
  readonly seed: number
  /** `null` means it has not been played yet. */
  readonly matches: readonly [MatchScore | null, MatchScore | null]
}

/** A duel not yet started, with the seed of its two matches: it is the first one's turn. */
export function newDuel(seed: number): Duel {
  return { seed, matches: [null, null] }
}

/** Whose turn it is to play, or `null` if both have already played. */
export function duelTurn(duel: Duel): Player | null {
  if (duel.matches[0] == null) return 0
  if (duel.matches[1] == null) return 1
  return null
}

/**
 * Who holds the controller: whoever's turn it is or, with both matches played, the last one who
 * played.
 *
 * It is what the scoreboard draws —whose match is the one on show— and it is always someone: a
 * finished duel keeps showing the match that closed it.
 */
export function controllerHolder(duel: Duel): Player {
  return duelTurn(duel) ?? 1
}

/** Have both played? */
export function duelOver(duel: Duel): boolean {
  return duelTurn(duel) == null
}

/**
 * Records the match of whoever had the turn. The seed does not change: it is the one of both.
 *
 * With the duel finished it records nothing: a third match belongs to nobody, and overwriting one
 * of the two would change the result of something that has already been seen.
 */
export function recordMatch(duel: Duel, score: MatchScore): Duel {
  const turn = duelTurn(duel)
  if (turn == null) return duel
  return { seed: duel.seed, matches: turn === 0 ? [score, duel.matches[1]] : [duel.matches[0], score] }
}

/** The lead they got over the machine: positive if they scored more goals than they conceded. */
export function margin(score: MatchScore): number {
  return score.scored - score.conceded
}

/** The lead written the way it reads on a scoreboard: «+3», «−2» or «0». */
export function formatMargin(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `−${-value}`
  return '0'
}

/** Who has won the duel, or `null` if it has not finished or they are tied. */
export function duelWinner(duel: Duel): Player | null {
  const [one, two] = duel.matches
  if (one == null || two == null) return null
  const diff = margin(one) - margin(two)
  if (diff === 0) return null
  return diff > 0 ? 0 : 1
}

/**
 * Whether the ending that has just arrived sounds like winning. `duelFinished` means that with
 * this match both have already played (`DuelView.over`); outside the duel, `false`.
 *
 * Outside the duel, and in the first one's match, the score against the machine says it. **The
 * end of the duel always sounds like winning**: what closes there is not a match against the
 * machine but the duel, and one of the two standing there wins it —or they tie, which is not
 * losing either—. With the score of the second match, a duel won by whoever played first sounded
 * like a defeat.
 */
export function endSoundsLikeWin(duelFinished: boolean, score: MatchScore): boolean {
  return duelFinished || score.scored > score.conceded
}
