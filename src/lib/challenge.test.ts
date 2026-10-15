import { describe, expect, it } from 'vitest'
import {
  CHALLENGE_GOAL_STEPS,
  CHALLENGE_ROUNDS,
  LAP_STEP,
  challengeRound,
  lapMultiplier,
} from './challenge'
import { DIFFICULTY_ORDER } from './gameConfig'

describe('the challenge ladder', () => {
  it('starts with the easiest and the shortest match', () => {
    const first = challengeRound(1)

    expect(first.difficulty).toBe(DIFFICULTY_ORDER[0])
    expect(first.goalTarget).toBe(CHALLENGE_GOAL_STEPS[0])
  })

  it('lengthens the match before going up a level', () => {
    const second = challengeRound(2)

    expect(second.difficulty).toBe(DIFFICULTY_ORDER[0])
    expect(second.goalTarget).toBeGreaterThan(challengeRound(1).goalTarget)
  })

  it('goes up a level once the lengths run out and goes back to the short one', () => {
    const next = challengeRound(CHALLENGE_GOAL_STEPS.length + 1)

    expect(next.difficulty).toBe(DIFFICULTY_ORDER[1])
    expect(next.goalTarget).toBe(CHALLENGE_GOAL_STEPS[0])
  })

  it('never leaves the difficulties that exist', () => {
    for (let round = 1; round <= CHALLENGE_ROUNDS + 20; round++) {
      expect(DIFFICULTY_ORDER).toContain(challengeRound(round).difficulty)
    }
  })

  it('starts the ladder again past the last round', () => {
    // It used to stay stuck on Impossible at seven goals: the same match over
    // and over and for the same points. Now round sixteen is the first rung
    // again, and what changes is what the goals are worth.
    const first = challengeRound(1)
    const past = challengeRound(CHALLENGE_ROUNDS + 1)

    expect(past.difficulty).toBe(first.difficulty)
    expect(past.goalTarget).toBe(first.goalTarget)
    // The number shown to the player does keep going up.
    expect(past.round).toBe(CHALLENGE_ROUNDS + 1)
  })

  it('treats an impossible round as the first', () => {
    expect(challengeRound(0).goalTarget).toBe(CHALLENGE_GOAL_STEPS[0])
    expect(challengeRound(Number.NaN).difficulty).toBe(DIFFICULTY_ORDER[0])
  })
})

describe('the laps of the ladder', () => {
  it('the whole ladder is the first lap and multiplies nothing', () => {
    for (let round = 1; round <= CHALLENGE_ROUNDS; round++) {
      const current = challengeRound(round)
      expect(current.lap, `round ${round}`).toBe(1)
      expect(current.multiplier, `round ${round}`).toBe(1)
    }
  })

  it('past the last round the second lap starts, and it is worth more', () => {
    const second = challengeRound(CHALLENGE_ROUNDS + 1)
    expect(second.lap).toBe(2)
    expect(second.multiplier).toBe(1 + LAP_STEP)

    const third = challengeRound(CHALLENGE_ROUNDS * 2 + 1)
    expect(third.lap).toBe(3)
    expect(third.multiplier).toBe(1 + 2 * LAP_STEP)
  })

  it('the lap does not change mid-lap', () => {
    for (let round = CHALLENGE_ROUNDS + 1; round <= CHALLENGE_ROUNDS * 2; round++) {
      expect(challengeRound(round).lap, `round ${round}`).toBe(2)
    }
  })

  it('the multiplier goes up half by half and never drops below one', () => {
    expect(lapMultiplier(1)).toBe(1)
    expect(lapMultiplier(0)).toBe(1)
    expect(lapMultiplier(-3)).toBe(1)
    expect(lapMultiplier(Number.NaN)).toBe(1)
    for (let lap = 1; lap < 8; lap++) {
      expect(lapMultiplier(lap + 1) - lapMultiplier(lap)).toBeCloseTo(LAP_STEP, 10)
    }
  })
})
