import { gameStorage } from './storage'

/**
 * What this game stored when it was called something else, brought over to today's keys.
 *
 * The game went from `air-hockey` to `glide-hockey` in the name change
 * (`xrcade/docs/nombres-y-marcas.md`): «AIR-HOCKEY» is still registered to Brunswick, and
 * although today the term behaves as descriptive, a labelled cabinet is exactly where it
 * stops being so. **All of its keys had the name in front**: each mode's record, the opened
 * levels, the stars and the tutorial seen. Changing the name just like that would erase the
 * record of whoever already played — and a score that is lost because those of us on the
 * inside decided on another name is exactly what cannot be broken.
 *
 * **The prefix is moved, not a list of keys.** A list would have to be kept up to date and
 * forgetting one means losing that score silently; the prefix also covers the ones that were
 * not written anywhere when the change was made.
 */

/** How this game's keys started before the name change. */
export const LEGACY_PREFIX = 'air-hockey:'

/** And how they start now. */
export const KEY_PREFIX = 'glide-hockey:'

/**
 * Moves to the new prefix everything stored under the old one, and deletes the old.
 *
 * Three decisions that matter:
 *
 * - **It does not overwrite what is already there.** If the new key exists it is because it
 *   was already played under the new name, and that score is the good one: the old one is
 *   simply deleted. Without this, reopening an old tab would bring back a worse record.
 * - **It reads the keys before touching anything.** Walking the storage while entries are
 *   being deleted from it skips half of them, because the indices shift underfoot.
 * - **With the storage blocked nothing happens.** In a private window reading it throws;
 *   there, there is no record to move and the game carries on the same.
 */
export function migrateLegacyKeys(storage: Storage | null = gameStorage()): void {
  if (storage === null) return
  try {
    const oldKeys: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key !== null && key.startsWith(LEGACY_PREFIX)) oldKeys.push(key)
    }
    for (const oldKey of oldKeys) {
      const newKey = KEY_PREFIX + oldKey.slice(LEGACY_PREFIX.length)
      const value = storage.getItem(oldKey)
      if (value !== null && storage.getItem(newKey) === null) storage.setItem(newKey, value)
      storage.removeItem(oldKey)
    }
  } catch {
    // Storage blocked or quota exhausted: there is nothing to move and the game plays the same.
  }
}

/**
 * The same, but only once per page load.
 *
 * It is called **during the render** of the match state and not from an effect, for the same
 * reason as `setAssetsBase`: the record and the levels are read with `useSyncExternalStore`
 * on the first render, before any effect runs. Moving afterwards, the first paint would say
 * «no record» and nobody would tell React again that it is no longer true.
 *
 * Repeating it is harmless —the second pass finds nothing to move—, so the latch is there to
 * save the walk, not for correctness.
 */
let done = false

export function migrateLegacyKeysOnce(): void {
  if (done) return
  done = true
  migrateLegacyKeys()
}

/** Only for the tests: forgets that it was already done. */
export function resetLegacyKeysMigration(): void {
  done = false
}
