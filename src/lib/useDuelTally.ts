import { useMemo, useSyncExternalStore } from 'react'

import { storedTally, tallyFromText, type DuelTally } from './duelTally'

/**
 * What the two who are playing have so far (`duelTally.ts`), and React finds out when it changes.
 *
 * Apart from the series because it is the only thing of it that needs React: the rest is also
 * run by the Godot port, which does not have it.
 */
export function useDuelTally(): DuelTally {
  const text = useSyncExternalStore(storedTally.subscribe, storedTally.get, storedTally.getServer)
  return useMemo(() => tallyFromText(text), [text])
}
