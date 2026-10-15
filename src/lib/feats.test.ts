import { beforeEach, describe, expect, it } from 'vitest'
import { OPPONENT_SKILLS } from './gameConfig'
import {
  BACK_OF_OWN_HALF,
  FEATS_KEY,
  NEW_POSSESSION,
  withFeats,
  earnFeats,
  goalFeat,
  matchFeats,
  storedFeats,
  readFeats,
  touch,
  type Possession,
} from './feats'
import { advanceTable, startTable, type TableState } from './matchLoop'
import { gameStorage } from './storage'

/**
 * The feats of Glide Hockey: each one is triggered from the logic and another possession comes
 * close without getting there; what is achieved is stored and is not told again. Without `vi` or
 * the browser: it also runs in the Godot engine, with its save.
 */

beforeEach(() => gameStorage()?.clear())

/** A possession told touch by touch: who and with the puck where. */
function played(...touches: ['player' | 'opponent', number][]): Possession {
  return touches.reduce((before, [who, z]) => touch(before, who, z), NEW_POSSESSION)
}

describe('winning without conceding (GH_SHUTOUT)', () => {
  it('a match won without a goal against', () => {
    expect(matchFeats({ won: true, conceded: 0, endless: false })).toEqual(['GH_SHUTOUT'])
  })

  it('not with one conceded, nor losing, nor in the endless match that is closed at will', () => {
    expect(matchFeats({ won: true, conceded: 1, endless: false })).toEqual([])
    expect(matchFeats({ won: false, conceded: 0, endless: false })).toEqual([])
    expect(matchFeats({ won: true, conceded: 0, endless: true })).toEqual([])
  })
})

describe('a single touch from the back (GH_LONG_SHOT)', () => {
  it('one touch with the puck at the back of their own half and a goal, with nobody else touching it', () => {
    expect(goalFeat(played(['opponent', -0.5], ['player', BACK_OF_OWN_HALF]), 'player')).toBe('GH_LONG_SHOT')
  })

  it('almost: from a bit further forward, with two touches, or deflected by the machine', () => {
    expect(goalFeat(played(['player', BACK_OF_OWN_HALF - 0.01]), 'player')).toBeNull()
    expect(goalFeat(played(['player', 0.8], ['player', 0.6]), 'player')).toBeNull()
    expect(goalFeat(played(['player', 0.8], ['opponent', -0.3]), 'player')).toBeNull()
  })

  it('a goal without the player touching the puck is not theirs in any way', () => {
    expect(goalFeat(NEW_POSSESSION, 'player')).toBeNull()
  })
})

describe('scoring an own goal (GH_OWN_GOAL)', () => {
  it('the goal against with the last touch by the player', () => {
    expect(goalFeat(played(['opponent', -0.4], ['player', 0.3]), 'opponent')).toBe('GH_OWN_GOAL')
  })

  it('almost: the last touch was by the machine', () => {
    expect(goalFeat(played(['player', 0.3], ['opponent', -0.4]), 'opponent')).toBeNull()
  })

  it('it comes out of the table: the puck that their own mallet puts into their goal', () => {
    const skill = OPPONENT_SKILLS.easy
    let table: TableState = {
      ...startTable({ skill, lastScorer: null }),
      puck: { position: { x: 0, z: 0.7 }, velocity: { x: 0, z: 0 } },
      player: { position: { x: 0, z: 0.5 }, velocity: { x: 0, z: 0 } },
    }
    const feats: string[] = []
    const goals: string[] = []
    // The hand pushes towards its own goal at 3 m/s, frame by frame.
    for (let i = 1; i <= 40; i++) {
      const frame = advanceTable(table, {
        delta: 1 / 60,
        pointer: { x: 0, z: Math.min(0.5 + i * 0.05, 0.93) },
        inHand: true,
        skill,
        playing: true,
      })
      table = frame.table
      feats.push(...frame.feats)
      goals.push(...frame.goals)
    }
    expect(goals).toEqual(['opponent'])
    expect(feats).toEqual(['GH_OWN_GOAL'])
    // And the next possession starts from zero.
    expect(table.possession).toEqual(NEW_POSSESSION)
  })
})

describe('what is stored and what is told to the hall', () => {
  it('the first time it is earned and stored; the second time it is no longer told', () => {
    expect(earnFeats(['GH_OWN_GOAL', 'GH_SHUTOUT'])).toEqual(['GH_SHUTOUT', 'GH_OWN_GOAL'])
    expect(gameStorage()?.getItem(FEATS_KEY)).toBe('GH_SHUTOUT,GH_OWN_GOAL')
    expect(earnFeats(['GH_SHUTOUT'])).toEqual([])
    expect(earnFeats(['GH_SHUTOUT', 'GH_LONG_SHOT'])).toEqual(['GH_LONG_SHOT'])
    expect(storedFeats()).toEqual(['GH_SHUTOUT', 'GH_LONG_SHOT', 'GH_OWN_GOAL'])
  })

  it('with nothing new it does not write', () => {
    expect(earnFeats([])).toEqual([])
    expect(gameStorage()?.getItem(FEATS_KEY)).toBeNull()
  })

  it('what is stored is external input: whatever is not a feat of the game is ignored', () => {
    expect(readFeats(null)).toEqual([])
    expect(readFeats('GH_OWN_GOAL,xx,GH_OWN_GOAL,AX_SOMETHING')).toEqual(['GH_OWN_GOAL'])
  })

  it('the result only carries the field when one is earned for the first time', () => {
    const result = { mode: 'practice', points: 300, challenge: false }
    expect(withFeats(result, [])).toEqual(result)
    expect(withFeats(result, ['GH_SHUTOUT'])).toEqual({ ...result, feats: ['GH_SHUTOUT'] })
  })
})
