/**
 * Los ajustes que **no** son de un juego: idioma, volúmenes, escenario, altura, agarre, giro y mano.
 *
 * **El mismo fichero en los diecisiete.** Cada juego lee solo lo que usa, pero el contrato es
 * uno: `organizate/scripts/repos/comunes.py` exige que esta copia sea idéntica en todos, y
 * `xrcade/src/lib/puente-de-ajustes.test.ts` que diga lo mismo que escribe el salón.
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
 * nivel, dificultad o modo siguen siendo de cada juego y siguen guardándose con
 * su prefijo. Aquí solo está lo que se elige una vez y vale para todos.
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

/**
 * Qué se ve alrededor con el visor puesto: el sitio dibujado o tu habitación.
 *
 * `place` es el decorado opaco de quien pinta —la sala del arcade, la bolera, el prado— y
 * `room` es la habitación de verdad, por *passthrough*, con encima solo lo que hace falta
 * para jugar. Son los mismos dos nombres con los que cada juego habla de su decorado, a
 * propósito: que el valor venga del arcade no cambia qué significa.
 *
 * **Es un ajuste de lo que se pinta, no del tipo de sesión.** Decidir con él qué sesión se abre
 * tiene dos fallos, y los dos se vieron con el visor puesto. Una sesión de WebXR no cambia de
 * tipo, así que cambiar de escenario obligaría a cerrar la sesión y abrir otra: saca del visor y
 * tarda en volver. Y un juego no puede enterarse mirando el tipo de sesión, que no dice lo que
 * se eligió. Así que el anfitrión entra en `immersive-ar` siempre que el visor la tiene, y este
 * ajuste decide si se pinta el decorado: cambiarlo es instantáneo y lo lee cualquiera que monte
 * escena.
 *
 * **Y es uno solo.** Si cada juego guardara el suyo, el salón diría «realidad virtual» y la
 * cabina entraría en la habitación porque alguna vez se eligió ahí: dos preferencias que se
 * contradicen sin que nadie sepa cuál manda.
 */
export const SCENERIES = ['place', 'room'] as const
export type Scenery = (typeof SCENERIES)[number]

/** Dónde se recuerda. El prefijo es del arcade, no de un juego. */
export const SCENERY_KEY = 'xrcade:scenery'

/** Con qué se entra: el sitio dibujado, que es lo que se ve en cualquier pantalla. */
export const DEFAULT_SCENERY: Scenery = 'place'

/**
 * Interpreta el escenario leído del almacenamiento. Como el idioma: solo cuenta uno que
 * exista, y cualquier otra cosa cae al de partida.
 */
export function parseScenery(raw: string | null | undefined): Scenery {
  return (SCENERIES as readonly string[]).includes(raw ?? '') ? (raw as Scenery) : DEFAULT_SCENERY
}

/** El escenario elegido, leído de un almacenamiento que puede no estar. */
export function readScenery(storage: Pick<Storage, 'getItem'> | null): Scenery {
  if (storage === null) return DEFAULT_SCENERY
  try {
    return parseScenery(storage.getItem(SCENERY_KEY))
  } catch {
    // Almacenamiento capado: se ve el sitio dibujado, que nunca deja a nadie mirando la nada.
    return DEFAULT_SCENERY
  }
}

/**
 * Guarda el escenario, o lo olvida cuando vuelve a ser el de partida.
 *
 * @returns si quedó guardado. Un `false` no es un error: significa que este navegador no
 *   guarda nada y la elección vivirá lo que dure la visita.
 */
export function writeScenery(storage: Storage | null, value: Scenery): boolean {
  if (storage === null) return false
  try {
    if (value === DEFAULT_SCENERY) storage.removeItem(SCENERY_KEY)
    else storage.setItem(SCENERY_KEY, value)
    return true
  } catch {
    return false
  }
}

/**
 * Si quien pinta tiene que poner su decorado: **la regla que siguen el salón y los juegos**.
 *
 * Se quita solo cuando se ha elegido la habitación **y** la sesión es `immersive-ar`. La
 * segunda condición no sobra: en una `immersive-vr` —un visor sin passthrough— o fuera del
 * visor no hay habitación detrás, y quitar el decorado dejaría a quien juega mirando negro sin
 * saber por qué. El tipo de sesión no decide qué se ve; solo dice si la habitación se puede
 * enseñar.
 *
 * @param sessionMode El de `useXR((state) => state.mode)`.
 */
export function showsPlace(sessionMode: string | null | undefined, scenery: Scenery): boolean {
  return scenery === 'place' || sessionMode !== 'immersive-ar'
}

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
 * Interpreta la altura leída del almacenamiento. Como el escenario: solo cuenta una
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

/**
 * Cómo se sujeta lo que se coge.
 *
 * **El problema.** Nueve de los trece piden **mantener apretado** el gatillo durante todo
 * el gesto: el dardo, el hacha, la bola, el palo, el mazo, la cuerda del arco. Un lanzamiento
 * de bolos son tres o cuatro segundos con la mano cerrada; una partida entera son ciento y
 * pico. Quien tiene poca fuerza de agarre —artritis, temblor, una mano cansada— se queda
 * fuera del juego, y no de una parte: del gesto entero, que es el juego.
 *
 * **Qué hace `toggle`.** Un toque para cogerlo y otro para soltarlo. El gesto de en medio
 * —el brazo— es el mismo, y por eso no cambia ninguna puntuación: lo que decide el
 * lanzamiento sigue siendo la velocidad de la mano al soltar.
 *
 * **Por qué es del arcade y no de cada juego.** Quien no puede mantener el gatillo no puede
 * mantenerlo en ninguna cabina. Y porque cambiar de cabina ya obliga a reaprender cómo se
 * coge cada cosa: al menos que la forma de sujetarla sea la misma en todas.
 */
export const GRAB_MODES = ['hold', 'toggle'] as const
export type GrabMode = (typeof GRAB_MODES)[number]

/** Dónde se recuerda. El prefijo es del arcade, no de un juego. */
export const GRAB_MODE_KEY = 'xrcade:grab'

/** Manteniendo, que es lo que enseñan los tutoriales y lo que espera casi todo el mundo. */
export const DEFAULT_GRAB_MODE: GrabMode = 'hold'

/** Interpreta el agarre leído del almacenamiento: solo cuenta uno que exista. */
export function parseGrabMode(raw: string | null | undefined): GrabMode {
  return (GRAB_MODES as readonly string[]).includes(raw ?? '')
    ? (raw as GrabMode)
    : DEFAULT_GRAB_MODE
}

/** El agarre elegido, leído de un almacenamiento que puede no estar. */
export function readGrabMode(storage: Pick<Storage, 'getItem'> | null): GrabMode {
  if (storage === null) return DEFAULT_GRAB_MODE
  try {
    return parseGrabMode(storage.getItem(GRAB_MODE_KEY))
  } catch {
    // Almacenamiento capado: se agarra manteniendo, como se agarraba siempre.
    return DEFAULT_GRAB_MODE
  }
}

/**
 * Guarda el agarre, o lo olvida cuando vuelve a ser el de partida.
 *
 * @returns si quedó guardado. Un `false` no es un error: significa que este navegador no
 *   guarda nada y la elección vivirá lo que dure la visita.
 */
export function writeGrabMode(storage: Storage | null, value: GrabMode): boolean {
  if (storage === null) return false
  try {
    if (value === DEFAULT_GRAB_MODE) storage.removeItem(GRAB_MODE_KEY)
    else storage.setItem(GRAB_MODE_KEY, value)
    return true
  } catch {
    return false
  }
}

/**
 * Cuándo se puede girar el decorado con el stick.
 *
 * **El problema.** Los juegos dan por hecho que uno se gira con el cuerpo: los platos de skeet
 * salen de dos casetas, los morteros del arco ocupan el claro, las cabinas de los extremos del
 * salón están a 75°. Sentado —en una silla fija, en un sofá, en una silla de ruedas— eso es
 * torcer el cuello o no llegar.
 *
 * **Qué hace cada valor.** `auto` gira solo cuando la altura de juego es la de sentado
 * (`eyes`): quien juega de pie se gira con el cuerpo, y un stick que moviera el mundo sin
 * querer le revolvería el estómago. `stick` gira siempre, para quien juega de pie pero no se
 * puede o no se quiere girar. Lo que gira es el decorado, nunca el jugador; cómo, en
 * `lib/giro.ts`.
 *
 * **Tolerante a que no esté.** Un salón anterior a este ajuste no lo escribe, y cualquier cosa
 * que no sea un valor conocido cae a `auto`: es lo que había antes de existir la opción, más el
 * giro sentado, que no estorba a nadie que esté de pie.
 */
export const TURN_MODES = ['auto', 'stick'] as const
export type TurnMode = (typeof TURN_MODES)[number]

/** Dónde se recuerda. El prefijo es del arcade, no de un juego. */
export const TURN_MODE_KEY = 'xrcade:giro'

/** Solo sentado. */
export const DEFAULT_TURN_MODE: TurnMode = 'auto'

/** Interpreta el giro leído del almacenamiento: solo cuenta uno que exista. */
export function parseTurnMode(raw: string | null | undefined): TurnMode {
  return (TURN_MODES as readonly string[]).includes(raw ?? '')
    ? (raw as TurnMode)
    : DEFAULT_TURN_MODE
}

/** El giro elegido, leído de un almacenamiento que puede no estar. */
export function readTurnMode(storage: Pick<Storage, 'getItem'> | null): TurnMode {
  if (storage === null) return DEFAULT_TURN_MODE
  try {
    return parseTurnMode(storage.getItem(TURN_MODE_KEY))
  } catch {
    // Almacenamiento capado: se gira solo sentado, que es lo que no estorba a nadie.
    return DEFAULT_TURN_MODE
  }
}

/**
 * Guarda el giro, o lo olvida cuando vuelve a ser el de partida.
 *
 * @returns si quedó guardado. Un `false` no es un error: significa que este navegador no
 *   guarda nada y la elección vivirá lo que dure la visita.
 */
export function writeTurnMode(storage: Storage | null, value: TurnMode): boolean {
  if (storage === null) return false
  try {
    if (value === DEFAULT_TURN_MODE) storage.removeItem(TURN_MODE_KEY)
    else storage.setItem(TURN_MODE_KEY, value)
    return true
  } catch {
    return false
  }
}

/**
 * Con qué mano se juega: la que lanza, golpea y apunta.
 *
 * **El problema.** Cada juego que la necesitaba la preguntaba en su menú —la pala en la mesa,
 * el bate en la jaula—, y quien es zurdo tenía que decirlo en cada cabina, entre el modo y la
 * dificultad, antes de poder jugar. Es la misma respuesta en todas: nadie cambia de mano buena
 * al cambiar de juego.
 *
 * **Por qué es del arcade y no de cada juego.** Por lo mismo que el escenario: se elige una vez
 * y vale para los trece, y así el menú de cada juego se queda en lo que es suyo. **Una sola
 * clave**: el juego que tenía la suya la deja de leer y la borra sin trasladarla, porque dos
 * sitios que dicen lo mismo acaban diciendo cosas distintas, y trasladarla pisaría lo elegido
 * aquí con lo que se eligió en una sola cabina.
 *
 * Los valores son los nombres de WebXR (`XRHandedness`) y los que ya usan los juegos que tenían
 * el ajuste: se le pasan tal cual a `@react-three/xr` para pedirle el mando de esa mano, y leer
 * este en vez del propio cambia de dónde sale el valor, no qué significa.
 */
export const HANDS = ['right', 'left'] as const
export type Hand = (typeof HANDS)[number]

/**
 * En qué orden se enseñan al elegir: izquierda a la izquierda, como se tienen las manos de
 * frente. Un selector con la derecha a la izquierda se pulsa al revés sin querer.
 */
export const HAND_ORDER: readonly Hand[] = ['left', 'right']

/** Dónde se recuerda. El prefijo es del arcade, no de un juego. */
export const HAND_KEY = 'xrcade:hand'

/** La derecha, que es la de la mayoría y con la que se construyeron los trece. */
export const DEFAULT_HAND: Hand = 'right'

/** Interpreta la mano leída del almacenamiento: solo cuenta una que exista. */
export function parseHand(raw: string | null | undefined): Hand {
  return (HANDS as readonly string[]).includes(raw ?? '') ? (raw as Hand) : DEFAULT_HAND
}

/** La mano elegida, leída de un almacenamiento que puede no estar. */
export function readHand(storage: Pick<Storage, 'getItem'> | null): Hand {
  if (storage === null) return DEFAULT_HAND
  try {
    return parseHand(storage.getItem(HAND_KEY))
  } catch {
    // Almacenamiento capado: se juega con la derecha, como se jugaba antes de haber esto.
    return DEFAULT_HAND
  }
}

/**
 * Guarda la mano, o la olvida cuando vuelve a ser la de partida.
 *
 * @returns si quedó guardada. Un `false` no es un error: significa que este navegador no
 *   guarda nada y la elección vivirá lo que dure la visita.
 */
export function writeHand(storage: Storage | null, value: Hand): boolean {
  if (storage === null) return false
  try {
    if (value === DEFAULT_HAND) storage.removeItem(HAND_KEY)
    else storage.setItem(HAND_KEY, value)
    return true
  } catch {
    return false
  }
}

/**
 * Cuánto se sube o se baja el mundo **además** de la altura de juego, en centímetros.
 *
 * **El problema.** `standing|eyes` es un interruptor: de pie, el mundo donde se dibujó; a la
 * altura de los ojos, bajado lo que los ojos estén por debajo de la persona de referencia. Entre
 * medias no hay nada, y una silla de oficina y un sofá no ponen los ojos a la misma altura del
 * brazo, ni llega igual quien mide 1,50 que quien mide 1,90. El salón deja afinarlo de cinco en
 * cinco centímetros y este juego solo lo lee: se suma a lo que ya haga la altura de juego y sube
 * (positivo) o baja (negativo) el decorado entero, con la mano donde está.
 *
 * El tope es de un palmo largo a cada lado: más allá ya no es afinar, es la otra altura de
 * juego, y un mundo treinta centímetros por encima del suelo de verdad se ve flotando.
 */
export const PLAY_HEIGHT_OFFSET_KEY = 'xrcade:play-height-offset'

/** Lo más que se sube o se baja, en centímetros, a cada lado del cero. */
export const MAX_PLAY_HEIGHT_OFFSET = 30

/** Sin tocar: el mundo donde lo pone la altura de juego, como antes de haber esto. */
export const DEFAULT_PLAY_HEIGHT_OFFSET = 0

/**
 * Interpreta el ajuste leído del almacenamiento.
 *
 * Solo vale un entero dentro del tope. Un decimal, un texto o un número fuera de rango son
 * almacenamiento manipulado o de otra versión, y caen al cero: un mundo metro y medio por
 * encima del suelo por un valor roto es mucho peor que uno sin afinar.
 */
export function parsePlayHeightOffset(raw: string | null | undefined): number {
  if (raw == null || !/^-?\d{1,3}$/.test(raw)) return DEFAULT_PLAY_HEIGHT_OFFSET
  const value = Number(raw)
  return Math.abs(value) <= MAX_PLAY_HEIGHT_OFFSET ? value : DEFAULT_PLAY_HEIGHT_OFFSET
}

/** El ajuste, en centímetros, leído de un almacenamiento que puede no estar. */
export function readPlayHeightOffset(storage: Pick<Storage, 'getItem'> | null): number {
  if (storage === null) return DEFAULT_PLAY_HEIGHT_OFFSET
  try {
    return parsePlayHeightOffset(storage.getItem(PLAY_HEIGHT_OFFSET_KEY))
  } catch {
    // Almacenamiento capado: sin afinar, que es como se jugaba antes de haber esto.
    return DEFAULT_PLAY_HEIGHT_OFFSET
  }
}

/** De centímetros a los metros en los que se mueve el decorado. */
export function playHeightOffsetMeters(cm: number): number {
  return cm / 100
}
