'use client'

import { useEffect, useState } from 'react'

/**
 * Whether this device can play with the headset, and in what way.
 *
 * The browser is asked instead of using the `@react-three/xr` hook because that
 * one has no answer for the server: when prerendering the page it blows up the
 * whole build with a «Missing getServerSnapshot». And the question has to be
 * asked in the desktop menu, which is real HTML and is prerendered.
 *
 * `null` while it is not known. It is a third value on purpose: showing the
 * enter-VR button and removing it half a second later —or the other way round—
 * is worse than waiting to have the answer, because the button moves right when
 * someone was about to press it.
 */
export interface ImmersiveSupport {
  /** Mixed reality: the table over the player's room. */
  ar: boolean
  /** Virtual reality: the game's room and nothing else. */
  vr: boolean
}

export function useImmersiveSupport(): ImmersiveSupport | null {
  const [support, setSupport] = useState<ImmersiveSupport | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const xr = typeof navigator === 'undefined' ? undefined : navigator.xr
      // A browser without WebXR is not a failure: it is half of those who are
      // going to open this, and there is simply no headset button there.
      const [ar, vr] =
        xr == null
          ? [false, false]
          : await Promise.all([
              // `isSessionSupported` rejects in non-secure contexts and in
              // some browsers with a half-done API. The question failing
              // means that it cannot be done, not that the game does not start.
              xr.isSessionSupported('immersive-ar').catch(() => false),
              xr.isSessionSupported('immersive-vr').catch(() => false),
            ])

      if (!cancelled) setSupport({ ar, vr })
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return support
}
