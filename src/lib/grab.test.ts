import { describe, expect, it } from 'vitest'

import { grabStep, startGrab, stepGrab } from './grab'

/**
 * The two ways of holding what is taken.
 *
 * `hold` is the usual gesture and cannot change by a single frame: it is what the tutorial
 * teaches and what everybody does. `toggle` exists for whoever cannot keep the trigger
 * squeezed for the whole gesture, and what has to be tested about it is just what one gets
 * wrong when writing it: that **releasing the button does not count**, because if it counted
 * the same tap would take and release, and nothing could be taken.
 */

describe('holding the trigger', () => {
  it('squeezing takes and releasing releases', () => {
    expect(grabStep(true, false, 'hold')).toBe('take')
    expect(grabStep(false, true, 'hold')).toBe('release')
  })

  it('and what is beside the point does nothing', () => {
    // Squeezing with something already in the hand, or releasing with the hand empty: it
    // happens when the button repeats the event or when the game was not letting you take yet.
    expect(grabStep(true, true, 'hold')).toBe('nothing')
    expect(grabStep(false, false, 'hold')).toBe('nothing')
  })
})

describe('with one tap', () => {
  it('one tap takes and the next one releases', () => {
    expect(grabStep(true, false, 'toggle')).toBe('take')
    expect(grabStep(true, true, 'toggle')).toBe('release')
  })

  it('releasing the button does not count', () => {
    // It is the whole point: counting the release event, the first tap would take and release
    // in the same gesture and one could not play.
    expect(grabStep(false, false, 'toggle')).toBe('nothing')
    expect(grabStep(false, true, 'toggle')).toBe('nothing')
  })

  it('a whole gesture: take, move and release, without holding anything', () => {
    let holding = false
    const steps: string[] = []
    // Squeezing and releasing the button, twice: it is what the hand really does.
    for (const pressed of [true, false, true, false]) {
      const step = grabStep(pressed, holding, 'toggle')
      if (step === 'take') holding = true
      if (step === 'release') holding = false
      steps.push(step)
    }

    expect(steps).toEqual(['take', 'nothing', 'release', 'nothing'])
    expect(holding).toBe(false)
  })
})

describe('looking at the button every frame', () => {
  /** Runs a few frames with the button as it is told. */
  function frames(buttons: boolean[], mode: 'hold' | 'toggle') {
    let state = startGrab()
    const carried: boolean[] = []
    for (const pressed of buttons) {
      state = stepGrab(state, pressed, mode)
      carried.push(state.holding)
    }
    return carried
  }

  it('holding, something is carried exactly while the button is squeezed', () => {
    expect(frames([false, true, true, true, false, false], 'hold')).toEqual([
      false, true, true, true, false, false,
    ])
  })

  it('with one tap, what counts is that the button becomes squeezed', () => {
    // One tap is several frames with the button squeezed, not one: without looking at the edge,
    // the grab would turn on and off ninety times a second.
    expect(frames([false, true, true, true, false, false], 'toggle')).toEqual([
      false, true, true, true, true, true,
    ])
  })

  it('and the next tap releases it', () => {
    expect(frames([true, false, true, false], 'toggle')).toEqual([
      true, true, false, false,
    ])
  })

  it('starts with the hand empty', () => {
    expect(startGrab()).toEqual({ holding: false, wasPressed: false })
  })
})
