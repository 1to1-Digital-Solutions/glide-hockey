import { describe, expect, it } from 'vitest'
import { exitProblems, type PanelBox } from './exitCorner'
import { MENU_BOXES, MENU_PANEL } from './xrMenuLayout'

import { DIFFICULTY_ORDER } from './gameConfig'
import { LEVEL_BAR_BOTTOM, LEVEL_BUTTON, levelBarHeight } from './xrMenuLayout'

/**
 * The level bars fit in their button.
 *
 * The tallest one stuck out at the top: the height was a number written by hand and with five
 * levels it went past the edge. Inside the headset that is a bar floating in front of the
 * panel, and it cannot be seen on any screen.
 */
describe('the level bars', () => {
  const levels = DIFFICULTY_ORDER.length

  it('none sticks out of its button', () => {
    for (let index = 0; index < levels; index += 1) {
      expect(LEVEL_BAR_BOTTOM + levelBarHeight(index), `level ${index}`).toBeLessThanOrEqual(
        LEVEL_BUTTON[1] / 2,
      )
    }
  })

  it('grow from one to the next, which is what is read', () => {
    // Without this they all fit because they measure the same, and then they say nothing.
    for (let index = 1; index < levels; index += 1) {
      expect(levelBarHeight(index)).toBeGreaterThan(levelBarHeight(index - 1))
    }
  })

  it('one more level shrinks the step instead of overflowing', () => {
    expect(LEVEL_BAR_BOTTOM + levelBarHeight(levels, levels + 1)).toBeLessThanOrEqual(
      LEVEL_BUTTON[1] / 2,
    )
  })

  it('with a single level the bar takes up what there is', () => {
    expect(LEVEL_BAR_BOTTOM + levelBarHeight(0, 1)).toBeLessThanOrEqual(LEVEL_BUTTON[1] / 2)
  })
})


/**
 * Where the exit lands, which until now depended on the game.
 *
 * The rule —bottom right, at the end of the actions row— and the reason why are in
 * `exitCorner.ts`, the same file in all thirteen. Here it is only given the layout of THIS
 * panel, translated into what the rule can read.
 */
describe('the exit', () => {
  const asBox = (name: string): PanelBox => {
    const { position, size } = MENU_BOXES[name]
    return { x: position[0], y: position[1], width: size[0], height: size[1] }
  }

  it('is in the bottom right corner of the settings panel', () => {
    const names = Object.keys(MENU_BOXES)

    expect(
      exitProblems(
        asBox('exit'),
        names.filter((name) => name !== 'exit').map(asBox),
        { width: MENU_PANEL.width, height: MENU_PANEL.height },
      ),
    ).toEqual([])
  })
})
