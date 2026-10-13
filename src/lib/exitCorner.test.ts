import { describe, expect, it } from 'vitest'
import { exitProblems, type PanelBox } from './exitCorner'

/**
 * The rule of where the exit goes, tested with make-believe boxes.
 *
 * There is nothing of this game here on purpose: what is checked is that the rule **knows how
 * to say what is wrong**, because it is what whoever breaks it in any of the thirteen will read.
 * That the panel of this game complies is checked in `menuLayout.test.ts`, with its real
 * layout.
 */

const PANEL = { width: 0.8, height: 1.0 }
const BOTTOM_ROW = -0.4

/** The exit where the rule says: at the end of the bottom row. */
const EXIT: PanelBox = { x: 0.28, y: BOTTOM_ROW, width: 0.16, height: 0.09 }
/** And play, to its left in the same row. */
const PLAY: PanelBox = { x: 0, y: BOTTOM_ROW, width: 0.34, height: 0.09 }
/** A row of options from above, which takes up the whole panel. */
const OPTION: PanelBox = { x: 0.34, y: 0.2, width: 0.12, height: 0.07 }

describe('where the exit of the panel goes', () => {
  it('at the end of the bottom row nothing is wrong with it', () => {
    expect(exitProblems(EXIT, [PLAY, OPTION], PANEL)).toEqual([])
  })

  it('a row of options that reaches further right does not count: it is not its row', () => {
    // The rows of options take up the panel from side to side; demanding that the exit pass them
    // would be demanding that it stick out of the panel.
    const wider: PanelBox = { ...OPTION, x: 0.37 }
    expect(exitProblems(EXIT, [PLAY, wider], PANEL)).toEqual([])
  })

  it('in the left half it is called out, which is where four of the thirteen were', () => {
    const onTheLeft: PanelBox = { ...EXIT, x: -0.28 }
    // And it drags the other complaint along, that play is left to its right: they are two
    // sentences because they are two things to look at.
    expect(exitProblems(onTheLeft, [PLAY], PANEL)).toContainEqual(
      expect.stringContaining('left half'),
    )
  })

  it('with a neighbour of its row further right, too', () => {
    const neighbour: PanelBox = { x: 0.34, y: BOTTOM_ROW, width: 0.1, height: 0.09 }
    expect(exitProblems(EXIT, [PLAY, neighbour], PANEL)).toEqual([
      expect.stringContaining('further right'),
    ])
  })

  it('and outside the bottom row, the same again: at mid height it crosses what is being chosen', () => {
    const atMidHeight: PanelBox = { ...EXIT, y: 0 }
    expect(exitProblems(atMidHeight, [PLAY], PANEL)).toEqual([
      expect.stringContaining('below the exit'),
    ])
  })

  it('sticking out over the right edge it is called out apart: there the ray no longer reaches all of it', () => {
    const stickingOut: PanelBox = { ...EXIT, x: 0.38 }
    expect(exitProblems(stickingOut, [PLAY], PANEL)).toEqual([
      expect.stringContaining('on the right'),
    ])
  })

  it('and sticking out at the bottom, likewise', () => {
    const stickingOut: PanelBox = { ...EXIT, y: -0.49 }
    expect(exitProblems(stickingOut, [], PANEL)).toEqual([
      expect.stringContaining('at the bottom'),
    ])
  })

  it('says everything that is wrong at once, since fixing it one by one is three rounds', () => {
    const allWrong: PanelBox = { x: -0.3, y: 0.3, width: 0.16, height: 0.09 }
    expect(exitProblems(allWrong, [PLAY], PANEL)).toHaveLength(2)
  })
})
