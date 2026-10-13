import { describe, expect, it } from 'vitest'

import { EXIT_BUTTONS, HOLD_IDLE, HOLD_TO_EXIT_SECONDS, holdStep, type HoldToExit } from './holdToExit'

/**
 * The long press that takes you out of the game: the same count as the hall's
 * (`xrcade/src/lib/salon/holdToExit.test.ts` and `godot/tests/test_hold_to_exit.gd`).
 */

/** Holds (or not) for `seconds` at 72 Hz, and counts how many times it fired. */
function hold(pressed: boolean, seconds: number, from: HoldToExit = HOLD_IDLE) {
  let state = from
  let fired = 0
  let progress = 0
  for (let t = 0; t < seconds; t += 1 / 72) {
    const step = holdStep(state, pressed, 1 / 72)
    state = step.state
    progress = step.progress
    if (step.exit) fired += 1
  }
  return { state, fired, progress }
}

describe('hold to exit', () => {
  it('a short tap does not take you out of the game, and the ring is halfway', () => {
    const { fired, progress } = hold(true, HOLD_TO_EXIT_SECONDS * 0.5)
    expect(fired).toBe(0)
    expect(progress).toBeGreaterThan(0.4)
    expect(progress).toBeLessThan(0.6)
  })

  it('held for the whole time it fires only once, and the ring goes away', () => {
    const { fired, progress } = hold(true, HOLD_TO_EXIT_SECONDS * 2)
    expect(fired).toBe(1)
    expect(progress).toBe(0)
  })

  it('releasing sets the count to zero', () => {
    const { state } = hold(true, HOLD_TO_EXIT_SECONDS * 0.8)
    expect(holdStep(state, false, 1 / 72)).toEqual({ state: HOLD_IDLE, progress: 0, exit: false })
    expect(hold(true, HOLD_TO_EXIT_SECONDS * 0.8, HOLD_IDLE).fired).toBe(0)
  })

  it('after firing it has to be released to repeat, and a broken clock does not count', () => {
    const { state } = hold(true, HOLD_TO_EXIT_SECONDS * 1.5)
    expect(holdStep(state, true, 1).exit).toBe(false)
    expect(holdStep(HOLD_IDLE, true, Number.NaN).state.held).toBe(0)
    expect(holdStep(HOLD_IDLE, true, -1).state.held).toBe(0)
  })
})

describe('the buttons', () => {
  it('are the B and the Y, as in the hall', () => {
    expect(EXIT_BUTTONS).toEqual(['b-button', 'y-button'])
  })
})
