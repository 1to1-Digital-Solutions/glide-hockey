/**
 * Números para el visor, dibujados con segmentos.
 *
 * **Por qué no `<Text>`.** El componente de drei descarga las fuentes de un CDN
 * y el juego tiene que funcionar en un visor sin salida a internet — además, la
 * política de seguridad del salón de xrcade lo bloquea (ver `docs/xrcade.md`).
 * Auto-hospedar una fuente serían decenas de kilobytes y un fichero más que
 * copiar para pintar diez símbolos.
 *
 * Un display de siete segmentos, en cambio, son siete rectángulos: cabe en una
 * tabla, no pesa nada y se lee de lejos, que es lo que hace falta para un
 * marcador colgado al otro extremo de la mesa.
 *
 * La tabla es lógica pura y por eso vive aquí: `XRNumber` solo pinta los
 * rectángulos que esta función le diga.
 */

/**
 * Los siete segmentos, por su nombre de siempre:
 *
 * ```
 *  --a--
 * |     |
 * f     b
 * |     |
 *  --g--
 * |     |
 * e     c
 * |     |
 *  --d--
 * ```
 */
export type Segment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g'

/** Qué segmentos se encienden en cada cifra. */
export const DIGIT_SEGMENTS: readonly Segment[][] = [
  ['a', 'b', 'c', 'd', 'e', 'f'], // 0
  ['b', 'c'], // 1
  ['a', 'b', 'g', 'e', 'd'], // 2
  ['a', 'b', 'g', 'c', 'd'], // 3
  ['f', 'g', 'b', 'c'], // 4
  ['a', 'f', 'g', 'c', 'd'], // 5
  ['a', 'f', 'g', 'e', 'c', 'd'], // 6
  ['a', 'b', 'c'], // 7
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'], // 8
  ['a', 'b', 'c', 'd', 'f', 'g'], // 9
]

/**
 * Las cifras de un número, de la más significativa a la menos.
 *
 * Solo enteros no negativos: en el visor no se enseña nada más —goles, puntos,
 * rondas— y un display de siete segmentos no tiene con qué dibujar un signo ni
 * una coma. Lo que llegue raro se cuenta como cero, que es preferible a dejar
 * el marcador en blanco sin explicación.
 */
export function digitsOf(value: number): number[] {
  if (!Number.isFinite(value) || value <= 0) return [0]
  return String(Math.floor(value)).split('').map(Number)
}

/**
 * Dónde va cada segmento dentro de su cifra y cuánto mide, en fracciones de la
 * altura del dígito.
 *
 * En fracciones y no en metros para que un solo número —el tamaño que le pase
 * quien lo pinta— escale el conjunto entero sin descuadrarlo.
 */
export const SEGMENT_THICKNESS = 0.14

/** Posición (x, y) y si el segmento va tumbado, en fracciones de la altura. */
export const SEGMENT_LAYOUT: Record<
  Segment,
  { x: number; y: number; horizontal: boolean }
> = {
  a: { x: 0, y: 0.5, horizontal: true },
  b: { x: 0.25, y: 0.25, horizontal: false },
  c: { x: 0.25, y: -0.25, horizontal: false },
  d: { x: 0, y: -0.5, horizontal: true },
  e: { x: -0.25, y: -0.25, horizontal: false },
  f: { x: -0.25, y: 0.25, horizontal: false },
  g: { x: 0, y: 0, horizontal: true },
}

/** Ancho de una cifra respecto a su altura, ya contando la separación. */
export const DIGIT_ADVANCE = 0.68
