/**
 * At what height the immersive UI is placed: that of the eyes of whoever is playing.
 *
 * **It was nailed to a constant.** The menu, the scoreboard and the exit button lived at a
 * fixed height, measured with one person in front of it: for someone a metre and a half tall
 * they ended up above the comfortable line of sight —and that is where the settings and the
 * exit are— and for someone two metres tall, at chest height. It is one of the few things in
 * the game that cannot be adjusted by hand, because nobody is going to open a menu they cannot
 * reach in order to raise the menu.
 *
 * Only the arithmetic is here, which is what can be checked without a headset: which height
 * is accepted as good, how much the UI rises or falls and when it is measured again. The one
 * that applies it is `components/xr/XRUiHeight.tsx`.
 */

/**
 * The stature the UI was placed with.
 *
 * It is not an average of anything: it is the person who was in front of it when the heights
 * were set, and that is why it is the zero of the correction. With it, everything stays
 * exactly where it was.
 */
export const REFERENCE_EYE_HEIGHT = 1.6

/**
 * The range of heights accepted as «a person's eyes».
 *
 * Outside it the measurement is not a stature: it is the headset on a table, in the hand of
 * someone bending down to pick it up, or a session whose origin is not on the floor. In those
 * cases nothing is made up and the UI stays where it has always been.
 */
export const MIN_EYE_HEIGHT = 0.9
export const MAX_EYE_HEIGHT = 2.2

/** Is this height that of the eyes of someone standing or seated? */
export function isPlausibleEyeHeight(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_EYE_HEIGHT && value <= MAX_EYE_HEIGHT
}

/**
 * Does this session have its origin on the floor, going by what it says it has enabled?
 *
 * `local-floor` is asked for as required when the session is opened, so a live session has it
 * by necessity. But `enabledFeatures` is optional in the specification and there are browsers
 * that do not publish it: demanding it would mean giving up measuring on headsets where the
 * data is good. If the list is missing it is accepted as good, and if even so the space were
 * not a floor one, the height would be born outside the range above and would not be used
 * either.
 */
export function hasFloorReference(enabled: readonly string[] | undefined): boolean {
  return enabled == null || enabled.includes('local-floor') || enabled.includes('bounded-floor')
}

/**
 * How much the UI rises (or falls) for that eye height, in metres.
 *
 * The **whole** height is followed and not a fraction: the panels do not touch the floor nor
 * have anything to do with it, they are floating sheets that are looked at, so the only thing
 * that matters is at what height they end up relative to the eyes. Without a good height,
 * zero: they stay where they were.
 */
export function uiRise(eyeHeight: number | null | undefined): number {
  if (!isPlausibleEyeHeight(eyeHeight)) return 0
  return eyeHeight - REFERENCE_EYE_HEIGHT
}

/**
 * How much the height has to change, and for how long, to measure again.
 *
 * The UI is placed on entering and **stays still**: one that chased the head would rise when
 * standing on tiptoe and fall when crouching, right when a button is being aimed at. But
 * sitting down mid-run does have to show, and that is a large and sustained change, not a
 * movement of play.
 */
export const RETAKE_DELTA = 0.15
export const RETAKE_SECONDS = 1

/** What is remembered of the height between frames. */
export interface HeightTracker {
  /** The height being used right now, or `null` while there is no good one. */
  held: number | null
  /** The filtered measurement, which is what is compared with the one being used. */
  smoothed: number | null
  /** How long the measurement has been far from the one being used, in seconds. */
  drift: number
}

/** A tracking just started: with nothing measured yet. */
export function startTracking(): HeightTracker {
  return { held: null, smoothed: null, drift: 0 }
}

/**
 * Advances the tracking with this frame's measurement.
 *
 * @param measured  the height of the head, or `null` if there is no good data
 * @param ratio     how much the filter moves toward the measurement in this frame, from 0 to 1
 * @param delta     seconds of this frame
 */
export function trackHeight(
  state: HeightTracker,
  measured: number | null,
  ratio: number,
  delta: number,
): HeightTracker {
  if (!isPlausibleEyeHeight(measured)) return state

  const smoothed = state.smoothed == null ? measured : state.smoothed + (measured - state.smoothed) * ratio
  // The first good measurement is used as is: entering the session and seeing the menu at eye
  // height is what has to happen, not a panel rising slowly from wherever.
  if (state.held == null) return { held: smoothed, smoothed, drift: 0 }

  const far = Math.abs(smoothed - state.held) > RETAKE_DELTA
  const drift = far ? state.drift + Math.max(0, delta) : 0
  if (drift > RETAKE_SECONDS) return { held: smoothed, smoothed, drift: 0 }
  return { held: state.held, smoothed, drift }
}

/**
 * How much the world is shifted, in metres, to leave it within reach of whoever
 * is playing.
 *
 * **The problem.** The heights of the scene were chosen with one person standing
 * in front of it. Seated —on a chair, on a sofa, in a wheelchair— the whole
 * world ends up a hand's breadth above where the arm reaches, and nothing fails:
 * it simply cannot be played. The same happens on a small scale to someone
 * shorter than that person, and they have no way of levelling it either.
 *
 * **It is the same correction already made to the UI**, applied to the stage:
 * it comes out negative for someone whose eyes are below the reference, so the
 * world comes down to them. And the stage is shifted, not the player: the
 * origin belongs to whoever mounts the scene —in the hall there is a cabinet
 * arc planted there— and two origins in the same session trample each other.
 *
 * **It changes no score.** The whole scene is shifted, with the target inside,
 * while the hand stays where the hand is: the height of the target relative to
 * the arm is the same as it was for the standing person it was drawn for. And
 * whoever plays standing notices nothing, because there the correction is zero.
 *
 * Whoever is playing asks for it from the arcade's settings and it is not
 * guessed: lowering the world without anybody having said so would move the
 * floor under the feet of someone who is standing.
 *
 * @param eyeHeight  the height of the eyes the headset has measured, or `null`
 * @param atEyeLevel whether the world has been asked for at eye level
 */
export function worldRise(
  eyeHeight: number | null | undefined,
  atEyeLevel: boolean,
): number {
  if (!atEyeLevel) return 0
  return uiRise(eyeHeight)
}

/**
 * How much the UI rises **above what the world has already moved**.
 *
 * The UI hangs from the world, and the world may already have come down to the
 * eyes of whoever is playing (see `worldRise`). Adding the UI's correction then
 * would lower it twice: the menu would end up at knee height precisely for
 * whoever is least able to crouch down and look for it.
 *
 * Put another way: when the whole world comes to you, the UI is already where
 * it has to be and needs no correction of its own.
 */
export function uiRiseOverWorld(
  eyeHeight: number | null | undefined,
  atEyeLevel: boolean,
): number {
  return uiRise(eyeHeight) - worldRise(eyeHeight, atEyeLevel)
}
