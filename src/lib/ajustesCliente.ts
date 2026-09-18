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
  DEFAULT_SCENERY,
  DEFAULT_VOLUME_SETTINGS,
  LANG_COOKIE,
  langFromCookies,
  readGrabMode,
  readPlayHeight,
  readScenery,
  readVolumes,
  writeScenery,
  writeVolume,
  type GrabMode,
  type Lang,
  type PlayHeight,
  type Scenery,
  type SoundChannel,
  type Volumes,
} from './ajustes'

/** Lo que dura la elección de idioma: un año, como cualquier preferencia. */
const LANG_MAX_AGE = 60 * 60 * 24 * 365

/** El evento con el que un cambio recorre esta misma página. */
const EVENTO = 'xrcade:ajustes'

/**
 * Avisa a **esta misma página** de que un ajuste ha cambiado.
 *
 * El navegador avisa por su cuenta de los cambios de `localStorage`, pero solo a
 * las *otras* pestañas. Y la que escribe es justo la que tiene el juego montado
 * dentro, así que sin este evento el ajuste se guardaría y no se notaría hasta
 * recargar. Está en un sitio y no repetido en cada `set…` porque olvidarlo en
 * uno no rompe nada visible: simplemente ese ajuste tarda una recarga en llegar.
 */
function avisarDelCambio(): void {
  /* v8 ignore next -- los ajustes solo se cambian desde el navegador. */
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO))
}

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
  avisarDelCambio()
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
  avisarDelCambio()
}

/**
 * Qué se ve alrededor con el visor puesto, y React se entera cuando cambia.
 *
 * Va por el mismo almacén que los volúmenes: se guarda en `localStorage` y no en cookie
 * porque no se pinta en el servidor —solo lo mira quien dibuja la escena, que es de
 * navegador—. Y por el mismo aviso: montado en la cabina, el juego está en la misma página
 * que el panel del salón, así que sin él el decorado no cambiaría hasta recargar, y recargar
 * con el visor puesto es salir de la sesión.
 *
 * En el servidor devuelve el de partida y no lo guardado: el menú de la web enseña cuál está
 * elegido, y leer el almacenamiento al hidratar pintaría otro botón que el del HTML.
 */
export function useScenery(): Scenery {
  return useSyncExternalStore(subscribe, currentScenery, () => DEFAULT_SCENERY)
}

/**
 * El escenario elegido que el navegador no dejó guardar, o `null` si quedó guardado.
 *
 * Con el almacenamiento capado —navegación privada, cuota llena, cookies bloqueadas— la
 * escritura falla, y la lectura, que va al almacenamiento, volvería a dar el sitio dibujado: el
 * botón se encendería y el decorado no cambiaría. Aquí vive la elección mientras dure la visita,
 * y la lectura lo mira antes que el almacenamiento. Es la misma forma que en el salón, y la misma
 * idea que las preferencias del juego (`storage.ts`).
 */
let unsavedScenery: Scenery | null = null

/** Lo elegido en esta visita si no se pudo guardar; si no, lo guardado o el sitio dibujado. */
function currentScenery(): Scenery {
  return unsavedScenery ?? readScenery(settingsStorage())
}

/**
 * Cambia qué se ve alrededor, en todo el arcade.
 *
 * **No toca la sesión.** Es lo que hace que el cambio sea inmediato y sin salir del visor:
 * quien pinta el decorado lo lee y lo pone o lo quita en el fotograma siguiente. Y escribe
 * la clave del arcade aunque lo pulse el menú del juego: una sola preferencia, la misma que
 * enseña el salón.
 */
export function setScenery(value: Scenery): void {
  // Si entra en el almacenamiento, manda lo guardado y el respaldo sobra; si no, el respaldo
  // es lo único que lo recuerda.
  unsavedScenery = writeScenery(settingsStorage(), value) ? null : value
  avisarDelCambio()
}

/**
 * A qué altura se juega, y React se entera cuando cambia.
 *
 * Se lee del almacenamiento en cada lectura en vez de cachearse, como el
 * escenario y por lo mismo: es un valor primitivo, y ahí `useSyncExternalStore`
 * compara bien sin ayuda.
 */
export function usePlayHeight(): PlayHeight {
  // La misma lectura en los dos lados: en el servidor no hay almacenamiento y
  // `readPlayHeight` devuelve la de partida, así que no hace falta una segunda
  // función que pueda apartarse de esta sin que nadie se entere.
  return useSyncExternalStore(subscribe, leerAltura, leerAltura)
}

/** Lo guardado, o de pie si no hay nada o hay basura. */
function leerAltura(): PlayHeight {
  return readPlayHeight(settingsStorage())
}

/**
 * Cómo se sujeta lo que se coge, y React se entera cuando cambia.
 *
 * Como la altura de juego: se lee del almacenamiento en cada lectura en vez de
 * cachearse, porque es un valor primitivo y ahí `useSyncExternalStore` compara
 * bien sin ayuda.
 */
export function useGrabMode(): GrabMode {
  return useSyncExternalStore(subscribe, leerAgarre, leerAgarre)
}

/** Lo guardado, o manteniendo si no hay nada o hay basura. */
function leerAgarre(): GrabMode {
  return readGrabMode(settingsStorage())
}
