import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStoredPreference, gameStorage } from './storage'

/**
 * What is tested here is not «save and read», which is the easy part: it is
 * that the game **can still be played** when the browser does not allow
 * anything to be stored. In private mode, or with the storage barred by policy,
 * touching `localStorage` throws; if that bubbled up, the game would crash on
 * startup because of a dispensable preference.
 */

/** The storage of a browser in private mode: it throws instead of failing. */
function blockedStorage(): Storage {
  return {
    getItem: () => {
      throw new DOMException('blocked', 'SecurityError')
    },
    setItem: () => {
      throw new DOMException('quota exhausted', 'QuotaExceededError')
    },
  } as unknown as Storage
}

const toNumber = (raw: string | null): number => {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** A fake preference with a fixed key. */
function counter() {
  return createStoredPreference<number>({
    key: 'glide-hockey:test:counter',
    parse: toNumber,
    serialize: String,
  })
}

/** And another with one key per variant, like that of the record per mode. */
function perMode() {
  return createStoredPreference<number, [string]>({
    key: (mode: string) => `glide-hockey:test:${mode}`,
    parse: toNumber,
    serialize: String,
  })
}

afterEach(() => {
  // In this order: while the `localStorage` getter is faked, clearing it would
  // throw and bring down the next test because of the previous one's failure.
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('the browser storage', () => {
  it('in the browser it is the usual one', () => {
    expect(gameStorage()).toBe(window.localStorage)
  })

  it('on the server there is none', () => {
    // It is what keeps the prerendered HTML and the hydrated one the same:
    // if something were read here, React would warn that they do not match.
    vi.stubGlobal('window', undefined)
    expect(gameStorage()).toBeNull()
  })

  it('if the browser forbids touching it, it is like not having it', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(gameStorage()).toBeNull()
  })
})

describe('a preference stored between visits', () => {
  it('what is stored is read again on the next visit', () => {
    const pref = counter()
    pref.save(7)

    expect(pref.get()).toBe(7)
    // Another tab, or another visit, reads the same.
    expect(counter().get()).toBe(7)
  })

  it('with nothing stored, the starting value', () => {
    expect(counter().get()).toBe(0)
  })

  it('what is stored is external input: only what is valid is accepted', () => {
    localStorage.setItem('glide-hockey:test:counter', 'whatever')
    expect(counter().get()).toBe(0)
  })

  it('on the server always the starting value, even if something is stored', () => {
    const pref = counter()
    pref.save(7)
    expect(pref.getServer()).toBe(0)
  })

  it('with one key per variant, each variant stores its own', () => {
    const pref = perMode()
    pref.save(3, 'easy')
    pref.save(9, 'hard')

    expect(pref.get('easy')).toBe(3)
    expect(pref.get('hard')).toBe(9)
  })

  it('notifies whoever watches it when it changes, and stops doing so on releasing it', () => {
    const pref = counter()
    const listener = vi.fn()
    const unsubscribe = pref.subscribe(listener)

    pref.save(3)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    pref.save(4)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('also listens to the other tabs', () => {
    // `useSyncExternalStore` only reads again when it is notified: without this, a
    // change made in another tab would not show up until reloading.
    const pref = counter()
    const listener = vi.fn()
    const unsubscribe = pref.subscribe(listener)

    window.dispatchEvent(new StorageEvent('storage'))
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    window.dispatchEvent(new StorageEvent('storage'))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  describe('when the browser does not allow storing', () => {
    it('reading gives the starting value instead of throwing', () => {
      vi.spyOn(window, 'localStorage', 'get').mockReturnValue(blockedStorage())
      expect(counter().get()).toBe(0)
    })

    it('saving does not break, and what was chosen holds at least for this visit', () => {
      // Without this, with the storage blocked pressing a menu option did **nothing**:
      // the write failed silently and the re-read returned what was there before, so
      // the button stayed unmarked. What could not be stored is remembered in memory
      // until the tab is closed; between visits it is lost, which is what not having
      // storage means.
      vi.spyOn(window, 'localStorage', 'get').mockReturnValue(blockedStorage())
      const pref = counter()
      const listener = vi.fn()
      pref.subscribe(listener)

      expect(() => pref.save(9)).not.toThrow()

      expect(pref.get()).toBe(9)
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('with no storage at all, neither reading nor writing break', () => {
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError')
      })
      const pref = counter()
      expect(() => pref.save(9)).not.toThrow()
      expect(pref.get()).toBe(9)
    })
  })
})
