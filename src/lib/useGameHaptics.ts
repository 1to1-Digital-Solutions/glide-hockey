'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { eventPulses, playPulses, type Handedness, type HandEvent } from './haptics'
import type { HandPulse } from './hapticFeedback'

export interface GameHaptics {
  /** What is felt of an event of the table, in the hand that holds the mallet (if one does). */
  feel: (event: HandEvent) => void
  /**
   * Which hand holds the mallet, or `null` if none does. `MalletHand` says it every
   * frame the mallet is held, and on release.
   */
  noteHand: (hand: Handedness | null) => void
  /**
   * A ready-made pulse, in the hand it says. It is where the hit feedback vibrates
   * (`components/xr/HitFeedback.tsx`), which brings its own from the shared recipe
   * and in both hands: the body takes the hit, not the mallet hand.
   */
  pulse: (handPulse: HandPulse) => void
}

/**
 * Makes the controllers vibrate with what happens on the table.
 *
 * It is imperative, like `useGameAudio`, because the events are decided by the table loop
 * frame by frame. Without an immersive session there are no controllers and it does nothing. It
 * ignores the mute: muting turns off the speaker, not the hand.
 *
 * **Nothing vibrates for sliding.** There is no slide here: it was a train of overlapping
 * pulses every frame, and since `pulse()` does not queue, what reached the hand was an endless
 * buzz.
 */
export function useGameHaptics(): GameHaptics {
  const session = useXR((state) => state.session)
  const mallet = useRef<Handedness | null>(null)
  /** The tails of the strikes waiting for their turn, to cancel them on unmount. */
  const pending = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const tails = pending.current
    return () => {
      for (const id of tails) clearTimeout(id)
      tails.clear()
    }
  }, [])

  const noteHand = useCallback((hand: Handedness | null) => {
    mallet.current = hand
  }, [])

  const play = useCallback(
    (pulses: HandPulse[]) => {
      if (session == null) return
      playPulses(session, pulses, (fire, ms) => {
        const id = setTimeout(() => {
          pending.current.delete(id)
          fire()
        }, ms)
        pending.current.add(id)
      })
    },
    [session],
  )

  const feel = useCallback(
    (event: HandEvent) => play(eventPulses(event, mallet.current)),
    [play],
  )

  const pulse = useCallback((handPulse: HandPulse) => play([handPulse]), [play])

  return useMemo(() => ({ feel, noteHand, pulse }), [feel, noteHand, pulse])
}
