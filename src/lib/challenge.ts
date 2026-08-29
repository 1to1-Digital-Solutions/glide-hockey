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
 * Pasada la última ronda de la escalera no hay nada más que subir, así que se
 * repite: quien llega ahí está jugando por puntos.
 */

/** Goles de cada partida dentro de una misma dificultad, de menos a más. */
export const CHALLENGE_GOAL_STEPS = [3, 5, 7] as const

/** Rondas de la escalera antes de quedarse en el último escalón. */
export const CHALLENGE_ROUNDS =
  DIFFICULTY_ORDER.length * CHALLENGE_GOAL_STEPS.length

/** Lo que se juega en una ronda del reto. */
export interface ChallengeRound {
  /** Número de ronda, 1-based: es lo que se le enseña al jugador. */
  round: number
  difficulty: Difficulty
  goalTarget: number
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
  // Pasada la escalera se repite el último escalón: no hay ronda 16.
  const index = Math.min(safeRound, CHALLENGE_ROUNDS) - 1
  const steps = CHALLENGE_GOAL_STEPS.length

  return {
    round: safeRound,
    difficulty: DIFFICULTY_ORDER[Math.floor(index / steps)],
    goalTarget: CHALLENGE_GOAL_STEPS[index % steps],
  }
}
