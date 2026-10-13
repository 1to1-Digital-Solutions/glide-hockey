import { type Difficulty } from './gameConfig'

/**
 * Score of a match.
 *
 * The rule of the game is simple —**each goal you score adds and each goal
 * scored against you subtracts**— and here only how much is decided. Two things
 * modulate it, and both reward playing better and not just playing more:
 *
 * - **The difficulty**, because scoring against Impossible costs what scoring
 *   against Easy does not. It multiplies what is earned; what is lost is fixed,
 *   or going up a level would punish the same mistake twice.
 * - **The streak**, because chaining goals without conceding is harder than
 *   trading them. A goal against cuts it off at once.
 * - **The lap of the challenge**, which is the only one of the three that is not
 *   chosen: one gets to it by holding out fifteen rounds without losing (see
 *   `challenge.ts`). Outside the challenge it is worth one and changes nothing.
 *
 * The score **does not drop below zero**: it is a mark that is compared with the
 * record, and a negative one says nothing the scoreboard does not say. And **in the first
 * round of the challenge conceding does not subtract** (`concededPenalty`): losing it with
 * one goal scored does not leave zero.
 */

/** Points of a goal before applying any multiplier. */
export const BASE_GOAL_POINTS = 100

/** What a conceded goal deducts, the same at every difficulty. */
export const CONCEDED_PENALTY = 60

/**
 * How much each difficulty multiplies. It grows more than proportionally to the
 * margin it takes away: if it were linear, a long match on Easy would yield the
 * same as a tight one on Impossible and choosing a level would make no difference.
 */
const DIFFICULTY_MULTIPLIERS: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2.25,
  expert: 3.5,
  impossible: 5,
}

/** How much each chained goal adds to the streak. */
const STREAK_STEP = 0.2

/**
 * Cap of the streak multiplier. Without it, a long challenge on Easy would give
 * more than a flawless one on Impossible just for lasting longer.
 */
export const MAX_STREAK_MULTIPLIER = 2.5

/**
 * Multiplier for the streak. The first goal goes at 1 and each chained one adds,
 * up to the cap.
 *
 * @param streak consecutive goals without conceding, **including** the current one
 */
export function streakMultiplier(streak: number): number {
  if (!Number.isFinite(streak) || streak <= 1) return 1
  return Math.min(1 + (streak - 1) * STREAK_STEP, MAX_STREAK_MULTIPLIER)
}

/** Points a goal adds. Always an integer: decimals say nothing to the
 * player. */
export function goalPoints({
  difficulty,
  streak,
  lap = 1,
}: {
  difficulty: Difficulty
  streak: number
  /** What the lap of the challenge multiplies by. One —or nothing— outside it. */
  lap?: number
}): number {
  return Math.round(
    BASE_GOAL_POINTS *
      DIFFICULTY_MULTIPLIERS[difficulty] *
      streakMultiplier(streak) *
      Math.max(1, Number.isFinite(lap) ? lap : 1),
  )
}

/** The score after scoring a goal. */
export function scoreGoal(
  points: number,
  options: { difficulty: Difficulty; streak: number; lap?: number },
): number {
  return points + goalPoints(options)
}

/**
 * What a conceded goal deducts in that round of the challenge (`null` outside it).
 *
 * **In the first round of the challenge, nothing.** It is the one of whoever is new to the game,
 * on Easy and to three goals: scoring one and losing it 1–3 subtracted 180 and the sign closed
 * with «0 puntos», which told whoever had just scored their first goal that they had done
 * nothing. From the second round on, the usual. Outside the challenge, too.
 */
export function concededPenalty(round: number | null): number {
  return round === 1 ? 0 : CONCEDED_PENALTY
}

/** The score after conceding a goal, with zero as the floor. */
export function scoreConceded(points: number, penalty: number = CONCEDED_PENALTY): number {
  return Math.max(0, points - penalty)
}
