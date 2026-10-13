'use client'

import { useEffect, useRef } from 'react'
import { MUSIC_FADE_MS, fadeVolume } from './musicFade'
import { useGame } from './gameStore'
import { MUSIC_VOLUME, musicUrl } from './music'

/**
 * La música de fondo, sonando en bucle mientras el juego esté montado.
 *
 * Cuelga de la escena y no de la web que la envuelve, como el resto del audio
 * (`useGameAudio.ts`): el salón de xrcade monta la escena y nada más, y una
 * música enganchada a la interfaz de escritorio dejaría el juego mudo justo
 * donde se juega con el visor.
 *
 * **No empieza sola.** Ningún navegador deja sonar nada antes de que quien
 * juega toque algo, y en el visor tampoco: el intento se rechaza en silencio.
 * Así que se prueba al montar —por si se viene de otra pantalla y ya hubo un
 * gesto— y, si no cuela, se espera al primero que llegue.
 *
 * El silencio manda: callar el juego para la música también, y la música solo
 * se apaga a sí misma.
 *
 * **Cuánto suena lo dicen los ajustes del arcade.** El volumen de ambiente se
 * elige una vez en xrcade y vale para el salón y para los doce juegos; a cero
 * ni se descarga el fichero. El volumen de aquí es el de este tema en concreto:
 * los ajustes dicen cuánto de eso se quiere oír, no lo suben por encima de lo
 * que es un fondo.
 */
/**
 * Lleva el volumen de `audio` hasta `hasta` en `MUSIC_FADE_MS`, y hace `alAcabar` al llegar.
 *
 * Devuelve cómo se corta: la rampa siguiente empieza donde esta se quedó, que es lo que
 * evita el salto si se enciende y se apaga la música a toda prisa.
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
    // El elemento se crea al pedir música por primera vez, no al montar: quien
    // entra con la música apagada no descarga un megabyte para nada.
    if (!wanted) {
      const leaving = player.current
      if (leaving == null) return
      // Se baja y **entonces** se para: `pause()` en seco es un chasquido con los
      // auriculares del visor puestos.
      return ramp(leaving, 0, () => leaving.pause())
    }

    const fresh = player.current == null
    const audio = player.current ?? new Audio(musicUrl())
    player.current = audio
    audio.loop = true
    // Un elemento de audio nace a todo volumen: recién creado se pone a cero antes de
    // subir, que si no la música entra de golpe y es justo lo que se está quitando. Volviendo
    // de un apagado a medias se sube desde donde se quedó.
    if (fresh) audio.volume = 0
    const cut = ramp(audio, MUSIC_VOLUME * ambienceVolume)

    /** Intenta sonar. El navegador puede decir que no, y no es un error. */
    const start = () => {
      void audio.play().catch(() => {})
    }
    start()

    // Y si dijo que no, al primer gesto que haya. Se escucha en la ventana
    // porque el gesto puede caer en el Canvas, en un botón del menú o en el
    // mando del visor, y aquí no se sabe cuál llega antes.
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    for (const event of events) window.addEventListener(event, start, { once: true })

    return () => {
      cut()
      for (const event of events) window.removeEventListener(event, start)
    }
  }, [wanted, ambienceVolume])

  // Quitar la escena se lleva la música: dentro del salón se monta y se
  // desmonta a cada visita, y si no, seguiría sonando sobre el juego siguiente.
  useEffect(
    () => () => {
      const leaving = player.current
      player.current = null
      // Al salir de la cabina la música se va bajando, no se corta: el salón devuelve la
      // suya justo detrás y dos cortes seguidos se oyen como un error.
      if (leaving != null) ramp(leaving, 0, () => leaving.pause())
    },
    [],
  )
}
