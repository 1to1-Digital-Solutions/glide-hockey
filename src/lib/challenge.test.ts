import { describe, expect, it } from 'vitest'
import {
  CHALLENGE_GOAL_STEPS,
  CHALLENGE_ROUNDS,
  challengeRound,
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

  it('repite el último escalón pasada la escalera', () => {
    const ultima = challengeRound(CHALLENGE_ROUNDS)
    const pasada = challengeRound(CHALLENGE_ROUNDS + 7)

    expect(pasada.difficulty).toBe(ultima.difficulty)
    expect(pasada.goalTarget).toBe(ultima.goalTarget)
    // El número que se le enseña al jugador sí sigue subiendo.
    expect(pasada.round).toBe(CHALLENGE_ROUNDS + 7)
  })

  it('trata una ronda imposible como la primera', () => {
    expect(challengeRound(0).goalTarget).toBe(CHALLENGE_GOAL_STEPS[0])
    expect(challengeRound(Number.NaN).difficulty).toBe(DIFFICULTY_ORDER[0])
  })
})
