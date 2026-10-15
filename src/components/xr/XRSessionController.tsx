'use client'

import { useEffect, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { useGame } from '../../lib/gameStore'

/**
 * Bridge between the state of the WebXR session and the state of the game.
 *
 * On entering VR/AR the player is taken **to the menu**, not to a match: in the
 * headset `XRMenu` is in charge, which is where they choose mode, level and
 * goals. And on leaving, it goes back to the desktop menu, because a half-played
 * match that keeps running with nobody watching it can only end in a thrashing.
 *
 * It must be mounted inside `<XR>` to be able to read the state of the session.
 */
export function XRSessionController() {
  const mode = useXR((state) => state.mode)
  const { gameState, resetGame, setImmersive } = useGame()

  // Remembering that there was a session is essential: on desktop `mode` is
  // always null, and without this guard any match started with the mouse would
  // cancel itself as soon as it began.
  //
  // It starts from whatever there is on mount: mounted already inside a session —which is what
  // the hall does— there is no desktop match to discard, and the one there is belongs to the
  // hall's challenge, which starts already playing (see `HallOptions`).
  const immersive = useRef(mode != null)

  useEffect(() => {
    setImmersive(mode != null)

    // Entry: if it arrives with a half-played desktop match, it is discarded.
    if (mode != null) {
      if (immersive.current) return
      immersive.current = true
      if (gameState !== 'menu') resetGame()
      return
    }

    // Exit: back to the desktop menu.
    if (!immersive.current) return
    immersive.current = false
    resetGame()
  }, [mode, gameState, resetGame, setImmersive])

  return null
}
