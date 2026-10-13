/**
 * The anchor the host lends: where it plants the game's world and with what heading.
 *
 * **Why the gaze is not always good enough.** A game alone on its web opens the session itself and
 * knows nothing about whoever enters, so it plants the stage in front of where they look: it is the
 * only thing that guarantees it does not come out behind their back. Inside the hall more is already
 * known —the arc of cabinets has been planted for a while, with its place and its heading—, and there
 * the gaze is the worse of the two clues: to choose one of the cabinets on the left you have to turn
 * your head, and anchoring to that the game comes out turned towards where you turned, that is,
 * sideways with respect to the body. With the headset on that forces you to turn round entirely or to
 * recentre the room, which is what was reported.
 *
 * So the host can lend its own, and the game uses it **only in the first
 * placement**: from then on the gaze rules. Recentring relocates the whole reference
 * space and leaves what was lent pointing to where there is no longer anything, so the gesture that
 * relocates the room has to beat both.
 *
 * What is NOT inherited is the height: each game sets it —the table, the tee, the ground of the
 * meadow— and the host only knows about the floor.
 *
 * It is the same file in the thirteen games and in the hall (`comunes.py` watches it): it is the
 * contract between the two sides, and a copy that drifted would silently change where
 * the game appears, without breaking anything that can be seen from a screen.
 */

/** Where the world is planted: the point of the floor and the heading of its front. */
export interface Placement {
  /** In the space of the origin the host sets, in metres. */
  x: number
  z: number
  /** Where the front of the scene (its −Z) faces, in radians about the vertical axis. */
  yaw: number
}

/** The anchor just as the host passes it to the scene it mounts. */
export interface HostAnchor {
  /** The feet of whoever plays, in the host's space: `[x, y, z]`, in metres. */
  position: readonly [number, number, number]
  /** The heading of their front, in radians about the vertical axis. */
  yaw: number
}

/**
 * What the world is planted with this time.
 *
 * @param lent What the host lends as long as it has not been used. `null` if it lends nothing
 *   —the game's own web— or if it was already spent in the first placement, which is what lets
 *   the gaze rule as soon as the room is recentred.
 * @param feet Where the feet of whoever plays are now.
 * @param gazeYaw The heading that comes out of their gaze now.
 */
export function entryPlacement(
  lent: HostAnchor | null | undefined,
  feet: { x: number; z: number },
  gazeYaw: number,
): Placement {
  if (lent == null) return { x: feet.x, z: feet.z, yaw: gazeYaw }
  return { x: lent.position[0], z: lent.position[2], yaw: lent.yaw }
}
