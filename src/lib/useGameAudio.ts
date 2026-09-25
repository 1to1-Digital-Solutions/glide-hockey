'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  type GlideHockeyAudio,
  type GameSound,
  createGlideHockeyAudio,
} from './audioEngine'
import { useGame } from './gameStore'

/**
 * El audio de la partida, visto desde la escena: una función a la que se le
 * pide un sonido y punto.
 *
 * Cuelga de la escena (`components/game/GameWorld.tsx`) y no de la web que la
 * envuelve: el salón de xrcade monta la escena y nada más, así que un sonido
 * enganchado a la interfaz de escritorio dejaría el juego mudo justo donde se
 * juega con el visor.
 *
 * Tampoco cuelga de la mesa, que es quien pide los sonidos: **la mesa se
 * estrena en cada partida y en cada ronda del reto** (`key={runId}`). Colgado
 * de ella, ganar una ronda cerraba el contexto en el mismo fotograma en que
 * sonaba el gol que la ganaba —el gol se cortaba— y abría uno nuevo por ronda,
 * cuando los navegadores cortan a la decena. Colgado de la escena hay **un
 * único contexto** mientras el juego esté montado, que es justo lo que dura.
 *
 * Aquí no se decide qué suena —eso lo cuenta la mesa, fotograma a fotograma—,
 * solo si hay con qué sonar: silenciado devuelve una función que no hace nada,
 * así que quien la llama no tiene que preguntar.
 */
export type PlayGameSound = (sound: GameSound, strength?: number) => void
/** El roce del disco, cada fotograma, con su velocidad en m/s (0 lo apaga). */
export type SlidePuck = (speed: number) => void

/** El corte del paso bajo del bus, en hercios: el oído tapado de un golpe recibido. */
export type FiltrarBus = (hz: number) => void

export function useGameAudio(): { play: PlayGameSound; slide: SlidePuck; filtrar: FiltrarBus } {
  const { muted, sfxVolume } = useGame()
  const audio = useRef<GlideHockeyAudio | null>(null)

  // Silenciar suelta el audio del dispositivo, no solo baja el volumen: un
  // contexto abierto sigue contando como que la página está sonando, y en el
  // visor eso es lo que agacha la música que el jugador tenga puesta.
  // El volumen de efectos de los ajustes del arcade, aplicado al motor en
  // cuanto cambia. No hace falta volver a crearlo: `setVolume` toca el nodo
  // maestro, y con el audio aún sin abrir se aplica al abrirlo.
  useEffect(() => {
    audio.current?.setVolume(sfxVolume)
  }, [sfxVolume])

  useEffect(() => {
    if (!muted) return
    audio.current?.close()
    audio.current = null
  }, [muted, sfxVolume])

  // Quitar la escena se lleva su audio: dentro del salón se monta y se desmonta
  // a cada visita, y los contextos se irían acumulando.
  useEffect(
    () => () => {
      audio.current?.close()
      audio.current = null
    },
    [],
  )

  const play = useCallback(
    (sound: GameSound, strength?: number) => {
      if (muted) return
      // El contexto se crea con el primer sonido, que siempre llega con la
      // partida ya empezada: creado antes de que nadie toque nada, el navegador
      // lo dejaría en suspenso (ver `audioEngine.ts`).
      const engine = (audio.current ??= createGlideHockeyAudio())
    // El motor nace a volumen completo y aquí se le dice el de los
    // ajustes: creado dentro de este efecto, el que sigue al volumen todavía
    // no lo ha visto.
    engine.setVolume(sfxVolume)
      engine.play(sound, strength)
    },
    [muted, sfxVolume],
  )

  // El roce va colgado del mismo reproductor: silenciado no hay reproductor y
  // no hace nada; sin golpe previo tampoco (no abre el contexto).
  const slide = useCallback(
    (speed: number) => {
      if (muted) return
      audio.current?.slide(speed)
    },
    [muted],
  )

  // El filtro del golpe recibido va al mismo bus, silenciado o no: sin audio
  // abierto no hay nada que tapar, y el motor que se abra después nace abierto.
  const filtrar = useCallback((hz: number) => {
    audio.current?.setLowpass(hz)
  }, [])

  return useMemo(() => ({ play, slide, filtrar }), [play, slide, filtrar])
}
