import { type Vec2 } from './puckPhysics'

/**
 * Lo que está pasando en la mesa, para quien mire desde fuera del Canvas.
 *
 * El disco y los mazos son objetos de three: desde el DOM no hay forma de
 * seleccionarlos, ni de saber dónde están, ni de saber si se han tocado. Un
 * test de navegador que quiera comprobar que el ratón mueve el mazo solo podría
 * mirar el marcador y esperar a que caiga un gol, que depende de la puntería y
 * de la máquina en la que corra.
 *
 * Esto lo evita publicando el estado de la partida, pero **solo si alguien lo
 * ha pedido**: la escena escribe en `window.__glideHockeyScene` si esa propiedad
 * ya existe, y si no existe no hace nada. Ningún navegador la trae de serie,
 * así que quien no la cree —o sea, todo el mundo menos los tests— paga una
 * comprobación por fotograma y nada más.
 */

/** Punto de la página, en las mismas coordenadas que trae un evento de puntero. */
export interface ScreenPoint {
  x: number
  y: number
}

/** Lo que ocupa el canvas dentro de la página. */
export interface CanvasRect {
  left: number
  top: number
  width: number
  height: number
}

/** La foto de la mesa que se publica en cada fotograma. */
export interface SceneProbe {
  /** El mazo del jugador, en coordenadas de la mesa. */
  playerMallet: Vec2
  /** El disco, en coordenadas de la mesa. */
  puck: Vec2
  /**
   * Dónde se ve el disco, en píxeles de la página: es a donde hay que llevar
   * el ratón para que el mazo vaya a por él.
   */
  puckScreen: ScreenPoint
  /** Golpes del mazo del jugador al disco desde que empezó la partida. */
  playerHits: number
  /**
   * Goles que ha metido la máquina **en la mesa** desde que se montó, cuenten o no en el
   * marcador: aprendiendo el reto no cuentan (`aprendiendo`), y así se ve que entraron igual.
   */
  goalsAgainst: number
}

declare global {
  interface Window {
    /**
     * La ranura de la que habla la cabecera. Opcional porque lo normal es que
     * no exista: solo la crea quien quiera mirar dentro de la escena.
     */
    __glideHockeyScene?: SceneProbe | null
  }
}

/**
 * Pasa de coordenadas normalizadas de three —el cuadrado de −1 a 1, con la Y
 * creciendo hacia arriba— al píxel de la página donde se ve ese punto.
 *
 * Es la inversa de lo que hace R3F al recibir un evento de puntero, así que
 * mover el ratón al punto devuelto vuelve a apuntar al mismo sitio de la mesa.
 */
export function screenPointFromNdc(
  ndcX: number,
  ndcY: number,
  rect: CanvasRect,
): ScreenPoint {
  return {
    x: rect.left + ((ndcX + 1) / 2) * rect.width,
    y: rect.top + ((1 - ndcY) / 2) * rect.height,
  }
}

/** ¿Alguien ha pedido ver lo que pasa en la mesa? */
export function isSceneProbeRequested(): boolean {
  return typeof window !== 'undefined' && '__glideHockeyScene' in window
}

/** Publica el estado de la mesa, si alguien lo ha pedido. */
export function publishSceneProbe(probe: SceneProbe): void {
  if (!isSceneProbeRequested()) return
  window.__glideHockeyScene = probe
}
