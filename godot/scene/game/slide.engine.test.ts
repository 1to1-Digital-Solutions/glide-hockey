/**
 * The puck's slide in Godot: the loop was rendered at top speed and is scaled with the web's
 * sums (`slideSound.ts`). It runs in the engine, with the domain tests.
 */
import { describe, expect, it } from 'vitest'

import { MAX_PUCK_SPEED } from '@/lib/gameConfig'
import { STALL_SPEED } from '@/lib/puckPhysics'
import { SLIDE_PITCH_MAX, SLIDE_PITCH_MIN, slideLevel } from '@/lib/slideSound'

import { puckSlide } from './events'

describe('the slide of the puck', () => {
  it('at top speed the loop sounds just as it was rendered', () => {
    expect(puckSlide(MAX_PUCK_SPEED)).toEqual({ volume: 1, pitch: 1 })
  })

  it('stopped it is silent, and slower is quieter and lower, in the proportion of the web', () => {
    expect(puckSlide(0).volume).toBe(0)
    expect(puckSlide(STALL_SPEED).volume).toBe(0)
    expect(puckSlide(0).pitch).toBeCloseTo(SLIDE_PITCH_MIN / SLIDE_PITCH_MAX, 12)
    const slow = puckSlide(1.5)
    const fast = puckSlide(4)
    expect(slow.volume).toBeLessThan(fast.volume)
    expect(slow.pitch).toBeLessThan(fast.pitch)
    expect(slow.volume).toBeCloseTo(slideLevel(1.5) / slideLevel(MAX_PUCK_SPEED), 12)
  })

  it('faster than the cap does not go above that', () => {
    expect(puckSlide(MAX_PUCK_SPEED * 3)).toEqual({ volume: 1, pitch: 1 })
  })
})
