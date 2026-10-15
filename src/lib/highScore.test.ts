import { beforeEach, describe, expect, it } from 'vitest'
import {
  HIGH_SCORE_KEYS,
  getBestEndlessStreak,
  getBestPoints,
  parseBestPoints,
  saveBestEndlessStreak,
  saveBestPoints,
} from './highScore'

beforeEach(() => {
  window.localStorage.clear()
})

describe('what is read from the browser', () => {
  it('with nothing stored there is no record', () => {
    expect(parseBestPoints(null)).toBe(0)
    expect(parseBestPoints('   ')).toBe(0)
  })

  it('discards what someone may have written by hand', () => {
    expect(parseBestPoints('a lot')).toBe(0)
    expect(parseBestPoints('-40')).toBe(0)
    expect(parseBestPoints('12.5')).toBe(0)
  })

  it('accepts an integer', () => {
    expect(parseBestPoints('1200')).toBe(1200)
  })
})

describe('saving the record', () => {
  it('only writes if it improves on what was there', () => {
    saveBestPoints('practice', 500)
    saveBestPoints('practice', 300)

    expect(getBestPoints('practice')).toBe(500)
  })

  it('keeps one record per mode', () => {
    saveBestPoints('practice', 500)

    expect(getBestPoints('challenge')).toBe(0)
    expect(window.localStorage.getItem(HIGH_SCORE_KEYS.challenge)).toBeNull()
  })

  it('does not save an impossible score', () => {
    saveBestPoints('practice', Number.NaN)

    expect(getBestPoints('practice')).toBe(0)
  })
})

describe('the streak of the endless match', () => {
  it('is only saved if it improves on the one there was', () => {
    saveBestEndlessStreak(5)
    saveBestEndlessStreak(3)

    expect(getBestEndlessStreak()).toBe(5)
  })

  it('an impossible streak is not saved', () => {
    // It comes from the match, but also from what is stored, which is edited by hand.
    saveBestEndlessStreak(5)
    for (const streak of [0, -1, 2.5, Number.NaN]) saveBestEndlessStreak(streak)

    expect(getBestEndlessStreak()).toBe(5)
  })
})
