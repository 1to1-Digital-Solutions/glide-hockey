/**
 * The hit the body takes: what is seen, what moves, what is heard and what is felt, and how much.
 *
 * It is the same file in every game that uses it (`comunes.py` watches over it). Each game says
 * **when** the player is hit, **from where** and **how hard**; everything else is decided here,
 * so that a hit reads the same in any cabinet of the hall. All pure: no React, no three and no
 * audio. What paints it is `components/xr/HitFeedback.tsx`.
 *
 * **Five layers from a single place**, and none of them moves the camera:
 *
 * - **The vignette**: it darkens the edges of the view, more on the side the hit comes from, and
 *   never reaches the centre. It is what says "you have been hit" without covering what is being
 *   looked at.
 * - **The shake of the world**: the stage shifts a few millimetres and comes back, damped.
 *   **The stage, never the camera**: moving the view without the head moving is the root cause
 *   of motion sickness in virtual reality (the eye says you are moving and the inner ear says you
 *   are not); head tracking has to keep following one to one whatever happens.
 * - **The slow motion**: an instant with the game's clock slowed down. Only the game's —what is
 *   flying—, never the head's or the hands', which keep their own pace: freezing that reads as a
 *   frame hitch and not as a hit.
 * - **The filter**: a brief low-pass on the game's bus, the "muffled ear" of the hit.
 * - **The haptic**: the shared recipe `hitTaken` of `hapticFeedback.ts`, in both hands. No pulses
 *   are invented here.
 *
 * **The figures come from no guide, because there is none.** Neither Meta nor Valve publish how
 * long an impact vignette should last or how far the world may move; Meta leaves it as curves
 * that each game tunes. These are a short, weak starting point: TO BE CALIBRATED WITH THE HEADSET.
 *
 * **Comfort rules over everything.** Whoever turns it off gets none of this; in gentle, half. And
 * with the system's reduced motion there is no shake and no slow motion —they are the two that
 * move something—, the vignette stays at gentle and the haptic and the filter go on, as they move
 * nothing.
 */

import { pulsesFor, type HandPulse } from './hapticFeedback'

/** A point or a direction, without tying itself to the vector type of any game. */
export interface Point3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** A side of the view, on the screen: `x` to the right and `y` upwards, from −1 to 1. */
export interface ViewSide {
  readonly x: number
  readonly y: number
}

// ---------------------------------------------------------------------------
// The comfort setting
// ---------------------------------------------------------------------------

/**
 * How much a hit is noticed: nothing, half or whole.
 *
 * The values are in English because they are stored: a translated storage key or value would
 * erase the player's choice the day the language of the code changed.
 */
export const COMFORT_LEVELS = ['off', 'gentle', 'normal'] as const
export type Comfort = (typeof COMFORT_LEVELS)[number]

/** What one starts with: the whole hit, which is already short and weak. */
export const DEFAULT_COMFORT: Comfort = 'normal'

/** What each setting multiplies all the layers by. */
export const COMFORT_FACTOR: Record<Comfort, number> = { off: 0, gentle: 0.5, normal: 1 }

/** The comfort read from storage: only one that exists counts; anything else, the default. */
export function parseComfort(raw: string | null | undefined): Comfort {
  return (COMFORT_LEVELS as readonly string[]).includes(raw ?? '') ? (raw as Comfort) : DEFAULT_COMFORT
}

/**
 * The comfort stored under `key`, which belongs to the game: it is a setting of the cabinet and
 * not of the hall, because the hit of a slug in the face and that of a puck in the belly do not
 * ask for the same.
 */
export function readComfort(storage: Pick<Storage, 'getItem'> | null, key: string): Comfort {
  if (storage === null) return DEFAULT_COMFORT
  try {
    return parseComfort(storage.getItem(key))
  } catch {
    // Storage locked down: the default, which is short and weak.
    return DEFAULT_COMFORT
  }
}

/**
 * Stores the comfort, or forgets it when it is the default again.
 *
 * @returns whether it ended up stored. A `false` is not an error: the browser stores nothing and
 *   the choice lasts as long as the visit does.
 */
export function writeComfort(storage: Storage | null, key: string, value: Comfort): boolean {
  if (storage === null) return false
  try {
    if (value === DEFAULT_COMFORT) storage.removeItem(key)
    else storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// The figures
// ---------------------------------------------------------------------------

/**
 * The figures of the layers, with the hardest hit and full comfort. TO BE CALIBRATED WITH THE
 * HEADSET.
 *
 * - `vignette`: it rises in `fadeIn` seconds and fades out in `fadeOut`, falling along a curve
 *   (fast at first, gentle at the end: what remains does not bother). `max` is the most it
 *   darkens, and `floor` what the weakest hit weighs, so that a small hit is seen too. `side` is
 *   how much it leans towards the side of the hit: with 0 it would be a ring equal on all sides.
 * - `shake`: `amplitude` in metres —a centimetre and a half, the hardest hit—, `hertz` of the
 *   oscillation, `damping` in seconds (the envelope falls to a third in that time) and
 *   `duration`, after which the stage is **exactly** where it was.
 * - `slowMo`: the game's clock drops to `scale` for `hold` seconds and returns to 1 in
 *   `recovery`. The ceiling of a hit stop is about ten frames (that of Street Fighter II);
 *   this does not reach even half of the stopped clock.
 * - `filter`: the cutoff drops to `cutoff` hertz, stays for `hold` seconds and returns to `open`
 *   in `recovery`, rising on a logarithmic scale, which is how the ear hears frequencies.
 */
export const HIT = {
  vignette: { fadeIn: 0.06, fadeOut: 0.9, max: 0.9, floor: 0.45, side: 1 },
  shake: { amplitude: 0.015, hertz: 11, damping: 0.1, duration: 0.4 },
  slowMo: { scale: 0.3, hold: 0.08, recovery: 0.25 },
  filter: { cutoff: 500, open: 20000, hold: 0.1, recovery: 0.5 },
} as const

/** How long the longest layer takes to fade out: past this, the hit no longer exists. */
export const HIT_DURATION = Math.max(
  HIT.vignette.fadeIn + HIT.vignette.fadeOut,
  HIT.shake.duration,
  HIT.slowMo.hold + HIT.slowMo.recovery,
  HIT.filter.hold + HIT.filter.recovery,
)

/** How many hits are tracked at once: closer together than this they can no longer be told apart. */
export const MAX_CONCURRENT_HITS = 4

// ---------------------------------------------------------------------------
// From the strength to the layers
// ---------------------------------------------------------------------------

/**
 * How much each layer weighs in a hit, from 0 to 1. `haptic` is the strength passed to the shared
 * recipe, or `null` if it does not vibrate.
 */
export interface HitLayers {
  readonly vignette: number
  readonly shake: number
  readonly slowMo: number
  readonly filter: number
  readonly haptic: number | null
}

/** A hit that does nothing: the one of comfort turned off. */
export const NO_LAYERS: HitLayers = { vignette: 0, shake: 0, slowMo: 0, filter: 0, haptic: null }

const clamp = (x: number) => Math.min(1, Math.max(0, x))

/**
 * The layers of a hit of that strength (0–1) with that comfort and, if the system asks for it,
 * with reduced motion.
 *
 * The strength scales the shake, the slow motion and the filter whole —a graze does not slow the
 * world down—, but the vignette starts from a floor: the weakest hit has to be seen too. The
 * haptic carries the strength as is and not the comfort, because its recipe already has its own
 * minimum and maximum; the comfort only decides whether it vibrates.
 */
export function layersForHit(strength: number, comfort: Comfort, reduced = false): HitLayers {
  const factor = COMFORT_FACTOR[comfort]
  if (factor === 0) return NO_LAYERS
  const f = clamp(strength)
  const v = HIT.vignette
  const vignette = (v.floor + (1 - v.floor) * f) * v.max
  return {
    // With reduced motion, the vignette never goes past the gentle one.
    vignette: vignette * (reduced ? Math.min(factor, COMFORT_FACTOR.gentle) : factor),
    shake: reduced ? 0 : f * factor,
    slowMo: reduced ? 0 : f * factor,
    filter: f * factor,
    haptic: f,
  }
}

/** The pulses of the hit: the shared recipe, in both hands. None if it does not vibrate. */
export function hitPulses(layers: HitLayers): HandPulse[] {
  return layers.haptic === null ? [] : pulsesFor({ type: 'hitTaken', strength: layers.haptic })
}

// ---------------------------------------------------------------------------
// The curves over time
// ---------------------------------------------------------------------------

/** The shape of the vignette at that age in seconds, from 0 to 1: it rises straight and falls along a curve. */
export function vignetteShape(age: number): number {
  const { fadeIn, fadeOut } = HIT.vignette
  if (age < 0 || age >= fadeIn + fadeOut) return 0
  if (age < fadeIn) return age / fadeIn
  const k = (age - fadeIn) / fadeOut
  return (1 - k) * (1 - k)
}

/** How much the vignette of those layers darkens at that age, from 0 to 1. */
export function vignetteAt(layers: HitLayers, age: number): number {
  return layers.vignette * vignetteShape(age)
}

/**
 * The shape of the shake at that age, from −1 to 1: an oscillation that dies out.
 *
 * The envelope is that of a spring damped **by a ramp that reaches zero** at `duration`: without
 * the ramp, the exponential never ends, and the stage would stay forever a fraction of a
 * millimetre away from its place. It starts at zero —the sine— so that the first frame does not
 * jump.
 */
export function shakeShape(age: number): number {
  const { hertz, damping, duration } = HIT.shake
  if (age <= 0 || age >= duration) return 0
  return Math.exp(-age / damping) * (1 - age / duration) * Math.sin(2 * Math.PI * hertz * age)
}

/**
 * Where the stage is at that age, in metres from its place: along `direction`, which is
 * **where the hit comes from**. On taking a shove one moves back, so the world, seen from the
 * player, goes that way and comes back.
 */
export function shakeAt(layers: HitLayers, direction: Point3, age: number): Point3 {
  const m = layers.shake * HIT.shake.amplitude * shakeShape(age)
  return { x: direction.x * m, y: direction.y * m, z: direction.z * m }
}

/** What goes from 0 to 1 smoothly: the return of the slow motion and of the filter does not jerk. */
function smooth(k: number): number {
  const t = clamp(k)
  return t * t * (3 - 2 * t)
}

/** How much the hit slows down at that age, from 0 (nothing) to 1 (the most): it holds and returns smoothly. */
function brakeAt(age: number, hold: number, recovery: number): number {
  if (age < 0 || age >= hold + recovery) return 0
  if (age < hold) return 1
  return 1 - smooth((age - hold) / recovery)
}

/** At what pace the game's clock runs at that age: 1 is the normal one and it never drops below `scale`. */
export function timeScaleAt(layers: HitLayers, age: number): number {
  const { scale, hold, recovery } = HIT.slowMo
  return 1 - (1 - scale) * layers.slowMo * brakeAt(age, hold, recovery)
}

/**
 * The cutoff of the low-pass at that age, in hertz. Fully open is `open`, which no longer removes
 * anything that can be heard.
 */
export function cutoffAt(layers: HitLayers, age: number): number {
  const { cutoff, open, hold, recovery } = HIT.filter
  const k = layers.filter * brakeAt(age, hold, recovery)
  return open * Math.pow(cutoff / open, k)
}

// ---------------------------------------------------------------------------
// Where it comes from, in the view
// ---------------------------------------------------------------------------

/**
 * The side of the view a hit comes from, from its direction **in head space** (the camera looks
 * at −Z, with X to the right and Y up).
 *
 * It is what it has of lateral: a head-on hit gives `(0, 0)` and the vignette comes out equal on
 * all the edges; one that comes from the left, `(−1, 0)`, and it darkens the left more. One from
 * behind also gives its side —whatever it has—, because the view has no rear edge.
 */
export function sideInView(directionInHead: Point3): ViewSide {
  const { x, y, z } = directionInHead
  const length = Math.hypot(x, y, z)
  if (length < 1e-9) return { x: 0, y: 0 }
  return { x: x / length, y: y / length }
}

/** A direction of length 1, or downwards if it has none: the dull hit, with no side. */
export function unitVector(d: Point3 | null | undefined): Point3 {
  const length = d == null ? 0 : Math.hypot(d.x, d.y, d.z)
  if (d == null || length < 1e-9) return { x: 0, y: -1, z: 0 }
  return { x: d.x / length, y: d.y / length, z: d.z / length }
}

// ---------------------------------------------------------------------------
// Several hits at once
// ---------------------------------------------------------------------------

/** A hit under way: when it happened, how much each layer weighs, where to and on which side it is seen. */
export interface Hit {
  readonly start: number
  readonly layers: HitLayers
  /** Where it comes from, of length 1, in the space where the stage is shaken. */
  readonly direction: Point3
  readonly side: ViewSide
}

/** What has to be painted, moved and heard at one instant. */
export interface HitState {
  readonly vignette: number
  readonly side: ViewSide
  readonly shake: Point3
  readonly timeScale: number
  readonly cutoff: number
  /** The hits that are still live: the others no longer contribute anything and are forgotten. */
  readonly live: readonly Hit[]
}

/** Nothing to paint: the state at rest, to which everything returns. */
export const AT_REST: HitState = {
  vignette: 0,
  side: { x: 0, y: 0 },
  shake: { x: 0, y: 0, z: 0 },
  timeScale: 1,
  cutoff: HIT.filter.open,
  live: [],
}

/** Adds a hit to the ones there are, forgetting the oldest if they are already too many. */
export function addHit(hits: readonly Hit[], hit: Hit): Hit[] {
  return [...hits, hit].slice(-MAX_CONCURRENT_HITS)
}

/**
 * All the live hits together, at that instant (seconds, with the same clock as `start`).
 *
 * **Each layer is combined in its own way**: the vignette, the darkest one —two vignettes added
 * would cover the centre—, with the side of that one; the shakes are added, which is what two
 * shoves do; and the clock and the filter, the most slowed and the most closed. That way a hit on
 * top of another never jumps: each layer carries on from where it was.
 */
export function hitState(hits: readonly Hit[], now: number): HitState {
  const live = hits.filter((g) => now - g.start < HIT_DURATION)
  if (live.length === 0) return AT_REST
  let vignette = 0
  let side: ViewSide = AT_REST.side
  let sx = 0
  let sy = 0
  let sz = 0
  let timeScale = 1
  let cutoff: number = HIT.filter.open
  for (const g of live) {
    const age = now - g.start
    const v = vignetteAt(g.layers, age)
    if (v > vignette) {
      vignette = v
      side = g.side
    }
    const s = shakeAt(g.layers, g.direction, age)
    sx += s.x
    sy += s.y
    sz += s.z
    timeScale = Math.min(timeScale, timeScaleAt(g.layers, age))
    cutoff = Math.min(cutoff, cutoffAt(g.layers, age))
  }
  return { vignette, side, shake: { x: sx, y: sy, z: sz }, timeScale, cutoff, live }
}
