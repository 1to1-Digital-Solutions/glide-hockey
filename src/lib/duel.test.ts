import { describe, expect, it } from 'vitest'
import {
  DUEL_SETUP,
  PLAYER_LABELS,
  controllerHolder,
  duelOver,
  duelTurn,
  duelWinner,
  endSoundsLikeWin,
  formatMargin,
  margin,
  newDuel,
  recordMatch,
  type Duel,
} from './duel'
import { DEFAULT_GOALS, OPPONENT_SKILLS } from './gameConfig'
import { advanceTable, startTable } from './matchLoop'
import { playerStart } from './opponent'

/**
 * El duelo por turnos.
 *
 * Lo que se vigila es que **sea justo y se entienda**: que el turno pase al otro al acabar una
 * partida, que un duelo acabado no admita una tercera, que los dos jueguen contra la misma máquina
 * con la misma semilla, y que gane quien le haya sacado más ventaja y no quien haya marcado más.
 */

const NUEVO = newDuel(42)

describe('los turnos', () => {
  it('empieza el primero y, apuntada su partida, le toca al segundo', () => {
    expect(duelTurn(NUEVO)).toBe(0)
    const tras = recordMatch(NUEVO, { scored: 7, conceded: 4 })
    expect(duelTurn(tras)).toBe(1)
    expect(duelOver(tras)).toBe(false)
  })

  it('con las dos partidas jugadas se acaba', () => {
    const fin = recordMatch(recordMatch(NUEVO, { scored: 7, conceded: 4 }), { scored: 3, conceded: 7 })
    expect(duelTurn(fin)).toBeNull()
    expect(duelOver(fin)).toBe(true)
    expect(fin.matches).toEqual([
      { scored: 7, conceded: 4 },
      { scored: 3, conceded: 7 },
    ])
  })

  it('el mando lo tiene a quien le toca, y al acabar el último que jugó', () => {
    expect(controllerHolder(NUEVO)).toBe(0)
    const tras = recordMatch(NUEVO, { scored: 7, conceded: 4 })
    expect(controllerHolder(tras)).toBe(1)
    expect(controllerHolder(recordMatch(tras, { scored: 1, conceded: 7 }))).toBe(1)
  })

  it('un duelo acabado no apunta una tercera partida', () => {
    const fin = recordMatch(recordMatch(NUEVO, { scored: 7, conceded: 4 }), { scored: 3, conceded: 7 })
    expect(recordMatch(fin, { scored: 7, conceded: 0 })).toBe(fin)
  })

  it('cada uno se llama por su número', () => {
    expect(PLAYER_LABELS).toEqual(['Player 1', 'Player 2'])
  })
})

describe('la misma máquina para los dos', () => {
  it('se juega siempre igual: Media y a 7, lo que no se elige en el menú', () => {
    expect(DUEL_SETUP).toEqual({ difficulty: 'medium', goalTarget: DEFAULT_GOALS })
  })

  it('la semilla es la del duelo en las dos partidas', () => {
    const tras = recordMatch(NUEVO, { scored: 7, conceded: 4 })
    const fin = recordMatch(tras, { scored: 2, conceded: 7 })
    expect([NUEVO.seed, tras.seed, fin.seed]).toEqual([42, 42, 42])
  })

  /**
   * Lo que hace la semilla: con el mazo del jugador quieto, dos mesas puestas con la del duelo
   * dejan el mismo rastro —la máquina elige los mismos tiros—, y con otra semilla, otro.
   */
  function rastro(duelo: Duel): string[] {
    const skill = OPPONENT_SKILLS[DUEL_SETUP.difficulty]
    let table = startTable({ skill, lastScorer: null, seed: duelo.seed })
    const huellas: string[] = []
    for (let paso = 1; paso <= 60 * 15; paso += 1) {
      const result = advanceTable(table, { delta: 1 / 60, pointer: playerStart(), skill, playing: true })
      table = result.table
      huellas.push(...result.goals)
      if (paso % 30 === 0) huellas.push(`${table.opponent.position.x.toFixed(5)},${table.opponent.position.z.toFixed(5)}`)
    }
    return huellas
  }

  it('con la misma semilla la máquina tira igual al primero y al segundo', () => {
    const tras = recordMatch(NUEVO, { scored: 7, conceded: 4 })
    expect(rastro(tras)).toEqual(rastro(NUEVO))
  })

  it('y otro duelo, con otra semilla, es otra máquina', () => {
    expect(rastro(newDuel(43))).not.toEqual(rastro(NUEVO))
  })
})

describe('quién gana', () => {
  it('gana quien le saca más ventaja a la máquina, aunque haya metido menos', () => {
    // El primero pierde 5–7 (−2) y el segundo gana 7–6 (+1): gana el segundo, con menos goles.
    const duelo = recordMatch(recordMatch(NUEVO, { scored: 5, conceded: 7 }), { scored: 7, conceded: 6 })
    expect(duelWinner(duelo)).toBe(1)
  })

  it('y si los dos ganan, el que ganó por más', () => {
    const duelo = recordMatch(recordMatch(NUEVO, { scored: 7, conceded: 1 }), { scored: 7, conceded: 3 })
    expect(duelWinner(duelo)).toBe(0)
  })

  it('con la misma ventaja es empate, aunque los goles sean otros', () => {
    const duelo = recordMatch(recordMatch(NUEVO, { scored: 7, conceded: 5 }), { scored: 4, conceded: 2 })
    expect(margin(duelo.matches[0]!)).toBe(margin(duelo.matches[1]!))
    expect(duelWinner(duelo)).toBeNull()
  })

  it('sin acabar no gana nadie', () => {
    expect(duelWinner(recordMatch(NUEVO, { scored: 7, conceded: 0 }))).toBeNull()
  })

  it('la ventaja se escribe con su signo', () => {
    expect(formatMargin(3)).toBe('+3')
    expect(formatMargin(-2)).toBe('−2')
    expect(formatMargin(0)).toBe('0')
  })
})

describe('cómo suena el final', () => {
  it('fuera del duelo, y en la partida del primero, lo dice el marcador', () => {
    expect(endSoundsLikeWin(false, { scored: 7, conceded: 3 })).toBe(true)
    expect(endSoundsLikeWin(false, { scored: 3, conceded: 7 })).toBe(false)
  })

  it('el final del duelo suena a ganar aunque quien jugó el último perdiera su partida', () => {
    expect(endSoundsLikeWin(true, { scored: 2, conceded: 7 })).toBe(true)
  })
})
