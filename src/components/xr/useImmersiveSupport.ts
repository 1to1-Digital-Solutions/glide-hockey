'use client'

import { useEffect, useState } from 'react'

/**
 * Si este dispositivo puede jugar con el visor, y de qué manera.
 *
 * Se pregunta al navegador en vez de usar el hook de `@react-three/xr` porque
 * aquel no tiene respuesta para el servidor: al prerenderizar la página revienta
 * el build entero con un «Missing getServerSnapshot». Y la pregunta hay que
 * hacerla en el menú de escritorio, que es HTML de verdad y se prerenderiza.
 *
 * `null` mientras no se sabe. Es un tercer valor a propósito: enseñar el botón
 * de entrar en VR y quitarlo medio segundo después —o al revés— es peor que
 * esperar a tener la respuesta, porque el botón se mueve justo cuando alguien
 * iba a pulsarlo.
 */
export interface ImmersiveSupport {
  /** Realidad mixta: la mesa sobre la habitación del jugador. */
  ar: boolean
  /** Realidad virtual: la sala del juego y nada más. */
  vr: boolean
}

export function useImmersiveSupport(): ImmersiveSupport | null {
  const [support, setSupport] = useState<ImmersiveSupport | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const xr = typeof navigator === 'undefined' ? undefined : navigator.xr
      // Un navegador sin WebXR no es un fallo: es la mitad de los que van a
      // abrir esto, y ahí simplemente no hay botón de visor.
      const [ar, vr] =
        xr == null
          ? [false, false]
          : await Promise.all([
              // `isSessionSupported` rechaza en contextos no seguros y en
              // algunos navegadores con la API a medias. Que falle la pregunta
              // significa que no se puede, no que el juego no arranque.
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
