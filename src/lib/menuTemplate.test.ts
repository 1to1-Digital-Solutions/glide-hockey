import { afterEach, describe, expect, it } from 'vitest'
import pkg from '../../package.json'
import {
  MENU_DEGREES,
  challengeFirst,
  foldRows,
  setGameName,
  degreesFromFront,
  gameName,
  nameFromId,
  type RowRole,
} from './menuTemplate'

/**
 * The menu template, the same in every game: the name, the order of the rows and where the menu
 * spawns. What belongs to each game —which rows it has and where its panel hangs— is measured by
 * its guard.
 */

afterEach(() => setGameName(null))

describe('the name of the game in its menu', () => {
  it('without the hall, that of the package capitalised, which is that of the catalogue', () => {
    expect(nameFromId('axe-throwing')).toBe('Axe Throwing')
    expect(nameFromId('minigolf')).toBe('Minigolf')
    expect(nameFromId('-odd--id-')).toBe('Odd Id')
    expect(gameName()).toBe(nameFromId(pkg.name))
  })

  it('with the hall, the name of the cabinet; an empty one does not count', () => {
    setGameName('  Test cabinet ')
    expect(gameName()).toBe('Test cabinet')
    setGameName('   ')
    expect(gameName()).toBe(nameFromId(pkg.name))
    setGameName('Test cabinet')
    setGameName(undefined)
    expect(gameName()).toBe(nameFromId(pkg.name))
  })
})

describe('the rows of the menu', () => {
  const ROWS: { key: string; role: RowRole }[] = [
    { key: 'hand', role: 'other' },
    { key: 'opponent', role: 'players' },
    { key: 'difficulty', role: 'other' },
    { key: 'mode', role: 'mode' },
  ]
  const role = (row: (typeof ROWS)[number]) => row.role
  const keys = (rows: readonly { key: string }[]) => rows.map((row) => row.key)

  it('«Modo» first, then «Jugadores», and the rest folded', () => {
    const folded = foldRows(ROWS, role, { moreOptions: false })
    expect(keys(folded.rows)).toEqual(['mode', 'opponent'])
    expect(folded.folded).toBe(2)
  })

  it('with «Más opciones», the rest behind, in the order it came in', () => {
    const unfolded = foldRows(ROWS, role, { moreOptions: true })
    expect(keys(unfolded.rows)).toEqual(['mode', 'opponent', 'hand', 'difficulty'])
    expect(unfolded.folded).toBe(0)
  })

  it('with the challenge chosen there is nothing to unfold: it is a fixed run', () => {
    expect(foldRows(ROWS, role, { moreOptions: false, inChallenge: true })).toEqual({
      rows: [ROWS[3], ROWS[1]],
      folded: 0,
    })
    expect(keys(foldRows(ROWS, role, { moreOptions: true, inChallenge: true }).rows)).toEqual(['mode', 'opponent'])
  })

  it('the challenge, the first of the modes', () => {
    expect(challengeFirst(['practice', 'time', 'challenge', 'levels'], (mode) => mode === 'challenge')).toEqual([
      'challenge',
      'practice',
      'time',
      'levels',
    ])
  })
})

describe('where the headset menu spawns', () => {
  it('is measured horizontally from the front, unsigned', () => {
    expect(degreesFromFront([0, 1.4, -1.2])).toBeCloseTo(0)
    expect(degreesFromFront([-1, 1.4, -1])).toBeCloseTo(45)
    expect(degreesFromFront([1, 0.2, -1])).toBeCloseTo(45)
    expect(degreesFromFront([0, 1.4, 1])).toBeCloseTo(180)
  })

  it('the threshold: at thirty degrees or less', () => {
    expect(MENU_DEGREES).toBe(30)
    expect(degreesFromFront([Math.tan(Math.PI / 6), 1.4, -1])).toBeLessThanOrEqual(MENU_DEGREES + 1e-9)
  })
})
