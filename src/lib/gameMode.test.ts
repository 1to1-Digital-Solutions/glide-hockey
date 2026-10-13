import { describe, expect, it } from 'vitest'
import { ENDLESS, modeRows, isEndless, runOutcome } from './gameMode'

describe('how a match ends', () => {
  it('stays alive as long as nobody reaches the agreed goals', () => {
    expect(
      runOutcome({ playerGoals: 4, opponentGoals: 4, goalTarget: 5 }),
    ).toBeNull()
  })

  it('is won by whoever gets there first', () => {
    expect(
      runOutcome({ playerGoals: 5, opponentGoals: 2, goalTarget: 5 }),
    ).toBe('won')
    expect(
      runOutcome({ playerGoals: 2, opponentGoals: 5, goalTarget: 5 }),
    ).toBe('lost')
  })

  it('the endless match does not end on goals', () => {
    expect(isEndless(ENDLESS)).toBe(true)
    expect(isEndless(7)).toBe(false)
    expect(runOutcome({ playerGoals: 40, opponentGoals: 35, goalTarget: ENDLESS })).toBeNull()
  })

  it('also counts if the score goes past the target', () => {
    expect(
      runOutcome({ playerGoals: 0, opponentGoals: 9, goalTarget: 3 }),
    ).toBe('lost')
  })
})

describe('the menu rows in each mode (the common template)', () => {
  const rowsOf = (mode: Parameters<typeof modeRows>[0], moreOptions: boolean) => [...modeRows(mode, moreOptions).rows]

  it('folded: the mode and, in levels, which one; the rest, behind «Más opciones»', () => {
    expect(rowsOf('practice', false)).toEqual(['mode'])
    expect(rowsOf('levels', false)).toEqual(['mode', 'goals'])
    expect(rowsOf('duel', false)).toEqual(['mode'])
    for (const mode of ['practice', 'levels', 'duel'] as const) expect(modeRows(mode, false).foldable, mode).toBe(true)
  })

  it('unfolded: the practice options, the scenery and the comfort', () => {
    expect(rowsOf('practice', true)).toEqual(['mode', 'machine', 'goals', 'settings'])
    expect(rowsOf('levels', true)).toEqual(['mode', 'goals', 'settings'])
    expect(rowsOf('duel', true)).toEqual(['mode', 'settings'])
  })

  it('the challenge is a fixed match: nothing folded and no button, even if asked for', () => {
    expect(rowsOf('challenge', true)).toEqual(['mode'])
    expect(modeRows('challenge', false).foldable).toBe(false)
  })
})
