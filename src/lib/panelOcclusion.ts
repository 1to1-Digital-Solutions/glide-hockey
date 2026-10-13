/**
 * What can no longer be seen because of a headset panel.
 *
 * **What `panelReading.ts` measures is whether the panel can be read; this is whether the panel
 * is in the way.** They are two different questions and the second cannot be seen from a
 * screen: in the browser the scene is looked at from wherever one likes and the panel seems to
 * be «to one side», but with the headset on it is looked at from a single place —the eyes of
 * whoever plays— and a plate a bit over a metre wide set one metre away hides whatever is
 * behind it. This game's settings menu was right in front: it hid half the table, the whole
 * scoreboard and the gesture demonstration, and that was only found out with the goggles on.
 *
 * Like `legibility.ts` and `exitCorner.ts`, **it returns phrases and not a `false`**: what it
 * hides and how much, which is what is needed to know which way to move it.
 *
 * Everything in metres and in the space of whoever plays: the feet at the origin and `−Z` ahead.
 */

import { TABLE_CENTER_Z, TABLE_HEIGHT } from './gameConfig'
import { HALF_LENGTH, HALF_WIDTH } from './puckPhysics'
import { rotate, type PanelPose, type Point, type Triple } from './panelReading'

/** What a panel measures, in metres. */
export interface PanelSize {
  readonly width: number
  readonly height: number
}

/** A point of the scene with its name, so as to be able to say what has been hidden. */
export interface Landmark {
  readonly what: string
  readonly points: readonly Point[]
}

const vector = (x: number, y: number, z: number): Point => ({ x, y, z })
const minus = (a: Point, b: Point): Point => vector(a.x - b.x, a.y - b.y, a.z - b.z)
const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Point, b: Point): Point =>
  vector(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)

/**
 * Does the panel come between the eyes and that point?
 *
 * The panel is a rectangle in its plane, so it is enough to know where the line cuts that plane
 * —`t` between 0 and 1: behind the eyes or beyond the point it hides nothing— and whether the
 * cut falls inside the rectangle.
 *
 * No guard for the ray parallel to the panel: there `t` comes out infinite or `NaN`, and the two
 * comparisons below discard it all the same. A branch no test can tell apart is a
 * branch that lies about what is tested.
 */
export function hiddenByPanel(pose: PanelPose, size: PanelSize, eyes: Point, target: Point): boolean {
  const centre = vector(pose.position[0], pose.position[1], pose.position[2])
  const right = rotate(vector(1, 0, 0), pose.rotation)
  const up = rotate(vector(0, 1, 0), pose.rotation)
  const normal = cross(right, up)

  const toward = minus(target, eyes)
  const t = dot(normal, minus(centre, eyes)) / dot(normal, toward)
  if (t <= 0 || t >= 1) return false

  const cut = minus(vector(eyes.x + toward.x * t, eyes.y + toward.y * t, eyes.z + toward.z * t), centre)
  return Math.abs(dot(cut, right)) <= size.width / 2 && Math.abs(dot(cut, up)) <= size.height / 2
}

/**
 * What this panel hides, said in phrases.
 *
 * It is counted over a grid of points and the proportion is stated: hiding one corner of the
 * table and hiding half of it are different things, and a `false` would count them the same.
 */
export function whatThePanelHides(
  pose: PanelPose,
  size: PanelSize,
  eyes: Point,
  landmarks: readonly Landmark[],
): string[] {
  return landmarks
    .map(({ what, points }) => ({
      what,
      hidden: points.filter((point) => hiddenByPanel(pose, size, eyes, point)).length,
      total: points.length,
    }))
    .filter(({ hidden }) => hidden > 0)
    .map(({ what, hidden, total }) => `the panel hides ${what} at ${hidden} of ${total} points`)
}

/**
 * A grid over the board, which is where the puck travels.
 *
 * The puck has no one place: it covers the whole table, so what has to be looked at is whether
 * the panel hides **any** point of the board, not whether it hides where the puck is now.
 */
export function tablePoints(steps: number): Point[] {
  const points: Point[] = []
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      points.push(
        vector(
          -HALF_WIDTH + (2 * HALF_WIDTH * i) / steps,
          TABLE_HEIGHT,
          TABLE_CENTER_Z - HALF_LENGTH + (2 * HALF_LENGTH * j) / steps,
        ),
      )
    }
  }
  return points
}

/** A grid over the face of another panel —the scoreboard, the demonstration— to see if they overlap. */
export function panelPoints(centre: Triple, size: PanelSize, steps: number): Point[] {
  const points: Point[] = []
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      points.push(
        vector(
          centre[0] - size.width / 2 + (size.width * i) / steps,
          centre[1] - size.height / 2 + (size.height * j) / steps,
          centre[2],
        ),
      )
    }
  }
  return points
}
