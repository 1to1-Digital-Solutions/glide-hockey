import type { Point3 } from './hitFeedback'
import { HALF_LENGTH } from './puckPhysics'

/**
 * The goal against, seen as a hit the body takes (`lib/hitFeedback.ts`).
 *
 * **Here the puck cannot hit whoever plays**: the table is a plane with rails and the physics
 * is two-dimensional (`puckPhysics.ts`), so nothing flies off towards the body. The closest
 * thing to «I've been hit» is having a goal scored against you, and that is the event that
 * triggers the macro. With **little strength**, because nobody has touched you: it is a notice
 * that the rally has been lost, not a shove. TO BE CALIBRATED WITH THE HEADSET.
 */
export const GOAL_AGAINST_STRENGTH = 0.3

/**
 * Where the hit comes from, as seen from the head: towards the own goal, where the puck went
 * in. In table coordinates, with its centre at the origin and the goal of whoever plays at
 * `+Z`; since the table is only shifted relative to the game world, without rotating, the
 * direction holds the same in game-world space, which is where `HitFeedback` is mounted.
 *
 * @param head where the eyes are, in table coordinates.
 */
export function goalAgainstDirection(head: Point3): Point3 {
  return { x: -head.x, y: -head.y, z: HALF_LENGTH - head.z }
}
