import { MAX_PUCK_SPEED } from './gameConfig'

/**
 * How much the puck glows according to how fast it goes.
 *
 * In the headset the puck crosses the table in half a second and a matt orange gets lost
 * against the white board; lighting up with speed is what lets one follow it out of the corner
 * of the eye. It is a pure calculation over the speed (m/s) so that it can be pinned down
 * without a scene: `Puck.tsx` draws it.
 *
 * **And it no longer has a ring.** It also had a halo that widened with speed, and with the
 * headset on it did not read as a fast puck but as a spotlight: «it has a sort of halo
 * around it, like a beam of light; I would take that out». The lit puck does the same job
 * —it says where it is without looking straight at it— without looking like something else.
 */

export interface PuckGlow {
  /** Emissive intensity of the puck: a touch at rest, much more at full speed. */
  emissive: number
}

/** Glow at rest and at full speed. */
const EMISSIVE_REST = 0.12
const EMISSIVE_MAX = 1.1

export function puckGlow(speed: number): PuckGlow {
  const s = Number.isFinite(speed) ? Math.min(1, Math.max(0, speed / MAX_PUCK_SPEED)) : 0
  return { emissive: EMISSIVE_REST + (EMISSIVE_MAX - EMISSIVE_REST) * s }
}
