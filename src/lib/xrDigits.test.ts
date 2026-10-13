import { describe, expect, it } from 'vitest'
import { DIGIT_SEGMENTS, digitsOf } from './xrDigits'

describe('the digits of a number', () => {
  it('splits a number of several digits in order', () => {
    expect(digitsOf(1250)).toEqual([1, 2, 5, 0])
  })

  it('zero is a single digit', () => {
    expect(digitsOf(0)).toEqual([0])
  })

  it('cuts off the decimals instead of trying to draw them', () => {
    expect(digitsOf(7.9)).toEqual([7])
  })

  it('treats what cannot be drawn as a zero', () => {
    expect(digitsOf(-30)).toEqual([0])
    expect(digitsOf(Number.NaN)).toEqual([0])
    expect(digitsOf(Number.POSITIVE_INFINITY)).toEqual([0])
  })

  it('knows how to draw the ten digits', () => {
    expect(DIGIT_SEGMENTS).toHaveLength(10)
    for (const segments of DIGIT_SEGMENTS) {
      expect(segments.length).toBeGreaterThan(0)
    }
  })
})
