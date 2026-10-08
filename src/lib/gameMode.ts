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
 * - **Duelo**: dos jugadores, por turnos con un mando. Cada uno juega una partida contra la
 *   misma máquina —mismo nivel, mismos goles, misma semilla— y gana quien le saque más ventaja
 *   (`duel.ts` explica por qué así).
 *
 * Todo son funciones puras sobre marcadores: el estado vive en `gameStore` y la
 * interfaz solo lo pinta, igual que con la puntuación.
 */

import { conElRetoPrimero } from './plantillaDelMenu'

export type GameMode = 'practice' | 'levels' | 'challenge' | 'duel'

/**
 * Orden de los modos en los selectores: los de uno solo, del más suave al más exigente, y al
 * final el de dos, que es otra forma de jugar y no un escalón más.
 */
export const GAME_MODE_ORDER: GameMode[] = ['practice', 'levels', 'challenge', 'duel']

/**
 * Los modos en la fila «Modo» de los dos menús, con el reto —el que da medalla— el primero, como
 * pide la plantilla común (`conElRetoPrimero` de `plantillaDelMenu.ts`); los demás, en su orden.
 */
export const MODOS_DEL_MENU: readonly GameMode[] = conElRetoPrimero(GAME_MODE_ORDER, (modo) => modo === 'challenge')

/** Etiqueta visible, en inglés: es la clave con la que se traduce (ver `textos.ts`). */
export const GAME_MODE_LABELS = {
  practice: 'Practice',
  levels: 'Levels',
  challenge: 'Challenge',
  duel: 'Duel',
} as const satisfies Record<GameMode, string>

/** Qué promete cada modo, en una línea, para el menú. */
export const GAME_MODE_HINTS = {
  practice: 'You choose the level and the goals. Losing costs nothing.',
  levels: 'One game at a time. The level you win stays unlocked for next time.',
  challenge: 'It steps up on its own, in one run. The first game you lose ends it.',
  duel: 'Take turns with one controller against the same machine: whoever beats it by more wins.',
} as const satisfies Record<GameMode, string>

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
