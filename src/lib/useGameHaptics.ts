'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { pulsosDelSuceso, reproducir, type Handedness, type SucesoEnLaMano } from './haptics'

export interface GameHaptics {
  /** Lo que se siente de un suceso de la mesa, en la mano que lleva el mazo (si la lleva). */
  sentir: (suceso: SucesoEnLaMano) => void
  /**
   * Qué mano lleva el mazo, o `null` si no lo lleva ninguna. Lo dice `MalletHand` cada
   * fotograma que el mazo va cogido, y al soltarlo.
   */
  noteHand: (mano: Handedness | null) => void
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

  const sentir = useCallback(
    (suceso: SucesoEnLaMano) => {
      if (session == null) return
      reproducir(session, pulsosDelSuceso(suceso, mazo.current), (hacer, ms) => {
        const id = setTimeout(() => {
          pendientes.current.delete(id)
          hacer()
        }, ms)
        pendientes.current.add(id)
      })
    },
    [session],
  )

  return useMemo(() => ({ sentir, noteHand }), [sentir, noteHand])
}
