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
 * The turn-based duel.
 *
 * What is watched is that **it is fair and understood**: that the turn passes to the other when a
 * match ends, that a finished duel does not admit a third one, that both play against the same
 * machine with the same seed, and that the winner is whoever got the bigger lead and not whoever
 * scored more.
 */

const FRESH = newDuel(42)

describe('the turns', () => {
  it("the first one starts and, once their match is recorded, it is the second one's turn", () => {
    expect(duelTurn(FRESH)).toBe(0)
    const afterFirst = recordMatch(FRESH, { scored: 7, conceded: 4 })
    expect(duelTurn(afterFirst)).toBe(1)
    expect(duelOver(afterFirst)).toBe(false)
  })

  it('with both matches played it is over', () => {
    const finished = recordMatch(recordMatch(FRESH, { scored: 7, conceded: 4 }), { scored: 3, conceded: 7 })
    expect(duelTurn(finished)).toBeNull()
    expect(duelOver(finished)).toBe(true)
    expect(finished.matches).toEqual([
      { scored: 7, conceded: 4 },
      { scored: 3, conceded: 7 },
    ])
  })

  it("the controller is held by whoever's turn it is, and at the end by the last one who played", () => {
    expect(controllerHolder(FRESH)).toBe(0)
    const afterFirst = recordMatch(FRESH, { scored: 7, conceded: 4 })
    expect(controllerHolder(afterFirst)).toBe(1)
    expect(controllerHolder(recordMatch(afterFirst, { scored: 1, conceded: 7 }))).toBe(1)
  })

  it('a finished duel does not record a third match', () => {
    const finished = recordMatch(recordMatch(FRESH, { scored: 7, conceded: 4 }), { scored: 3, conceded: 7 })
    expect(recordMatch(finished, { scored: 7, conceded: 0 })).toBe(finished)
  })

  it('each one is called by their number', () => {
    expect(PLAYER_LABELS).toEqual(['Player 1', 'Player 2'])
  })
})

describe('the same machine for both', () => {
  it('it is always played the same: Medium and to 7, which is not chosen in the menu', () => {
    expect(DUEL_SETUP).toEqual({ difficulty: 'medium', goalTarget: DEFAULT_GOALS })
  })

  it("the seed is the duel's in both matches", () => {
    const afterFirst = recordMatch(FRESH, { scored: 7, conceded: 4 })
    const finished = recordMatch(afterFirst, { scored: 2, conceded: 7 })
    expect([FRESH.seed, afterFirst.seed, finished.seed]).toEqual([42, 42, 42])
  })

  /**
   * What the seed does: with the player's mallet still, two tables set up with the duel's seed
   * leave the same trace —the machine picks the same shots—, and with another seed, another.
   */
  function trace(duel: Duel): string[] {
    const skill = OPPONENT_SKILLS[DUEL_SETUP.difficulty]
    let table = startTable({ skill, lastScorer: null, seed: duel.seed })
    const marks: string[] = []
    for (let step = 1; step <= 60 * 15; step += 1) {
      const result = advanceTable(table, { delta: 1 / 60, pointer: playerStart(), skill, playing: true })
      table = result.table
      marks.push(...result.goals)
      if (step % 30 === 0) marks.push(`${table.opponent.position.x.toFixed(5)},${table.opponent.position.z.toFixed(5)}`)
    }
    return marks
  }

  it('with the same seed the machine shoots the same at the first and at the second', () => {
    const afterFirst = recordMatch(FRESH, { scored: 7, conceded: 4 })
    expect(trace(afterFirst)).toEqual(trace(FRESH))
  })

  it('and another duel, with another seed, is another machine', () => {
    expect(trace(newDuel(43))).not.toEqual(trace(FRESH))
  })
})

describe('who wins', () => {
  it('whoever gets the bigger lead over the machine wins, even having scored fewer', () => {
    // The first loses 5–7 (−2) and the second wins 7–6 (+1): the second wins, with fewer goals.
    const duel = recordMatch(recordMatch(FRESH, { scored: 5, conceded: 7 }), { scored: 7, conceded: 6 })
    expect(duelWinner(duel)).toBe(1)
  })

  it('and if both win, the one who won by more', () => {
    const duel = recordMatch(recordMatch(FRESH, { scored: 7, conceded: 1 }), { scored: 7, conceded: 3 })
    expect(duelWinner(duel)).toBe(0)
  })

  it('with the same lead it is a tie, even if the goals are different', () => {
    const duel = recordMatch(recordMatch(FRESH, { scored: 7, conceded: 5 }), { scored: 4, conceded: 2 })
    expect(margin(duel.matches[0]!)).toBe(margin(duel.matches[1]!))
    expect(duelWinner(duel)).toBeNull()
  })

  it('unfinished, nobody wins', () => {
    expect(duelWinner(recordMatch(FRESH, { scored: 7, conceded: 0 }))).toBeNull()
  })

  it('the lead is written with its sign', () => {
    expect(formatMargin(3)).toBe('+3')
    expect(formatMargin(-2)).toBe('−2')
    expect(formatMargin(0)).toBe('0')
  })
})

describe('how the ending sounds', () => {
  it("outside the duel, and in the first one's match, the score says it", () => {
    expect(endSoundsLikeWin(false, { scored: 7, conceded: 3 })).toBe(true)
    expect(endSoundsLikeWin(false, { scored: 3, conceded: 7 })).toBe(false)
  })

  it('the end of the duel sounds like winning even if whoever played last lost their match', () => {
    expect(endSoundsLikeWin(true, { scored: 2, conceded: 7 })).toBe(true)
  })
})
