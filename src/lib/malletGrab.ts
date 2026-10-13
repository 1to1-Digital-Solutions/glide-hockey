/**
 * Coger el mazo con la mano, con el visor puesto.
 *
 * **Por qué no vale el rayo.** El mazo se movía apuntándole con el rayo del mando, y eso
 * se siente como manejar un cursor: la mano está quieta en el aire y la ficha se desliza
 * sola dos metros más allá. En una mesa de air hockey lo que se hace es **agarrar** el
 * mazo y empujarlo, que es lo que hace el palo de stick-rush y por eso aquel se entiende
 * sin explicación.
 *
 * La regla vive aquí y no en la escena para poder probarla sin visor y sin three: lo que
 * decide es cuándo se coge, cuándo se suelta y a dónde va el mazo mientras se sostiene,
 * que es donde están los errores que se sienten al jugar.
 *
 * **Se coge por proximidad, no por apuntar.** Hay que llevar la mano hasta el mazo y
 * apretar; apretar desde lejos no lo teletransporta a la mano, que es lo que volvería a
 * convertirlo en un cursor. Y una vez cogido no se suelta por alejarse: solo al soltar el
 * botón, porque en pleno intercambio la mano se sale de cualquier radio que se ponga.
 */

import type { Vec2 } from './puckPhysics'
import { MALLET_RADIUS } from './gameConfig'

/**
 * Hasta dónde llega la mano para coger el mazo, en metros desde su centro.
 *
 * Un poco más que el propio mazo: con el visor puesto la mano nunca cae exactamente
 * encima, y exigir precisión de milímetros convierte cogerlo en un minijuego aparte.
 */
export const GRAB_REACH = MALLET_RADIUS + 0.12

/** Lo que la mano y el botón dicen en este fotograma. */
export interface HandOnTable {
  /** Dónde está la mano, en coordenadas de la mesa. */
  position: Vec2
  /** Si el botón de agarre está apretado ahora mismo. */
  grabbing: boolean
}

/** Lo que el mazo sabe de sí mismo entre fotogramas. */
export interface MalletGrab {
  /** Si el mazo va en la mano ahora mismo. */
  held: boolean
  /** A dónde va el mazo. Sin mano que lo lleve, se queda donde estaba. */
  target: Vec2
}

/** A qué distancia está la mano del mazo. */
function distancia(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/**
 * El agarre del fotograma siguiente.
 *
 * @param previo    Cómo estaba el mazo hasta ahora.
 * @param mano      Lo que dice la mano, o `null` si no hay ninguna en la mesa: sin mando,
 *                  fuera de sesión, o con el mando apuntando a otra parte.
 */
export function nextGrab(previo: MalletGrab, mano: HandOnTable | null): MalletGrab {
  // Sin mano no se suelta lo que se llevaba: un mando que desaparece un fotograma —se
  // pierde el seguimiento al salir del campo de visión— dejaría el mazo tirado en medio
  // de una jugada.
  if (mano === null) return previo

  if (!mano.grabbing) return { held: false, target: previo.target }

  // Ya cogido, sigue a la mano vaya donde vaya: soltar por distancia lo perdería justo
  // en el golpe, que es cuando más rápido va.
  if (previo.held) return { held: true, target: mano.position }

  // Recién apretado: solo se coge si la mano está encima. Apretar desde lejos no hace nada.
  const alAlcance = distancia(mano.position, previo.target) <= GRAB_REACH
  return alAlcance ? { held: true, target: mano.position } : { held: false, target: previo.target }
}
