'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { DEFAULT_COMFORT, parseComfort, type Comfort } from './hitFeedback'
import { createStoredPreference } from './storage'
import type { TextKey } from './textos'

/**
 * How much the hit feedback is felt in this cabinet: off, gentle or full
 * (`lib/hitFeedback.ts`).
 *
 * **It belongs to the game and not to the hall.** The hall stores nothing like
 * it, and a goal against does not call for the same as a slug in the face: each
 * cabinet remembers it with its prefix. Both menus read it, and change it, and
 * so does the scene, which applies it; that is why it lives in the browser and
 * is watched by subscription, like the record: the web menu and the headset one
 * always show the same.
 *
 * The system's reduced motion does not go through here: `HitFeedback` itself
 * looks at it, and it overrides whatever is chosen.
 */
export const COMFORT_KEY = 'glide-hockey:confort'

const preference = createStoredPreference<Comfort>({
  key: COMFORT_KEY,
  // What is stored is external input: only a value that exists counts.
  parse: parseComfort,
  serialize: (value) => value,
})

export const getComfort = preference.get
export const saveComfort = preference.save

/** The chosen comfort and how to change it, seen from React. */
export function useComfort(): [Comfort, (value: Comfort) => void] {
  const comfort = useSyncExternalStore(preference.subscribe, preference.get, preference.getServer)
  const change = useCallback((value: Comfort) => preference.save(value), [])
  return [comfort, change]
}

/** What one starts with, for whoever draws it before reading anything. */
export const INITIAL_COMFORT: Comfort = DEFAULT_COMFORT

/**
 * What the row and each option are called, in both menus. «Full» and not «Normal»
 * in English: the dictionary key is the English text itself, and one that
 * translated to itself could not be told apart, by the guard, from what is still
 * left to translate. The same as in gloop-pop, so that both cabinets say the same.
 */
export const COMFORT_LEGEND: TextKey = 'When hit'
export const COMFORT_LABELS: Record<Comfort, TextKey> = { off: 'Off', gentle: 'Gentle', normal: 'Full' }
