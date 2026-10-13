'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { eventPulses, playPulses, type Handedness, type HandEvent } from './haptics'
import type { HandPulse } from './hapticFeedback'

export interface GameHaptics {
  /** Lo que se siente de un suceso de la mesa, en la mano que lleva el mazo (si la lleva). */
  feel: (suceso: HandEvent) => void
  /**
   * Qué mano lleva el mazo, o `null` si no lo lleva ninguna. Lo dice `MalletHand` cada
   * fotograma que el mazo va cogido, y al soltarlo.
   */
  noteHand: (mano: Handedness | null) => void
  /**
   * Un pulso ya hecho, en la mano que diga. Es por donde vibra el golpe recibido
   * (`components/xr/GolpeRecibido.tsx`), que trae los suyos de la receta común
   * y en las dos manos: el cuerpo recibe el golpe, no la mano del mazo.
   */
  pulse: (pulso: HandPulse) => void
}

/**
 * Hace vibrar los mandos con lo que pasa en la mesa.
 *
 * Es imperativo, como `useGameAudio`, porque los sucesos los decide el bucle de la mesa
 * fotograma a fotograma. Sin sesión inmersiva no hay mandos y no hace nada. No mira el silencio:
 * silenciar apaga el altavoz, no la mano.
 *
 * **Nada vibra por deslizar.** Aquí no hay roce: era un tren de pulsos solapados cada
 * fotograma, y como `pulse()` no encola, lo que llegaba a la mano era un zumbido sin fin.
 */
export function useGameHaptics(): GameHaptics {
  const session = useXR((state) => state.session)
  const mazo = useRef<Handedness | null>(null)
  /** Las colas de los golpes que esperan su turno, para cancelarlas al desmontar. */
  const pendientes = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const cola = pendientes.current
    return () => {
      for (const id of cola) clearTimeout(id)
      cola.clear()
    }
  }, [])

  const noteHand = useCallback((mano: Handedness | null) => {
    mazo.current = mano
  }, [])

  const tocar = useCallback(
    (pulsos: HandPulse[]) => {
      if (session == null) return
      playPulses(session, pulsos, (hacer, ms) => {
        const id = setTimeout(() => {
          pendientes.current.delete(id)
          hacer()
        }, ms)
        pendientes.current.add(id)
      })
    },
    [session],
  )

  const feel = useCallback(
    (suceso: HandEvent) => tocar(eventPulses(suceso, mazo.current)),
    [tocar],
  )

  const pulse = useCallback((pulso: HandPulse) => tocar([pulso]), [tocar])

  return useMemo(() => ({ feel, noteHand, pulse }), [feel, noteHand, pulse])
}
