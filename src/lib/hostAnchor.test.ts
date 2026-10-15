import { describe, expect, it } from 'vitest'

import { entryPlacement, type HostAnchor } from './hostAnchor'

/**
 * What the stage trusts when it is planted, which is what decides where the game appears.
 *
 * The failure this fixes cannot be seen from a screen —there the camera already points at the place—
 * and with the headset on it is seen at once: you turn your head to read the cabinets on the
 * left, you enter, and the table comes out turned towards there. Then you have to turn round entirely
 * or recentre the room to be able to play.
 */

/** What the hall lends: the arc at the feet of whoever entered and turned a quarter of a turn. */
const FROM_HALL: HostAnchor = { position: [1.5, 0, -0.5], yaw: Math.PI / 2 }

/** And what the head says at that instant: turned to look at the cabinets on the left. */
const FEET = { x: 1.2, z: -0.4 }
const GAZE = -Math.PI / 4

describe('what the stage is planted with', () => {
  it('with no host lending an anchor, with the feet and the gaze of now', () => {
    // It is the game's own web: there is no clue other than the gaze, and without it the stage
    // stays wherever the −Z of the room's calibration falls, which may be behind the back.
    expect(entryPlacement(null, FEET, GAZE)).toEqual({ x: 1.2, z: -0.4, yaw: GAZE })
    expect(entryPlacement(undefined, FEET, GAZE)).toEqual({ x: 1.2, z: -0.4, yaw: GAZE })
  })

  it('with the host\'s, with its heading and its place, and NOT with the camera\'s', () => {
    const place = entryPlacement(FROM_HALL, FEET, GAZE)

    expect(place.yaw).toBe(Math.PI / 2)
    expect(place.yaw, 'the heading of the gaze is exactly the one that misplaces').not.toBe(GAZE)
    expect([place.x, place.z]).toEqual([1.5, -0.5])
  })

  it('the height of the host is not inherited: the game sets it', () => {
    // The host only knows about the floor; at what height the table, the tee or the meadow goes
    // is the game's, and bringing its `y` along would lower them or raise them to the head's.
    expect(entryPlacement({ position: [0, 1.6, 0], yaw: 0 }, FEET, GAZE)).toEqual({ x: 0, z: 0, yaw: 0 })
  })

  it('once what was lent is spent —recentring the room—, the gaze rules again', () => {
    // Recentring relocates the whole reference space: what was lent stays pointing to
    // where there is no longer anything, so the gesture that relocates the room beats both.
    expect(entryPlacement(null, { x: 0, z: 0 }, Math.PI)).toEqual({ x: 0, z: 0, yaw: Math.PI })
  })
})
