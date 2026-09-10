/**
 * Los ajustes que **no** son de un juego: idioma y volúmenes.
 *
 * **Por qué viven fuera de cada juego.** Quien entra al arcade, elige español y
 * baja el ambiente no quiere volver a decirlo en cada cabina. Antes cada juego
 * guardaba su propio silencio (`stick-rush:muted`) y su propia música, así que
 * había doce sitios donde decir lo mismo y ninguno se enteraba de los otros.
 * Ahora hay uno solo, y el juego montado en el salón lo lee.
 *
 * **Cómo llega el ajuste del hub al juego.** No hay tubería: el juego se monta
 * *dentro* de la página de xrcade, así que comparten origen, y lo que se guarda
 * aquí lo lee el de al lado. Lo único que hace falta es avisar de que ha
 * cambiado, y de eso van los dos eventos de más abajo: `storage` cubre las
 * otras pestañas —que el navegador avisa solo— y `EVENTO` cubre esta misma,
 * donde el navegador no avisa.
 *
 * **Por qué el idioma va en cookie y el volumen no.** El idioma se pinta en el
 * servidor: si viviera solo en `localStorage`, el HTML llegaría en inglés y el
 * navegador lo cambiaría al hidratar, que es exactamente el desajuste que React
 * prohíbe. La cookie viaja con la petición, así que el servidor ya sabe en qué
 * idioma pintar y el `<html lang>` sale bien a la primera. Los volúmenes no se
 * pintan: solo los usa el audio, que es de navegador, y ahí `localStorage` vale
 * y no engorda cada petición.
 *
 * **Qué hay aquí y qué en `ajustesCliente.ts`.** Aquí solo lo que también
 * corre en el servidor: las claves, los valores de partida y cómo se lee cada
 * cosa. Lo que necesita `window` —el almacén al que React se suscribe, y
 * escribir— vive en el otro, que sí es de cliente. Partirlo no es manía: un
 * módulo marcado `'use client'` no se ejecuta en el servidor, y el `layout`
 * necesita el idioma **antes** de pintar para no desajustar la hidratación.
 *
 * **Es una copia deliberada.** El mismo fichero está en xrcade y en los doce
 * juegos, con las mismas claves y los mismos valores de partida: eso es lo que
 * hace que elegir español en el arcade se note dentro de la cabina. Se duplica
 * en vez de sacarse a un paquete porque los juegos son repositorios sueltos que
 * también se despliegan por su cuenta, y un paquete más que versionar y volver
 * a publicar por cada cambio costaría más de lo que ahorra. Lo que no puede
 * pasar es que las **claves** dejen de coincidir: ahí es donde se rompería el
 * puente, en silencio.
 *
 * **Qué NO decide este fichero.** Nada de lo que va dentro de una partida:
 * nivel, dificultad, modo o escenario siguen siendo de cada juego y siguen
 * guardándose con su prefijo. Aquí solo está lo que se elige una vez y vale
 * para todos.
 */

/** Los idiomas que hay. El inglés es la lengua de partida del arcade. */
export const LANGS = ['en', 'es'] as const
export type Lang = (typeof LANGS)[number]

/** Cómo se llama cada idioma en su propio idioma, que es como se elige. */
export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  es: 'Español',
}

/**
 * Las dos familias de sonido, separadas porque se quieren por separado.
 *
 * `sfx` es lo que responde a lo que haces —el golpe, el bote, el acierto— y
 * `ambience` es lo que suena de fondo aunque no hagas nada. Hay quien juega con
 * música puesta y quiere solo los efectos, y quien pone el juego de ambiente y
 * quiere lo contrario.
 */
export const SOUND_CHANNELS = ['sfx', 'ambience'] as const
export type SoundChannel = (typeof SOUND_CHANNELS)[number]

/**
 * Dónde se recuerda el idioma.
 *
 * Sin dos puntos a propósito: el nombre de una cookie es un *token* de HTTP y
 * los dos puntos no lo son, así que el prefijo del arcade va con guion bajo
 * aunque las claves de almacenamiento usen `xrcade:`.
 */
export const LANG_COOKIE = 'xrcade_lang'

/** Dónde se recuerda cada volumen. El prefijo es del arcade, no de un juego. */
export const VOLUME_KEYS: Record<SoundChannel, string> = {
  sfx: 'xrcade:volume:sfx',
  ambience: 'xrcade:volume:ambience',
}

/** Con qué se entra la primera vez. */
export const DEFAULT_LANG: Lang = 'en'
export const DEFAULT_VOLUMES: Record<SoundChannel, number> = { sfx: 100, ambience: 60 }

/** Los volúmenes, que es lo que va al almacenamiento. */
export interface Volumes {
  /** Volumen de los efectos, de 0 a 100. Un 0 es «apagado». */
  sfx: number
  /** Volumen del fondo, de 0 a 100. Un 0 es «apagado». */
  ambience: number
}

export const DEFAULT_VOLUME_SETTINGS: Volumes = {
  sfx: DEFAULT_VOLUMES.sfx,
  ambience: DEFAULT_VOLUMES.ambience,
}

/**
 * Interpreta un idioma venido de fuera.
 *
 * La cookie es entrada externa —cualquiera puede editarla desde las
 * herramientas del navegador—, así que solo un idioma que existe cuenta
 * cualquier otra cosa cae al de partida en vez de dejar la interfaz sin
 * traducir.
 */
export function parseLang(raw: string | null | undefined): Lang {
  return (LANGS as readonly string[]).includes(raw ?? '') ? (raw as Lang) : DEFAULT_LANG
}

/**
 * Interpreta un volumen leído del almacenamiento.
 *
 * Solo un entero de 0 a 100 vale. Un texto, un decimal o un número fuera de
 * rango son almacenamiento manipulado o de otra versión: se cae al de partida,
 * que es lo que hacía el juego antes de guardar nada.
 */
export function parseVolume(raw: string | null, fallback: number): number {
  if (raw === null || !/^\d{1,3}$/.test(raw)) return fallback
  const value = Number(raw)
  return value >= 0 && value <= 100 ? value : fallback
}

/**
 * El idioma escrito en una cabecera `Cookie`.
 *
 * Recibe el texto entero y no la cookie ya partida para que valga igual en el
 * servidor —donde llega así— y en el navegador, donde `document.cookie` tiene
 * esa misma forma.
 */
export function langFromCookies(cookieHeader: string | null | undefined): Lang {
  if (!cookieHeader) return DEFAULT_LANG
  for (const trozo of cookieHeader.split(';')) {
    const [nombre, ...resto] = trozo.trim().split('=')
    if (nombre === LANG_COOKIE) return parseLang(decodeURIComponent(resto.join('=')))
  }
  return DEFAULT_LANG
}

/** Los volúmenes, leídos de un almacenamiento que puede no estar. */
export function readVolumes(storage: Pick<Storage, 'getItem'> | null): Volumes {
  if (storage === null) return DEFAULT_VOLUME_SETTINGS
  try {
    return {
      sfx: parseVolume(storage.getItem(VOLUME_KEYS.sfx), DEFAULT_VOLUMES.sfx),
      ambience: parseVolume(storage.getItem(VOLUME_KEYS.ambience), DEFAULT_VOLUMES.ambience),
    }
  } catch {
    // Almacenamiento capado: se juega con lo de partida, y ya.
    return DEFAULT_VOLUME_SETTINGS
  }
}

/**
 * Guarda un volumen, o lo olvida cuando vuelve a ser el de partida.
 *
 * Solo se escribe lo que se aparta de lo de partida: así el almacenamiento
 * tiene algo únicamente cuando alguien ha decidido algo, y borrarlo devuelve el
 * arcade a como venía.
 *
 * @returns si quedó guardado. Un `false` no es un error: significa que este
 *   navegador no guarda nada y el ajuste vivirá lo que dure la visita.
 */
export function writeVolume(storage: Storage | null, channel: SoundChannel, value: number): boolean {
  if (storage === null) return false
  try {
    if (value === DEFAULT_VOLUMES[channel]) storage.removeItem(VOLUME_KEYS[channel])
    else storage.setItem(VOLUME_KEYS[channel], String(value))
    return true
  } catch {
    return false
  }
}

/** De 0-100 a la escala 0-1 con la que trabaja el audio del navegador. */
export function volumeFactor(value: number): number {
  return Math.min(100, Math.max(0, value)) / 100
}

/**
 * A qué altura se juega.
 *
 * **El problema.** Las cotas de los trece juegos se eligieron con una persona de pie
 * delante: el aro a 3,05 m, la diana a 1,73, la mesa de air hockey a la altura de su
 * cintura. De pie y midiendo lo que ella medía, está bien. Sentado —en una silla, en un
 * sofá, en una silla de ruedas— el mundo entero queda un palmo por encima de donde llega
 * el brazo, y no falla nada: simplemente no se puede jugar. A quien es más bajo que la
 * persona que estaba delante le pasa lo mismo en pequeño, y no tiene forma de nivelarlo,
 * al contrario que el modo, la dificultad o la mano, que sí se eligen.
 *
 * **Qué hace `eyes`.** Baja el mundo hasta los ojos de quien lleva el visor, que es la
 * misma corrección que ya se le hace a la interfaz inmersiva para que el menú no quede
 * fuera de la vista. No mueve al jugador —el origen es de quien monta la escena, y en el
 * salón hay un arco de cabinas plantado ahí—, mueve el decorado: la geometría que se ve es
 * idéntica y las puntuaciones no cambian, porque la relación entre el objetivo y la mano
 * es la misma.
 *
 * **Por qué es del arcade y no de cada juego.** Quien se sienta se sienta para toda la
 * visita. Decirlo trece veces, una por cabina, sería no poder decirlo.
 */
export const PLAY_HEIGHTS = ['standing', 'eyes'] as const
export type PlayHeight = (typeof PLAY_HEIGHTS)[number]

/** Dónde se recuerda. El prefijo es del arcade, no de un juego. */
export const PLAY_HEIGHT_KEY = 'xrcade:play-height'

/** De pie: el mundo donde ha estado siempre. */
export const DEFAULT_PLAY_HEIGHT: PlayHeight = 'standing'

/**
 * Interpreta la altura leída del almacenamiento. Como el modo inmersivo: solo cuenta una
 * que exista, y cualquier otra cosa cae a la de partida.
 */
export function parsePlayHeight(raw: string | null | undefined): PlayHeight {
  return (PLAY_HEIGHTS as readonly string[]).includes(raw ?? '')
    ? (raw as PlayHeight)
    : DEFAULT_PLAY_HEIGHT
}

/** La altura elegida, leída de un almacenamiento que puede no estar. */
export function readPlayHeight(storage: Pick<Storage, 'getItem'> | null): PlayHeight {
  if (storage === null) return DEFAULT_PLAY_HEIGHT
  try {
    return parsePlayHeight(storage.getItem(PLAY_HEIGHT_KEY))
  } catch {
    // Almacenamiento capado: se juega de pie, que es como se jugaba antes de haber esto.
    return DEFAULT_PLAY_HEIGHT
  }
}

/**
 * Guarda la altura, o la olvida cuando vuelve a ser la de partida.
 *
 * @returns si quedó guardada. Un `false` no es un error: significa que este navegador no
 *   guarda nada y la elección vivirá lo que dure la visita.
 */
export function writePlayHeight(storage: Storage | null, value: PlayHeight): boolean {
  if (storage === null) return false
  try {
    if (value === DEFAULT_PLAY_HEIGHT) storage.removeItem(PLAY_HEIGHT_KEY)
    else storage.setItem(PLAY_HEIGHT_KEY, value)
    return true
  } catch {
    return false
  }
}
