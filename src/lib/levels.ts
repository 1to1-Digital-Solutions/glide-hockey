import { CHALLENGE_ROUNDS, challengeRound, type ChallengeRound } from './challenge'

/**
 * Levels mode: the challenge ladder, one match at a time.
 *
 * Each level is a round of `challengeRound` —the same machine level, the same
 * goals—, but it is played on its own: winning it gives stars according to what
 * is conceded, and one is enough to unlock the next. The challenge is still the
 * challenge: in one go and until the first defeat. This is for coming back
 * another day and carrying on from where one was.
 *
 * All of it is pure functions: what gets stored lives in `progress.ts`.
 */

/** As many levels as the challenge ladder has rungs. */
export const LEVEL_COUNT = CHALLENGE_ROUNDS

export type Stars = 0 | 1 | 2 | 3

/** Clamps a level to the range that exists; anything odd falls to the first. */
export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1
  return Math.min(LEVEL_COUNT, Math.max(1, Math.floor(level)))
}

/** What is played at that level: the round of the ladder with its number. */
export function levelSpec(level: number): ChallengeRound {
  return challengeRound(clampLevel(level))
}

/**
 * The stars of a match won, by what was conceded: none if it was lost; one
 * for winning; two if the machine scored fewer than half as many as you;
 * three if it scored none.
 */
export function levelStars(won: boolean, playerGoals: number, opponentGoals: number): Stars {
  if (!won || playerGoals <= 0) return 0
  if (opponentGoals <= 0) return 3
  if (opponentGoals * 2 < playerGoals) return 2
  return 1
}

/** Passing is at least one star. */
export function levelPassed(stars: Stars): boolean {
  return stars >= 1
}

/**
 * Up to which level one can play after this match: the one that was already
 * unlocked, or the one after the passed one if it goes further. It never goes down.
 */
export function nextUnlocked(unlocked: number, level: number, stars: Stars): number {
  const current = clampLevel(unlocked)
  if (!levelPassed(stars)) return current
  return Math.max(current, clampLevel(level + 1))
}
