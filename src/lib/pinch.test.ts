import { describe, expect, it } from 'vitest'

import { PINCH_CLOSE, PINCH_OPEN, isPinching } from './pinch'

/**
 * Grabbing with the bare hand.
 *
 * It is tested here because it is a threshold, and thresholds without hysteresis are noticed
 * late: with only one, a hand trembling right on it lets go of and grabs the object several
 * times a second.
 */
describe('the pinch', () => {
  it('with the fingertips together, it grabs', () => {
    expect(isPinching(0.01, false)).toBe(true)
  })

  it('with the hand open, it does not', () => {
    expect(isPinching(0.09, false)).toBe(false)
  })

  it('holds through the tremor: letting go takes more than grabbing', () => {
    // Right between the two thresholds: if it was already grabbing, it keeps on; if not, it does not start.
    const between = (PINCH_CLOSE + PINCH_OPEN) / 2

    expect(isPinching(between, true)).toBe(true)
    expect(isPinching(between, false)).toBe(false)
  })

  it('spreading all the way lets go', () => {
    expect(isPinching(PINCH_OPEN + 0.01, true)).toBe(false)
  })

  it('without joints it does not grab: that is a controller, and its button says so', () => {
    expect(isPinching(null, false)).toBe(false)
    expect(isPinching(null, true)).toBe(false)
    expect(isPinching(Number.NaN, true)).toBe(false)
  })
})
