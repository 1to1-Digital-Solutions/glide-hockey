import { describe, expect, it } from 'vitest'

import {
  MAX_EYE_HEIGHT,
  MIN_EYE_HEIGHT,
  REFERENCE_EYE_HEIGHT,
  RETAKE_DELTA,
  RETAKE_SECONDS,
  hasFloorReference,
  isPlausibleEyeHeight,
  startTracking,
  trackHeight,
  uiRise,
  uiRiseOverWorld,
  worldRise,
} from './uiHeight'

/**
 * The interface at the height of whoever plays.
 *
 * It was nailed to a fixed height: for someone short it ended up above eye level and for
 * someone tall, at chest height —and that is where the settings and the exit button are—.
 * This is tested here because it is arithmetic; whether it reads comfortably is a matter of
 * putting the headset on.
 */
describe('which height is taken as good', () => {
  it('that of a pair of eyes, standing or seated', () => {
    expect(isPlausibleEyeHeight(1.6)).toBe(true)
    expect(isPlausibleEyeHeight(MIN_EYE_HEIGHT)).toBe(true)
    expect(isPlausibleEyeHeight(MAX_EYE_HEIGHT)).toBe(true)
  })

  it('and not that of the headset on a table nor that of anyone three metres tall', () => {
    expect(isPlausibleEyeHeight(0.4)).toBe(false)
    expect(isPlausibleEyeHeight(3)).toBe(false)
    expect(isPlausibleEyeHeight(null)).toBe(false)
    expect(isPlausibleEyeHeight(Number.NaN)).toBe(false)
  })
})

describe('how much the interface rises', () => {
  it('with the reference stature it stays exactly where it was', () => {
    expect(uiRise(REFERENCE_EYE_HEIGHT)).toBe(0)
  })

  it('it rises with whoever is taller and drops with whoever is shorter', () => {
    expect(uiRise(1.8)).toBeCloseTo(0.2, 6)
    expect(uiRise(1.4)).toBeCloseTo(-0.2, 6)
  })

  it('with no good height nothing is made up', () => {
    expect(uiRise(null)).toBe(0)
    expect(uiRise(0.2)).toBe(0)
  })
})

describe('whether the session measures from the floor', () => {
  it('with `local-floor` or `bounded-floor`, yes', () => {
    expect(hasFloorReference(['local-floor'])).toBe(true)
    expect(hasFloorReference(['bounded-floor'])).toBe(true)
  })

  it('with no list it is taken as good: there are browsers that do not publish it', () => {
    expect(hasFloorReference(undefined)).toBe(true)
  })

  it('with a list and no floor, no', () => {
    expect(hasFloorReference(['local'])).toBe(false)
  })
})

describe('when it is measured again', () => {
  const step = (state: ReturnType<typeof startTracking>, height: number | null, seconds = 1 / 72) =>
    trackHeight(state, height, 1, seconds)

  it('the first good measurement is used as is', () => {
    // Coming in and seeing the menu at eye height, not a panel rising slowly.
    expect(step(startTracking(), 1.75).held).toBeCloseTo(1.75, 6)
  })

  it('with no good measurement nothing is touched', () => {
    const initial = startTracking()

    expect(step(initial, null)).toBe(initial)
    expect(step(initial, 0.3)).toBe(initial)
  })

  it('moving while playing does not move the interface', () => {
    // Standing on tiptoe or crouching to reach something: the interface stays still, otherwise
    // the button slips away just as one goes to aim at it.
    let state = step(startTracking(), 1.7)
    for (let t = 0; t < 2; t += 1 / 72) state = step(state, 1.7 + RETAKE_DELTA * 0.8)

    expect(state.held).toBeCloseTo(1.7, 6)
  })

  it('nor does a big, short change', () => {
    let state = step(startTracking(), 1.7)
    for (let t = 0; t < RETAKE_SECONDS / 2; t += 1 / 72) state = step(state, 1.2)

    expect(state.held).toBeCloseTo(1.7, 6)
  })

  it('but sitting down halfway through a match does', () => {
    let state = step(startTracking(), 1.7)
    for (let t = 0; t < RETAKE_SECONDS * 2; t += 1 / 72) state = step(state, 1.2)

    expect(state.held).toBeCloseTo(1.2, 6)
  })
})

describe('the world at the height of whoever plays', () => {
  it('standing, nothing moves, however tall they are', () => {
    // It is what whoever has asked for nothing sees, which is nearly everyone: the
    // scene exactly where it has always been.
    expect(worldRise(1.2, false)).toBe(0)
    expect(worldRise(1.6, false)).toBe(0)
    expect(worldRise(2.0, false)).toBe(0)
  })

  it('seated, the world drops down to the eyes', () => {
    // A seated player measures about one metre twenty at the eyes: the world has
    // to drop the forty centimetres it is short of reaching them.
    expect(worldRise(1.2, true)).toBeCloseTo(-0.4, 10)
  })

  it('for whoever is taller it rises, for the same reason', () => {
    expect(worldRise(1.8, true)).toBeCloseTo(0.2, 10)
  })

  it('with no good measurement nothing is made up', () => {
    // With no floor in the reference space, or with the headset on the table, the
    // height is not a stature: one plays with the scene where it was.
    for (const height of [null, undefined, Number.NaN, 0, 5]) {
      expect(worldRise(height, true)).toBe(0)
    }
  })
})

describe('the interface when the world has already moved', () => {
  it('with the world still, the interface places itself', () => {
    expect(uiRiseOverWorld(1.4, false)).toBeCloseTo(uiRise(1.4), 10)
  })

  it('with the world lowered, it is not corrected again', () => {
    // Adding the two corrections left the menu at knee height, precisely for
    // whoever is least able to crouch to look for it.
    expect(uiRiseOverWorld(1.2, true)).toBe(0)
    expect(uiRiseOverWorld(1.9, true)).toBe(0)
  })

  it('with no good measurement nothing moves, whatever is asked for', () => {
    expect(uiRiseOverWorld(null, true)).toBe(0)
    expect(uiRiseOverWorld(null, false)).toBe(0)
  })
})
