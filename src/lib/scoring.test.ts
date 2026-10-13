import { describe, expect, it } from 'vitest'
import { DIFFICULTY_ORDER } from './gameConfig'
import {
  BASE_GOAL_POINTS,
  CONCEDED_PENALTY,
  MAX_STREAK_MULTIPLIER,
  concededPenalty,
  goalPoints,
  scoreConceded,
  scoreGoal,
  streakMultiplier,
} from './scoring'

describe('the streak multiplier', () => {
  it('multiplies nothing on the first goal', () => {
    expect(streakMultiplier(1)).toBe(1)
  })

  it('grows with each chained goal', () => {
    expect(streakMultiplier(3)).toBeGreaterThan(streakMultiplier(2))
  })

  it('has a cap, so that lasting does not beat playing well', () => {
    expect(streakMultiplier(1000)).toBe(MAX_STREAK_MULTIPLIER)
  })

  it('treats an impossible value as if there were no streak', () => {
    expect(streakMultiplier(Number.NaN)).toBe(1)
    expect(streakMultiplier(-4)).toBe(1)
  })
})

describe('the points of a goal', () => {
  it('are worth the base at the easiest level and with no streak', () => {
    expect(goalPoints({ difficulty: 'easy', streak: 1 })).toBe(BASE_GOAL_POINTS)
  })

  it('are worth more the higher the level', () => {
    const perLevel = DIFFICULTY_ORDER.map((difficulty) =>
      goalPoints({ difficulty, streak: 1 }),
    )

    const increasing = perLevel.every(
      (points, index) => index === 0 || points > perLevel[index - 1],
    )
    expect(increasing).toBe(true)
  })

  it('are always integers', () => {
    expect(Number.isInteger(goalPoints({ difficulty: 'hard', streak: 3 }))).toBe(
      true,
    )
  })
})

describe('the score of a match', () => {
  it('goes up on scoring', () => {
    expect(scoreGoal(0, { difficulty: 'easy', streak: 1 })).toBe(
      BASE_GOAL_POINTS,
    )
  })

  it('goes down on conceding', () => {
    expect(scoreConceded(500)).toBe(500 - CONCEDED_PENALTY)
  })

  it('does not drop below zero however many goals are scored against you', () => {
    expect(scoreConceded(scoreConceded(10))).toBe(0)
  })
})

describe('what conceding costs in the challenge', () => {
  it('in the first round, nothing: losing it 1–3 with one goal scored leaves the points of the goal', () => {
    let points = scoreGoal(0, { difficulty: 'easy', streak: 1 })
    for (let goal = 0; goal < 3; goal += 1) points = scoreConceded(points, concededPenalty(1))
    expect(points).toBe(100)
  })

  it('from the second, and outside the challenge, the usual', () => {
    expect(concededPenalty(2)).toBe(CONCEDED_PENALTY)
    expect(concededPenalty(16)).toBe(CONCEDED_PENALTY)
    expect(concededPenalty(null)).toBe(CONCEDED_PENALTY)
  })
})

/**
 * The lap of the challenge. It is the only multiplier that is not chosen: one
 * gets to it by holding out fifteen rounds without losing, and what it does is
 * make carrying on after the last round worth more than repeating it (see
 * `challenge.ts`).
 */
describe('the lap multiplier', () => {
  it('the first lap —and not being in the challenge— multiply nothing', () => {
    const plain = goalPoints({ difficulty: 'hard', streak: 1 })
    expect(goalPoints({ difficulty: 'hard', streak: 1, lap: 1 })).toBe(plain)
  })

  it('each lap is worth more than the previous one', () => {
    const first = goalPoints({ difficulty: 'hard', streak: 1, lap: 1 })
    const second = goalPoints({ difficulty: 'hard', streak: 1, lap: 1.5 })

    expect(second).toBeGreaterThan(first)
    expect(second).toBe(Math.round(first * 1.5))
  })

  it('a multiplier that arrived broken or below one does not deduct points', () => {
    const whole = goalPoints({ difficulty: 'easy', streak: 1, lap: 1 })
    for (const lap of [0, -2, Number.NaN]) {
      expect(goalPoints({ difficulty: 'easy', streak: 1, lap }), String(lap)).toBe(whole)
    }
  })

  it('reaches the score of the match, not only the calculation of one goal', () => {
    expect(scoreGoal(0, { difficulty: 'easy', streak: 1, lap: 2 })).toBe(BASE_GOAL_POINTS * 2)
  })
})
