import { renderHook, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DUEL_TALLY_KEY,
  getDuelTally,
  parseDuelTally,
  saveDuelResult,
} from './duelTally'
import { useDuelTally } from './useDuelTally'

/**
 * The tally of the pair that is playing.
 *
 * Playing against someone is the most memorable moment of a session, and a duel that closes and
 * is erased leaves nothing. It does not touch the record —the goals of a duel belong to two
 * people— but it does not follow that the duel does not count: what counts between two is who
 * wins.
 *
 * What is tested is the same as in the records: that adding adds where it should, and that what
 * is read is treated as external input (it is edited by hand from the browser in two clicks).
 */

/** The storage of a browser in private mode: it throws instead of failing. */
function blockedStorage(): Storage {
  return {
    getItem: () => {
      throw new DOMException('blocked', 'SecurityError')
    },
    setItem: () => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    },
  } as unknown as Storage
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('what the two have so far', () => {
  it('it starts at zero and is not the record: it has its own key', () => {
    expect(DUEL_TALLY_KEY).toBe('glide-hockey:duel-tally')
    expect(getDuelTally()).toEqual({ wins: [0, 0], ties: 0 })
  })

  it('each win adds to whoever wins it, and the tie goes apart', () => {
    saveDuelResult(0)
    expect(getDuelTally()).toEqual({ wins: [1, 0], ties: 0 })

    saveDuelResult(1)
    expect(getDuelTally()).toEqual({ wins: [1, 1], ties: 0 })

    saveDuelResult(0)
    expect(getDuelTally()).toEqual({ wins: [2, 1], ties: 0 })

    saveDuelResult(null)
    expect(getDuelTally()).toEqual({ wins: [2, 1], ties: 1 })
  })

  it('what is stored is read on the next visit', () => {
    saveDuelResult(1)

    expect(getDuelTally()).toEqual({ wins: [0, 1], ties: 0 })
  })
})

describe('what is read from storage', () => {
  it('garbage does not break the match: it starts from zero', () => {
    // Another version wrote it, or someone by hand from the browser tools.
    for (const raw of ['I am not json', '{"wins":"two"}', '[]', 'null']) {
      expect(parseDuelTally(raw)).toEqual({ wins: [0, 0], ties: 0 })
    }
  })

  it('an impossible counter counts as zero, not as an odd number', () => {
    expect(parseDuelTally('{"wins":[-3,2.7],"ties":"many"}')).toEqual({
      wins: [0, 2],
      ties: 0,
    })
  })

  it('with nothing stored, zero', () => {
    expect(parseDuelTally(null)).toEqual({ wins: [0, 0], ties: 0 })
  })
})

describe('with nowhere to store', () => {
  it('zero is read and the match goes on', () => {
    vi.stubGlobal('localStorage', blockedStorage())

    expect(getDuelTally()).toEqual({ wins: [0, 0], ties: 0 })
  })

  it('and on the server, where there is no browser, it does not break either', () => {
    // The hall prerenders the cabinet: there is no `window` there to get anything from.
    vi.stubGlobal('window', undefined)

    expect(getDuelTally()).toEqual({ wins: [0, 0], ties: 0 })
    expect(() => saveDuelResult(1)).not.toThrow()
  })

  it('and storing what has just happened does not break the match', () => {
    // Private window or quota exceeded: the series lasts as long as the visit, and that is it.
    // What it cannot do is bring the game down when the duel closes.
    vi.stubGlobal('localStorage', blockedStorage())

    expect(() => saveDuelResult(0)).not.toThrow()
  })
})

describe('what the web draws', () => {
  it('it finds out on its own when a duel is recorded', () => {
    const { result } = renderHook(() => useDuelTally())
    const before = result.current

    act(() => saveDuelResult(1))

    expect(result.current).toEqual({ wins: [before.wins[0], before.wins[1] + 1], ties: before.ties })
  })
})
