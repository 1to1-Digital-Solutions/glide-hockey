import { describe, expect, it } from 'vitest'
import { MAX_PUCK_SPEED } from './gameConfig'
import { puckGlow } from './puckGlow'

/**
 * That the puck lights up with speed, which is what lets one follow it out of the corner of
 * the eye while it crosses the table in half a second.
 *
 * It also had a ring that widened, and with the headset on it did not read as a fast puck
 * but as a spotlight. It was removed; the glow does the same job without looking like
 * something else.
 */

describe('the glow of the puck', () => {
  it('at rest it barely glows', () => {
    const still = puckGlow(0)
    expect(still.emissive).toBeGreaterThan(0)
    expect(still.emissive).toBeLessThan(0.3)
  })

  it('the faster, the more it glows, up to the maximum speed', () => {
    const slow = puckGlow(1)
    const fast = puckGlow(4)
    const capped = puckGlow(MAX_PUCK_SPEED)
    expect(fast.emissive).toBeGreaterThan(slow.emissive)
    expect(capped.emissive).toBeGreaterThan(fast.emissive)
    expect(puckGlow(MAX_PUCK_SPEED * 2)).toEqual(capped)
  })

  it('and it has nothing around it', () => {
    // The check on what was removed: if a ring comes back, this test says so.
    expect(Object.keys(puckGlow(3))).toEqual(['emissive'])
  })

  it('an impossible speed counts as rest', () => {
    expect(puckGlow(Number.NaN)).toEqual(puckGlow(0))
    expect(puckGlow(-3)).toEqual(puckGlow(0))
  })
})
