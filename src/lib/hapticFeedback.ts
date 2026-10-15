/**
 * What the hand feels: the vibration recipes shared by every game of the hall.
 *
 * It is the same file in all of them (`comunes.py` watches it). Each game translates its events
 * into a `HapticEvent` —"this hand has struck with this strength", "this hand is drawing up to
 * here"— and out of here comes **which pulses, in which hand and when**. That way a strike feels
 * the same in darts as in bowling, and whoever learns in one game what a vibration means does not
 * have to learn it again in the next one.
 *
 * Three rules that decide everything below:
 *
 * - **The hand that touches vibrates.** Both only when the body takes the hit. If both vibrate
 *   because of something one of them did, the hand no longer knows what was its own.
 * - **Sliding, waiting or something passing nearby does not vibrate.** Only contact. A continuous
 *   graze left one game vibrating for the whole run.
 * - **`pulse()` does not queue: each call cuts the previous one off** (the specification of
 *   `GamepadHapticActuator` and what the Quest does). A train of pulses is chained with delays
 *   equal to or greater than the duration of the previous pulse; overlapping them does not add
 *   up, it cuts. The test watches it.
 *
 * Everything is pure: no React, three or controllers. The one that plays the pulses is each game,
 * with its `pulseInputSource` or equivalent; in Godot, `XRInterface.trigger_haptic_pulse` receives
 * the same (intensity and duration) except the frequency, which does not exist here.
 */

export type HandSide = 'left' | 'right'

/** What has happened, told from the hand. `strength` and `level` go from 0 to 1. */
export type HapticEvent =
  /** Something strikes with what is held in the hand: a bat, a paddle, a blade, a mallet. */
  | { readonly type: 'impact'; readonly hand: HandSide; readonly strength: number }
  /** What was thrown arrives and touches something: the dart sticks, the pins fall, the hoop is made. */
  | { readonly type: 'arrival'; readonly hand: HandSide; readonly strength: number }
  /** Something is grabbed. */
  | { readonly type: 'grab'; readonly hand: HandSide }
  /** Something is released or thrown; `strength` is how hard it left. */
  | { readonly type: 'release'; readonly hand: HandSide; readonly strength: number }
  /** A shot: the recoil of the weapon. */
  | { readonly type: 'shot'; readonly hand: HandSide }
  /** The body takes a hit. Both hands. */
  | { readonly type: 'hitTaken'; readonly strength: number }

/** A pulse ready for `pulse(intensity, ms)`, which goes out `delay` ms after the event. */
export type HandPulse = {
  readonly hand: HandSide
  readonly intensity: number
  readonly ms: number
  readonly delay: number
}

/**
 * The figures of the recipes. They come from testing with a Quest 3 in the hand: below 0.08 of
 * intensity or 12 ms a pulse is not felt; above 0.9 they all feel the same.
 * TO BE CALIBRATED WITH THE HEADSET, together and in one game of each kind.
 */
export const HAPTIC_RECIPES = {
  /** The strike: strong and short, and a softer tail that says "it was for real". */
  impact: { min: 0.3, max: 0.95, ms: 35, tail: { factor: 0.35, ms: 60 } },
  /** What was thrown arrives: softer than a strike in the hand, because it happens far away. */
  arrival: { min: 0.15, max: 0.5, ms: 30 },
  grab: { intensity: 0.25, ms: 18 },
  release: { min: 0.2, max: 0.6, ms: 30 },
  shot: { intensity: 0.7, ms: 30 },
  /** The longest one and in both hands: so that it is not mistaken for anything one does. */
  hitTaken: { min: 0.6, max: 1, ms: 220 },
  /** The tension: short pulses that tighten and rise while drawing. */
  tension: {
    ms: 14,
    intensity: { slack: 0.08, taut: 0.4 },
    period: { slack: 140, taut: 45 },
    /** Below this nothing is being drawn yet: the string at rest does not vibrate. */
    threshold: 0.05,
  },
} as const

const clamp = (x: number) => Math.min(1, Math.max(0, x))
const between = (from: number, to: number, t: number) => from + (to - from) * clamp(t)

/** The pulses of a single event. The tension, which lasts, goes apart (`nextTension`). */
export function pulsesFor(event: HapticEvent): HandPulse[] {
  switch (event.type) {
    case 'impact': {
      const r = HAPTIC_RECIPES.impact
      const intensity = between(r.min, r.max, event.strength)
      return [
        { hand: event.hand, intensity, ms: r.ms, delay: 0 },
        { hand: event.hand, intensity: intensity * r.tail.factor, ms: r.tail.ms, delay: r.ms },
      ]
    }
    case 'arrival': {
      const r = HAPTIC_RECIPES.arrival
      return [{ hand: event.hand, intensity: between(r.min, r.max, event.strength), ms: r.ms, delay: 0 }]
    }
    case 'grab':
      return [{ hand: event.hand, intensity: HAPTIC_RECIPES.grab.intensity, ms: HAPTIC_RECIPES.grab.ms, delay: 0 }]
    case 'release': {
      const r = HAPTIC_RECIPES.release
      return [{ hand: event.hand, intensity: between(r.min, r.max, event.strength), ms: r.ms, delay: 0 }]
    }
    case 'shot':
      return [{ hand: event.hand, intensity: HAPTIC_RECIPES.shot.intensity, ms: HAPTIC_RECIPES.shot.ms, delay: 0 }]
    case 'hitTaken': {
      const r = HAPTIC_RECIPES.hitTaken
      const intensity = between(r.min, r.max, event.strength)
      return (['left', 'right'] as const).map((hand) => ({ hand, intensity, ms: r.ms, delay: 0 }))
    }
  }
}

/** When the last tension pulse of a hand played. `null`: nothing is being drawn. */
export type Tension = { readonly last: number | null }

export const NO_TENSION: Tension = { last: null }

/**
 * The tension while it lasts: it is called every frame with how far it is drawn (0–1) and the
 * clock in ms, and returns whether a pulse is due now. The period shortens and the intensity rises
 * with the draw, so the string **is felt growing**. Since the pulse lasts less than the shortest
 * period, it never cuts the previous one off.
 */
export function nextTension(
  state: Tension,
  hand: HandSide,
  level: number,
  now: number,
): { state: Tension; pulse: HandPulse | null } {
  const r = HAPTIC_RECIPES.tension
  if (level < r.threshold) return { state: NO_TENSION, pulse: null }
  const period = between(r.period.slack, r.period.taut, level)
  if (state.last !== null && now - state.last < period) return { state, pulse: null }
  return {
    state: { last: now },
    pulse: { hand, intensity: between(r.intensity.slack, r.intensity.taut, level), ms: r.ms, delay: 0 },
  }
}
