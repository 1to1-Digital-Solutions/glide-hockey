'use client'

import { useEffect, useRef } from 'react'
import { MUSIC_FADE_MS, fadeVolume } from './musicFade'
import { useGame } from './gameStore'
import { MUSIC_VOLUME, musicUrl } from './music'

/**
 * The background music, playing in a loop while the game is mounted.
 *
 * It hangs from the scene and not from the website that wraps it, like the rest
 * of the audio (`useGameAudio.ts`): xrcade's hall mounts the scene and nothing
 * else, and a music hooked to the desktop UI would leave the game mute right
 * where it is played with the headset.
 *
 * **It does not start by itself.** No browser lets anything play before
 * whoever is playing touches something, and neither does the headset: the
 * attempt is rejected silently. So it is tried on mount —in case one comes
 * from another screen and there was already a gesture— and, if that does not
 * work, it waits for the first one that arrives.
 *
 * Silence rules: muting the game stops the music too, and the music only
 * turns itself off.
 *
 * **How loud it plays is said by the arcade's settings.** The ambience volume
 * is chosen once in xrcade and holds for the hall and for the twelve games; at
 * zero the file is not even downloaded. The volume here is that of this
 * particular track: the settings say how much of that one wants to hear, they
 * do not raise it above what a background is.
 */
/**
 * Takes the volume of `audio` to `to` in `MUSIC_FADE_MS`, and does `onEnded` on arriving.
 *
 * Returns how it is cut: the next ramp starts where this one stopped, which is what
 * avoids the jump if the music is turned on and off in a hurry.
 */
function ramp(audio: HTMLAudioElement, to: number, onEnded?: () => void): () => void {
  const from = audio.volume
  const startedAt = performance.now()
  let id = 0

  const step = () => {
    const t = (performance.now() - startedAt) / MUSIC_FADE_MS
    audio.volume = fadeVolume(from, to, t)
    if (t < 1) id = requestAnimationFrame(step)
    else onEnded?.()
  }
  step()

  return () => cancelAnimationFrame(id)
}

export function useGameMusic(): void {
  const { music, ambienceVolume } = useGame()
  const player = useRef<HTMLAudioElement | null>(null)

  const wanted = music

  useEffect(() => {
    // The element is created when music is first asked for, not on mount: whoever
    // enters with the music off does not download a megabyte for nothing.
    if (!wanted) {
      const leaving = player.current
      if (leaving == null) return
      // It is lowered and **then** stopped: a hard `pause()` is a click with the
      // headset's earphones on.
      return ramp(leaving, 0, () => leaving.pause())
    }

    const fresh = player.current == null
    const audio = player.current ?? new Audio(musicUrl())
    player.current = audio
    audio.loop = true
    // An audio element is born at full volume: freshly created it is set to zero before
    // rising, otherwise the music comes in abruptly and that is exactly what is being removed.
    // Coming back from a half-finished turn-off it rises from where it stopped.
    if (fresh) audio.volume = 0
    const cut = ramp(audio, MUSIC_VOLUME * ambienceVolume)

    /** Tries to play. The browser may say no, and it is not an error. */
    const start = () => {
      void audio.play().catch(() => {})
    }
    start()

    // And if it said no, at the first gesture there is. It listens on the window
    // because the gesture may land on the Canvas, on a menu button or on the
    // headset's controller, and here there is no knowing which arrives first.
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    for (const event of events) window.addEventListener(event, start, { once: true })

    return () => {
      cut()
      for (const event of events) window.removeEventListener(event, start)
    }
  }, [wanted, ambienceVolume])

  // Removing the scene takes the music with it: inside the hall it is mounted and
  // unmounted on every visit, and otherwise it would keep playing over the next game.
  useEffect(
    () => () => {
      const leaving = player.current
      player.current = null
      // On leaving the cabinet the music is lowered gradually, not cut: the hall brings its
      // own back right behind and two cuts in a row sound like an error.
      if (leaving != null) ramp(leaving, 0, () => leaving.pause())
    },
    [],
  )
}
