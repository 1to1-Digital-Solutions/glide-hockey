import { describe, expect, it } from 'vitest'

import {
  COMFORT_LEVELS,
  DEFAULT_COMFORT,
  HIT_DURATION,
  AT_REST,
  HIT,
  MAX_CONCURRENT_HITS,
  NO_LAYERS,
  layersForHit,
  cutoffAt,
  timeScaleAt,
  hitState,
  shakeShape,
  vignetteShape,
  writeComfort,
  sideInView,
  readComfort,
  parseComfort,
  hitPulses,
  shakeAt,
  addHit,
  unitVector,
  vignetteAt,
  type Hit,
} from './hitFeedback'
import { HAPTIC_RECIPES } from './hapticFeedback'

/** A fake storage, with failures on demand. */
function fakeStorage(initial: Record<string, string> = {}, { fails = false } = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => {
      if (fails) throw new Error('locked down')
      return data.get(k) ?? null
    },
    setItem: (k: string, v: string) => {
      if (fails) throw new Error('locked down')
      data.set(k, v)
    },
    removeItem: (k: string) => {
      if (fails) throw new Error('locked down')
      data.delete(k)
    },
  } as unknown as Storage & { data: Map<string, string> }
}

/** Walks a curve in steps of one millisecond from before the hit until after it has faded out. */
function sampling(f: (age: number) => number): number[] {
  const values: number[] = []
  for (let ms = -20; ms <= HIT_DURATION * 1000 + 50; ms += 1) values.push(f(ms / 1000))
  return values
}

const HEAD_ON = { x: 0, y: 0, z: -1 }

function hitAt(start: number, strength = 1, direction = HEAD_ON): Hit {
  return { start, layers: layersForHit(strength, 'normal'), direction, side: { x: -1, y: 0 } }
}

describe('the comfort setting', () => {
  it('there are three, in English because they are stored, and one starts with the whole hit', () => {
    // Written by hand: if they change, what is stored in the player's browser changes.
    expect(COMFORT_LEVELS).toEqual(['off', 'gentle', 'normal'])
    expect(DEFAULT_COMFORT).toBe('normal')
  })

  it('reads only what exists, and anything else falls back to the default', () => {
    expect(parseComfort('off')).toBe('off')
    expect(parseComfort('gentle')).toBe('gentle')
    expect(parseComfort('apagado')).toBe('normal')
    expect(parseComfort(null)).toBe('normal')
    expect(parseComfort(undefined)).toBe('normal')
  })

  it('is read and stored under the key of the game, and the default takes up no room', () => {
    const s = fakeStorage()
    expect(readComfort(s, 'juego:confort')).toBe('normal')
    expect(writeComfort(s, 'juego:confort', 'gentle')).toBe(true)
    expect(s.data.get('juego:confort')).toBe('gentle')
    expect(readComfort(s, 'juego:confort')).toBe('gentle')
    expect(writeComfort(s, 'juego:confort', 'normal')).toBe(true)
    expect(s.data.has('juego:confort')).toBe(false)
  })

  it('without storage, or with one locked down, it keeps playing with the default', () => {
    expect(readComfort(null, 'x')).toBe('normal')
    expect(writeComfort(null, 'x', 'off')).toBe(false)
    const lockedDown = fakeStorage({}, { fails: true })
    expect(readComfort(lockedDown, 'x')).toBe('normal')
    expect(writeComfort(lockedDown, 'x', 'off')).toBe(false)
  })
})

describe('from the strength to the layers', () => {
  it('with comfort turned off it does nothing: it is not seen, does not move, is not heard, does not vibrate', () => {
    for (const strength of [0, 0.3, 1]) {
      for (const reduced of [false, true]) {
        const layers = layersForHit(strength, 'off', reduced)
        expect(layers).toEqual(NO_LAYERS)
        expect(hitPulses(layers)).toEqual([])
        expect(sampling((e) => vignetteAt(layers, e)).every((v) => v === 0)).toBe(true)
        expect(sampling((e) => shakeAt(layers, HEAD_ON, e).z).every((v) => v === 0)).toBe(true)
        expect(sampling((e) => timeScaleAt(layers, e)).every((v) => v === 1)).toBe(true)
        expect(sampling((e) => cutoffAt(layers, e)).every((v) => v === HIT.filter.open)).toBe(true)
      }
    }
  })

  it('the whole hit, with the maximum strength, reaches the figures of the table', () => {
    expect(layersForHit(1, 'normal')).toEqual({ vignette: 0.9, shake: 1, slowMo: 1, filter: 1, haptic: 1 })
  })

  it('in gentle, everything at half except the haptic, which carries the strength', () => {
    const whole = layersForHit(0.8, 'normal')
    const gentle = layersForHit(0.8, 'gentle')
    expect(gentle.vignette).toBeCloseTo(whole.vignette / 2)
    expect(gentle.shake).toBeCloseTo(whole.shake / 2)
    expect(gentle.slowMo).toBeCloseTo(whole.slowMo / 2)
    expect(gentle.filter).toBeCloseTo(whole.filter / 2)
    expect(gentle.haptic).toBe(0.8)
  })

  it('more strength, more of everything; and the weakest hit is seen too', () => {
    const weak = layersForHit(0, 'normal')
    const medium = layersForHit(0.5, 'normal')
    const strong = layersForHit(1, 'normal')
    expect(weak.vignette).toBeCloseTo(HIT.vignette.floor * HIT.vignette.max)
    expect(weak.shake).toBe(0)
    expect(medium.vignette).toBeGreaterThan(weak.vignette)
    expect(strong.vignette).toBeGreaterThan(medium.vignette)
    expect(medium.shake).toBeGreaterThan(0)
    expect(strong.shake).toBeGreaterThan(medium.shake)
  })

  it('the strength out of range is clamped: going over does not darken more or move more', () => {
    expect(layersForHit(3, 'normal')).toEqual(layersForHit(1, 'normal'))
    expect(layersForHit(-1, 'normal')).toEqual(layersForHit(0, 'normal'))
  })

  it('with reduced motion: no shake and no slow motion, gentle vignette, and the haptic goes on', () => {
    for (const comfort of ['gentle', 'normal'] as const) {
      const layers = layersForHit(1, comfort, true)
      expect(layers.shake).toBe(0)
      expect(layers.slowMo).toBe(0)
      expect(layers.vignette).toBeCloseTo(layersForHit(1, 'gentle').vignette)
      expect(layers.haptic).toBe(1)
      expect(layers.filter).toBeGreaterThan(0)
      expect(sampling((e) => shakeAt(layers, HEAD_ON, e).z).every((v) => v === 0)).toBe(true)
      expect(sampling((e) => timeScaleAt(layers, e)).every((v) => v === 1)).toBe(true)
    }
  })

  it('the haptic is the shared recipe of hit taken, in both hands', () => {
    const pulses = hitPulses(layersForHit(1, 'gentle'))
    expect(pulses.map((p) => p.hand).sort()).toEqual(['left', 'right'])
    for (const p of pulses) {
      expect(p.intensity).toBe(HAPTIC_RECIPES.hitTaken.max)
      expect(p.ms).toBe(HAPTIC_RECIPES.hitTaken.ms)
      expect(p.delay).toBe(0)
    }
  })
})

describe('the curves over time', () => {
  it('the vignette rises during the fade-in, falls along a curve and stays at zero', () => {
    const { fadeIn, fadeOut } = HIT.vignette
    expect(vignetteShape(-0.01)).toBe(0)
    expect(vignetteShape(0)).toBe(0)
    expect(vignetteShape(fadeIn / 2)).toBeCloseTo(0.5)
    expect(vignetteShape(fadeIn)).toBe(1)
    // It falls along a curve: halfway through the fade-out it is already down to a quarter.
    expect(vignetteShape(fadeIn + fadeOut / 2)).toBeCloseTo(0.25)
    expect(vignetteShape(fadeIn + fadeOut)).toBe(0)
    // It never goes past 1 and, once up there, it only goes down.
    const values = sampling(vignetteShape)
    expect(Math.max(...values)).toBe(1)
    const peak = values.indexOf(1)
    for (let i = peak + 1; i < values.length; i += 1) expect(values[i]).toBeLessThanOrEqual(values[i - 1])
  })

  it('the shake starts at zero, oscillates damped and ends exactly in its place', () => {
    const { duration, hertz } = HIT.shake
    expect(shakeShape(0)).toBe(0)
    expect(shakeShape(-0.1)).toBe(0)
    expect(shakeShape(duration)).toBe(0)
    expect(shakeShape(duration + 1)).toBe(0)
    // The first quarter wave goes towards the hit, and the next half comes back and overshoots.
    expect(shakeShape(1 / (4 * hertz))).toBeGreaterThan(0)
    expect(shakeShape(3 / (4 * hertz))).toBeLessThan(0)
    // Each crest, lower than the one before.
    const crests = [0, 1, 2].map((n) => Math.abs(shakeShape((n + 0.25) / hertz)))
    expect(crests[1]).toBeLessThan(crests[0])
    expect(crests[2]).toBeLessThan(crests[1])
    // No jumps: from one millisecond to the next it does not move more than a spring moves.
    const values = sampling(shakeShape)
    for (let i = 1; i < values.length; i += 1) expect(Math.abs(values[i] - values[i - 1])).toBeLessThan(0.08)
  })

  it('the stage moves a centimetre and a half at most, and towards where the hit comes from', () => {
    const layers = layersForHit(1, 'normal')
    const fromTheLeft = { x: -1, y: 0, z: 0 }
    const values = sampling((e) => shakeAt(layers, fromTheLeft, e).x)
    const largest = Math.max(...values.map(Math.abs))
    expect(largest).toBeLessThanOrEqual(HIT.shake.amplitude)
    expect(largest).toBeGreaterThan(HIT.shake.amplitude / 2)
    // First of all, to the left: that is where the world goes when one is shoved from there.
    expect(shakeAt(layers, fromTheLeft, 1 / (4 * HIT.shake.hertz)).x).toBeLessThan(0)
    // Only along the direction.
    expect(sampling((e) => shakeAt(layers, fromTheLeft, e).y).every((v) => v === 0)).toBe(true)
  })

  it('the slow motion holds for an instant and returns to 1 without a jerk', () => {
    const layers = layersForHit(1, 'normal')
    const { scale, hold, recovery } = HIT.slowMo
    expect(timeScaleAt(layers, -0.01)).toBe(1)
    expect(timeScaleAt(layers, 0)).toBeCloseTo(scale)
    expect(timeScaleAt(layers, hold / 2)).toBeCloseTo(scale)
    expect(timeScaleAt(layers, hold + recovery / 2)).toBeCloseTo((1 + scale) / 2)
    expect(timeScaleAt(layers, hold + recovery)).toBe(1)
    const values = sampling((e) => timeScaleAt(layers, e))
    expect(Math.min(...values)).toBeCloseTo(scale)
    expect(Math.max(...values)).toBe(1)
    for (let i = 1; i < values.length; i += 1) expect(Math.abs(values[i] - values[i - 1])).toBeLessThan(0.75)
    // Less than half of the stopped clock of the longest hit stop known.
    expect(hold).toBeLessThan(0.167 / 2)
  })

  it('in gentle, the clock slows down half as much', () => {
    expect(timeScaleAt(layersForHit(1, 'gentle'), 0)).toBeCloseTo(1 - (1 - HIT.slowMo.scale) / 2)
  })

  it('the filter closes down to the cutoff, holds and opens fully again', () => {
    const layers = layersForHit(1, 'normal')
    const { cutoff, open, hold, recovery } = HIT.filter
    expect(cutoffAt(layers, -0.01)).toBe(open)
    expect(cutoffAt(layers, 0)).toBeCloseTo(cutoff)
    expect(cutoffAt(layers, hold / 2)).toBeCloseTo(cutoff)
    // Halfway through the recovery it is halfway in octaves, not in hertz.
    expect(cutoffAt(layers, hold + recovery / 2)).toBeCloseTo(Math.sqrt(cutoff * open))
    expect(cutoffAt(layers, hold + recovery)).toBe(open)
    // In gentle, halfway in octaves.
    expect(cutoffAt(layersForHit(1, 'gentle'), 0)).toBeCloseTo(Math.sqrt(cutoff * open))
  })
})

describe('where it comes from, in the view', () => {
  it('head-on it has no side; from the left, the left; from above, above', () => {
    expect(sideInView({ x: 0, y: 0, z: -1 })).toEqual({ x: 0, y: 0 })
    expect(sideInView({ x: -2, y: 0, z: 0 })).toEqual({ x: -1, y: 0 })
    expect(sideInView({ x: 0, y: 3, z: 0 })).toEqual({ x: 0, y: 1 })
    const diagonal = sideInView({ x: 1, y: 0, z: -1 })
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2)
    expect(sideInView({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0 })
  })

  it('a direction is left at length 1, and without a direction the hit is dull, downwards', () => {
    expect(unitVector({ x: 0, y: 0, z: -5 })).toEqual({ x: 0, y: 0, z: -1 })
    expect(unitVector(null)).toEqual({ x: 0, y: -1, z: 0 })
    expect(unitVector(undefined)).toEqual({ x: 0, y: -1, z: 0 })
    expect(unitVector({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: -1, z: 0 })
  })
})

describe('several hits at once', () => {
  it('without hits, at rest', () => {
    expect(hitState([], 3)).toBe(AT_REST)
  })

  it('everything returns to zero: once the hit is over, the exact rest and no live hit', () => {
    const hits = [hitAt(10, 1, { x: -1, y: 0, z: 0 })]
    const during = hitState(hits, 10.05)
    expect(during.vignette).toBeGreaterThan(0)
    expect(during.timeScale).toBeLessThan(1)
    expect(during.cutoff).toBeLessThan(HIT.filter.open)
    expect(during.live).toHaveLength(1)
    const after = hitState(hits, 10 + HIT_DURATION)
    expect(after).toBe(AT_REST)
    // And just before it ends, practically nothing already.
    const almost = hitState(hits, 10 + HIT_DURATION - 0.001)
    expect(almost.vignette).toBeLessThan(1e-4)
    expect(almost.timeScale).toBe(1)
    expect(almost.cutoff).toBe(HIT.filter.open)
    expect(Math.hypot(almost.shake.x, almost.shake.y, almost.shake.z)).toBe(0)
  })

  it('the vignette is the darkest one, with its side; the shakes are added; clock and filter, the most slowed', () => {
    const older: Hit = { ...hitAt(0, 1), side: { x: 1, y: 0 } }
    const newer: Hit = { ...hitAt(0.2, 0.2), side: { x: -1, y: 0 } }
    const state = hitState([older, newer], 0.25)
    const onlyOlder = hitState([older], 0.25)
    const onlyNewer = hitState([newer], 0.25)
    expect(state.vignette).toBe(Math.max(onlyOlder.vignette, onlyNewer.vignette))
    expect(state.side).toEqual(onlyOlder.vignette > onlyNewer.vignette ? older.side : newer.side)
    expect(state.shake.z).toBeCloseTo(onlyOlder.shake.z + onlyNewer.shake.z)
    expect(state.timeScale).toBe(Math.min(onlyOlder.timeScale, onlyNewer.timeScale))
    expect(state.cutoff).toBe(Math.min(onlyOlder.cutoff, onlyNewer.cutoff))
  })

  it('the ones that no longer contribute are forgotten and never more are tracked than fit', () => {
    let hits: Hit[] = []
    for (let i = 0; i < MAX_CONCURRENT_HITS + 3; i += 1) hits = addHit(hits, hitAt(i * 0.01))
    expect(hits).toHaveLength(MAX_CONCURRENT_HITS)
    expect(hits[0].start).toBeCloseTo(0.03)
    const state = hitState([hitAt(0), hitAt(HIT_DURATION)], HIT_DURATION + 0.01)
    expect(state.live.map((g) => g.start)).toEqual([HIT_DURATION])
  })

  it('the longest figure rules how long a hit lasts', () => {
    expect(HIT_DURATION).toBeCloseTo(HIT.vignette.fadeIn + HIT.vignette.fadeOut)
  })
})
