'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  type GlideHockeyAudio,
  type GameSound,
  createGlideHockeyAudio,
} from './audioEngine'
import { useGame } from './gameStore'

/**
 * The audio of the match, seen from the scene: a function that is asked for a
 * sound and that is it.
 *
 * It hangs from the scene (`components/game/GameWorld.tsx`) and not from the
 * website that wraps it: the xrcade hall mounts the scene and nothing else, so
 * a sound hooked to the desktop interface would leave the game mute right
 * where it is played with the headset.
 *
 * It does not hang from the table either, which is the one that asks for the
 * sounds: **the table is brand new in each match and in each round of the
 * challenge** (`key={runId}`). Hanging from it, winning a round closed the
 * context in the same frame in which the goal that won it sounded —the goal
 * was cut off— and opened a new one per round, when browsers cut off at
 * around ten. Hanging from the scene there is **a single context** while the
 * game is mounted, which is exactly how long it lasts.
 *
 * What sounds is not decided here —the table tells that, frame by frame—,
 * only whether there is something to sound with: muted it returns a function
 * that does nothing, so whoever calls it does not have to ask.
 */
export type PlayGameSound = (sound: GameSound, strength?: number) => void
/** The slide of the puck, every frame, with its speed in m/s (0 silences it). */
export type SlidePuck = (speed: number) => void

/** The cutoff of the bus low-pass, in hertz: the muffled ear of a hit taken. */
export type FilterBus = (hz: number) => void

export function useGameAudio(): { play: PlayGameSound; slide: SlidePuck; filter: FilterBus } {
  const { muted, sfxVolume } = useGame()
  const audio = useRef<GlideHockeyAudio | null>(null)

  // Muting releases the device's audio, it does not just lower the volume: an
  // open context still counts as the page playing sound, and on the headset
  // that is what ducks the music the player has on.
  // The effects volume of the hall's settings, applied to the engine as soon
  // as it changes. There is no need to create it again: `setVolume` touches
  // the master node, and with the audio not open yet it is applied when it opens.
  useEffect(() => {
    audio.current?.setVolume(sfxVolume)
  }, [sfxVolume])

  useEffect(() => {
    if (!muted) return
    audio.current?.close()
    audio.current = null
  }, [muted, sfxVolume])

  // Removing the scene takes its audio with it: inside the hall it is mounted
  // and unmounted on every visit, and the contexts would pile up.
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
      // The context is created with the first sound, which always arrives with
      // the match already started: created before anybody touches anything,
      // the browser would leave it suspended (see `audioEngine.ts`).
      const engine = (audio.current ??= createGlideHockeyAudio())
    // The engine is born at full volume and here it is told the one of the
    // settings: created inside this effect, the one that follows the volume
    // has not seen it yet.
    engine.setVolume(sfxVolume)
      engine.play(sound, strength)
    },
    [muted, sfxVolume],
  )

  // The slide hangs from the same player: muted there is no player and it
  // does nothing; without a previous strike neither (it does not open the context).
  const slide = useCallback(
    (speed: number) => {
      if (muted) return
      audio.current?.slide(speed)
    },
    [muted],
  )

  // The filter of the hit feedback goes to the same bus, muted or not: without
  // open audio there is nothing to muffle, and the engine opened later is born open.
  const filter = useCallback((hz: number) => {
    audio.current?.setLowpass(hz)
  }, [])

  return useMemo(() => ({ play, slide, filter }), [play, slide, filter])
}
