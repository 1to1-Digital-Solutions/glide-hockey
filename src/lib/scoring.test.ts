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

/**
 * La vuelta del reto. Es el único multiplicador que no se elige: se llega a él
 * aguantando quince rondas sin perder, y lo que hace es que seguir jugando
 * después de la última ronda valga más que repetirla (ver `challenge.ts`).
 */
describe('el multiplicador de la vuelta', () => {
  it('la primera vuelta —y no estar en el reto— no multiplican nada', () => {
    const suelto = goalPoints({ difficulty: 'hard', streak: 1 })
    expect(goalPoints({ difficulty: 'hard', streak: 1, lap: 1 })).toBe(suelto)
  })

  it('cada vuelta vale más que la anterior', () => {
    const primera = goalPoints({ difficulty: 'hard', streak: 1, lap: 1 })
    const segunda = goalPoints({ difficulty: 'hard', streak: 1, lap: 1.5 })

    expect(segunda).toBeGreaterThan(primera)
    expect(segunda).toBe(Math.round(primera * 1.5))
  })

  it('un multiplicador que llegara roto o por debajo de uno no descuenta puntos', () => {
    const entero = goalPoints({ difficulty: 'easy', streak: 1, lap: 1 })
    for (const lap of [0, -2, Number.NaN]) {
      expect(goalPoints({ difficulty: 'easy', streak: 1, lap }), String(lap)).toBe(entero)
    }
  })

  it('llega a la puntuación de la partida, no solo a la cuenta de un gol', () => {
    expect(scoreGoal(0, { difficulty: 'easy', streak: 1, lap: 2 })).toBe(BASE_GOAL_POINTS * 2)
  })
})
