import { beforeEach, describe, expect, it } from 'vitest'
import {
  KEY_PREFIX,
  LEGACY_PREFIX,
  migrateLegacyKeys,
  migrateLegacyKeysOnce,
  resetLegacyKeysMigration,
} from './legacyKeys'

/**
 * That the name change does not cost the record to whoever already played.
 *
 * It is the only part of the renaming that can break something for whoever plays: the rest
 * —the repository, the package, the exports— is fixed by recompiling, and a lost score is not
 * recovered.
 */

/** A storage that throws straight away, like that of a private window. */
function blockedStorage(): Storage {
  const throws = () => {
    throw new DOMException('denied', 'SecurityError')
  }
  return {
    get length(): number {
      return throws()
    },
    key: throws,
    getItem: throws,
    setItem: throws,
    removeItem: throws,
    clear: throws,
  } as unknown as Storage
}

beforeEach(() => {
  window.localStorage.clear()
  resetLegacyKeysMigration()
})

describe('the move of the old keys', () => {
  it('takes to the new prefix everything that started with the old one', () => {
    window.localStorage.setItem(`${LEGACY_PREFIX}best-points:challenge`, '1240')
    window.localStorage.setItem(`${LEGACY_PREFIX}levels:unlocked`, '7')
    window.localStorage.setItem(`${LEGACY_PREFIX}levels:stars`, '3,2,0')

    migrateLegacyKeys(window.localStorage)

    expect(window.localStorage.getItem(`${KEY_PREFIX}best-points:challenge`)).toBe('1240')
    expect(window.localStorage.getItem(`${KEY_PREFIX}levels:unlocked`)).toBe('7')
    expect(window.localStorage.getItem(`${KEY_PREFIX}levels:stars`)).toBe('3,2,0')
  })

  it('deletes the old ones, so that two truths are not left', () => {
    window.localStorage.setItem(`${LEGACY_PREFIX}tutorial-seen`, '1')

    migrateLegacyKeys(window.localStorage)

    expect(window.localStorage.getItem(`${LEGACY_PREFIX}tutorial-seen`)).toBeNull()
  })

  it('touches nothing that is not its own', () => {
    window.localStorage.setItem('xrcade:scenery', 'room')
    window.localStorage.setItem('bowling:best-points', '180')

    migrateLegacyKeys(window.localStorage)

    expect(window.localStorage.getItem('xrcade:scenery')).toBe('room')
    expect(window.localStorage.getItem('bowling:best-points')).toBe('180')
  })

  it('also moves the keys nobody wrote in the table of the documentation', () => {
    // The move goes by prefix precisely because of this: a hand-made list falls short and that
    // score is lost without anybody noticing.
    window.localStorage.setItem(`${LEGACY_PREFIX}whatever-comes`, 'something')

    migrateLegacyKeys(window.localStorage)

    expect(window.localStorage.getItem(`${KEY_PREFIX}whatever-comes`)).toBe('something')
  })

  it('lets what is stored under the new name win', () => {
    // It was already played under the new name: that score is the good one. Overwriting it with
    // the old one would be handing someone back a worse record for opening an old tab.
    window.localStorage.setItem(`${LEGACY_PREFIX}best-points`, '400')
    window.localStorage.setItem(`${KEY_PREFIX}best-points`, '900')

    migrateLegacyKeys(window.localStorage)

    expect(window.localStorage.getItem(`${KEY_PREFIX}best-points`)).toBe('900')
    expect(window.localStorage.getItem(`${LEGACY_PREFIX}best-points`)).toBeNull()
  })

  it('with the storage blocked it does not throw', () => {
    expect(() => migrateLegacyKeys(blockedStorage())).not.toThrow()
  })

  it('nor without storage', () => {
    expect(() => migrateLegacyKeys(null)).not.toThrow()
  })

  it('repeating it changes nothing', () => {
    window.localStorage.setItem(`${LEGACY_PREFIX}best-points`, '120')

    migrateLegacyKeys(window.localStorage)
    migrateLegacyKeys(window.localStorage)

    expect(window.localStorage.getItem(`${KEY_PREFIX}best-points`)).toBe('120')
  })
})

describe('the one-time move', () => {
  it('moves on the first call', () => {
    window.localStorage.setItem(`${LEGACY_PREFIX}best-points`, '55')

    migrateLegacyKeysOnce()

    expect(window.localStorage.getItem(`${KEY_PREFIX}best-points`)).toBe('55')
  })

  it('and on the second it no longer walks anything', () => {
    migrateLegacyKeysOnce()
    // Whatever shows up after the first pass is not from an old version: in this page load
    // what was there has already been moved.
    window.localStorage.setItem(`${LEGACY_PREFIX}best-points`, '55')

    migrateLegacyKeysOnce()

    expect(window.localStorage.getItem(`${KEY_PREFIX}best-points`)).toBeNull()
    expect(window.localStorage.getItem(`${LEGACY_PREFIX}best-points`)).toBe('55')
  })
})
