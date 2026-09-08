import { assetUrl } from './assets'
import { createStoredPreference } from './storage'

/**
 * La música de fondo: si suena y cuál es.
 *
 * Es lo único del juego que **no** está sintetizado. Los golpes, los goles y el
 * roce del disco salen de osciladores (`audioEngine.ts`) porque son cortos y
 * responden a lo que pasa; una música de dos minutos y medio hecha a mano
 * sonaría a lo que es. Así que es un fichero, y por eso viaja en `public/` como
 * el HDRI de otros juegos: nunca desde un CDN, que el visor puede estar
 * conectado solo a la red de casa.
 *
 * Va aparte del silencio (`muted.ts`) a propósito: son dos decisiones
 * distintas. Hay quien quiere oír el disco y no la música, y quien pone el
 * juego de fondo y prefiere lo contrario. El silencio manda sobre las dos —si
 * el juego está callado, no suena nada— y la música solo se apaga a sí misma.
 */

/** El bucle de la sala, relativo a la base de los ficheros estáticos. */
const MUSIC_PATH = 'audio/sala.mp3'

/**
 * A qué volumen suena, de 0 a 1.
 *
 * Bajo a propósito: es el fondo de un salón recreativo, no la partida. Tiene
 * que oírse cuando no pasa nada y desaparecer debajo del disco en cuanto lo
 * hay.
 */
export const MUSIC_VOLUME = 0.22

/** La URL de la que se pide la música, ya con la base de quien monte el juego. */
export function musicUrl(): string {
  return assetUrl(MUSIC_PATH)
}

/** Cómo se entra: con música. */
export const DEFAULT_MUSIC = true

export const MUSIC_KEY = 'air-hockey:music'

/** Lo que se escribe para cada estado. */
const MUSIC_OFF = '0'
const MUSIC_ON = '1'

/**
 * Interpreta lo leído del almacenamiento. Solo un valor la apaga; cualquier
 * otra cosa —incluido no haber elegido nunca— es que suena, que es como se
 * entra.
 */
export function parseMusic(raw: string | null): boolean {
  return raw !== MUSIC_OFF
}

export const {
  get: getMusic,
  getServer: getServerMusic,
  subscribe: subscribeMusic,
  save: saveMusic,
} = createStoredPreference<boolean>({
  key: MUSIC_KEY,
  parse: parseMusic,
  serialize: (on) => (on ? MUSIC_ON : MUSIC_OFF),
})
