/**
 * The slide of the puck: how loud it is and at what pitch, depending on its speed.
 *
 * Only the maths, no audio: `audioEngine.ts` uses it to drive its filtered noise voice, and the
 * Godot port to drive the loop that was rendered from that same voice. A single place for both,
 * so the puck sounds just as fast in both.
 */
import { MAX_PUCK_SPEED } from './gameConfig'
import { STALL_SPEED } from './puckPhysics'

/** Cap of the slide relative to a whole strike, and its frequency band in Hz. */
export const SLIDE_MAX_LEVEL = 0.28
export const SLIDE_PITCH_MIN = 380
export const SLIDE_PITCH_MAX = 1900
/** Seconds the slide takes to follow the speed: no jumps between frames. */
export const SLIDE_SMOOTHING = 0.05

/**
 * How loud the sliding puck is, from 0 to 1, depending on its speed in m/s.
 *
 * Nothing below the speed at which the puck counts as stopped
 * (`STALL_SPEED`): a puck at rest does not slide. From there it rises with the
 * root of the speed —the ear notices the start more than the top end— up to
 * the cap at the maximum speed. It is a background sound: it never reaches the
 * volume of a strike.
 */
export function slideLevel(speed: number): number {
  if (!Number.isFinite(speed) || speed <= STALL_SPEED) return 0
  const t = Math.min(1, (speed - STALL_SPEED) / (MAX_PUCK_SPEED - STALL_SPEED))
  return SLIDE_MAX_LEVEL * Math.sqrt(t)
}

/**
 * At what frequency the slide is filtered depending on the speed: faster, higher.
 * It is what makes the speed be heard and not only the volume.
 */
export function slidePitch(speed: number): number {
  const s = Number.isFinite(speed) ? Math.min(1, Math.max(0, speed / MAX_PUCK_SPEED)) : 0
  return SLIDE_PITCH_MIN + (SLIDE_PITCH_MAX - SLIDE_PITCH_MIN) * s
}
