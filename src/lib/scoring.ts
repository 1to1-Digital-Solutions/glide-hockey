import { type Difficulty } from './gameConfig'

/**
 * Puntuación de una partida.
 *
 * La regla del juego es simple —**cada gol que metes suma y cada gol que te
 * meten resta**— y aquí solo se decide cuánto. Dos cosas la modulan, y las dos
 * premian jugar mejor y no solo jugar más:
 *
 * - **La dificultad**, porque marcarle a Imposible cuesta lo que no cuesta
 *   marcarle a Fácil. Multiplica lo que se gana; lo que se pierde es fijo, o
 *   subir de nivel castigaría el mismo error dos veces.
 * - **La racha**, porque encadenar goles sin encajar es más difícil que
 *   intercambiarlos. Un gol en contra la corta de golpe.
 *
 * La puntuación **no baja de cero**: es una marca que se compara con el récord,
 * y una negativa no dice nada que no diga el marcador.
 */

/** Puntos de un gol antes de aplicar ningún multiplicador. */
export const BASE_GOAL_POINTS = 100

/** Lo que descuenta un gol encajado, igual en todas las dificultades. */
export const CONCEDED_PENALTY = 60

/**
 * Cuánto multiplica cada dificultad. Crece más que proporcionalmente al margen
 * que quita: si fuera lineal, una partida larga en Fácil rendiría lo mismo que
 * una ajustada en Imposible y elegir nivel daría igual.
 */
const DIFFICULTY_MULTIPLIERS: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2.25,
  expert: 3.5,
  impossible: 5,
}

/** Cuánto suma cada gol encadenado a la racha. */
const STREAK_STEP = 0.2

/**
 * Tope del multiplicador de racha. Sin él, un reto largo en Fácil daría más que
 * uno impecable en Imposible solo por durar más.
 */
export const MAX_STREAK_MULTIPLIER = 2.5

/**
 * Multiplicador por racha. El primer gol va a 1 y cada uno encadenado suma,
 * hasta el tope.
 *
 * @param streak goles consecutivos sin encajar, **incluido** el actual
 */
export function streakMultiplier(streak: number): number {
  if (!Number.isFinite(streak) || streak <= 1) return 1
  return Math.min(1 + (streak - 1) * STREAK_STEP, MAX_STREAK_MULTIPLIER)
}

/** Puntos que suma un gol. Siempre entero: los decimales no le dicen nada al
 * jugador. */
export function goalPoints({
  difficulty,
  streak,
}: {
  difficulty: Difficulty
  streak: number
}): number {
  return Math.round(
    BASE_GOAL_POINTS *
      DIFFICULTY_MULTIPLIERS[difficulty] *
      streakMultiplier(streak),
  )
}

/** La puntuación tras marcar un gol. */
export function scoreGoal(
  points: number,
  options: { difficulty: Difficulty; streak: number },
): number {
  return points + goalPoints(options)
}

/** La puntuación tras encajar un gol, con el cero como suelo. */
export function scoreConceded(points: number): number {
  return Math.max(0, points - CONCEDED_PENALTY)
}
