'use client'

/**
 * The hall's settings, on the browser side: reading them, changing them and
 * letting React know.
 *
 * The contract —keys, default values and how what is read gets interpreted— is
 * in `settings.ts`, which also runs on the server. Here is what only makes
 * sense with a window in front.
 */

import { useSyncExternalStore } from 'react'

import {
  DEFAULT_HAND,
  DEFAULT_LANG,
  DEFAULT_SCENERY,
  DEFAULT_VOLUME_SETTINGS,
  LANG_COOKIE,
  langFor,
  readGrabMode,
  readHand,
  playHeightOffsetMeters,
  readPlayHeight,
  readPlayHeightOffset,
  readScenery,
  readTurnMode,
  readVolumes,
  writeHand,
  writeScenery,
  writeVolume,
  type GrabMode,
  type Hand,
  type Lang,
  type PlayHeight,
  type Scenery,
  type SoundChannel,
  type TurnMode,
  type Volumes,
} from './settings'

/** How long the language choice lasts: a year, like any preference. */
const LANG_MAX_AGE = 60 * 60 * 24 * 365

/** The event with which a change travels through this same page. */
const SETTINGS_EVENT = 'xrcade:ajustes'

/**
 * Tells **this same page** that a setting has changed.
 *
 * The browser reports `localStorage` changes on its own, but only to the
 * *other* tabs. And the one that writes is precisely the one that has the game
 * mounted inside, so without this event the setting would be saved and would not
 * be noticed until a reload. It is in one place and not repeated in every `set…`
 * because forgetting it in one breaks nothing visible: that setting simply takes
 * a reload to arrive.
 */
function notifyChange(): void {
  /* v8 ignore next -- settings are only changed from the browser. */
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SETTINGS_EVENT))
}

/** The browser's storage, or nothing if there is none or it is locked down. */
export function settingsStorage(): Storage | null {
  /* v8 ignore next -- on the server there is no window, and no test runs there. */
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    // Browser with storage blocked: there is nowhere to remember.
    return null
  }
}

/**
 * The store React subscribes to.
 *
 * The snapshot is cached because `useSyncExternalStore` compares by
 * identity: returning a new object on every read would leave React
 * repainting endlessly. It is invalidated only when something reports a change.
 */
let snapshot: Volumes | null = null
const listeners = new Set<() => void>()

function refresh(): void {
  snapshot = readVolumes(settingsStorage())
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', refresh)
    window.addEventListener(SETTINGS_EVENT, refresh)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(SETTINGS_EVENT, refresh)
    }
  }
}

function getSnapshot(): Volumes {
  snapshot ??= readVolumes(settingsStorage())
  return snapshot
}

/** On the server there is no storage: it is painted with the defaults. */
function getServerSnapshot(): Volumes {
  return DEFAULT_VOLUME_SETTINGS
}

/** The hall's volumes, and React finds out when they change. */
export function useVolumes(): Volumes {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Changes the volume of a channel, from 0 to 100. */
export function setVolume(channel: SoundChannel, value: number): void {
  const clamped = Math.min(100, Math.max(0, Math.round(value)))
  writeVolume(settingsStorage(), channel, clamped)
  // The cached snapshot is no longer valid: the next read goes back to the
  // storage. It is invalidated here and not in the listener because there may
  // not be one yet, and even so the next `getSnapshot` has to see the new value.
  snapshot = null
  notifyChange()
}

/**
 * The chosen language, read in the browser; with none chosen, the system's (`navigator.languages`),
 * which is the same one the server reads in `Accept-Language`.
 *
 * It does not go through `useSyncExternalStore`: changing the language reloads
 * the page —the server has to paint the texts again—, so there is nothing to
 * subscribe to. Whoever paints on the server uses `langFor` with the headers.
 */
export function currentLang(): Lang {
  /* v8 ignore next -- on the server `requestLang` paints, and it does see the header. */
  if (typeof document === 'undefined') return DEFAULT_LANG
  return langFor(document.cookie, navigator.languages)
}

/**
 * The chosen language, and React finds out when it changes.
 *
 * It goes through the same store as the volumes because a cookie tells nobody
 * when it changes: the notice is given by `setLang` with `SETTINGS_EVENT`. On the
 * server it returns the default —there it is painted with `requestLang`, which
 * does see the header— and `useSyncExternalStore` takes care of squaring the two
 * reads without upsetting hydration, which is exactly what it is for.
 */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, currentLang, () => DEFAULT_LANG)
}

/**
 * Changes the language of the whole hall.
 *
 * It is not `HttpOnly` on purpose: the browser writes it from the menu, without
 * going through the server. Nor does it carry anything that identifies anyone
 * —only `en` or `es`—, so `SameSite=Lax` is more than enough for what there is
 * to protect and is set all the same.
 */
export function setLang(lang: Lang): void {
  /* v8 ignore next -- only the menu calls it, and the menu belongs to the browser. */
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${LANG_COOKIE}=${lang}; Path=/; Max-Age=${LANG_MAX_AGE}; SameSite=Lax${secure}`
  // A cookie fires no event when it changes, so we fire it ourselves:
  // without this, what is already painted in the browser would stay in the
  // previous language even if the server returned the translated page.
  notifyChange()
}

/**
 * What is seen around with the headset on, and React finds out when it changes.
 *
 * It goes through the same store as the volumes: it is saved in `localStorage` and not in a
 * cookie because it is not painted on the server —only whoever draws the scene looks at it, and
 * that belongs to the browser—. And for the same notice: mounted in the cabinet, the game is on
 * the same page as the hall's panel, so without it the stage would not change until a reload, and
 * reloading with the headset on means leaving the session.
 *
 * On the server it returns the default and not what is saved: the web menu shows which one is
 * chosen, and reading the storage while hydrating would paint a different button from the HTML's.
 */
export function useScenery(): Scenery {
  return useSyncExternalStore(subscribe, currentScenery, () => DEFAULT_SCENERY)
}

/**
 * The chosen scenery that the browser did not let us save, or `null` if it was saved.
 *
 * With storage locked down —private browsing, full quota, blocked cookies— the
 * write fails, and the read, which goes to the storage, would give the drawn place again: the
 * button would light up and the stage would not change. Here the choice lives for as long as the
 * visit lasts, and the read looks at it before the storage. It is the same shape as in the hall,
 * and the same idea as the game's preferences (`storage.ts`).
 */
let unsavedScenery: Scenery | null = null

/** This visit's choice if it could not be saved; if not, what is saved or the drawn place. */
function currentScenery(): Scenery {
  return unsavedScenery ?? readScenery(settingsStorage())
}

/**
 * Changes what is seen around, in the whole hall.
 *
 * **It does not touch the session.** That is what makes the change immediate and without leaving
 * the headset: whoever paints the stage reads it and puts it up or takes it down on the next
 * frame. And it writes the hall's key even if the game's menu presses it: a single preference,
 * the same one the hall shows.
 */
export function setScenery(value: Scenery): void {
  // If it goes into the storage, what is saved rules and the fallback is not needed; if not, the
  // fallback is the only thing that remembers it.
  unsavedScenery = writeScenery(settingsStorage(), value) ? null : value
  notifyChange()
}

/**
 * At what height the game is played, and React finds out when it changes.
 *
 * It is read from the storage on every read instead of being cached, like the
 * scenery and for the same reason: it is a primitive value, and there
 * `useSyncExternalStore` compares well without help.
 */
export function usePlayHeight(): PlayHeight {
  // The same read on both sides: on the server there is no storage and
  // `readPlayHeight` returns the default, so there is no need for a second
  // function that could drift away from this one without anyone noticing.
  return useSyncExternalStore(subscribe, readHeight, readHeight)
}

/** What is saved, or standing if there is nothing or there is garbage. */
function readHeight(): PlayHeight {
  return readPlayHeight(settingsStorage())
}

/**
 * The hall's fine height, **in metres**, and React finds out when it changes.
 *
 * Like the play height: a primitive value read on every read, and on the server, without
 * storage, the default zero. It is given in metres because that is what whoever moves the
 * world adds; centimetres are the hall's business, which is the one that shows them.
 */
export function usePlayHeightOffset(): number {
  return useSyncExternalStore(subscribe, readFineHeight, readFineHeight)
}

/** What is saved, or zero if there is nothing or there is garbage. */
function readFineHeight(): number {
  return playHeightOffsetMeters(readPlayHeightOffset(settingsStorage()))
}

/**
 * How what is picked up is held, and React finds out when it changes.
 *
 * Like the play height: it is read from the storage on every read instead of
 * being cached, because it is a primitive value and there `useSyncExternalStore`
 * compares well without help.
 */
export function useGrabMode(): GrabMode {
  return useSyncExternalStore(subscribe, readGrab, readGrab)
}

/** What is saved, or holding if there is nothing or there is garbage. */
function readGrab(): GrabMode {
  return readGrabMode(settingsStorage())
}

/**
 * When the stage is turned with the stick, and React finds out when it changes.
 *
 * Like the grab: it is read from the storage on every read, because it is a
 * primitive value and there `useSyncExternalStore` compares well without help.
 */
export function useTurnMode(): TurnMode {
  return useSyncExternalStore(subscribe, readTurn, readTurn)
}

/** What is saved, or seated only if there is nothing or there is garbage. */
function readTurn(): TurnMode {
  return readTurnMode(settingsStorage())
}

/**
 * Which hand the game is played with, and React finds out when it changes.
 *
 * With the same shape as the scenery, and for the same reason: the games copy this block as is,
 * and the game mounted in the cabinet is on this same page, so without the notice the paddle or
 * the bat would not change hands until a reload.
 */
export function useHand(): Hand {
  return useSyncExternalStore(subscribe, currentHand, () => DEFAULT_HAND)
}

/**
 * The chosen hand that the browser did not let us save, or `null` if it was saved.
 *
 * With storage locked down the write fails, and the read would give the right hand again: the
 * button would not light up and whoever is left-handed would carry on with the paddle in the wrong
 * hand. Here the choice lives for as long as the visit lasts.
 */
let unsavedHand: Hand | null = null

/** This visit's choice if it could not be saved; if not, what is saved or the right hand. */
function currentHand(): Hand {
  return unsavedHand ?? readHand(settingsStorage())
}

/** Changes the hand the game is played with, in the whole hall. */
export function setHand(value: Hand): void {
  // If it goes into the storage, what is saved rules and the fallback is not needed; if not, the
  // fallback is the only thing that remembers it.
  unsavedHand = writeHand(settingsStorage(), value) ? null : value
  notifyChange()
}
