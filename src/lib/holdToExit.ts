/**
 * The count of «hold to exit»: the same as the hall's (`xrcade/src/lib/salon/holdToExit.ts`
 * and, in Godot, `godot/scripts/hold_to_exit.gd` and the kit), one sustained second. Mounted in the hall,
 * the hall keeps it; on the game's own web, `components/xr/ExitRing.tsx`.
 *
 * It is long on purpose: a stray tap happens by accident —when grabbing, when resting the hand— and taking
 * someone out of the run for that would be worse than offering no exit. And it shows: while it is held, a
 * ring fills in front of the eyes (`ExitRing.tsx`), which is what says it is being done right.
 *
 * Without `window`, without React and without three, to test it without a browser.
 */

/** How long the button has to be held, in seconds. */
export const HOLD_TO_EXIT_SECONDS = 1

/**
 * The buttons that, held, take you out of the game: the B and the Y of the Quest controllers, the same
 * as in Godot (which also accepts the menu one, which the headset's browser keeps for itself). No game
 * uses them.
 */
export const EXIT_BUTTONS = ['b-button', 'y-button'] as const

export interface HoldToExit {
  /** What has been held, in seconds. */
  readonly held: number
  /** Whether it has already fired: until release it does not fire again. */
  readonly fired: boolean
}

export const HOLD_IDLE: HoldToExit = { held: 0, fired: false }

/**
 * One frame of the count: with the button held or not, and what has happened. `exit` is `true`
 * exactly in the frame in which it completes; afterwards, even if it keeps being pressed, it does not
 * fire again until it is released and pressed again. `progress` goes from 0 to 1, and is 0 on firing: the ring
 * goes away when exiting.
 */
export function holdStep(
  state: HoldToExit,
  pressed: boolean,
  delta: number,
): { state: HoldToExit; progress: number; exit: boolean } {
  if (!pressed) return { state: HOLD_IDLE, progress: 0, exit: false }
  if (state.fired) return { state, progress: 0, exit: false }
  const held = state.held + Math.max(0, Number.isFinite(delta) ? delta : 0)
  if (held < HOLD_TO_EXIT_SECONDS) return { state: { held, fired: false }, progress: held / HOLD_TO_EXIT_SECONDS, exit: false }
  return { state: { held, fired: true }, progress: 0, exit: true }
}
