import { type GameMode } from './gameMode'
import { createStoredPreference } from './storage'

/**
 * La mejor puntuación, guardada entre visitas.
 *
 * Un entero por modo en `localStorage`, sin identificadores ni nada que
 * describa a quien juega: un récord que se borra al recargar no es un récord.
 *
 * **Un récord por modo** y no uno global: un reto se corta con la primera
 * partida perdida y una prueba la elige el jugador, así que las dos cifras no
 * miden lo mismo. Con una sola marca, uno de los dos modos no la batiría jamás.
 */

/** Clave del récord de cada modo, con prefijo para no chocar con nada más. */
export const HIGH_SCORE_KEYS: Record<GameMode, string> = {
  practice: 'air-hockey:best-points',
  levels: 'air-hockey:best-points:levels',
  challenge: 'air-hockey:best-points:challenge',
}

/**
 * La partida sin fin no tiene récord de puntos —crecen sin tope con el tiempo—,
 * así que su marca es la mejor racha de goles seguidos. Clave aparte para que
 * no se mezcle con la prueba normal, que sí mide el total.
 */
export const ENDLESS_STREAK_KEY = 'air-hockey:best-streak:endless'

/**
 * Interpreta lo leído del almacenamiento.
 *
 * Es entrada externa —cualquiera puede editarla desde las herramientas del
 * navegador—, así que solo se acepta un entero no negativo y exacto. Cualquier
 * otra cosa cuenta como «todavía no hay récord» en vez de propagar un `NaN` a
 * la puntuación.
 */
export function parseBestPoints(raw: string | null): number {
  if (raw == null || raw.trim() === '') return 0
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) return 0
  return value
}

const bestPoints = createStoredPreference<number, [GameMode]>({
  key: (mode) => HIGH_SCORE_KEYS[mode],
  parse: parseBestPoints,
  serialize: String,
})

export const {
  get: getBestPoints,
  getServer: getServerBestPoints,
  subscribe: subscribeBestPoints,
} = bestPoints

/**
 * Guarda la puntuación si mejora el récord de ese modo, y avisa a quien lo esté
 * mirando. Lo que la lectura fuera a descartar no llega a escribirse, para no
 * dejar en el navegador algo que ya no cuenta como récord.
 */
export function saveBestPoints(mode: GameMode, points: number): void {
  if (!Number.isSafeInteger(points) || points <= getBestPoints(mode)) return
  bestPoints.save(points, mode)
}

const endlessStreak = createStoredPreference<number>({
  key: ENDLESS_STREAK_KEY,
  parse: parseBestPoints,
  serialize: String,
})

export const {
  get: getBestEndlessStreak,
  getServer: getServerBestEndlessStreak,
  subscribe: subscribeBestEndlessStreak,
} = endlessStreak

/** Guarda la racha de una partida sin fin si mejora la marca. */
export function saveBestEndlessStreak(streak: number): void {
  if (!Number.isSafeInteger(streak) || streak <= getBestEndlessStreak()) return
  endlessStreak.save(streak)
}
