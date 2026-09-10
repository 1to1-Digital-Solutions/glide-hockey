/**
 * A qué altura se pone la interfaz inmersiva: la de los ojos de quien juega.
 *
 * **Estaba clavada a una constante.** El menú, el marcador y el botón de salir vivían a una
 * cota fija, medida con una persona delante: a alguien de metro y medio le quedaban por
 * encima de la vista cómoda —y ahí están los ajustes y la salida— y a alguien de dos metros,
 * a la altura del pecho. Es de las pocas cosas del juego que no se pueden ajustar a mano,
 * porque nadie va a entrar en un menú que no alcanza para subir el menú.
 *
 * Aquí solo está la aritmética, que es lo que se puede comprobar sin visor: qué cota se da
 * por buena, cuánto sube o baja la interfaz y cuándo se vuelve a medir. Quién lo aplica es
 * `components/xr/XRUiHeight.tsx`.
 */

/**
 * La estatura con la que se colocó la interfaz.
 *
 * No es una media de nada: es la persona que estaba delante cuando se pusieron las cotas, y
 * por eso es el cero de la corrección. Con ella puesta, todo queda exactamente donde estaba.
 */
export const REFERENCE_EYE_HEIGHT = 1.6

/**
 * El rango de cotas que se acepta como «ojos de una persona».
 *
 * Fuera de él la medida no es una estatura: es el visor sobre una mesa, en la mano de
 * alguien que se agacha a recogerlo, o una sesión cuyo origen no está en el suelo. En esos
 * casos no se inventa nada y la interfaz se queda donde ha estado siempre.
 */
export const MIN_EYE_HEIGHT = 0.9
export const MAX_EYE_HEIGHT = 2.2

/** ¿Es esta cota la de los ojos de alguien de pie o sentado? */
export function isPlausibleEyeHeight(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_EYE_HEIGHT && value <= MAX_EYE_HEIGHT
}

/**
 * ¿Tiene esta sesión el origen en el suelo, a la vista de lo que dice haber habilitado?
 *
 * `local-floor` se pide como requerida al abrir la sesión, así que una sesión viva la tiene
 * por fuerza. Pero `enabledFeatures` es opcional en la especificación y hay navegadores que
 * no la publican: exigirla sería renunciar a medir en visores donde el dato es bueno. Si la
 * lista falta se da por buena, y si aun así el espacio no fuera de suelo, la cota nacería
 * fuera del rango de arriba y tampoco se usaría.
 */
export function hasFloorReference(enabled: readonly string[] | undefined): boolean {
  return enabled == null || enabled.includes('local-floor') || enabled.includes('bounded-floor')
}

/**
 * Cuánto sube (o baja) la interfaz para esa altura de ojos, en metros.
 *
 * Se sigue la altura **entera** y no una fracción: los paneles no tocan el suelo ni tienen
 * nada que ver con él, son hojas flotantes que se miran, así que lo único que importa es a
 * qué altura quedan respecto a los ojos. Sin cota buena, cero: se quedan donde estaban.
 */
export function uiRise(eyeHeight: number | null | undefined): number {
  if (!isPlausibleEyeHeight(eyeHeight)) return 0
  return eyeHeight - REFERENCE_EYE_HEIGHT
}

/**
 * Cuánto tiene que cambiar la altura, y durante cuánto, para volver a medir.
 *
 * La interfaz se coloca al entrar y **se queda quieta**: una que persiguiera la cabeza
 * subiría al ponerse de puntillas y bajaría al agacharse, justo cuando se está apuntando a
 * un botón. Pero sentarse a media partida sí tiene que notarse, y eso es un cambio grande y
 * sostenido, no un movimiento de juego.
 */
export const RETAKE_DELTA = 0.15
export const RETAKE_SECONDS = 1

/** Lo que se recuerda de la altura entre fotogramas. */
export interface HeightTracker {
  /** La cota que se está usando ahora mismo, o `null` mientras no haya ninguna buena. */
  held: number | null
  /** La medida filtrada, que es lo que se compara con la que se usa. */
  smoothed: number | null
  /** Cuánto lleva la medida lejos de la que se usa, en segundos. */
  drift: number
}

/** Un seguimiento recién empezado: sin nada medido todavía. */
export function startTracking(): HeightTracker {
  return { held: null, smoothed: null, drift: 0 }
}

/**
 * Avanza el seguimiento con la medida de este fotograma.
 *
 * @param measured  la cota de la cabeza, o `null` si no hay dato bueno
 * @param ratio     cuánto se acerca el filtro a la medida en este fotograma, de 0 a 1
 * @param delta     segundos de este fotograma
 */
export function trackHeight(
  state: HeightTracker,
  measured: number | null,
  ratio: number,
  delta: number,
): HeightTracker {
  if (!isPlausibleEyeHeight(measured)) return state

  const smoothed = state.smoothed == null ? measured : state.smoothed + (measured - state.smoothed) * ratio
  // La primera medida buena se usa tal cual: entrar en la sesión y ver el menú a la altura
  // de los ojos es lo que tiene que pasar, no un panel subiendo despacio desde donde sea.
  if (state.held == null) return { held: smoothed, smoothed, drift: 0 }

  const lejos = Math.abs(smoothed - state.held) > RETAKE_DELTA
  const drift = lejos ? state.drift + Math.max(0, delta) : 0
  if (drift > RETAKE_SECONDS) return { held: smoothed, smoothed, drift: 0 }
  return { held: state.held, smoothed, drift }
}

/**
 * Cuánto se corre el mundo, en metros, para dejarlo al alcance de quien juega.
 *
 * **El problema.** Las cotas de la escena se eligieron con una persona de pie
 * delante. Sentado —en una silla, en un sofá, en una silla de ruedas— el mundo
 * entero queda un palmo por encima de donde llega el brazo, y no falla nada:
 * simplemente no se puede jugar. A quien es más bajo que esa persona le pasa lo
 * mismo en pequeño, y tampoco tiene forma de nivelarlo.
 *
 * **Es la misma corrección que ya se le hace a la interfaz**, aplicada al
 * decorado: sale negativa para quien tiene los ojos por debajo de la referencia,
 * así que el mundo baja hasta él. Y se corre el decorado, no al jugador: el
 * origen es de quien monta la escena —en el salón hay un arco de cabinas
 * plantado ahí— y dos orígenes en la misma sesión se pisan.
 *
 * **No cambia ninguna puntuación.** Se corre la escena entera, con el objetivo
 * dentro, mientras la mano se queda donde está la mano: la altura del objetivo
 * respecto al brazo es la misma que tenía la persona de pie para la que se
 * dibujó. Y quien juega de pie no nota nada, porque ahí la corrección es cero.
 *
 * Lo pide quien juega desde los ajustes del arcade y no se adivina: bajar el
 * mundo sin que nadie lo haya dicho movería el suelo bajo los pies de quien
 * está de pie.
 *
 * @param eyeHeight  la cota de los ojos que haya medido el visor, o `null`
 * @param atEyeLevel si se ha pedido el mundo a la altura de los ojos
 */
export function worldRise(
  eyeHeight: number | null | undefined,
  atEyeLevel: boolean,
): number {
  if (!atEyeLevel) return 0
  return uiRise(eyeHeight)
}

/**
 * Cuánto sube la interfaz **por encima de lo que ya se haya movido el mundo**.
 *
 * La interfaz cuelga del mundo, y el mundo puede haber bajado ya hasta los ojos
 * de quien juega (ver `worldRise`). Sumar entonces la corrección de la interfaz
 * la bajaría dos veces: el menú acabaría a la altura de las rodillas justo para
 * quien menos puede agacharse a buscarlo.
 *
 * Dicho de otra forma: cuando el mundo entero viene a ti, la interfaz ya está
 * donde tiene que estar y no le hace falta corrección propia.
 */
export function uiRiseOverWorld(
  eyeHeight: number | null | undefined,
  atEyeLevel: boolean,
): number {
  return uiRise(eyeHeight) - worldRise(eyeHeight, atEyeLevel)
}
