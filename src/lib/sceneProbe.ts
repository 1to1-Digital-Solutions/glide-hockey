import { type Vec2 } from './puckPhysics'

/**
 * What is happening on the table, for whoever looks from outside the Canvas.
 *
 * The puck and the mallets are three objects: from the DOM there is no way to
 * select them, nor to know where they are, nor to know whether they have
 * touched. A browser test that wanted to check that the mouse moves the mallet
 * could only look at the scoreboard and wait for a goal to drop, which depends
 * on the aim and on the machine it runs on.
 *
 * This avoids it by publishing the state of the match, but **only if someone
 * has asked for it**: the scene writes to `window.__glideHockeyScene` if that
 * property already exists, and if it does not exist it does nothing. No browser
 * ships with it, so whoever does not create it —that is, everybody except the
 * tests— pays one check per frame and nothing more.
 */

/** Point of the page, in the same coordinates a pointer event brings. */
export interface ScreenPoint {
  x: number
  y: number
}

/** What the canvas takes up inside the page. */
export interface CanvasRect {
  left: number
  top: number
  width: number
  height: number
}

/** The snapshot of the table that is published every frame. */
export interface SceneProbe {
  /** The player's mallet, in table coordinates. */
  playerMallet: Vec2
  /** The puck, in table coordinates. */
  puck: Vec2
  /**
   * Where the puck is seen, in page pixels: it is where the mouse has to be
   * taken for the mallet to go after it.
   */
  puckScreen: ScreenPoint
  /** Hits of the player's mallet on the puck since the match started. */
  playerHits: number
  /**
   * Goals the machine has scored **on the table** since it was mounted, whether or not they
   * count on the scoreboard: while learning the challenge they do not count (`learning`), and
   * this way one can see they went in all the same.
   */
  goalsAgainst: number
}

declare global {
  interface Window {
    /**
     * The slot the header talks about. Optional because normally it does not
     * exist: only whoever wants to look inside the scene creates it.
     */
    __glideHockeyScene?: SceneProbe | null
  }
}

/**
 * Goes from three's normalised coordinates —the square from −1 to 1, with the Y
 * growing upwards— to the pixel of the page where that point is seen.
 *
 * It is the inverse of what R3F does on receiving a pointer event, so moving
 * the mouse to the returned point aims at the same place on the table again.
 */
export function screenPointFromNdc(
  ndcX: number,
  ndcY: number,
  rect: CanvasRect,
): ScreenPoint {
  return {
    x: rect.left + ((ndcX + 1) / 2) * rect.width,
    y: rect.top + ((1 - ndcY) / 2) * rect.height,
  }
}

/** Has someone asked to see what happens on the table? */
export function isSceneProbeRequested(): boolean {
  return typeof window !== 'undefined' && '__glideHockeyScene' in window
}

/** Publishes the state of the table, if someone has asked for it. */
export function publishSceneProbe(probe: SceneProbe): void {
  if (!isSceneProbeRequested()) return
  window.__glideHockeyScene = probe
}
