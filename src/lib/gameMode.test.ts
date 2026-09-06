import { describe, expect, it } from 'vitest'
import { ENDLESS, isEndless, runOutcome } from './gameMode'

describe('cómo acaba una partida', () => {
  it('sigue viva mientras nadie llegue a los goles pactados', () => {
    expect(
      runOutcome({ playerGoals: 4, opponentGoals: 4, goalTarget: 5 }),
    ).toBeNull()
  })

  it('la gana quien llega antes', () => {
    expect(
      runOutcome({ playerGoals: 5, opponentGoals: 2, goalTarget: 5 }),
    ).toBe('won')
    expect(
      runOutcome({ playerGoals: 2, opponentGoals: 5, goalTarget: 5 }),
    ).toBe('lost')
  })

  it('la partida sin fin no se acaba por goles', () => {
    expect(isEndless(ENDLESS)).toBe(true)
    expect(isEndless(7)).toBe(false)
    expect(runOutcome({ playerGoals: 40, opponentGoals: 35, goalTarget: ENDLESS })).toBeNull()
  })

  it('cuenta también si el marcador se pasa del objetivo', () => {
    expect(
      runOutcome({ playerGoals: 0, opponentGoals: 9, goalTarget: 3 }),
    ).toBe('lost')
  })
})
