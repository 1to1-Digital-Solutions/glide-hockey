'use client'

import { useEffect, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { useGame } from '../../lib/gameStore'

/**
 * Puente entre el estado de la sesión WebXR y el estado del juego.
 *
 * Al entrar en VR/AR se lleva al jugador **al menú**, no a una partida: en el
 * visor manda `XRMenu`, que es donde elige modo, nivel y goles. Y al salir se
 * vuelve al menú de escritorio, porque una partida a medias que sigue corriendo
 * sin nadie mirándola solo puede acabar en una goleada en contra.
 *
 * Debe montarse dentro de `<XR>` para poder leer el estado de la sesión.
 */
export function XRSessionController() {
  const mode = useXR((state) => state.mode)
  const { gameState, resetGame, setImmersive } = useGame()

  // Recordar que hubo sesión es imprescindible: en escritorio `mode` es null
  // siempre, y sin esta guarda cualquier partida iniciada con el ratón se
  // cancelaría sola nada más empezar.
  const immersive = useRef(false)

  useEffect(() => {
    setImmersive(mode != null)

    // Entrada: si se llega con una partida de escritorio a medias, se descarta.
    if (mode != null) {
      if (immersive.current) return
      immersive.current = true
      if (gameState !== 'menu') resetGame()
      return
    }

    // Salida: se vuelve al menú de escritorio.
    if (!immersive.current) return
    immersive.current = false
    resetGame()
  }, [mode, gameState, resetGame, setImmersive])

  return null
}
