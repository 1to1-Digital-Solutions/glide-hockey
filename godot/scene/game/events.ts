/**
 * From what happens on the table to what is heard and felt, in Godot.
 *
 * **The rules are the web's**, but two of its files do not go into the engine: `haptics.ts`
 * imports `impactStrength` from `audioEngine.ts`, and that one opens a browser `AudioContext`, so
 * the whole graph stays out (`build.mjs --list-tests`). The little that is used of them is copied
 * here with its name on the web beside it; if `impactStrength` and the hand's events moved to a
 * file with no browser, this would be deleted and the scene would import the web's.
 *
 * - **What is heard**: the mallet's strike (whoever deals it) and the bounce off the rail, each
 *   with the strength of the collision, and the goal. The effects are rendered from
 *   `audioEngine.ts` at three strengths (`godot-kit.json`): the closest to the collision's is
 *   chosen, like the volume and the pitch the web computes at every strike.
 * - **The puck's slide** (`puckSlide`): a loop rendered from the web's continuous voice at top
 *   speed, whose volume and pitch are lowered with the speed of the moment, with the same sums as
 *   the web (`slideSound.ts`).
 * - **What is felt** (`frameEvents` and `eventPulses`): only the hit of the **player's** mallet on
 *   the puck, in the hand that carries it and with the strength of the collision; the goal, soft;
 *   and the end of the match, long. The slide and the bounce are not touched by the hand, so they
 *   do not vibrate.
 */
import { thresholdPulses } from '@/lib/scoreboardSign'
import { MAX_PUCK_SPEED } from '@/lib/gameConfig'
import type { FrameResult } from '@/lib/matchLoop'
import type { Medal } from '@/lib/goal'
import { slideLevel, slidePitch } from '@/lib/slideSound'
import { pulsesFor, type HandSide, type HandPulse } from '@/lib/hapticFeedback'

/** At what speed the slide loop was rendered (`loops.slide` of `godot-kit.json`): the top one. */
export const LOOP_SPEED = MAX_PUCK_SPEED

/**
 * How the slide sounds at this speed (m/s), relative to the rendered loop: the volume, in the
 * proportion of the web's (`slideLevel`), and the pitch, in that of its filter (`slidePitch`). The
 * loop is noise passed through that band-pass filter; played back slower, the band drops in the
 * same proportion and with the same shape, which is what the web does when it moves the filter.
 * That is why it is rendered at top speed: from there everything is going down, and the volume
 * never goes above the one that was tuned.
 */
export function puckSlide(speed: number): { volume: number; pitch: number } {
  return {
    volume: slideLevel(speed) / slideLevel(LOOP_SPEED),
    pitch: slidePitch(speed) / slidePitch(LOOP_SPEED),
  }
}

/** How strong an impact is, from 0 to 1, by its speed in m/s (`impactStrength`). */
export function impactStrength(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 0
  return Math.min(1, speed / MAX_PUCK_SPEED)
}

/** The three strengths the strike and the bounce were rendered at (`godot-kit.json`). */
export const STRENGTHS = { suave: 0.2, medio: 0.5, fuerte: 0.9 } as const

/** The rendered effect closest to a strength from 0 to 1. */
export function collisionSound(sound: 'strike' | 'bounce', strength: number): string {
  let best: keyof typeof STRENGTHS = 'suave'
  for (const name of Object.keys(STRENGTHS) as (keyof typeof STRENGTHS)[]) {
    if (Math.abs(STRENGTHS[name] - strength) < Math.abs(STRENGTHS[best] - strength)) best = name
  }
  return `${sound}-${best}`
}

/** How strongly the goal reaches the hand: the softest of the arrivals (`GOAL_STRENGTH`). */
export const GOAL_STRENGTH = 0

/** The end of the match in the mallet's hand (`FINAL_PULSE`). */
export const END_PULSE = { intensity: 0.6, ms: 220 } as const

/** What is felt of an event on the table (`HandEvent`). */
export type HandEvent =
  | { readonly type: 'hit'; readonly strength: number }
  | { readonly type: 'goal' }
  | { readonly type: 'end' }
  /** A medal threshold is crossed: the goal sign celebrates it. */
  | { readonly type: 'threshold'; readonly medal: Medal }

/** What of one frame of the table reaches the hand (`frameEvents`). */
export function frameEvents(hitsBefore: number, { table, goals, impact }: Pick<FrameResult, 'table' | 'goals' | 'impact'>): HandEvent[] {
  const events: HandEvent[] = []
  if (table.playerHits > hitsBefore) events.push({ type: 'hit', strength: impactStrength(impact.strike) })
  if (goals.length > 0) events.push({ type: 'goal' })
  return events
}

/** The pulses of an event in the hand that carries the mallet; with no hand, none (`eventPulses`). */
export function eventPulses(event: HandEvent, mallet: HandSide | null): HandPulse[] {
  if (mallet == null) return []
  switch (event.type) {
    case 'hit':
      return pulsesFor({ type: 'impact', hand: mallet, strength: Number.isFinite(event.strength) ? event.strength : 1 })
    case 'goal':
      return pulsesFor({ type: 'arrival', hand: mallet, strength: GOAL_STRENGTH })
    case 'end':
      return [{ hand: mallet, intensity: END_PULSE.intensity, ms: END_PULSE.ms, delay: 0 }]
    case 'threshold':
      return thresholdPulses(event.medal, mallet)
  }
}
