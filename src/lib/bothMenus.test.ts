import { describe, expect, it } from 'vitest'
import { SCENERIES } from './settings'
import { GAME_MODE_ORDER, MENU_MODE_ORDER } from './gameMode'
import { MENU_BOXES, MENU_BUTTON, MENU_PANEL } from './xrMenuLayout'

/**
 * Both menus offer the same: the one on the web and the panel inside the headset.
 *
 * Today that is true because both walk **the same lists** —modes, difficulties, hands—,
 * so adding an option shows up in both without touching anything. Where they do not walk
 * them is in what the panel solves with a **two-state switch**: there the panel does not
 * count the options, it assumes them. While there are two it makes no difference; at the
 * third, the web would offer it and inside the headset there would be no way to choose it
 * —and inside the headset is where nobody tests—.
 *
 * This does not fix that: it warns the day it happens, which is what was missing.
 */

describe('what the headset panel solves with a switch', () => {
  it('the scenery one assumes there are two and only two', () => {
    expect(
      SCENERIES.length,
      'there are more sceneries than the switch has states: the panel has to start walking the list',
    ).toBe(2)
  })
})

describe('the modes, in both menus', () => {
  // The web draws one button per mode of `GAME_MODE_ORDER` (`StartScreen.test.tsx` presses the
  // duel one); the headset panel, one box per mode. A mode without a box would be offered on the
  // web and not inside the headset, which is where the duel is played by passing the controller.
  it('every mode has its button on the headset panel, the duel too', () => {
    expect(GAME_MODE_ORDER).toContain('duel')
    for (const mode of GAME_MODE_ORDER) expect(MENU_BOXES[`mode ${mode}`], mode).toBeDefined()
  })

  it('and they fit in the row without overlapping or leaving the panel', () => {
    const xs = MENU_MODE_ORDER.map((mode) => MENU_BOXES[`mode ${mode}`].position[0])
    const width = MENU_BUTTON.mode[0]
    for (let i = 1; i < xs.length; i += 1) expect(xs[i] - xs[i - 1]).toBeGreaterThan(width)
    expect(Math.max(...xs.map(Math.abs)) + width / 2).toBeLessThan(MENU_PANEL.width / 2)
  })

  it('with the challenge, the one that gives a medal, first in the row; the rest, in their order', () => {
    expect(MENU_MODE_ORDER).toEqual(['challenge', 'practice', 'levels', 'duel'])
  })
})
