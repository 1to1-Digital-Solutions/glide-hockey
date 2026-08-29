import { describe, expect, it } from 'vitest'
import { DIFFICULTY_ORDER } from './gameConfig'
import {
  BASE_GOAL_POINTS,
  CONCEDED_PENALTY,
  MAX_STREAK_MULTIPLIER,
  goalPoints,
  scoreConceded,
  scoreGoal,
  streakMultiplier,
} from './scoring'

describe('el multiplicador de racha', () => {
  it('no multiplica nada en el primer gol', () => {
    expect(streakMultiplier(1)).toBe(1)
  })

  it('crece con cada gol encadenado', () => {
    expect(streakMultiplier(3)).toBeGreaterThan(streakMultiplier(2))
  })

  it('tiene un tope, para que durar no gane a jugar bien', () => {
    expect(streakMultiplier(1000)).toBe(MAX_STREAK_MULTIPLIER)
  })

  it('trata un valor imposible como si no hubiera racha', () => {
    expect(streakMultiplier(Number.NaN)).toBe(1)
    expect(streakMultiplier(-4)).toBe(1)
  })
})

describe('los puntos de un gol', () => {
  it('valen la base en el nivel más fácil y sin racha', () => {
    expect(goalPoints({ difficulty: 'easy', streak: 1 })).toBe(BASE_GOAL_POINTS)
  })

  it('valen más cuanto más alto es el nivel', () => {
    const porNivel = DIFFICULTY_ORDER.map((difficulty) =>
      goalPoints({ difficulty, streak: 1 }),
    )

    const creciente = porNivel.every(
      (points, index) => index === 0 || points > porNivel[index - 1],
    )
    expect(creciente).toBe(true)
  })

  it('son siempre enteros', () => {
    expect(Number.isInteger(goalPoints({ difficulty: 'hard', streak: 3 }))).toBe(
      true,
    )
  })
})

describe('la puntuación de una partida', () => {
  it('sube al marcar', () => {
    expect(scoreGoal(0, { difficulty: 'easy', streak: 1 })).toBe(
      BASE_GOAL_POINTS,
    )
  })

  it('baja al encajar', () => {
    expect(scoreConceded(500)).toBe(500 - CONCEDED_PENALTY)
  })

  it('no baja de cero por muchos goles que te metan', () => {
    expect(scoreConceded(scoreConceded(10))).toBe(0)
  })
})
