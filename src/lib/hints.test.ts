import { describe, expect, it } from 'vitest'
import {
  CROSSFADE,
  THROB,
  MAX_EXPIRY,
  MIN_EXPIRY,
  moveToward,
  advanceHints,
  hintOn,
  throb,
  sweepPhase,
  scriptProblems,
  noHints,
  type Hint,
} from './hints'

type Milestone = 'grab' | 'hit'

const NOTHING = { grab: false, hit: false }

const FLOOR: Hint<Milestone> = { id: 'floor', until: 'grab', expiresAfter: 10 }
const TARGET: Hint<Milestone> = { id: 'target', until: 'hit', expiresAfter: 12, from: 'grab' }

describe('a hint turns off by itself, one way or another', () => {
  it('is shown from the start, while nothing has been done', () => {
    expect(hintOn(FLOOR, NOTHING, 0)).toBe(true)
  })

  it('turns off as soon as the gesture is done once, even with deadline to spare', () => {
    expect(hintOn(FLOOR, { ...NOTHING, grab: true }, 0)).toBe(false)
  })

  it('and turns off when the deadline runs out, even if the gesture was never done', () => {
    expect(hintOn(FLOOR, NOTHING, FLOOR.expiresAfter - 0.01)).toBe(true)
    expect(hintOn(FLOOR, NOTHING, FLOOR.expiresAfter)).toBe(false)
  })

  it('the one that waits for a milestone is not shown before it comes', () => {
    expect(hintOn(TARGET, NOTHING, 0)).toBe(false)
    expect(hintOn(TARGET, { ...NOTHING, grab: true }, 0)).toBe(true)
  })
})

describe('the whole script, frame by frame', () => {
  const SCRIPT = [FLOOR, TARGET]

  it('says which ones are shown, by their name', () => {
    const state = advanceHints(SCRIPT, NOTHING, noHints(), 1)
    expect([...state.lit]).toEqual(['floor'])
  })

  it('the one that waits for a milestone arrives with its whole deadline, not with what is left of the round', () => {
    const state = noHints()
    // Twenty seconds without grabbing anything: more than the deadline of the target's mark.
    for (let i = 0; i < 20; i += 1) advanceHints(SCRIPT, NOTHING, state, 1)
    expect(state.clocks.target).toBe(0)
    expect(state.lit.has('target')).toBe(false)

    advanceHints(SCRIPT, { ...NOTHING, grab: true }, state, 1)
    expect(state.lit.has('target')).toBe(true)
  })

  it('they turn off by themselves when the deadline runs out, without having done anything', () => {
    const state = noHints()
    for (let i = 0; i < 30; i += 1) advanceHints(SCRIPT, NOTHING, state, 1)
    expect(state.lit.size).toBe(0)
  })

  it('and as soon as the gesture is done once, even if the deadline has only just started', () => {
    const state = noHints()
    advanceHints(SCRIPT, NOTHING, state, 0.1)
    expect(state.lit.has('floor')).toBe(true)
    advanceHints(SCRIPT, { ...NOTHING, grab: true }, state, 0.1)
    expect(state.lit.has('floor')).toBe(false)
  })

  it('a frame that arrives with the clock going backwards advances nothing', () => {
    const state = noHints()
    advanceHints(SCRIPT, NOTHING, state, -5)
    expect(state.clocks.floor).toBe(0)
  })
})

describe('nothing appears or disappears abruptly', () => {
  it('takes the whole crossfade to turn on, and as much again to turn off', () => {
    expect(moveToward(0, 1, CROSSFADE / 2)).toBeCloseTo(0.5)
    expect(moveToward(0.5, 1, CROSSFADE / 2)).toBeCloseTo(1)
    expect(moveToward(1, 0, CROSSFADE / 2)).toBeCloseTo(0.5)
  })

  it('does not overshoot however late the frame arrives', () => {
    expect(moveToward(0, 1, 10)).toBe(1)
    expect(moveToward(1, 0, 10)).toBe(0)
  })

  it('with the clock stopped or without crossfade, it jumps to where it is due: a fade of zero lasts zero', () => {
    expect(moveToward(0, 1, 0)).toBe(0)
    expect(moveToward(0, 1, -1)).toBe(0)
    expect(moveToward(0, 1, 0.1, 0)).toBe(1)
  })
})

describe('the throb', () => {
  it('hovers around one and does not go beyond its strength', () => {
    const samples = Array.from({ length: 64 }, (_, i) => throb(i / 8))
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(1 - THROB.strength)
    expect(Math.max(...samples)).toBeLessThanOrEqual(1 + THROB.strength)
  })

  it('stays still with the strength at zero, which is what whoever wants no motion asks for', () => {
    expect(throb(3.7, 0)).toBe(1)
  })
})

describe('the demonstration repeats', () => {
  it('keeps counting laps and how far into each one it is', () => {
    expect(sweepPhase(0, 4)).toEqual({ lap: 0, progress: 0 })
    expect(sweepPhase(2, 4)).toEqual({ lap: 0, progress: 0.5 })
    expect(sweepPhase(6, 4)).toEqual({ lap: 1, progress: 0.5 })
  })

  it('without a period there are no laps to count, and a negative clock starts at the beginning', () => {
    expect(sweepPhase(3, 0)).toEqual({ lap: 0, progress: 0 })
    expect(sweepPhase(-2, 4)).toEqual({ lap: 0, progress: 0 })
  })
})

describe('the guardian of the script says what is wrong, not that something is wrong', () => {
  it('accepts a healthy script', () => {
    expect(scriptProblems([FLOOR, TARGET])).toEqual([])
  })

  it('catches the repeated hint', () => {
    expect(scriptProblems([FLOOR, FLOOR])).toEqual([expect.stringContaining('twice')])
  })

  it('catches the deadline that falls short and the one that never ends', () => {
    expect(scriptProblems([{ ...FLOOR, expiresAfter: MIN_EXPIRY - 1 }])).toEqual([
      expect.stringContaining('not enough time'),
    ])
    expect(scriptProblems([{ ...FLOOR, expiresAfter: MAX_EXPIRY + 1 }])).toEqual([
      expect.stringContaining('part of the stage'),
    ])
  })

  it('catches the one that turns on and off with the same milestone', () => {
    expect(scriptProblems([{ ...FLOOR, from: 'grab' }])).toEqual([
      expect.stringContaining('same milestone'),
    ])
  })

  it('and names the hint that is wrong, which is what one looks for when reading it', () => {
    const [problem] = scriptProblems([{ ...TARGET, expiresAfter: MAX_EXPIRY + 5 }])
    expect(problem).toContain('target')
  })
})
