/**
 * Grabbing the mallet with the hand, with the headset on.
 *
 * **Why the ray will not do.** The mallet used to be moved by aiming at it with the
 * controller ray, and that feels like driving a cursor: the hand is still in the air and
 * the piece slides by itself two metres further on. On an air hockey table what one does
 * is **grab** the mallet and push it, which is what the stick of stick-rush does and that
 * is why that one is understood without explanation.
 *
 * The rule lives here and not in the scene so that it can be tested without a headset and
 * without three: what it decides is when it is grabbed, when it is let go and where the
 * mallet goes while it is held, which is where the mistakes felt while playing are.
 *
 * **It is grabbed by proximity, not by aiming.** The hand has to be brought to the mallet
 * and squeezed; squeezing from far away does not teleport it to the hand, which is what
 * would turn it into a cursor again. And once grabbed it is not let go by moving away: only
 * on releasing the button, because mid-exchange the hand leaves any radius one could set.
 */

import type { Vec2 } from './puckPhysics'
import { MALLET_RADIUS } from './gameConfig'

/**
 * How far the hand reaches to grab the mallet, in metres from its centre.
 *
 * A little more than the mallet itself: with the headset on the hand never lands exactly
 * on top, and demanding millimetre precision turns grabbing it into a separate minigame.
 */
export const GRAB_REACH = MALLET_RADIUS + 0.12

/** What the hand and the button say in this frame. */
export interface HandOnTable {
  /** Where the hand is, in table coordinates. */
  position: Vec2
  /** Whether the grab button is squeezed right now. */
  grabbing: boolean
}

/** What the mallet knows about itself between frames. */
export interface MalletGrab {
  /** Whether the mallet is in the hand right now. */
  held: boolean
  /** Where the mallet goes. With no hand carrying it, it stays where it was. */
  target: Vec2
}

/** How far the hand is from the mallet. */
function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/**
 * The grab of the next frame.
 *
 * @param previous  How the mallet was until now.
 * @param hand      What the hand says, or `null` if there is none on the table: no
 *                  controller, out of session, or with the controller aiming elsewhere.
 */
export function nextGrab(previous: MalletGrab, hand: HandOnTable | null): MalletGrab {
  // With no hand, what was being carried is not let go: a controller that disappears for
  // one frame —tracking is lost on leaving the field of view— would leave the mallet lying
  // in the middle of a rally.
  if (hand === null) return previous

  if (!hand.grabbing) return { held: false, target: previous.target }

  // Already grabbed, it follows the hand wherever it goes: letting go by distance would lose
  // it right on the hit, which is when it goes fastest.
  if (previous.held) return { held: true, target: hand.position }

  // Just squeezed: it is only grabbed if the hand is on top. Squeezing from far away does nothing.
  const withinReach = distance(hand.position, previous.target) <= GRAB_REACH
  return withinReach ? { held: true, target: hand.position } : { held: false, target: previous.target }
}
