import { describe, expect, it } from 'vitest'
import { CHALLENGE_ROUNDS, challengeRound } from './challenge'
import { LEVEL_COUNT, clampLevel, levelPassed, levelSpec, levelStars, nextUnlocked } from './levels'

describe('the levels', () => {
  it('there are as many as the challenge has rungs, and each one is its round', () => {
    expect(LEVEL_COUNT).toBe(CHALLENGE_ROUNDS)
    expect(levelSpec(4)).toEqual(challengeRound(4))
  })

  it('a level that does not exist falls to the nearest edge', () => {
    expect(clampLevel(0)).toBe(1)
    expect(clampLevel(LEVEL_COUNT + 10)).toBe(LEVEL_COUNT)
    expect(clampLevel(2.7)).toBe(2)
    expect(clampLevel(Number.NaN)).toBe(1)
  })
})

describe('the stars', () => {
  it('losing gives none, winning gives one', () => {
    expect(levelStars(false, 2, 3)).toBe(0)
    expect(levelStars(true, 3, 2)).toBe(1)
  })

  it('conceding fewer than half gives two, and none gives three', () => {
    expect(levelStars(true, 5, 2)).toBe(2)
    expect(levelStars(true, 5, 0)).toBe(3)
    // Exactly half does not make it to two.
    expect(levelStars(true, 4, 2)).toBe(1)
  })

  it('passing is one star at least', () => {
    expect(levelPassed(0)).toBe(false)
    expect(levelPassed(1)).toBe(true)
  })
})

describe('the unlocking', () => {
  it('passing the highest level opens the next one, without going past the last', () => {
    expect(nextUnlocked(3, 3, 1)).toBe(4)
    expect(nextUnlocked(LEVEL_COUNT, LEVEL_COUNT, 3)).toBe(LEVEL_COUNT)
  })

  it('repeating a lower one or not passing leaves things as they were', () => {
    expect(nextUnlocked(5, 2, 3)).toBe(5)
    expect(nextUnlocked(3, 3, 0)).toBe(3)
  })
})
