'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Which hand is holding something right now.
 *
 * **To turn its ray off.** The controller draws a long ray with its cursor, which is what is
 * used to press the menus; with the object already in the hand that ray stays lit and
 * pointing at the wall, as if something were being pointed at. Reported with the headset on:
 * "once the user grabs the object, I think the ray should stop being visible".
 *
 * It is kept outside React —a `Set` and some listeners— because the one that writes it is the
 * game's frame loop, which runs at 90 Hz and cannot go through `setState`, and the one that
 * reads it is the controller component, which is React. The external store of
 * `useSyncExternalStore` is exactly that shape.
 *
 * **Only the drawing is turned off, not the pointer.** The ray still exists: releasing the
 * object and pressing a menu button again has to work with no further ceremony.
 */

type HandSide = 'left' | 'right'

interface Registry {
  ocupadas: Set<HandSide>
  oyentes: Set<() => void>
}

declare global {
  interface Window {
    /**
     * Who is holding something in the hand, **shared between the game and whoever mounts it**.
     *
     * It goes on `window` and not in the module because they are two modules. This file is
     * copied into the **sixteen games that let you grab something** and into the hub, and
     * mounted inside the hall the one that draws the controller is the hall's: the game marked
     * the hand in its copy and the hall read its own, which was always empty. From inside the
     * headset that looks like **the ray does not turn off when playing from the arcade** even
     * though it does on the game's own website, which is where it was tested.
     *
     * **Sixteen and not seventeen**: in stick-rush the sticks are caught with a tap and are not
     * carried, so there is nothing to mark. Table Tennis came in when its paddle started being
     * grabbed like the others, and skeet when its pistol stopped being *always* in the hand and
     * started being drawn with the grab: while it was always on, marking it would have turned
     * the ray off for the whole run and there would have been nothing left to press the menu
     * with.
     *
     * On each game's own website the ray is drawn by its own `XRControllerGrip`, which reads
     * it: the sixteen ship it, because the library's default controller knows nothing about
     * this and left the ray lit with the object in the hand. Inside the arcade —which is where
     * people play— the hall's one draws it, and it reads it too. `scripts/repos/comunes.py`
     * compares it.
     *
     * A shared `window` is ugly and it is the channel there is: they are two packages that are
     * bundled together but do not share a module. The first one to arrive creates it.
     */
    __xrManosOcupadas?: Registry
  }
}

/** The usual registry, or a new one. Without `window` —on the server— one of its own. */
const own: Registry = { ocupadas: new Set(), oyentes: new Set() }

function registry(): Registry {
  if (typeof window === 'undefined') return own
  window.__xrManosOcupadas ??= own
  return window.__xrManosOcupadas
}

/** Notes whether that hand holds something. Callable every frame: it only notifies on change. */
export function markHandBusy(hand: HandSide, busy: boolean): void {
  const { ocupadas, oyentes } = registry()
  if (busy === ocupadas.has(hand)) return
  if (busy) ocupadas.add(hand)
  else ocupadas.delete(hand)
  for (const listener of oyentes) listener()
}

/** Releases them all: when the run ends or the scene unmounts nobody is holding anything. */
export function releaseHands(): void {
  const { ocupadas, oyentes } = registry()
  if (ocupadas.size === 0) return
  ocupadas.clear()
  for (const listener of oyentes) listener()
}

/** Changes are notified here. Exported so it can be tested that it does not over-notify. */
export function subscribeToHands(listener: () => void): () => void {
  const { oyentes } = registry()
  oyentes.add(listener)
  return () => {
    oyentes.delete(listener)
  }
}

/** Whether that hand holds something, for whoever has to paint it. Outside the headset, never. */
export function useHandBusy(hand: HandSide | undefined): boolean {
  const read = useCallback(() => (hand == null ? false : registry().ocupadas.has(hand)), [hand])
  return useSyncExternalStore(subscribeToHands, read, () => false)
}
