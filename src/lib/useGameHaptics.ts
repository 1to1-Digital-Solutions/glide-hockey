'use client'

import { useCallback, useMemo, useRef } from 'react'
import { type ThreeEvent } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { type GameSound } from './audioEngine'
import { type Handedness, handednessOf, pulseFor, pulseSession } from './haptics'

export interface GameHaptics {
  /** Da el golpe que corresponde a un suceso de la mesa, si hay mandos. */
  pulse: (sound: GameSound) => void
  /**
   * Apunta qué mano ha movido el mazo. La mesa lo llama con cada evento de
   * puntero que mueve el mazo, y es lo que decide a qué mando va el golpe.
   */
  noteAim: (event: ThreeEvent<PointerEvent>) => void
}

/**
 * Hace vibrar los mandos con lo que pasa en la mesa.
 *
 * Es imperativo, como `useGameAudio`, porque los sucesos —golpe, rebote, gol—
 * los decide el bucle de la mesa fotograma a fotograma, no un cambio de estado
 * del almacén. Sin sesión inmersiva no hay mandos y no hace nada. No mira el
 * silencio: silenciar apaga el altavoz, no la mano.
 */
export function useGameHaptics(): GameHaptics {
  const session = useXR((state) => state.session)
  const mallet = useRef<Handedness | null>(null)

  const noteAim = useCallback((event: ThreeEvent<PointerEvent>) => {
    const hand = handednessOf(event)
    if (hand != null) mallet.current = hand
  }, [])

  const pulse = useCallback(
    (sound: GameSound) => {
      if (session == null) return
      pulseSession(session, pulseFor(sound), mallet.current)
    },
    [session],
  )

  return useMemo(() => ({ pulse, noteAim }), [pulse, noteAim])
}
