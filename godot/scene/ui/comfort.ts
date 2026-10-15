/**
 * The comfort of the hit taken: the only setting of the interface that belongs to Glide Hockey. The
 * language and the hall's volumes are read by the kit (`@kit/runtime/settings`).
 *
 * **The comfort is chosen here**, in the top row of the menu, as in the web's headset menu: it is
 * with the headset on that one knows whether it makes one dizzy. It is stored with the same key and
 * the same format as the web (`lib/comfort.ts`, which does not go into the engine because it is a
 * React hook).
 */
import { writeComfort, readComfort, type Comfort } from '@/lib/hitFeedback'
import { gameStorage } from '@/lib/storage'

/** The key of the comfort of the hit taken: the web's (`COMFORT_KEY` of `lib/comfort.ts`). */
export const COMFORT_KEY = 'glide-hockey:confort'

/** How much a goal against is felt: off, gentle or normal. */
export function currentComfort(): Comfort {
  return readComfort(gameStorage(), COMFORT_KEY)
}

export function chooseComfort(value: Comfort): void {
  writeComfort(gameStorage(), COMFORT_KEY, value)
}
