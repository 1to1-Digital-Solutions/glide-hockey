/**
 * Cuándo cuenta la pulsación de un botón del visor.
 *
 * El problema: en sesión inmersiva un mismo botón recibe más de un puntero. Los
 * dos mandos pueden cruzarse encima y un agarre suele registrar dos punteros
 * casi a la vez. Sin filtro, los botones que suman o restan —los goles del
 * menú— se accionarían dos veces por pulsación.
 *
 * La regla: una pulsación cuenta si ha pasado la ventana desde la anterior que
 * contó. Y si no hay reloj del que fiarse, cuenta igual: ante la duda un botón
 * responde, nunca se calla — un menú entero que no reacciona no deja ni rastro
 * en consola que lo explique.
 *
 * Es lógica pura para poder probarla sin visor: `XRPressable` solo pinta y
 * llama a lo que esto decida.
 */

/** Ventana, en milisegundos, durante la que se ignora una segunda pulsación. */
export const PRESS_DEBOUNCE_MS = 300

/**
 * Cuándo se ha pulsado, en milisegundos, o `null` si no hay reloj disponible.
 *
 * `performance` está en cualquier navegador; el respaldo es para los entornos
 * donde el juego se monta sin él (una prueba, un renderizado en servidor) y
 * existe para no romper, no para bloquear.
 */
export function pressTime(): number | null {
  return typeof performance !== 'undefined' ? performance.now() : null
}

/**
 * ¿Esta pulsación cuenta?
 *
 * @param now cuándo se ha pulsado, o `null` si no se sabe
 * @param lastPress cuándo contó la anterior, o `null` si no ha habido ninguna
 * @param disabled si el botón está apagado
 */
export function pressCounts(
  now: number | null,
  lastPress: number | null,
  disabled = false,
): boolean {
  if (disabled) return false
  if (now == null || lastPress == null) return true
  return now - lastPress >= PRESS_DEBOUNCE_MS
}
