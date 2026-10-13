import { describe, expect, it } from 'vitest'

import {
  MENU_PANEL,
  MENU_ROW,
  MENU_ROW_HEIGHT,
  MENU_ROW_LABEL_RISE,
  MENU_ROW_LABEL_SIZE,
} from './xrMenuLayout'

/**
 * That the headset menu can be read.
 *
 * It is what **cannot be seen on any screen**: with the mouse the panel is looked at head-on and
 * up close, and with the headset on it is read at half a metre and freehand. The failure this
 * watches for was reported like this: «I opened the settings menu and all the letters look
 * overlapped, so it is no help to me». The name of a row was being drawn inside the row above.
 */

type Band = { name: string; bottom: number; top: number }

/** Each row with its buttons, and the name of the row as its own band. */
function bands(): Band[] {
  const list: Band[] = []
  for (const [name, y] of Object.entries(MENU_ROW)) {
    const height = MENU_ROW_HEIGHT[name as keyof typeof MENU_ROW]
    list.push({ name, bottom: y - height / 2, top: y + height / 2 })
    // The record band has no name: there is nothing to explain. And the comfort one and the
    // top one («Más opciones») have it on their same line: those are measured by
    // `menu.legible.test.ts` against the boxes, which is where they could overlap.
    if (name === 'record' || name === 'comfort' || name === 'title') continue
    const center = y + MENU_ROW_LABEL_RISE
    list.push({
      name: `name of ${name}`,
      bottom: center - MENU_ROW_LABEL_SIZE / 2,
      top: center + MENU_ROW_LABEL_SIZE / 2,
    })
  }
  return list.sort((a, b) => b.top - a.top)
}

describe('the rows of the headset menu', () => {
  it('do not overlap one another', () => {
    const list = bands()
    for (let i = 1; i < list.length; i++) {
      expect(list[i].top, `${list[i].name} runs into ${list[i - 1].name}`)
        .toBeLessThanOrEqual(list[i - 1].bottom)
    }
  })

  it('all fit inside the panel', () => {
    for (const band of bands()) {
      expect(Math.abs(band.top), band.name).toBeLessThanOrEqual(MENU_PANEL.height / 2)
      expect(Math.abs(band.bottom), band.name).toBeLessThanOrEqual(MENU_PANEL.height / 2)
    }
  })
})
