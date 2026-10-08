/**
 * La cuenta de «mantener pulsado para salir»: la misma que el salón (`xrcade/src/lib/salon/holdToExit.ts`
 * y, en Godot, `godot/scripts/hold_to_exit.gd` y el kit), un segundo sostenido. Montado en el salón
 * la lleva el salón; en la web propia del juego, `components/xr/AroDeSalir.tsx`.
 *
 * Es larga a propósito: un toque suelto se da sin querer —al agarrar, al apoyar la mano— y sacar a
 * alguien de la partida por eso sería peor que no ofrecer salida. Y se ve: mientras se sostiene, un
 * aro se llena delante de los ojos (`AroDeSalir.tsx`), que es lo que dice que se está haciendo bien.
 *
 * Sin `window`, sin React y sin three, para probarla sin navegador.
 */

/** Cuánto hay que sostener el botón, en segundos. */
export const HOLD_TO_EXIT_SECONDS = 1

/**
 * Los botones que, sostenidos, sacan del juego: el B y el Y de los mandos de Quest, los mismos
 * que en Godot (que además acepta el de menú, que el navegador del visor se queda). Ningún juego
 * los usa.
 */
export const EXIT_BUTTONS = ['b-button', 'y-button'] as const

export interface HoldToExit {
  /** Lo sostenido, en segundos. */
  readonly held: number
  /** Si ya se disparó: hasta soltar no vuelve a dispararse. */
  readonly fired: boolean
}

export const HOLD_IDLE: HoldToExit = { held: 0, fired: false }

/**
 * Un fotograma de la cuenta: con el botón sostenido o no, y lo que ha pasado. `exit` es `true`
 * exactamente en el fotograma en que se completa; después, aunque se siga apretando, no vuelve a
 * dispararse hasta soltar y volver a pulsar. `progress` va de 0 a 1, y es 0 al dispararse: el aro
 * se va cuando se sale.
 */
export function holdStep(
  state: HoldToExit,
  pressed: boolean,
  delta: number,
): { state: HoldToExit; progress: number; exit: boolean } {
  if (!pressed) return { state: HOLD_IDLE, progress: 0, exit: false }
  if (state.fired) return { state, progress: 0, exit: false }
  const held = state.held + Math.max(0, Number.isFinite(delta) ? delta : 0)
  if (held < HOLD_TO_EXIT_SECONDS) return { state: { held, fired: false }, progress: held / HOLD_TO_EXIT_SECONDS, exit: false }
  return { state: { held, fired: true }, progress: 0, exit: true }
}
