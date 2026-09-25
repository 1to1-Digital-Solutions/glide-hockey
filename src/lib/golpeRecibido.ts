/**
 * El golpe que recibe el cuerpo: qué se ve, qué se mueve, qué se oye y qué se siente, y cuánto.
 *
 * Es el mismo fichero en todos los juegos que lo usan (`comunes.py` lo vigila). Cada juego dice
 * **cuándo** le dan a quien juega, **de dónde** y **con qué fuerza**; aquí se decide todo lo
 * demás, para que un golpe se lea igual en cualquier cabina del salón. Todo puro: sin React, sin
 * three y sin audio. Quien lo pinta es `components/xr/GolpeRecibido.tsx`.
 *
 * **Cinco capas desde un solo sitio**, y ninguna mueve la cámara:
 *
 * - **La viñeta**: oscurece los bordes de la vista, más del lado por el que llega el golpe, y no
 *   entra nunca en el centro. Es lo que dice «te han dado» sin tapar lo que se está mirando.
 * - **La sacudida del mundo**: el decorado se desplaza unos milímetros y vuelve, amortiguado.
 *   **El decorado, nunca la cámara**: mover la vista sin que la cabeza se mueva es la causa raíz
 *   del mareo en realidad virtual (el ojo dice que te mueves y el oído interno dice que no); el
 *   seguimiento de la cabeza tiene que seguir uno a uno pase lo que pase.
 * - **La cámara lenta**: un instante con el reloj del juego frenado. Solo el del juego —lo que
 *   vuela—, nunca el de la cabeza ni el de las manos, que siguen a su ritmo: congelar eso se lee
 *   como un tirón de fotogramas y no como un golpe.
 * - **El filtro**: un paso bajo breve en el bus del juego, el «oído tapado» del golpe.
 * - **El háptico**: la receta común `golpeRecibido` de `tactos.ts`, en las dos manos. Aquí no se
 *   inventan pulsos.
 *
 * **Las cifras no son de ninguna guía, porque no hay ninguna.** Ni Meta ni Valve publican cuánto
 * debe durar una viñeta de impacto o cuánto se puede mover el mundo; Meta lo deja como curvas que
 * ajusta cada juego. Estas son un punto de partida corto y flojo: A CALIBRAR CON EL VISOR.
 *
 * **El confort manda sobre todo.** Quien lo apaga no recibe nada de esto; en suave, la mitad. Y
 * con el movimiento reducido del sistema no hay sacudida ni cámara lenta —son las dos que mueven
 * algo—, la viñeta se queda en suave y el háptico y el filtro siguen, que no mueven nada.
 */

import { pulsosDe, type Pulso } from './tactos'

/** Un punto o una dirección, sin atarse al tipo de vector de ningún juego. */
export interface Punto3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Un lado de la vista, en la pantalla: `x` hacia la derecha e `y` hacia arriba, de −1 a 1. */
export interface Lado {
  readonly x: number
  readonly y: number
}

// ---------------------------------------------------------------------------
// El ajuste de confort
// ---------------------------------------------------------------------------

/**
 * Cuánto se nota un golpe: nada, la mitad o entero.
 *
 * Los valores van en inglés porque se guardan: una clave o un valor de almacenamiento traducido
 * borraría la elección de quien juega el día que se cambiara el idioma del código.
 */
export const CONFORTS = ['off', 'gentle', 'normal'] as const
export type Confort = (typeof CONFORTS)[number]

/** Con qué se entra: el golpe entero, que ya es corto y flojo. */
export const CONFORT_DE_PARTIDA: Confort = 'normal'

/** Lo que multiplica cada ajuste a todas las capas. */
export const FACTOR_DEL_CONFORT: Record<Confort, number> = { off: 0, gentle: 0.5, normal: 1 }

/** El confort leído del almacenamiento: solo cuenta uno que exista; lo demás, el de partida. */
export function parseConfort(raw: string | null | undefined): Confort {
  return (CONFORTS as readonly string[]).includes(raw ?? '') ? (raw as Confort) : CONFORT_DE_PARTIDA
}

/**
 * El confort guardado en `clave`, que es del juego: es un ajuste de la cabina y no del salón,
 * porque el golpe de una babosa en la cara y el de un disco en la barriga no piden lo mismo.
 */
export function leerConfort(storage: Pick<Storage, 'getItem'> | null, clave: string): Confort {
  if (storage === null) return CONFORT_DE_PARTIDA
  try {
    return parseConfort(storage.getItem(clave))
  } catch {
    // Almacenamiento capado: el de partida, que es corto y flojo.
    return CONFORT_DE_PARTIDA
  }
}

/**
 * Guarda el confort, o lo olvida cuando vuelve a ser el de partida.
 *
 * @returns si quedó guardado. Un `false` no es un error: el navegador no guarda nada y la
 *   elección dura lo que dure la visita.
 */
export function guardarConfort(storage: Storage | null, clave: string, valor: Confort): boolean {
  if (storage === null) return false
  try {
    if (valor === CONFORT_DE_PARTIDA) storage.removeItem(clave)
    else storage.setItem(clave, valor)
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Las cifras
// ---------------------------------------------------------------------------

/**
 * Las cifras de las capas, con el golpe más fuerte y el confort entero. A CALIBRAR CON EL VISOR.
 *
 * - `vineta`: sube en `entrada` segundos y se apaga en `salida`, cayendo en curva (rápido al
 *   principio, suave al final: lo que queda no molesta). `maximo` es lo más que se oscurece, y
 *   `suelo` lo que pesa el golpe más flojo, para que un golpe pequeño también se vea. `lado` es
 *   cuánto se inclina hacia el lado del golpe: con 0 sería un anillo igual por todos lados.
 * - `sacudida`: `amplitud` en metros —centímetro y medio, el golpe más fuerte—, `hercios` de la
 *   oscilación, `amortiguacion` en segundos (la envolvente cae a un tercio en ese tiempo) y
 *   `dura`, después de lo cual el decorado está **exactamente** donde estaba.
 * - `lenta`: el reloj del juego baja a `escala` durante `quieta` segundos y vuelve a 1 en
 *   `vuelta`. El techo de un parón de golpe son unos diez fotogramas (el de Street Fighter II);
 *   esto no llega ni a la mitad del reloj parado.
 * - `filtro`: el corte baja a `corte` hercios, se queda `quieto` segundos y vuelve a `abierto` en
 *   `vuelta`, subiendo en escala logarítmica, que es como el oído oye las frecuencias.
 */
export const GOLPE = {
  vineta: { entrada: 0.06, salida: 0.9, maximo: 0.9, suelo: 0.45, lado: 1 },
  sacudida: { amplitud: 0.015, hercios: 11, amortiguacion: 0.1, dura: 0.4 },
  lenta: { escala: 0.3, quieta: 0.08, vuelta: 0.25 },
  filtro: { corte: 500, abierto: 20000, quieto: 0.1, vuelta: 0.5 },
} as const

/** Lo que tarda en apagarse la capa más larga: pasado esto, el golpe ya no existe. */
export const DURACION_DEL_GOLPE = Math.max(
  GOLPE.vineta.entrada + GOLPE.vineta.salida,
  GOLPE.sacudida.dura,
  GOLPE.lenta.quieta + GOLPE.lenta.vuelta,
  GOLPE.filtro.quieto + GOLPE.filtro.vuelta,
)

/** Cuántos golpes se siguen a la vez: más seguidos que esto ya no se distinguen uno de otro. */
export const GOLPES_A_LA_VEZ = 4

// ---------------------------------------------------------------------------
// De la fuerza a las capas
// ---------------------------------------------------------------------------

/**
 * Cuánto pesa cada capa en un golpe, de 0 a 1. `haptico` es la fuerza que se le pasa a la receta
 * común, o `null` si no vibra.
 */
export interface Capas {
  readonly vineta: number
  readonly sacudida: number
  readonly lenta: number
  readonly filtro: number
  readonly haptico: number | null
}

/** Un golpe que no hace nada: el del confort apagado. */
export const SIN_CAPAS: Capas = { vineta: 0, sacudida: 0, lenta: 0, filtro: 0, haptico: null }

const acotar = (x: number) => Math.min(1, Math.max(0, x))

/**
 * Las capas de un golpe de esa fuerza (0–1) con ese confort y, si lo pide el sistema, con el
 * movimiento reducido.
 *
 * La fuerza escala la sacudida, la cámara lenta y el filtro enteros —un roce no frena el mundo—,
 * pero la viñeta parte de un suelo: el golpe más flojo también tiene que verse. El háptico lleva
 * la fuerza tal cual y no el confort, porque su receta ya tiene su propio mínimo y máximo; el
 * confort solo decide si vibra.
 */
export function capasDelGolpe(fuerza: number, confort: Confort, reducido = false): Capas {
  const factor = FACTOR_DEL_CONFORT[confort]
  if (factor === 0) return SIN_CAPAS
  const f = acotar(fuerza)
  const v = GOLPE.vineta
  const vineta = (v.suelo + (1 - v.suelo) * f) * v.maximo
  return {
    // Con el movimiento reducido, la viñeta nunca pasa de la suave.
    vineta: vineta * (reducido ? Math.min(factor, FACTOR_DEL_CONFORT.gentle) : factor),
    sacudida: reducido ? 0 : f * factor,
    lenta: reducido ? 0 : f * factor,
    filtro: f * factor,
    haptico: f,
  }
}

/** Los pulsos del golpe: la receta común, en las dos manos. Ninguno si no vibra. */
export function pulsosDelGolpe(capas: Capas): Pulso[] {
  return capas.haptico === null ? [] : pulsosDe({ tipo: 'golpeRecibido', fuerza: capas.haptico })
}

// ---------------------------------------------------------------------------
// Las curvas en el tiempo
// ---------------------------------------------------------------------------

/** La forma de la viñeta con esa edad en segundos, de 0 a 1: sube recta y cae en curva. */
export function formaDeLaVineta(edad: number): number {
  const { entrada, salida } = GOLPE.vineta
  if (edad < 0 || edad >= entrada + salida) return 0
  if (edad < entrada) return edad / entrada
  const k = (edad - entrada) / salida
  return (1 - k) * (1 - k)
}

/** Cuánto oscurece la viñeta de esas capas con esa edad, de 0 a 1. */
export function vinetaEn(capas: Capas, edad: number): number {
  return capas.vineta * formaDeLaVineta(edad)
}

/**
 * La forma de la sacudida con esa edad, de −1 a 1: una oscilación que se apaga.
 *
 * La envolvente es la de un muelle amortiguado **por una rampa que llega a cero** en `dura`: sin
 * la rampa, la exponencial nunca acaba, y el decorado se quedaría para siempre a una fracción de
 * milímetro de su sitio. Empieza en cero —el seno— para que el primer fotograma no salte.
 */
export function formaDeLaSacudida(edad: number): number {
  const { hercios, amortiguacion, dura } = GOLPE.sacudida
  if (edad <= 0 || edad >= dura) return 0
  return Math.exp(-edad / amortiguacion) * (1 - edad / dura) * Math.sin(2 * Math.PI * hercios * edad)
}

/**
 * Dónde está el decorado con esa edad, en metros desde su sitio: a lo largo de `direccion`, que
 * es **hacia donde viene el golpe**. Al recibir un empujón uno retrocede, así que el mundo, visto
 * desde quien juega, se va hacia allí y vuelve.
 */
export function sacudidaEn(capas: Capas, direccion: Punto3, edad: number): Punto3 {
  const m = capas.sacudida * GOLPE.sacudida.amplitud * formaDeLaSacudida(edad)
  return { x: direccion.x * m, y: direccion.y * m, z: direccion.z * m }
}

/** Lo que va de 0 a 1 en suave: la vuelta de la cámara lenta y del filtro no dan tirón. */
function suave(k: number): number {
  const t = acotar(k)
  return t * t * (3 - 2 * t)
}

/** Cuánto frena el golpe con esa edad, de 0 (nada) a 1 (lo más): se queda y vuelve en suave. */
function frenoEn(edad: number, quieta: number, vuelta: number): number {
  if (edad < 0 || edad >= quieta + vuelta) return 0
  if (edad < quieta) return 1
  return 1 - suave((edad - quieta) / vuelta)
}

/** A qué ritmo corre el reloj del juego con esa edad: 1 es el normal y nunca baja de `escala`. */
export function escalaDelRelojEn(capas: Capas, edad: number): number {
  const { escala, quieta, vuelta } = GOLPE.lenta
  return 1 - (1 - escala) * capas.lenta * frenoEn(edad, quieta, vuelta)
}

/**
 * El corte del paso bajo con esa edad, en hercios. Abierto del todo es `abierto`, que ya no
 * quita nada que se oiga.
 */
export function corteEn(capas: Capas, edad: number): number {
  const { corte, abierto, quieto, vuelta } = GOLPE.filtro
  const k = capas.filtro * frenoEn(edad, quieto, vuelta)
  return abierto * Math.pow(corte / abierto, k)
}

// ---------------------------------------------------------------------------
// De dónde viene, en la vista
// ---------------------------------------------------------------------------

/**
 * El lado de la vista por el que llega un golpe, a partir de su dirección **en el espacio de la
 * cabeza** (la cámara mira a −Z, con X a la derecha e Y arriba).
 *
 * Es lo que tiene de lateral: un golpe de frente da `(0, 0)` y la viñeta sale igual por todos
 * los bordes; uno que llega por la izquierda, `(−1, 0)`, y oscurece más la izquierda. Uno por la
 * espalda también da su lado —el que tenga—, porque la vista no tiene borde de atrás.
 */
export function ladoEnLaVista(direccionEnLaCabeza: Punto3): Lado {
  const { x, y, z } = direccionEnLaCabeza
  const largo = Math.hypot(x, y, z)
  if (largo < 1e-9) return { x: 0, y: 0 }
  return { x: x / largo, y: y / largo }
}

/** Una dirección de largo 1, o hacia abajo si no tiene ninguna: el golpe sordo, sin lado. */
export function unitaria(d: Punto3 | null | undefined): Punto3 {
  const largo = d == null ? 0 : Math.hypot(d.x, d.y, d.z)
  if (d == null || largo < 1e-9) return { x: 0, y: -1, z: 0 }
  return { x: d.x / largo, y: d.y / largo, z: d.z / largo }
}

// ---------------------------------------------------------------------------
// Varios golpes a la vez
// ---------------------------------------------------------------------------

/** Un golpe en marcha: cuándo fue, cuánto pesa cada capa, hacia dónde y por qué lado se ve. */
export interface Golpe {
  readonly inicio: number
  readonly capas: Capas
  /** Hacia donde viene, de largo 1, en el espacio donde se sacude el decorado. */
  readonly direccion: Punto3
  readonly lado: Lado
}

/** Lo que hay que pintar, mover y oír en un instante. */
export interface EstadoDelGolpe {
  readonly vineta: number
  readonly lado: Lado
  readonly sacudida: Punto3
  readonly escala: number
  readonly corte: number
  /** Los golpes que siguen vivos: los demás ya no aportan nada y se olvidan. */
  readonly vivos: readonly Golpe[]
}

/** Nada que pintar: el estado de reposo, al que todo vuelve. */
export const EN_REPOSO: EstadoDelGolpe = {
  vineta: 0,
  lado: { x: 0, y: 0 },
  sacudida: { x: 0, y: 0, z: 0 },
  escala: 1,
  corte: GOLPE.filtro.abierto,
  vivos: [],
}

/** Añade un golpe a los que hay, olvidando los más viejos si ya son demasiados. */
export function sumarGolpe(golpes: readonly Golpe[], golpe: Golpe): Golpe[] {
  return [...golpes, golpe].slice(-GOLPES_A_LA_VEZ)
}

/**
 * Todos los golpes vivos juntos, en ese instante (segundos, con el mismo reloj que `inicio`).
 *
 * **Cada capa se junta a su manera**: la viñeta, la más oscura —dos viñetas sumadas taparían el
 * centro—, con el lado de esa; las sacudidas se suman, que es lo que hacen dos empujones; y el
 * reloj y el filtro, el más frenado y el más cerrado. Así un golpe encima de otro nunca da un
 * salto: cada capa sigue desde donde estaba.
 */
export function estadoDelGolpe(golpes: readonly Golpe[], ahora: number): EstadoDelGolpe {
  const vivos = golpes.filter((g) => ahora - g.inicio < DURACION_DEL_GOLPE)
  if (vivos.length === 0) return EN_REPOSO
  let vineta = 0
  let lado: Lado = EN_REPOSO.lado
  let sx = 0
  let sy = 0
  let sz = 0
  let escala = 1
  let corte: number = GOLPE.filtro.abierto
  for (const g of vivos) {
    const edad = ahora - g.inicio
    const v = vinetaEn(g.capas, edad)
    if (v > vineta) {
      vineta = v
      lado = g.lado
    }
    const s = sacudidaEn(g.capas, g.direccion, edad)
    sx += s.x
    sy += s.y
    sz += s.z
    escala = Math.min(escala, escalaDelRelojEn(g.capas, edad))
    corte = Math.min(corte, corteEn(g.capas, edad))
  }
  return { vineta, lado, sacudida: { x: sx, y: sy, z: sz }, escala, corte, vivos }
}
