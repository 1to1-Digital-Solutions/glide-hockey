import { afterEach, describe, expect, it } from 'vitest'
import {
  isSceneProbeRequested,
  publishSceneProbe,
  screenPointFromNdc,
  type SceneProbe,
} from './sceneProbe'

/** The canvas of a 1280×720 browser with the game full screen. */
const CANVAS = { left: 0, top: 0, width: 1280, height: 720 }

/** Any snapshot of the table: here it only matters that it is published whole. */
const SNAPSHOT: SceneProbe = {
  playerMallet: { x: 0, z: 0.72 },
  puck: { x: 0, z: 0 },
  puckScreen: { x: 640, y: 300 },
  playerHits: 2,
  goalsAgainst: 0,
}

describe('screenPointFromNdc', () => {
  it('takes the centre of the scene to the centre of the canvas', () => {
    expect(screenPointFromNdc(0, 0, CANVAS)).toEqual({ x: 640, y: 360 })
  })

  it('flips the Y: up in three is up on the screen', () => {
    // In normalised coordinates the Y grows upwards; on the page, downwards.
    // Without the inversion, aiming at the far end of the table would move the
    // mallet to the near edge.
    expect(screenPointFromNdc(0, 1, CANVAS).y).toBe(0)
    expect(screenPointFromNdc(0, -1, CANVAS).y).toBe(720)
  })

  it('takes the corners to the corners', () => {
    expect(screenPointFromNdc(-1, 1, CANVAS)).toEqual({ x: 0, y: 0 })
    expect(screenPointFromNdc(1, -1, CANVAS)).toEqual({ x: 1280, y: 720 })
  })

  it('counts from where the canvas starts, not from the page', () => {
    // Mounted inside another application the game need not take up the whole
    // screen: the point that is published is the one a pointer event would
    // bring, and that one is in page coordinates.
    const embedded = { left: 100, top: 40, width: 800, height: 600 }

    expect(screenPointFromNdc(0, 0, embedded)).toEqual({ x: 500, y: 340 })
  })
})

describe('publishSceneProbe', () => {
  afterEach(() => {
    delete window.__glideHockeyScene
  })

  it('does not create the slot: without it being requested, the scene does not touch the window', () => {
    publishSceneProbe(SNAPSHOT)

    expect(isSceneProbeRequested()).toBe(false)
    expect('__glideHockeyScene' in window).toBe(false)
  })

  it('publishes the snapshot of the table when the slot exists', () => {
    window.__glideHockeyScene = null

    publishSceneProbe(SNAPSHOT)

    expect(window.__glideHockeyScene).toEqual(SNAPSHOT)
  })
})
