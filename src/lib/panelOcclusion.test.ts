import { describe, expect, it } from 'vitest'

import { hiddenByPanel, panelPoints, tablePoints, whatThePanelHides } from './panelOcclusion'
import { eyesAt, type PanelPose } from './panelReading'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from './gameConfig'
import { HALF_LENGTH, HALF_WIDTH } from './puckPhysics'

/**
 * The instrument that says what a panel hides, tested with a fake panel: a 40 × 40 cm plate
 * one metre in front of eyes at the origin. With round numbers one can see at a glance whether
 * the answer is the right one, which is exactly what does not happen with the game's dimensions.
 */
const EYES = eyesAt(0)
const PANEL: PanelPose = { position: [0, 0, -1] }
const SIZE = { width: 0.4, height: 0.4 }

describe('what a panel hides', () => {
  it('hides what lies right behind it', () => {
    expect(hiddenByPanel(PANEL, SIZE, EYES, { x: 0, y: 0, z: -2 })).toBe(true)
  })

  it('does not hide what is between the eyes and it', () => {
    expect(hiddenByPanel(PANEL, SIZE, EYES, { x: 0, y: 0, z: -0.5 })).toBe(false)
  })

  it('does not hide what is behind the back: the panel is not in between, it is behind the eyes', () => {
    expect(hiddenByPanel(PANEL, SIZE, EYES, { x: 0, y: 0, z: 2 })).toBe(false)
  })

  it('does not hide what falls outside its width', () => {
    // The ray crosses its plane 50 cm from the centre, and the plate reaches 20.
    expect(hiddenByPanel(PANEL, SIZE, EYES, { x: 1, y: 0, z: -2 })).toBe(false)
  })

  it('nor what falls outside its height', () => {
    expect(hiddenByPanel(PANEL, SIZE, EYES, { x: 0, y: 1, z: -2 })).toBe(false)
  })

  /**
   * And it accounts for the rotation, which is what is needed: the panels are set facing the eyes
   * and tilted towards them, and rotated the same panel no longer reaches where it reached head-on.
   */
  it('rotated, what grazed its edge gets away from it', () => {
    const grazing = { x: 0.35, y: 0, z: -2 }
    const rotated: PanelPose = { position: [0, 0, -1], rotation: [0, Math.PI / 6, 0] }
    expect(hiddenByPanel(PANEL, SIZE, EYES, grazing)).toBe(true)
    expect(hiddenByPanel(rotated, SIZE, EYES, grazing)).toBe(false)
  })
})

describe('the phrases it returns', () => {
  it('say what is hidden and at how many points, and leave out what is seen whole', () => {
    const behind = [
      { x: 0, y: 0, z: -2 },
      { x: 0, y: 0.1, z: -2 },
      { x: 3, y: 0, z: -2 },
    ]
    expect(
      whatThePanelHides(PANEL, SIZE, EYES, [
        { what: 'the table', points: behind },
        { what: 'the scoreboard', points: [{ x: 3, y: 0, z: -2 }] },
      ]),
    ).toEqual(['the panel hides the table at 2 of 3 points'])
  })
})

describe('the grids', () => {
  it('the board one covers the whole table, corners included', () => {
    const points = tablePoints(4)
    expect(points).toHaveLength(25)
    expect(points.every((p) => p.y === TABLE_HEIGHT)).toBe(true)
    expect(Math.min(...points.map((p) => p.x))).toBeCloseTo(-HALF_WIDTH)
    expect(Math.max(...points.map((p) => p.x))).toBeCloseTo(HALF_WIDTH)
    expect(Math.min(...points.map((p) => p.z))).toBeCloseTo(TABLE_CENTER_Z - HALF_LENGTH)
    expect(Math.max(...points.map((p) => p.z))).toBeCloseTo(TABLE_CENTER_Z + HALF_LENGTH)
  })

  it('the one of a panel covers its whole face', () => {
    const points = panelPoints([1, 2, 3], { width: 0.4, height: 0.2 }, 2)
    expect(points).toHaveLength(9)
    expect(points.every((p) => p.z === 3)).toBe(true)
    expect(Math.min(...points.map((p) => p.x))).toBeCloseTo(0.8)
    expect(Math.max(...points.map((p) => p.x))).toBeCloseTo(1.2)
    expect(Math.min(...points.map((p) => p.y))).toBeCloseTo(1.9)
    expect(Math.max(...points.map((p) => p.y))).toBeCloseTo(2.1)
  })
})
