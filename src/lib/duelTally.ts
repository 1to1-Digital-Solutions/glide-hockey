import type { Player } from './duel'
import { createStoredPreference } from './storage'

/**
 * How many duels each one has won, stored in the browser.
 *
 * Playing against someone is the most memorable moment of a session, and a duel that closes and
 * is erased leaves nothing: what counts between two is who wins, and it is recorded. It is the
 * same thing minigolf and table-tennis do, with the same format.
 *
 * It does not touch the record on purpose: the goals of a duel belong to two people and say
 * nothing about the best of either. And this does not travel to the hall: the hall shows one
 * person's best, and this belongs to the pair standing there. Nor does it identify anyone: it is
 * three numbers.
 *
 * Without React, so that the Godot port stores it with these same functions; what the web draws
 * subscribed lives in `useDuelTally.ts`.
 */

/** The duels won by each one, in player order, and the tied ones. */
export interface DuelTally {
  readonly wins: readonly [number, number]
  readonly ties: number
}

/** Where it is remembered. With a prefix, like the records, so as not to clash with anything. */
export const DUEL_TALLY_KEY = 'glide-hockey:duel-tally'

const EMPTY: DuelTally = { wins: [0, 0], ties: 0 }

/** A whole, non-negative counter, or zero: it is external input. */
function count(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

/** Parses what was read from storage. */
export function parseDuelTally(raw: string | null): DuelTally {
  if (raw == null) return EMPTY
  try {
    const value = JSON.parse(raw) as { wins?: unknown[]; ties?: unknown }
    const wins = Array.isArray(value?.wins) ? value.wins : []
    return { wins: [count(wins[0]), count(wins[1])], ties: count(value?.ties) }
  } catch {
    // Another version wrote it, or someone by hand from the browser tools.
    return EMPTY
  }
}

/**
 * The tally, stored as the text that was written.
 *
 * **The text and not the object** is stored on purpose: `createStoredPreference` reads and
 * parses again on every read, and `useSyncExternalStore` compares two reads in a row with
 * `Object.is`. A new object every time would leave React repainting non-stop; a text would not.
 */
const stored = createStoredPreference<string>({
  key: DUEL_TALLY_KEY,
  parse: (raw) => raw ?? '',
  serialize: (value) => value,
})

/**
 * The tally just as it is stored, for whoever subscribes to it (`useDuelTally.ts`): the text and
 * not the object, for the reason given above.
 */
export const storedTally = {
  subscribe: stored.subscribe,
  get: stored.get,
  getServer: stored.getServer,
}

/** Parses the stored text: empty means nothing has been recorded yet. */
export function tallyFromText(text: string): DuelTally {
  return parseDuelTally(text === '' ? null : text)
}

/** What they have right now, without subscribing to anything. */
export function getDuelTally(): DuelTally {
  return tallyFromText(stored.get())
}

/**
 * Records how a duel ended: who won it, or `null` if it was a tie.
 *
 * It returns nothing: whoever looks at it is subscribed (`useDuelTally`) and finds out on their
 * own. Returning the tally would invite storing it in React state, and then there would be two
 * copies of the same thing that can disagree.
 */
export function saveDuelResult(winner: Player | null): void {
  const before = getDuelTally()
  const tally: DuelTally =
    winner == null
      ? { wins: before.wins, ties: before.ties + 1 }
      : {
          wins:
            winner === 0
              ? [before.wins[0] + 1, before.wins[1]]
              : [before.wins[0], before.wins[1] + 1],
          ties: before.ties,
        }

  stored.save(JSON.stringify(tally))
}
