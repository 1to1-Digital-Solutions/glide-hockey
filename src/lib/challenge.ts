import { DIFFICULTY_ORDER, type Difficulty } from './gameConfig'

/**
 * The ladder of challenge mode: what comes up in each round.
 *
 * The challenge climbs by two different rungs, and in this order:
 *
 * 1. **Within one difficulty, longer matches.** The machine plays just as
 *    well, but it has to be beaten more times in a row: what is put to the
 *    test is holding out without giving goals away.
 * 2. **Once the lengths run out, a higher level.** The difficulty goes up and
 *    the short match comes back, which is how a new level is entered without
 *    the first puck catching you off guard.
 *
 * That order matters: the other way round —raising the level every round and
 * lengthening afterwards— the player would reach Impossible in five rounds and
 * the challenge would be over before it started.
 *
 * **Past round fifteen the ladder starts again, and that is a lap.**
 * It used to stay stuck on the last rung: whoever got there kept playing
 * the same match against Impossible over and over, earning exactly the
 * same points, and the challenge stopped climbing without ever ending. Now each
 * lap **multiplies what the goals are worth** (`lapMultiplier`), so what decides
 * a score is no longer holding out for fifteen rounds: it is how many laps are
 * done. And the second lap starts at the bottom again on purpose —it is the lap
 * of honour—: from Impossible at seven goals there is no higher rung to climb
 * to, and the only thing left would be repeating it.
 */

/** Goals of each match within one same difficulty, from fewest to most. */
export const CHALLENGE_GOAL_STEPS = [3, 5, 7] as const

/** Rounds in one whole lap of the ladder. */
export const CHALLENGE_ROUNDS =
  DIFFICULTY_ORDER.length * CHALLENGE_GOAL_STEPS.length

/**
 * How much each lap adds to the goals multiplier.
 *
 * Half as much again for each one: the second is worth one and a half times,
 * the third double. It goes up by halves and not by doubling per lap because
 * the multiplier combines with the difficulty one (×5 on Impossible) and the
 * streak one (×2.5 at most), and by doubling, the fourth lap would be worth
 * eight times the first: the score would stop measuring how one plays and
 * start measuring for how long.
 */
export const LAP_STEP = 0.5

/** What is played in one round of the challenge. */
export interface ChallengeRound {
  /** Round number, 1-based: it is what the player is shown. */
  round: number
  difficulty: Difficulty
  goalTarget: number
  /**
   * Which lap of the ladder it is on, 1-based. The first lap is 1, and from
   * round sixteen onwards, 2.
   */
  lap: number
  /** What this round's goals are multiplied by for the lap they fall in. */
  multiplier: number
}

/**
 * What the goals are multiplied by on lap `lap` (1-based). The first one
 * multiplies nothing: it is the challenge just as it was.
 */
export function lapMultiplier(lap: number): number {
  const safeLap = Number.isFinite(lap) ? Math.max(1, Math.floor(lap)) : 1
  return 1 + (safeLap - 1) * LAP_STEP
}

/**
 * What comes up in round `round` (1-based).
 *
 * Rounds below 1 are treated as the first: a challenge always starts on the
 * bottom rung, and returning something odd here would come out in the scene as
 * a match to zero goals that ends by itself.
 */
export function challengeRound(round: number): ChallengeRound {
  const safeRound = Number.isFinite(round) ? Math.max(1, Math.floor(round)) : 1
  // Past the ladder it starts again from the bottom, and the lap is noted.
  const index = (safeRound - 1) % CHALLENGE_ROUNDS
  const lap = Math.floor((safeRound - 1) / CHALLENGE_ROUNDS) + 1
  const steps = CHALLENGE_GOAL_STEPS.length

  return {
    round: safeRound,
    difficulty: DIFFICULTY_ORDER[Math.floor(index / steps)],
    goalTarget: CHALLENGE_GOAL_STEPS[index % steps],
    lap,
    multiplier: lapMultiplier(lap),
  }
}
