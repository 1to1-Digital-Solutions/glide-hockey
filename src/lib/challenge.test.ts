import { describe, expect, it } from 'vitest'
import {
  CHALLENGE_GOAL_STEPS,
  CHALLENGE_ROUNDS,
  LAP_STEP,
  challengeRound,
  lapMultiplier,
} from './challenge'
import { DIFFICULTY_ORDER } from './gameConfig'

describe('la escalera del reto', () => {
  it('empieza por lo más fácil y la partida más corta', () => {
    const first = challengeRound(1)

    expect(first.difficulty).toBe(DIFFICULTY_ORDER[0])
    expect(first.goalTarget).toBe(CHALLENGE_GOAL_STEPS[0])
  })

  it('alarga la partida antes de subir de nivel', () => {
    const second = challengeRound(2)

    expect(second.difficulty).toBe(DIFFICULTY_ORDER[0])
    expect(second.goalTarget).toBeGreaterThan(challengeRound(1).goalTarget)
  })

  it('sube de nivel al agotar las duraciones y vuelve a la corta', () => {
    const nueva = challengeRound(CHALLENGE_GOAL_STEPS.length + 1)

    expect(nueva.difficulty).toBe(DIFFICULTY_ORDER[1])
    expect(nueva.goalTarget).toBe(CHALLENGE_GOAL_STEPS[0])
  })

  it('nunca se sale de las dificultades que existen', () => {
    for (let round = 1; round <= CHALLENGE_ROUNDS + 20; round++) {
      expect(DIFFICULTY_ORDER).toContain(challengeRound(round).difficulty)
    }
  })

  it('vuelve a empezar la escalera pasada la última ronda', () => {
    // Antes se quedaba clavada en Imposible a siete goles: la misma partida una
    // y otra vez y por los mismos puntos. Ahora la ronda dieciséis es el primer
    // escalón otra vez, y lo que cambia es lo que valen los goles.
    const primera = challengeRound(1)
    const pasada = challengeRound(CHALLENGE_ROUNDS + 1)

    expect(pasada.difficulty).toBe(primera.difficulty)
    expect(pasada.goalTarget).toBe(primera.goalTarget)
    // El número que se le enseña al jugador sí sigue subiendo.
    expect(pasada.round).toBe(CHALLENGE_ROUNDS + 1)
  })

  it('trata una ronda imposible como la primera', () => {
    expect(challengeRound(0).goalTarget).toBe(CHALLENGE_GOAL_STEPS[0])
    expect(challengeRound(Number.NaN).difficulty).toBe(DIFFICULTY_ORDER[0])
  })
})

describe('las vueltas a la escalera', () => {
  it('la escalera entera es la primera vuelta y no multiplica nada', () => {
    for (let round = 1; round <= CHALLENGE_ROUNDS; round++) {
      const ronda = challengeRound(round)
      expect(ronda.lap, `ronda ${round}`).toBe(1)
      expect(ronda.multiplier, `ronda ${round}`).toBe(1)
    }
  })

  it('pasada la última ronda empieza la segunda vuelta, y vale más', () => {
    const segunda = challengeRound(CHALLENGE_ROUNDS + 1)
    expect(segunda.lap).toBe(2)
    expect(segunda.multiplier).toBe(1 + LAP_STEP)

    const tercera = challengeRound(CHALLENGE_ROUNDS * 2 + 1)
    expect(tercera.lap).toBe(3)
    expect(tercera.multiplier).toBe(1 + 2 * LAP_STEP)
  })

  it('la vuelta no cambia a mitad de vuelta', () => {
    for (let round = CHALLENGE_ROUNDS + 1; round <= CHALLENGE_ROUNDS * 2; round++) {
      expect(challengeRound(round).lap, `ronda ${round}`).toBe(2)
    }
  })

  it('el multiplicador sube medio a medio y nunca baja de uno', () => {
    expect(lapMultiplier(1)).toBe(1)
    expect(lapMultiplier(0)).toBe(1)
    expect(lapMultiplier(-3)).toBe(1)
    expect(lapMultiplier(Number.NaN)).toBe(1)
    for (let lap = 1; lap < 8; lap++) {
      expect(lapMultiplier(lap + 1) - lapMultiplier(lap)).toBeCloseTo(LAP_STEP, 10)
    }
  })
})
