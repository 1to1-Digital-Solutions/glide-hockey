import { DIFFICULTY_ORDER, type Difficulty } from './gameConfig'

/**
 * La escalera del modo reto: qué toca en cada ronda.
 *
 * El reto sube por dos escalones distintos, y en este orden:
 *
 * 1. **Dentro de una dificultad, partidas más largas.** La máquina juega igual
 *    de bien, pero hay que ganarle más veces seguidas: lo que se pone a prueba
 *    es aguantar sin regalar goles.
 * 2. **Agotadas las duraciones, más nivel.** Se sube de dificultad y se vuelve
 *    a la partida corta, que es como se entra en un nivel nuevo sin que el
 *    primer disco te pille de golpe.
 *
 * Ese orden importa: al revés —subir el nivel cada ronda y alargar después— el
 * jugador llegaría a Imposible en cinco rondas y el reto se acabaría antes de
 * empezar.
 *
 * **Pasada la ronda quince la escalera vuelve a empezar, y eso es una vuelta.**
 * Antes se quedaba clavada en el último escalón: quien llegaba ahí seguía jugando
 * la misma partida contra Imposible una y otra vez, ganando exactamente los
 * mismos puntos, y el reto dejaba de subir sin acabarse nunca. Ahora cada vuelta
 * **multiplica lo que valen los goles** (`lapMultiplier`), así que lo que decide
 * una marca ya no es aguantar quince rondas: es cuántas vueltas se dan. Y la
 * segunda vuelta empieza otra vez abajo a propósito —es la vuelta de honor—:
 * desde Imposible a siete goles no hay escalón más alto al que subir, y lo único
 * que quedaría sería repetirlo.
 */

/** Goles de cada partida dentro de una misma dificultad, de menos a más. */
export const CHALLENGE_GOAL_STEPS = [3, 5, 7] as const

/** Rondas que tiene una vuelta entera a la escalera. */
export const CHALLENGE_ROUNDS =
  DIFFICULTY_ORDER.length * CHALLENGE_GOAL_STEPS.length

/**
 * Cuánto suma cada vuelta al multiplicador de los goles.
 *
 * Media vuelta más por cada una: la segunda vale vez y media, la tercera el
 * doble. Se sube de medio en medio y no al doble por vuelta porque el
 * multiplicador se junta con el de dificultad (×5 en Imposible) y el de racha
 * (×2,5 como mucho), y duplicando, la cuarta vuelta valdría ocho veces la
 * primera: la marca dejaría de medir cómo se juega y pasaría a medir cuánto rato.
 */
export const LAP_STEP = 0.5

/** Lo que se juega en una ronda del reto. */
export interface ChallengeRound {
  /** Número de ronda, 1-based: es lo que se le enseña al jugador. */
  round: number
  difficulty: Difficulty
  goalTarget: number
  /**
   * Por qué vuelta a la escalera va, 1-based. La primera vuelta es la 1, y de la
   * ronda dieciséis en adelante, la 2.
   */
  lap: number
  /** Lo que multiplican los goles de esta ronda por la vuelta en la que caen. */
  multiplier: number
}

/**
 * Lo que multiplican los goles en la vuelta `lap` (1-based). La primera no
 * multiplica nada: es el reto tal y como estaba.
 */
export function lapMultiplier(lap: number): number {
  const vuelta = Number.isFinite(lap) ? Math.max(1, Math.floor(lap)) : 1
  return 1 + (vuelta - 1) * LAP_STEP
}

/**
 * Qué toca en la ronda `round` (1-based).
 *
 * Las rondas por debajo de 1 se tratan como la primera: un reto siempre empieza
 * por el escalón de abajo, y devolver algo raro aquí saldría por la escena como
 * una partida a cero goles que termina sola.
 */
export function challengeRound(round: number): ChallengeRound {
  const safeRound = Number.isFinite(round) ? Math.max(1, Math.floor(round)) : 1
  // Pasada la escalera se vuelve a empezar por abajo, y se apunta la vuelta.
  const index = (safeRound - 1) % CHALLENGE_ROUNDS
  const lap = Math.floor((safeRound - 1) / CHALLENGE_ROUNDS) + 1
  const steps = CHALLENGE_GOAL_STEPS.length

  return {
    round: safeRound,
    difficulty: DIFFICULTY_ORDER[Math.floor(index / steps)],
    goalTarget: CHALLENGE_GOAL_STEPS[index % steps],
    lap,
    multiplier: lapMultiplier(lap),
  }
}
