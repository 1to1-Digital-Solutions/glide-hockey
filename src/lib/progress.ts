import { LEVEL_COUNT, clampLevel, nextUnlocked, type Stars } from './levels'
import { createStoredPreference } from './storage'

/**
 * Lo que el modo Niveles recuerda entre visitas: hasta qué nivel se puede jugar
 * y cuántas estrellas tiene cada uno.
 *
 * Va al almacenamiento del navegador por la misma fontanería que el récord
 * (`createStoredPreference`): sin identificadores, tolerante a un almacenamiento
 * bloqueado y avisando a quien mira. Las estrellas se guardan todas en una sola
 * clave, como texto, para que la lectura sea un valor comparable y no un array
 * nuevo cada vez.
 */

export const UNLOCKED_LEVEL_KEY = 'air-hockey:levels:unlocked'
export const LEVEL_STARS_KEY = 'air-hockey:levels:stars'

/** Entrada externa: solo un nivel que exista; lo demás es «solo el primero». */
export function parseUnlockedLevel(raw: string | null): number {
  if (raw == null || raw.trim() === '') return 1
  const value = Number(raw)
  if (!Number.isSafeInteger(value)) return 1
  return clampLevel(value)
}

/** Las estrellas de todos los niveles, del primero al último, como «3,2,0,…». */
export function parseStarsList(raw: string | null): string {
  const partes = (raw ?? '').split(',').map((s) => Number(s.trim()))
  const estrellas = Array.from({ length: LEVEL_COUNT }, (_, i) => {
    const v = partes[i]
    return Number.isInteger(v) && v >= 0 && v <= 3 ? v : 0
  })
  return estrellas.join(',')
}

export function starsFromList(list: string, level: number): Stars {
  const v = Number(list.split(',')[clampLevel(level) - 1])
  return (Number.isInteger(v) && v >= 0 && v <= 3 ? v : 0) as Stars
}

const unlocked = createStoredPreference<number>({
  key: UNLOCKED_LEVEL_KEY,
  parse: parseUnlockedLevel,
  serialize: String,
})

const stars = createStoredPreference<string>({
  key: LEVEL_STARS_KEY,
  parse: parseStarsList,
  serialize: (s) => s,
})

export const {
  get: getUnlockedLevel,
  getServer: getServerUnlockedLevel,
  subscribe: subscribeUnlockedLevel,
} = unlocked

export const {
  get: getStarsList,
  getServer: getServerStarsList,
  subscribe: subscribeStarsList,
} = stars

/**
 * Guarda el resultado de un nivel: sus estrellas si mejoran las que tenía, y el
 * desbloqueo del siguiente si se superó. Devuelve hasta dónde se puede jugar
 * ahora, para que quien lo llama sepa si acaba de abrirse algo.
 */
export function saveLevelResult(level: number, earned: Stars): number {
  const nivel = clampLevel(level)
  const lista = getStarsList().split(',').map(Number)
  if (earned > (lista[nivel - 1] ?? 0)) {
    lista[nivel - 1] = earned
    stars.save(lista.join(','))
  }
  const siguiente = nextUnlocked(getUnlockedLevel(), nivel, earned)
  if (siguiente > getUnlockedLevel()) unlocked.save(siguiente)
  return siguiente
}

/** Cuántos niveles tienen al menos una estrella. */
export function levelsPassed(list: string): number {
  return list.split(',').filter((s) => Number(s) >= 1).length
}
