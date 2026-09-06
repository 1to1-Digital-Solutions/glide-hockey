import { describe, expect, it } from 'vitest'
import { CHALLENGE_ROUNDS, challengeRound } from './challenge'
import { LEVEL_COUNT, clampLevel, levelPassed, levelSpec, levelStars, nextUnlocked } from './levels'

describe('los niveles', () => {
  it('hay tantos como escalones tiene el reto, y cada uno es su ronda', () => {
    expect(LEVEL_COUNT).toBe(CHALLENGE_ROUNDS)
    expect(levelSpec(4)).toEqual(challengeRound(4))
  })

  it('un nivel que no existe cae al borde más cercano', () => {
    expect(clampLevel(0)).toBe(1)
    expect(clampLevel(LEVEL_COUNT + 10)).toBe(LEVEL_COUNT)
    expect(clampLevel(2.7)).toBe(2)
    expect(clampLevel(Number.NaN)).toBe(1)
  })
})

describe('las estrellas', () => {
  it('perder no da ninguna, ganar da una', () => {
    expect(levelStars(false, 2, 3)).toBe(0)
    expect(levelStars(true, 3, 2)).toBe(1)
  })

  it('encajar menos de la mitad da dos, y ninguno da tres', () => {
    expect(levelStars(true, 5, 2)).toBe(2)
    expect(levelStars(true, 5, 0)).toBe(3)
    // Justo la mitad no llega a dos.
    expect(levelStars(true, 4, 2)).toBe(1)
  })

  it('superar es una estrella por lo menos', () => {
    expect(levelPassed(0)).toBe(false)
    expect(levelPassed(1)).toBe(true)
  })
})

describe('el desbloqueo', () => {
  it('superar el nivel más alto abre el siguiente, sin pasar del último', () => {
    expect(nextUnlocked(3, 3, 1)).toBe(4)
    expect(nextUnlocked(LEVEL_COUNT, LEVEL_COUNT, 3)).toBe(LEVEL_COUNT)
  })

  it('repetir uno de abajo o no superar deja las cosas como estaban', () => {
    expect(nextUnlocked(5, 2, 3)).toBe(5)
    expect(nextUnlocked(3, 3, 0)).toBe(3)
  })
})
