'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  type AirHockeyAudio,
  type GameSound,
  createAirHockeyAudio,
} from './audioEngine'
import { useGame } from './gameStore'

/**
 * El audio de la partida, visto desde la escena: una función a la que se le
 * pide un sonido y punto.
 *
 * Cuelga de la mesa (`components/game/Rink.tsx`) y no de la web que la
 * envuelve: el salón de xrcade monta la escena y nada más, así que un sonido
 * enganchado a la interfaz de escritorio dejaría el juego mudo justo donde se
 * juega con el visor. Y colgando de un solo sitio hay **un único contexto de
 * audio**, que es el recurso que de verdad hay que vigilar: los navegadores
 * cortan a la decena y la mesa se remonta en cada ronda del reto.
 *
 * Aquí no se decide qué suena —eso lo cuenta la mesa, fotograma a fotograma—,
 * solo si hay con qué sonar: silenciado devuelve una función que no hace nada,
 * así que quien la llama no tiene que preguntar.
 */
export type PlayGameSound = (sound: GameSound) => void

export function useGameAudio(): PlayGameSound {
  const { muted } = useGame()
  const audio = useRef<AirHockeyAudio | null>(null)

  // Silenciar suelta el audio del dispositivo, no solo baja el volumen: un
  // contexto abierto sigue contando como que la página está sonando, y en el
  // visor eso es lo que agacha la música que el jugador tenga puesta.
  useEffect(() => {
    if (!muted) return
    audio.current?.close()
    audio.current = null
  }, [muted])

  // Quitar la mesa se lleva su audio: dentro del salón la escena se monta y se
  // desmonta a cada visita, y los contextos se irían acumulando.
  useEffect(
    () => () => {
      audio.current?.close()
      audio.current = null
    },
    [],
  )

  return useCallback(
    (sound: GameSound) => {
      if (muted) return
      // El contexto se crea con el primer sonido, que siempre llega con la
      // partida ya empezada: creado antes de que nadie toque nada, el navegador
      // lo dejaría en suspenso (ver `audioEngine.ts`).
      const engine = (audio.current ??= createAirHockeyAudio())
      engine.play(sound)
    },
    [muted],
  )
}
