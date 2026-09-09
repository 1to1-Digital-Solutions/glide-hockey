/**
 * Con qué intención se juega una partida.
 *
 * - **Prueba**: se elige la dificultad y a cuántos goles se juega, y la partida
 *   acaba cuando alguien llega. Perder no cuesta nada. Es para calibrar el pulso
 *   o probar un nivel nuevo.
 * - **Niveles**: la misma escalera del reto, pero una partida cada vez: cada
 *   nivel es una ronda de `challengeRound`, ganarla da estrellas según lo que
 *   se encaje (`levels.ts`) y desbloquea el siguiente. Lo desbloqueado se
 *   recuerda entre visitas (`progress.ts`): no hay que volver a empezar por lo
 *   fácil.
 * - **Reto**: se empieza por lo más fácil y la máquina va apretando sola —más
 *   goles por partida y, después, más nivel (ver `challenge.ts`)—. Cada partida
 *   ganada encadena la siguiente y la primera perdida cierra el reto. No tiene
 *   final: se aguanta lo que se aguante, y de ahí sale la puntuación. Es el
 *   modo heroico: del tirón, sin puntos de control.
 *
 * Todo son funciones puras sobre marcadores: el estado vive en `gameStore` y la
 * interfaz solo lo pinta, igual que con la puntuación.
 */

export type GameMode = 'practice' | 'levels' | 'challenge'

/** Orden de los modos en los selectores, del más suave al más exigente. */
export const GAME_MODE_ORDER: GameMode[] = ['practice', 'levels', 'challenge']

/** Etiqueta visible para el usuario (idioma del producto: español). */
export const GAME_MODE_LABELS: Record<GameMode, string> = {
  practice: 'Practice',
  levels: 'Levels',
  challenge: 'Challenge',
}

/** Qué promete cada modo, en una línea, para el menú. */
export const GAME_MODE_HINTS: Record<GameMode, string> = {
  practice: 'You choose the level and the goals. Losing costs nothing.',
  levels: 'One game at a time. The level you win stays unlocked for next time.',
  challenge: 'It steps up on its own, in one run. The first game you lose ends it.',
}

/**
 * La partida sin fin de la prueba: no se juega a ningún número de goles, sigue
 * hasta que el jugador la termina. Se representa como una partida a infinitos
 * goles, que es exactamente lo que es: `runOutcome` no la cierra nunca. Los
 * puntos crecen sin tope, así que su récord es la mejor racha.
 */
export const ENDLESS = Number.POSITIVE_INFINITY

export function isEndless(goalTarget: number): boolean {
  return !Number.isFinite(goalTarget)
}

/**
 * Cómo ha acabado una partida.
 *
 * - `won`: el jugador llegó antes a los goles pactados. En reto es haber
 *   superado la ronda y seguir.
 * - `lost`: llegó antes la máquina.
 */
export type RunOutcome = 'won' | 'lost'

/** Lo que hay que saber de una partida para decidir si sigue viva. */
export interface RunProgress {
  /** Goles del jugador en la partida en curso. */
  playerGoals: number
  /** Goles de la máquina en la partida en curso. */
  opponentGoals: number
  /** A cuántos goles se juega esta partida. */
  goalTarget: number
}

/**
 * Cómo ha acabado la partida, o `null` si sigue en marcha.
 *
 * Los dos marcadores se comprueban, y el del jugador manda en un empate
 * imposible: no hay forma de que los dos lleguen a la vez —el disco se para al
 * entrar—, pero un desenlace que dependa del orden de dos `if` es una trampa
 * esperando a un cambio en la simulación.
 */
export function runOutcome({
  playerGoals,
  opponentGoals,
  goalTarget,
}: RunProgress): RunOutcome | null {
  if (playerGoals >= goalTarget) return 'won'
  if (opponentGoals >= goalTarget) return 'lost'
  return null
}
