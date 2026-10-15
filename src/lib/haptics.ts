/**
 * The vibration of the controllers: what is felt in the hand with what happens on the table.
 *
 * **Only the mallet striking the puck vibrates**, in the hand that holds the mallet and with the
 * strength of the collision. The slide of the puck used to vibrate every frame with overlapping
 * pulses and, not knowing which hand held the mallet, in both: with the headset on the
 * controllers buzzed for the whole rally. Now, as in the whole hall (`.claude/rules/xr.md`,
 * «Each contact is felt in the hand that touches, and nothing else»), sliding does not vibrate,
 * bouncing off the rail does not either —the puck touches it, not the hand— and the recipes are
 * the shared ones of `hapticFeedback.ts`.
 *
 * It comes from the same events as the sound (`audioEngine.ts`) but it does **not** obey the
 * mute: muting turns off the speaker, not the hand. It is pure logic and tested; the one that
 * really pulses the controllers is `useGameHaptics`, which brings the session, the mallet hand
 * and the clocks.
 */

import { impactStrength } from './audioEngine'
import { thresholdPulses } from './scoreboardSign'
import { type FrameResult } from './matchLoop'
import type { Medal } from './goal'
import { pulsesFor, type HandSide, type HandPulse } from './hapticFeedback'

export type Handedness = HandSide

/** A single tap: strength from 0 to 1 and how long it lasts. */
export interface HapticPulse {
  intensity: number
  durationMs: number
}

/** What happens on the table and can be felt in the hand. */
export type HandEvent =
  /** The player's mallet strikes the puck; `strength` (0–1) comes from the collision speed. */
  | { readonly type: 'hit'; readonly strength: number }
  /** A goal goes in, for or against. */
  | { readonly type: 'goal' }
  /** The match ends. */
  | { readonly type: 'end' }
  /** A medal threshold is crossed: the goal sign celebrates it. */
  | { readonly type: 'threshold'; readonly medal: Medal }

/**
 * How strong the goal arrives, as an `arrival` of `hapticFeedback.ts`: the softest of its kind.
 *
 * The puck goes in far away, at the other end of the table: it is announced without being
 * mistaken for a strike the hand has made. TO BE CALIBRATED WITH THE HEADSET.
 */
export const GOAL_STRENGTH = 0

/**
 * The end of the match: it is not a contact, it is the only thing that says it is over without
 * looking at the scoreboard. Long and in the mallet hand —not in both: that is left for the hit
 * the body takes—. TO BE CALIBRATED WITH THE HEADSET.
 */
export const FINAL_PULSE: HapticPulse = { intensity: 0.6, durationMs: 220 }

/**
 * What reaches the hand from one frame of the table.
 *
 * **Only the strike of the player's mallet** —the machine's is its own— and the goal. The puck
 * that slides or bounces off the rail is not touched by the hand, so it does not vibrate. The
 * strike is recognised because the player's hit count goes up (`playerHits`): `struck` says
 * that *some* mallet struck.
 *
 * @param hitsBefore The player's hits the table had before this frame.
 */
export function frameEvents(
  hitsBefore: number,
  { table, goals, impact }: Pick<FrameResult, 'table' | 'goals' | 'impact'>,
): HandEvent[] {
  const events: HandEvent[] = []
  if (table.playerHits > hitsBefore) events.push({ type: 'hit', strength: impactStrength(impact.strike) })
  if (goals.length > 0) events.push({ type: 'goal' })
  return events
}

/**
 * The pulses that go with an event of the table, in the hand that holds the mallet.
 *
 * **No hand, no pulse**: nobody touches the loose mallet, and sending it to both hands «just in
 * case» is what left the two controllers vibrating.
 */
export function eventPulses(event: HandEvent, mallet: HandSide | null): HandPulse[] {
  if (mallet == null) return []
  switch (event.type) {
    case 'hit':
      // A strength that is not a number —a lost frame— counts as a whole strike: better that
      // than passing `NaN` to the actuator.
      return pulsesFor({
        type: 'impact',
        hand: mallet,
        strength: Number.isFinite(event.strength) ? event.strength : 1,
      })
    case 'goal':
      return pulsesFor({ type: 'arrival', hand: mallet, strength: GOAL_STRENGTH })
    case 'end':
      return [{ hand: mallet, intensity: FINAL_PULSE.intensity, ms: FINAL_PULSE.durationMs, delay: 0 }]
    case 'threshold':
      return thresholdPulses(event.medal, mallet)
  }
}

/** What this module needs from an `XRInputSource`: the hand and its actuator. */
export interface HapticSource {
  handedness: XRHandedness | string
  gamepad?: { hapticActuators?: readonly { pulse?: unknown }[] } | null
}

/** What it needs from a WebXR session: where the controllers come in. */
export interface HapticSession {
  inputSources: Iterable<HapticSource>
}

interface HapticActuator {
  pulse(value: number, duration: number): Promise<boolean> | boolean | void
}

function actuatorOf(source: HapticSource): HapticActuator | undefined {
  const actuator = source.gamepad?.hapticActuators?.[0]
  return typeof actuator?.pulse === 'function' ? (actuator as HapticActuator) : undefined
}

/**
 * Gives a tap on the controller of that hand. Returns whether it vibrated: a controller with no
 * actuator, or one that rejects the pulse, is not an error, it is a different controller.
 */
export function pulseHand(
  session: HapticSession | null | undefined,
  hand: HandSide,
  intensity: number,
  ms: number,
): boolean {
  if (session == null) return false
  let pulsed = false
  for (const source of session.inputSources) {
    if (source.handedness !== hand) continue
    const actuator = actuatorOf(source)
    if (actuator == null) continue
    try {
      const played: unknown = actuator.pulse(intensity, ms)
      if (typeof (played as Promise<unknown> | undefined)?.catch === 'function') {
        void (played as Promise<unknown>).catch(() => {})
      }
      pulsed = true
    } catch {
      // An actuator that fails cannot stop the match.
    }
  }
  return pulsed
}

/**
 * Plays a list of pulses: those with `delay` 0 right away and the rest with `schedule`, which is
 * the one that keeps the clock (and the one that cancels them on unmount). Each pulse looks at
 * the session at its own moment.
 */
export function playPulses(
  session: HapticSession | null | undefined,
  pulses: readonly HandPulse[],
  schedule: (fire: () => void, ms: number) => void,
): void {
  for (const { hand, intensity, ms, delay } of pulses) {
    const fire = () => {
      pulseHand(session, hand, intensity, ms)
    }
    if (delay > 0) schedule(fire, delay)
    else fire()
  }
}

/**
 * Strength and duration of the tap that confirms a headset button.
 *
 * Short and weak: it is not a strike of the game, it is the «I heard you» of a button. The
 * same numbers in the thirteen, so that changing cabinet does not change what pressing feels like.
 */
export const PRESS_PULSE: HapticPulse = { intensity: 0.25, durationMs: 18 }

/** Which controller the event comes from, if it comes from one. */
function inputSourceOf(event: unknown): HapticSource | undefined {
  return (event as { nativeEvent?: { inputSource?: HapticSource } } | null)?.nativeEvent
    ?.inputSource
}

/**
 * Vibrates **the controller that pressed**, if it can.
 *
 * Apart from `pulseSession`, which deals out by hands: a button is pressed by one specific hand
 * and answering the other would be answering someone who has done nothing. With the mouse there
 * is no controller and nothing happens, which is the desktop case.
 */
export function pulsePressed(event: unknown, pulse: HapticPulse = PRESS_PULSE): boolean {
  const source = inputSourceOf(event)
  const actuator = source == null ? undefined : actuatorOf(source)
  if (actuator == null || pulse.intensity <= 0) return false
  try {
    const played: unknown = actuator.pulse(pulse.intensity, pulse.durationMs)
    if (typeof (played as Promise<unknown> | undefined)?.catch === 'function') {
      void (played as Promise<unknown>).catch(() => {})
    }
    return true
  } catch {
    // An actuator that fails cannot stop the match.
    return false
  }
}
