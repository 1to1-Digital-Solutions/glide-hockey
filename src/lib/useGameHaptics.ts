'use client'

import { useCallback, useMemo, useRef } from 'react'
import { type ThreeEvent } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { type GameSound } from './audioEngine'
import { type Handedness, type HapticPulse, handednessOf, pulseFor, pulseSession } from './haptics'

export interface GameHaptics {
  /**
   * Da el golpe que corresponde a un suceso de la mesa, si hay mandos.
   * `strength` (0 a 1) es la fuerza del impacto: un roce vibra menos que un
   * golpe seco. El gol no la mira.
   */
  pulse: (sound: GameSound, strength?: number) => void
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
/** Cuánto de la amplitud se conserva con el impacto más flojo: se nota, pero poco. */
const MIN_PULSE = 0.35

/** La misma receta con la fuerza del impacto; la duración no cambia. */
export function scaledPulse(pulse: HapticPulse, strength: number): HapticPulse {
  const s = Math.min(1, Math.max(0, Number.isFinite(strength) ? strength : 1))
  return { ...pulse, intensity: pulse.intensity * (MIN_PULSE + (1 - MIN_PULSE) * s) }
}

export function useGameHaptics(): GameHaptics {
  const session = useXR((state) => state.session)
  const mallet = useRef<Handedness | null>(null)

  const noteAim = useCallback((event: ThreeEvent<PointerEvent>) => {
    const hand = handednessOf(event)
    if (hand != null) mallet.current = hand
  }, [])

  const pulse = useCallback(
    (sound: GameSound, strength = 1) => {
      if (session == null) return
      const pulse = scaledPulse(pulseFor(sound), sound === 'goal' ? 1 : strength)
      pulseSession(session, pulse, mallet.current)
    },
    [session],
  )

  return useMemo(() => ({ pulse, noteAim }), [pulse, noteAim])
}
