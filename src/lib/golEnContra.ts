import type { Punto3 } from './golpeRecibido'
import { HALF_LENGTH } from './puckPhysics'

/**
 * El gol en contra, visto como un golpe que recibe el cuerpo (`lib/golpeRecibido.ts`).
 *
 * **Aquí el disco no puede dar a quien juega**: la mesa es un plano con bandas y la física es
 * de dos dimensiones (`puckPhysics.ts`), así que nada sale volando hacia el cuerpo. Lo más
 * parecido a «me han dado» es que te metan un gol, y ese es el suceso que dispara la macro. Con
 * **poca fuerza**, porque nadie te ha tocado: es un aviso de que la jugada se ha perdido, no un
 * empujón. A CALIBRAR CON EL VISOR.
 */
export const FUERZA_DEL_GOL_EN_CONTRA = 0.3

/**
 * Hacia dónde viene el golpe, desde la cabeza: hacia la portería propia, donde ha entrado el
 * disco. En coordenadas de la mesa, con su centro en el origen y la portería de quien juega en
 * `+Z`; como la mesa solo está desplazada respecto del mundo del juego, sin girar, la dirección
 * vale igual en el espacio del mundo del juego, que es donde se monta `GolpeRecibido`.
 *
 * @param cabeza dónde están los ojos, en coordenadas de la mesa.
 */
export function direccionDelGolEnContra(cabeza: Punto3): Punto3 {
  return { x: -cabeza.x, y: -cabeza.y, z: HALF_LENGTH - cabeza.z }
}
