import { describe, expect, it } from 'vitest'

import { MUSIC_FADE_MS, fadeVolume } from './musicFade'

/**
 * The fade of the music.
 *
 * It is tested here because it is arithmetic; that the cut is not heard is a matter of
 * listening to it. What this watches is that the ramp starts where it was, ends where it was
 * asked to and does not stray on the way: a volume above the chosen one is the music
 * covering the game.
 */
describe('the fade ramp', () => {
  it('starts where it was and ends where it was asked to', () => {
    expect(fadeVolume(0, 0.22, 0)).toBe(0)
    expect(fadeVolume(0, 0.22, 1)).toBe(0.22)
  })

  it('a clock that overshoots does not raise the music above the chosen volume', () => {
    expect(fadeVolume(0, 0.22, 4)).toBe(0.22)
    expect(fadeVolume(0.22, 0, -1)).toBe(0.22)
  })

  it('starts and ends softly, which is what keeps it from being noticed', () => {
    // A straight ramp would be worth 0.11 halfway and the start and the sudden stop would be heard.
    expect(fadeVolume(0, 0.22, 0.1)).toBeLessThan(0.022)
    expect(fadeVolume(0, 0.22, 0.9)).toBeGreaterThan(0.198)
  })

  it('halfway it is at the half', () => {
    expect(fadeVolume(0, 0.22, 0.5)).toBeCloseTo(0.11, 6)
  })

  it('works in both directions', () => {
    expect(fadeVolume(0.22, 0, 0.5)).toBeCloseTo(0.11, 6)
  })

  it('a broken clock leaves the volume where it is', () => {
    expect(fadeVolume(0.22, 0, Number.NaN)).toBe(0.22)
  })

  it('lasts long enough not to be heard and short enough not to get in the way', () => {
    expect(MUSIC_FADE_MS).toBeGreaterThan(300)
    expect(MUSIC_FADE_MS).toBeLessThan(1500)
  })
})
