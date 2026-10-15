import { LEVEL_COUNT, clampLevel, nextUnlocked, type Stars } from './levels'
import { createStoredPreference } from './storage'

/**
 * What Levels mode remembers between visits: up to which level one can play
 * and how many stars each one has.
 *
 * It goes to the browser's storage through the same plumbing as the record
 * (`createStoredPreference`): with no identifiers, tolerant of a blocked
 * storage and notifying whoever watches. The stars are all stored under a single
 * key, as text, so that the read is a comparable value and not a new array
 * every time.
 */

export const UNLOCKED_LEVEL_KEY = 'glide-hockey:levels:unlocked'
export const LEVEL_STARS_KEY = 'glide-hockey:levels:stars'

/** External input: only a level that exists; anything else is «only the first». */
export function parseUnlockedLevel(raw: string | null): number {
  if (raw == null || raw.trim() === '') return 1
  const value = Number(raw)
  if (!Number.isSafeInteger(value)) return 1
  return clampLevel(value)
}

/** The stars of all the levels, from the first to the last, as «3,2,0,…». */
export function parseStarsList(raw: string | null): string {
  const parts = (raw ?? '').split(',').map((s) => Number(s.trim()))
  const starList = Array.from({ length: LEVEL_COUNT }, (_, i) => {
    const v = parts[i]
    return Number.isInteger(v) && v >= 0 && v <= 3 ? v : 0
  })
  return starList.join(',')
}

export function starsFromList(list: string, level: number): Stars {
  const v = Number(list.split(',')[clampLevel(level) - 1])
  return (Number.isInteger(v) && v >= 0 && v <= 3 ? v : 0) as Stars
}

const unlocked = createStoredPreference<number>({
  key: UNLOCKED_LEVEL_KEY,
  parse: parseUnlockedLevel,
  serialize: String,
})

const stars = createStoredPreference<string>({
  key: LEVEL_STARS_KEY,
  parse: parseStarsList,
  serialize: (s) => s,
})

export const {
  get: getUnlockedLevel,
  getServer: getServerUnlockedLevel,
  subscribe: subscribeUnlockedLevel,
} = unlocked

export const {
  get: getStarsList,
  getServer: getServerStarsList,
  subscribe: subscribeStarsList,
} = stars

/**
 * Saves the result of a level: its stars if they improve on the ones it had, and
 * the unlocking of the next one if it was passed. Returns how far one can play
 * now, so that whoever calls it knows whether something has just opened.
 */
export function saveLevelResult(level: number, earned: Stars): number {
  const safeLevel = clampLevel(level)
  const list = getStarsList().split(',').map(Number)
  // The `?? 0` is for a stored list shorter than it should be: it is edited
  // by hand, and without this comparing against `undefined` would always be false.
  /* v8 ignore next */
  if (earned > (list[safeLevel - 1] ?? 0)) {
    list[safeLevel - 1] = earned
    stars.save(list.join(','))
  }
  const next = nextUnlocked(getUnlockedLevel(), safeLevel, earned)
  if (next > getUnlockedLevel()) unlocked.save(next)
  return next
}

/** How many levels have at least one star. */
export function levelsPassed(list: string): number {
  return list.split(',').filter((s) => Number(s) >= 1).length
}
