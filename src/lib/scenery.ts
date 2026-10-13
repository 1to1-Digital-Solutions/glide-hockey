import type { Scenery } from './settings'

/**
 * How the hall's scenery is offered in this game: the arcade room or the own room of whoever
 * plays.
 *
 * **The preference does not belong to this game.** It is stored in `xrcade:scenery` and the
 * rule of when the backdrop is drawn is `showsPlace`, both in `lib/settings.ts`, which is the
 * copy of the bridge with the hall; the hook and the change are in `lib/settingsClient.ts`.
 * Only what belongs to glide-hockey is left here: what each option is called in its menus and
 * the own key that has to be deleted.
 *
 * **Why it does not have one of its own.** The hall always enters `immersive-ar` when the
 * headset has it, so the session type does not say what whoever plays chose. With one scenery
 * per game, whoever chose «tu habitación» in this cabinet would enter without a backdrop even
 * if in the hall they had chosen the drawn place, and there would be no way to know which of
 * the two rules.
 *
 * The one deciding the room is `GameWorld`, with the scenery the match state gives it
 * (`lib/gameStore.ts`), which is also what both menus read.
 */

/** What each scenery is called in this game's menus. */
export const SCENERY_LABELS = {
  place: 'The room',
  room: 'Your room',
} as const satisfies Record<Scenery, string>

export const SCENERY_HINTS = {
  place: 'The table with the arcade room around it.',
  room: 'Headset and augmented reality only: the table stands in your own room.',
} as const satisfies Record<Scenery, string>

/**
 * The key of the game's own scenery, which nobody writes.
 *
 * If it is in the browser, it is deleted on mounting the match state and **it is not moved** to
 * the hall's one: the choice that rules is the hall's. Leaving it would break nothing —nobody
 * reads it—, but deleting it keeps whoever looks at the storage from believing there are two
 * preferences.
 */
export const OWN_SCENERY_KEY = 'glide-hockey:scenery'

/**
 * Forgets the game's own scenery.
 *
 * It withstands a storage that is not there or that throws: there is nothing to forget, and the
 * game carries on with the hall's one.
 */
export function forgetOwnScenery(storage: Pick<Storage, 'removeItem'> | null): void {
  try {
    storage?.removeItem(OWN_SCENERY_KEY)
  } catch {
    // Storage blocked: nothing could be stored under that key either.
  }
}
