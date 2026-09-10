/**
 * El pellizco: cómo se agarra algo con la mano desnuda.
 *
 * **Seis de los trece juegos exigían un mando.** Leían `useXRInputSourceState('controller')`
 * y nada más, así que con las manos desnudas el objeto no aparecía nunca y encima no había
 * forma de explicar por qué —dentro del visor no se puede pintar texto—. Quien no tiene los
 * mandos a mano, o no puede sostenerlos, se quedaba fuera del juego entero.
 *
 * Un mando dice si está apretado con un botón; una mano no tiene botones, así que lo dice la
 * distancia entre la yema del pulgar y la del índice. Es el gesto que el propio visor usa
 * para «seleccionar», así que no hay nada nuevo que aprender.
 *
 * Aquí solo está el umbral, que es lo que se puede comprobar sin visor.
 */

/**
 * A qué distancia se da por cerrado el pellizco, en metros.
 *
 * Dos centímetros y medio: las yemas se tocan sobre el centímetro, y el margen deja que
 * cuente antes de llegar a tocarse del todo. Más ancho empezaría a contar la mano
 * simplemente relajada.
 */
export const PINCH_CLOSE = 0.025

/**
 * Y a cuál se da por abierto.
 *
 * Más lejos que el de cerrar a propósito: con un solo umbral, una mano temblando justo en él
 * abriría y cerraría varias veces por segundo, y el objeto se caería solo. Esto es la
 * histéresis de un interruptor, y es lo que hace que agarrar aguante el pulso.
 */
export const PINCH_OPEN = 0.04

/**
 * ¿Está la mano agarrando?
 *
 * @param distance  entre la yema del pulgar y la del índice, en metros, o `null` si el visor
 *   no da las articulaciones (es el caso de un mando, y el de un visor que no las publica)
 * @param wasPinching  si lo estaba en el fotograma anterior
 */
export function isPinching(distance: number | null, wasPinching: boolean): boolean {
  if (distance == null || !Number.isFinite(distance)) return false
  return wasPinching ? distance < PINCH_OPEN : distance < PINCH_CLOSE
}
