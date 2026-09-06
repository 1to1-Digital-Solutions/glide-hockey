import { CHALLENGE_ROUNDS, challengeRound, type ChallengeRound } from './challenge'

/**
 * El modo Niveles: la escalera del reto, una partida cada vez.
 *
 * Cada nivel es una ronda de `challengeRound` —el mismo nivel de la máquina, los
 * mismos goles—, pero se juega suelta: ganarla da estrellas según lo que se
 * encaje, y con una basta para desbloquear el siguiente. El reto sigue siendo
 * el reto: del tirón y a la primera derrota. Esto es para volver otro día y
 * seguir donde se estaba.
 *
 * Todo son funciones puras: qué se guarda vive en `progress.ts`.
 */

/** Tantos niveles como escalones tiene la escalera del reto. */
export const LEVEL_COUNT = CHALLENGE_ROUNDS

export type Stars = 0 | 1 | 2 | 3

/** Recorta un nivel al rango que existe; lo raro cae al primero. */
export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1
  return Math.min(LEVEL_COUNT, Math.max(1, Math.floor(level)))
}

/** Lo que se juega en ese nivel: la ronda de la escalera con su número. */
export function levelSpec(level: number): ChallengeRound {
  return challengeRound(clampLevel(level))
}

/**
 * Las estrellas de una partida ganada, por lo que se encajó: ninguna si se
 * perdió; una por ganar; dos si la máquina metió menos de la mitad que tú;
 * tres si no metió ninguno.
 */
export function levelStars(won: boolean, playerGoals: number, opponentGoals: number): Stars {
  if (!won || playerGoals <= 0) return 0
  if (opponentGoals <= 0) return 3
  if (opponentGoals * 2 < playerGoals) return 2
  return 1
}

/** Superar es al menos una estrella. */
export function levelPassed(stars: Stars): boolean {
  return stars >= 1
}

/**
 * Hasta qué nivel se puede jugar después de esta partida: el que ya estaba
 * desbloqueado, o el siguiente al superado si va más allá. No baja nunca.
 */
export function nextUnlocked(unlocked: number, level: number, stars: Stars): number {
  const actual = clampLevel(unlocked)
  if (!levelPassed(stars)) return actual
  return Math.max(actual, clampLevel(level + 1))
}
