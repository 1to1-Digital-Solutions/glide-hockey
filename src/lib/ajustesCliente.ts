'use client'

/**
 * Los ajustes del arcade, del lado del navegador: leerlos, cambiarlos y que
 * React se entere.
 *
 * El contrato —claves, valores de partida y cómo se interpreta lo leído— está
 * en `ajustes.ts`, que también corre en el servidor. Aquí está lo que solo
 * tiene sentido con una ventana delante.
 */

import { useSyncExternalStore } from 'react'

import {
  DEFAULT_LANG,
  DEFAULT_VOLUME_SETTINGS,
  LANG_COOKIE,
  langFromCookies,
  readVolumes,
  writeVolume,
  type Lang,
  type SoundChannel,
  type Volumes,
} from './ajustes'

/** Lo que dura la elección de idioma: un año, como cualquier preferencia. */
const LANG_MAX_AGE = 60 * 60 * 24 * 365

/** El evento con el que un cambio recorre esta misma página. */
const EVENTO = 'xrcade:ajustes'

/** El almacenamiento del navegador, o nada si no lo hay o está capado. */
export function settingsStorage(): Storage | null {
  /* v8 ignore next -- en el servidor no hay ventana, y allí no corre ningún test. */
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    // Navegador con el almacenamiento bloqueado: no hay dónde recordar.
    return null
  }
}

/**
 * El almacén al que React se suscribe.
 *
 * La instantánea se cachea porque `useSyncExternalStore` compara por
 * identidad: devolver un objeto nuevo en cada lectura dejaría a React
 * repintando sin parar. Se invalida solo cuando algo avisa de un cambio.
 */
let snapshot: Volumes | null = null
const listeners = new Set<() => void>()

function refresh(): void {
  snapshot = readVolumes(settingsStorage())
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', refresh)
    window.addEventListener(EVENTO, refresh)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(EVENTO, refresh)
    }
  }
}

function getSnapshot(): Volumes {
  snapshot ??= readVolumes(settingsStorage())
  return snapshot
}

/** En el servidor no hay almacenamiento: se pinta con lo de partida. */
function getServerSnapshot(): Volumes {
  return DEFAULT_VOLUME_SETTINGS
}

/** Los volúmenes del arcade, y React se entera cuando cambian. */
export function useVolumes(): Volumes {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Cambia el volumen de un canal, de 0 a 100. */
export function setVolume(channel: SoundChannel, value: number): void {
  const recortado = Math.min(100, Math.max(0, Math.round(value)))
  writeVolume(settingsStorage(), channel, recortado)
  // La instantánea cacheada ya no vale: la próxima lectura vuelve al
  // almacenamiento. Se invalida aquí y no en el oyente porque puede que todavía
  // no haya ninguno, y aun así el siguiente `getSnapshot` tiene que ver lo nuevo.
  snapshot = null
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO))
}

/**
 * El idioma elegido, leído en el navegador.
 *
 * No pasa por `useSyncExternalStore`: cambiar de idioma recarga la página —el
 * servidor tiene que volver a pintar los textos—, así que no hay nada a lo que
 * suscribirse. Quien pinta en el servidor usa `langFromCookies` con la cabecera.
 */
export function currentLang(): Lang {
  /* v8 ignore next -- en el servidor pinta `idiomaDeLaPeticion`, que sí ve la cabecera. */
  if (typeof document === 'undefined') return DEFAULT_LANG
  return langFromCookies(document.cookie)
}

/**
 * El idioma elegido, y React se entera cuando cambia.
 *
 * Va por el mismo almacén que los volúmenes porque una cookie no avisa a nadie
 * al cambiar: el aviso lo da `setLang` con `EVENTO`. En el servidor devuelve el
 * de partida —allí se pinta con `idiomaDeLaPeticion`, que sí ve la cabecera— y
 * `useSyncExternalStore` se encarga de cuadrar las dos lecturas sin desajustar
 * la hidratación, que es justo para lo que está.
 */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, currentLang, () => DEFAULT_LANG)
}

/**
 * Cambia el idioma de todo el arcade.
 *
 * No es `HttpOnly` a propósito: lo escribe el navegador desde el menú, sin
 * pasar por el servidor. Tampoco lleva nada que identifique a nadie —solo `en`
 * o `es`—, así que `SameSite=Lax` sobra para lo que hay que proteger y está
 * puesto igualmente.
 */
export function setLang(lang: Lang): void {
  /* v8 ignore next -- solo lo llama el menú, que es del navegador. */
  if (typeof document === 'undefined') return
  const seguro = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${LANG_COOKIE}=${lang}; Path=/; Max-Age=${LANG_MAX_AGE}; SameSite=Lax${seguro}`
  // Una cookie no dispara ningún evento al cambiar, así que lo damos nosotros:
  // sin esto, lo que ya está pintado en el navegador se quedaría en el idioma
  // anterior aunque el servidor devolviera la página traducida.
  window.dispatchEvent(new Event(EVENTO))
}
