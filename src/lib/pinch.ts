/**
 * The pinch: how something is grabbed with the bare hand.
 *
 * **Six of the thirteen games required a controller.** They read
 * `useXRInputSourceState('controller')` and nothing else, so with bare hands the object never
 * appeared and on top of that there was no way to explain why —inside the headset no text can
 * be drawn—. Whoever does not have the controllers at hand, or cannot hold them, was left out
 * of the whole game.
 *
 * A controller says whether it is squeezed with a button; a hand has no buttons, so the
 * distance between the tip of the thumb and that of the index finger says it. It is the gesture
 * the headset itself uses to «select», so there is nothing new to learn.
 *
 * Only the threshold is here, which is what can be checked without a headset.
 */

/**
 * At what distance the pinch is taken as closed, in metres.
 *
 * Two and a half centimetres: the fingertips touch at around one centimetre, and the margin
 * lets it count before they fully touch. Wider would start counting the hand when it is
 * simply relaxed.
 */
export const PINCH_CLOSE = 0.025

/**
 * And at which it is taken as open.
 *
 * Further than the closing one on purpose: with a single threshold, a hand trembling right on
 * it would open and close several times a second, and the object would fall by itself. This is
 * the hysteresis of a switch, and it is what makes grabbing hold through the tremor.
 */
export const PINCH_OPEN = 0.04

/**
 * Is the hand grabbing?
 *
 * @param distance  between the tip of the thumb and that of the index finger, in metres, or
 *   `null` if the headset does not give the joints (the case of a controller, and that of a
 *   headset that does not publish them)
 * @param wasPinching  whether it was in the previous frame
 */
export function isPinching(distance: number | null, wasPinching: boolean): boolean {
  if (distance == null || !Number.isFinite(distance)) return false
  return wasPinching ? distance < PINCH_OPEN : distance < PINCH_CLOSE
}
