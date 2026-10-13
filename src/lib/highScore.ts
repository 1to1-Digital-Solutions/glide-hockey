import { type GameMode } from './gameMode'
import { createStoredPreference } from './storage'

/**
 * The best score, stored between visits.
 *
 * One integer per mode in `localStorage`, with no identifiers nor anything that
 * describes whoever plays: a record that is erased on reload is not a record.
 *
 * **One record per mode** and not a global one: a challenge is cut short by the
 * first match lost and a practice one is chosen by the player, so the two
 * figures do not measure the same. With a single score, one of the two modes
 * would never beat it.
 */

/** Key of each mode's record, with a prefix so as not to clash with anything else. */
export const HIGH_SCORE_KEYS: Record<GameMode, string> = {
  practice: 'glide-hockey:best-points',
  levels: 'glide-hockey:best-points:levels',
  challenge: 'glide-hockey:best-points:challenge',
  // In the duel no record is stored —the goals belong to two people and say nothing about the
  // score of either—, but the mode exists and the record is read per mode.
  duel: 'glide-hockey:best-points:duel',
}

/**
 * The endless match has no points record —they grow without a cap over time—,
 * so its score is the best streak of goals in a row. A separate key so that it
 * does not get mixed with normal practice, which does measure the total.
 */
export const ENDLESS_STREAK_KEY = 'glide-hockey:best-streak:endless'

/**
 * Interprets what was read from storage.
 *
 * It is external input —anyone can edit it from the browser's tools—, so only
 * an exact, non-negative integer is accepted. Anything else counts as «there
 * is no record yet» instead of propagating a `NaN` to the score.
 */
export function parseBestPoints(raw: string | null): number {
  if (raw == null || raw.trim() === '') return 0
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) return 0
  return value
}

const bestPoints = createStoredPreference<number, [GameMode]>({
  key: (mode) => HIGH_SCORE_KEYS[mode],
  parse: parseBestPoints,
  serialize: String,
})

export const {
  get: getBestPoints,
  getServer: getServerBestPoints,
  subscribe: subscribeBestPoints,
} = bestPoints

/**
 * Saves the score if it improves that mode's record, and notifies whoever is
 * watching it. What the read would discard never gets written, so as not to
 * leave in the browser something that no longer counts as a record.
 */
export function saveBestPoints(mode: GameMode, points: number): void {
  if (!Number.isSafeInteger(points) || points <= getBestPoints(mode)) return
  bestPoints.save(points, mode)
}

const endlessStreak = createStoredPreference<number>({
  key: ENDLESS_STREAK_KEY,
  parse: parseBestPoints,
  serialize: String,
})

export const {
  get: getBestEndlessStreak,
  getServer: getServerBestEndlessStreak,
  subscribe: subscribeBestEndlessStreak,
} = endlessStreak

/** Saves the streak of an endless match if it improves the score. */
export function saveBestEndlessStreak(streak: number): void {
  if (!Number.isSafeInteger(streak) || streak <= getBestEndlessStreak()) return
  endlessStreak.save(streak)
}
