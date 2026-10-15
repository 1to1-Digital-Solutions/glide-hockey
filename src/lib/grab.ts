import type { GrabMode } from './settings'

/**
 * What to do with each change of the grab button, depending on how one has chosen to grab.
 *
 * **The problem.** The gesture of this game asks to **keep** the trigger **squeezed** from end
 * to end: take, move the arm and release. One throw is three or four seconds with the hand
 * closed; a whole run, a hundred and some. Whoever has little grip strength —arthritis,
 * tremor, a tired hand— is not left out of one part of the game: they are left out of the
 * gesture, which is the game.
 *
 * **What changes with `toggle`.** One tap to take it and another to release it. The gesture in
 * between is the same and that is why **no score changes**: what decides the throw is still
 * what the arm does up to the moment of releasing.
 *
 * Only the decision lives here, without three.js or React, because it is where one gets it
 * wrong: in `toggle` the button does something different **depending on what is already held
 * in the hand**, and without ignoring the release event, one tap would take and release in the
 * same gesture.
 *
 * How to grab is chosen by whoever plays in the settings of the arcade and holds for the
 * thirteen cabinets (see `lib/settings.ts`): whoever cannot hold the trigger cannot hold it in
 * any of them.
 */

/** What is due with what is (or is not) held in the hand. */
export type GrabStep = 'take' | 'release' | 'nothing'

/**
 * @param pressed  whether this event is the squeeze one (`true`) or the release one (`false`)
 * @param holding  whether something is being carried in the hand right now
 * @param mode     how one has chosen to grab
 */
export function grabStep(pressed: boolean, holding: boolean, mode: GrabMode): GrabStep {
  if (mode === 'toggle') {
    // Releasing the button does nothing: if it counted, the same tap would take and release.
    if (!pressed) return 'nothing'
    return holding ? 'release' : 'take'
  }
  if (pressed) return holding ? 'nothing' : 'take'
  return holding ? 'release' : 'nothing'
}

/**
 * The same, for whoever reads the button **every frame** instead of through events.
 *
 * Several games do not listen to the button: they look at it in the render loop, because what
 * they do with it —following the hand with the mallet— happens every frame anyway. There is
 * no "squeeze event" to consult there, so the edge has to be seen: what turns the grab on or
 * off in `toggle` is that the button **becomes** squeezed, not that it is.
 */
export interface GrabLatch {
  /** Whether something is being carried in the hand right now. */
  holding: boolean
  /** Whether the button was squeezed in the previous frame. */
  wasPressed: boolean
}

/** A grab that has just started: the hand empty and the button released. */
export function startGrab(): GrabLatch {
  return { holding: false, wasPressed: false }
}

/** Advances the grab with what the button says in this frame. */
export function stepGrab(state: GrabLatch, pressed: boolean, mode: GrabMode): GrabLatch {
  // Holding, the hand carries something exactly while the button is squeezed.
  if (mode !== 'toggle') return { holding: pressed, wasPressed: pressed }
  const edge = pressed && !state.wasPressed
  return { holding: edge ? !state.holding : state.holding, wasPressed: pressed }
}
