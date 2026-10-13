import { describe, expect, it } from 'vitest'
import { ENDLESS, modeRows, isEndless, runOutcome } from './gameMode'

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

describe('las filas del menú en cada modo (la plantilla común)', () => {
  const filas = (modo: Parameters<typeof modeRows>[0], masOpciones: boolean) => [...modeRows(modo, masOpciones).rows]

  it('plegado: el modo y, en los niveles, cuál; lo demás, detrás de «Más opciones»', () => {
    expect(filas('practice', false)).toEqual(['mode'])
    expect(filas('levels', false)).toEqual(['mode', 'goals'])
    expect(filas('duel', false)).toEqual(['mode'])
    for (const modo of ['practice', 'levels', 'duel'] as const) expect(modeRows(modo, false).foldable, modo).toBe(true)
  })

  it('desplegado: lo de la práctica, el decorado y el confort', () => {
    expect(filas('practice', true)).toEqual(['mode', 'machine', 'goals', 'settings'])
    expect(filas('levels', true)).toEqual(['mode', 'goals', 'settings'])
    expect(filas('duel', true)).toEqual(['mode', 'settings'])
  })

  it('el reto es una partida fija: nada plegado y sin botón, aunque se pida', () => {
    expect(filas('challenge', true)).toEqual(['mode'])
    expect(modeRows('challenge', false).foldable).toBe(false)
  })
})
