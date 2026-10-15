import { describe, expect, it } from 'vitest'

import { HAPTIC_RECIPES, NO_TENSION, pulsesFor, nextTension, type HandPulse, type HapticEvent, type Tension } from './hapticFeedback'

const ALL: HapticEvent[] = [
  { type: 'impact', hand: 'right', strength: 0.5 },
  { type: 'arrival', hand: 'left', strength: 0.5 },
  { type: 'grab', hand: 'right' },
  { type: 'release', hand: 'left', strength: 0.5 },
  { type: 'shot', hand: 'right' },
  { type: 'hitTaken', strength: 0.5 },
]

/** Per hand, in order of output: no pulse may start before the previous one ends. */
function cutEachOther(pulses: HandPulse[]): boolean {
  for (const hand of ['left', 'right'] as const) {
    const own = pulses.filter((p) => p.hand === hand).sort((a, b) => a.delay - b.delay)
    for (let i = 1; i < own.length; i += 1) {
      if (own[i].delay < own[i - 1].delay + own[i - 1].ms) return true
    }
  }
  return false
}

describe('pulsesFor', () => {
  it('no event chains pulses that cut each other off, because pulse() does not queue', () => {
    for (const event of ALL) expect(cutEachOther(pulsesFor(event)), event.type).toBe(false)
  })

  it('every pulse is felt and none goes above 1', () => {
    for (const event of ALL) {
      for (const strength of [0, 1]) {
        const withStrength = 'strength' in event ? { ...event, strength } : event
        for (const p of pulsesFor(withStrength as HapticEvent)) {
          expect(p.ms).toBeGreaterThanOrEqual(12)
          expect(p.intensity).toBeGreaterThan(0.08 - 1e-9)
          expect(p.intensity).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('only the hand that touches vibrates', () => {
    for (const event of ALL.filter((t) => t.type !== 'hitTaken')) {
      const hands = new Set(pulsesFor(event).map((p) => p.hand))
      expect([...hands], event.type).toEqual(['hand' in event ? event.hand : 'right'])
    }
  })

  it('the hit the body takes, in both hands and longer than any other', () => {
    const hit = pulsesFor({ type: 'hitTaken', strength: 0.5 })
    expect(hit.map((p) => p.hand).sort()).toEqual(['left', 'right'])
    const others = ALL.filter((t) => t.type !== 'hitTaken').flatMap(pulsesFor)
    expect(Math.min(...hit.map((p) => p.ms))).toBeGreaterThan(Math.max(...others.map((p) => p.ms)))
  })

  it('a stronger strike vibrates more, and the tail is softer than the strike', () => {
    const weak = pulsesFor({ type: 'impact', hand: 'left', strength: 0.1 })
    const strong = pulsesFor({ type: 'impact', hand: 'left', strength: 0.9 })
    expect(strong[0].intensity).toBeGreaterThan(weak[0].intensity)
    expect(strong[1].intensity).toBeLessThan(strong[0].intensity)
    expect(strong[1].delay).toBe(HAPTIC_RECIPES.impact.ms)
  })

  it('strength outside 0–1 is clamped', () => {
    expect(pulsesFor({ type: 'release', hand: 'left', strength: 3 })[0].intensity).toBe(HAPTIC_RECIPES.release.max)
    expect(pulsesFor({ type: 'arrival', hand: 'left', strength: -1 })[0].intensity).toBe(HAPTIC_RECIPES.arrival.min)
  })
})

describe('nextTension', () => {
  /** Draws for `ms` at a fixed level and returns the pulses that come out. */
  function draw(level: number, ms: number): HandPulse[] {
    let state: Tension = NO_TENSION
    const pulses: HandPulse[] = []
    for (let t = 0; t <= ms; t += 1000 / 90) {
      const step = nextTension(state, 'left', level, t)
      state = step.state
      if (step.pulse) pulses.push({ ...step.pulse, delay: t })
    }
    return pulses
  }

  it('the string at rest does not vibrate', () => {
    expect(draw(0, 1000)).toHaveLength(0)
    expect(draw(HAPTIC_RECIPES.tension.threshold / 2, 1000)).toHaveLength(0)
  })

  it('it is felt growing: tauter, more pulses and stronger ones', () => {
    const slack = draw(0.2, 1000)
    const taut = draw(1, 1000)
    expect(taut.length).toBeGreaterThan(slack.length)
    expect(taut[0].intensity).toBeGreaterThan(slack[0].intensity)
  })

  it('at full draw, no pulse cuts the previous one off', () => {
    expect(cutEachOther(draw(1, 2000))).toBe(false)
  })

  it('releasing the string starts over: the first pulse of the next tension goes out at once', () => {
    const drawing = nextTension(NO_TENSION, 'right', 0.5, 0)
    expect(drawing.pulse).not.toBeNull()
    const released = nextTension(drawing.state, 'right', 0, 10)
    expect(released.state).toEqual(NO_TENSION)
    expect(nextTension(released.state, 'right', 0.5, 20).pulse).not.toBeNull()
  })
})
