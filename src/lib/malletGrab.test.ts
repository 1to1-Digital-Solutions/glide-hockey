import { describe, expect, it } from 'vitest'
import { GRAB_REACH, nextGrab, type MalletGrab } from './malletGrab'

/**
 * What is checked here is how grabbing the mallet feels, which is what the ray got
 * wrong: the mallet has to go where the hand goes and not where one aims.
 */
const atRest: MalletGrab = { held: false, target: { x: 0, z: 0.6 } }

describe('grabbing the mallet', () => {
  it('squeezing with the hand on top grabs it', () => {
    const after = nextGrab(atRest, {
      position: { x: 0.02, z: 0.62 },
      grabbing: true,
    })

    expect(after.held).toBe(true)
    expect(after.target).toEqual({ x: 0.02, z: 0.62 })
  })

  it('squeezing from far away does not bring it to the hand', () => {
    // It is what would turn it back into a cursor: the mallet crossing half the table in one
    // jump because someone squeezed a button while looking that way.
    const after = nextGrab(atRest, {
      position: { x: 0.5, z: -0.4 },
      grabbing: true,
    })

    expect(after.held).toBe(false)
    expect(after.target).toEqual(atRest.target)
  })

  it('the hand does not have to land exactly on top', () => {
    const justInside = { x: atRest.target.x, z: atRest.target.z + GRAB_REACH - 0.001 }
    expect(nextGrab(atRest, { position: justInside, grabbing: true }).held).toBe(true)
  })

  it('without squeezing it is not grabbed, however much on top the hand is', () => {
    const after = nextGrab(atRest, { position: atRest.target, grabbing: false })
    expect(after.held).toBe(false)
  })
})

describe('holding the mallet', () => {
  const held: MalletGrab = { held: true, target: { x: 0, z: 0.6 } }

  it('follows the hand wherever it goes', () => {
    // Without this it would be let go mid-hit, which is when the hand goes fastest and
    // furthest: the grab radius only decides when it is grabbed, not when it is let go.
    const far = { x: 0.45, z: 0.15 }
    expect(nextGrab(held, { position: far, grabbing: true })).toEqual({
      held: true,
      target: far,
    })
  })

  it('is let go on releasing the button, and the mallet stays where it was', () => {
    const after = nextGrab(held, { position: { x: 0.3, z: 0.2 }, grabbing: false })
    expect(after).toEqual({ held: false, target: held.target })
  })

  it('losing the controller for one frame does not let it go', () => {
    // Tracking is lost when the controller leaves the headset's field of view. Letting go
    // there would leave the mallet lying in the middle of a rally.
    expect(nextGrab(held, null)).toEqual(held)
  })
})
