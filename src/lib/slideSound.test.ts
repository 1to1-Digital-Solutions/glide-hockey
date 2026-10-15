import { describe, expect, it } from 'vitest'

import { MAX_PUCK_SPEED } from './gameConfig'
import { STALL_SPEED } from './puckPhysics'
import { SLIDE_MAX_LEVEL, SLIDE_PITCH_MAX, SLIDE_PITCH_MIN, slideLevel, slidePitch } from './slideSound'

// The same maths drives the web voice and the Godot loop: here its extremes are pinned, which
// is where the port renders its loop (at the maximum speed) and from where it scales it.
describe('the slide of the puck', () => {
  it('at rest it does not sound and at the maximum speed it reaches its cap, without exceeding it', () => {
    expect(slideLevel(STALL_SPEED)).toBe(0)
    expect(slideLevel(MAX_PUCK_SPEED)).toBeCloseTo(SLIDE_MAX_LEVEL, 12)
    expect(slideLevel(MAX_PUCK_SPEED * 2)).toBe(slideLevel(MAX_PUCK_SPEED))
  })

  it('the pitch goes from one end of the band to the other', () => {
    expect(slidePitch(0)).toBe(SLIDE_PITCH_MIN)
    expect(slidePitch(MAX_PUCK_SPEED)).toBe(SLIDE_PITCH_MAX)
    expect(slidePitch(-1)).toBe(SLIDE_PITCH_MIN)
  })
})
