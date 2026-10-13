/**
 * How much of the eye is taken up by what is written on a headset panel, **as the panel ends up**:
 * where it is relative to the eyes, how it is rotated and which row each text goes in.
 *
 * **The common instrument measures against a distance, and a distance is not enough.**
 * `components/xr/legibility.ts` says whether a font reaches so many metres, but not how many
 * metres away it is. Measuring to the centre of the panel and without foreshortening passes the
 * font that cannot be read with the headset on: a panel that only rotates about the vertical and
 * sits below or above the eyes is seen tilted, and its farthest row takes up less than its
 * centre would say. In batting, «Exit» came out at 0.85° while the test gave 1.416°.
 *
 * So here **each text is measured in its row and with the foreshortening**, with the size the
 * canvas records as written —shrunk included—, against `MIN_READING_DEGREES`. And the two
 * failures no distance sees: a painted size that is not in the panel's list (a font written by
 * hand, or shrunk to fit) and a text that runs into a button, which is a rectangle and not a
 * text.
 *
 * It is the same file in the games that use it. Everything in metres and in the space of whoever
 * is playing: the feet at the origin and `−Z` ahead. No three and no React; the scene places what
 * comes out of here.
 */

/** Three numbers: a position or three angles, like three's. */
export type Triple = readonly [number, number, number]

/** The order in which the three rotations are applied, like that of a three `Euler`. */
export type EulerOrder = 'XYZ' | 'XZY' | 'YXZ' | 'YZX' | 'ZXY' | 'ZYX'

/** A point in the space of whoever is playing. */
export interface Point {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Where a panel is and how it is rotated, in the space of whoever is playing. */
export interface PanelPose {
  /** Its centre. */
  readonly position: Triple
  /** Like three's `rotation`: three angles and, if it is not `'XYZ'`, the order. Without it, facing `+Z`. */
  readonly rotation?: Triple | readonly [number, number, number, EulerOrder]
}

/**
 * The least a font that is read at a glance takes up in the eye, in degrees.
 *
 * **One degree falls short**: with every font above it, the report with the headset on was
 * still «to see it properly I would have to take 2 steps». One degree is what it takes to
 * *make out* a word, not to read a menu straight through. The three quarters of a degree of
 * `legibility.ts` are the floor of the common instrument; this is what is asked for to read.
 */
export const MIN_READING_DEGREES = 1.4

/**
 * At which eye heights it is measured: someone seated or short, the reference one and someone tall.
 *
 * The UI rises and falls with the eyes (`uiRise` in each game), so relative to them it should
 * stay where it is; measuring it at all three is what proves it does, and what would flag a panel
 * that did not follow them.
 */
export const EYE_HEIGHTS = [1.2, 1.6, 1.9] as const

/** The eyes of whoever is playing, standing at the origin, at that height. */
export function eyesAt(height: number): Point {
  return { x: 0, y: height, z: 0 }
}

/** A point rotated about an axis. */
function rotateAbout(axis: 'X' | 'Y' | 'Z', angle: number, p: Point): Point {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  if (axis === 'X') return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }
  if (axis === 'Y') return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c }
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z }
}

/**
 * A point rotated the way three rotates it with that `rotation`.
 *
 * three composes the matrix in the order written —`'XYZ'` is `Rx · Ry · Rz`—, so the last
 * rotation is applied to the point first.
 */
export function rotate(point: Point, rotation?: PanelPose['rotation']): Point {
  if (rotation == null) return point
  const [x, y, z] = rotation
  const order: EulerOrder = rotation[3] ?? 'XYZ'
  const angles = { X: x, Y: y, Z: z }
  return [...order].reverse().reduce((p, axis) => rotateAbout(axis as 'X' | 'Y' | 'Z', angles[axis as 'X' | 'Y' | 'Z'], p), point)
}

/** Where a point of the panel lands, in its plane and from its centre, in the space of whoever is playing. */
export function pointOnPanel(pose: PanelPose, localX: number, localY: number): Point {
  const offset = rotate({ x: localX, y: localY, z: 0 }, pose.rotation)
  return { x: pose.position[0] + offset.x, y: pose.position[1] + offset.y, z: pose.position[2] + offset.z }
}

/** The rotation about the vertical that leaves the face of a panel (`+Z`) looking toward the eyes. */
export function facingEyes(position: Triple, eyes: Point): number {
  return Math.atan2(eyes.x - position[0], eyes.z - position[2])
}

/**
 * How much a panel tilts to look at the eyes, like three's `rotation.x`.
 *
 * **A vertical panel below or above the line of sight is read foreshortened**: edge-on, its
 * letters take up less in the eye than they would head-on. Tilted toward the eyes, it is read
 * head-on.
 */
export function tiltTowardEyes(position: Triple, eyes: Point): number {
  return -Math.atan2(eyes.y - position[1], Math.hypot(eyes.x - position[0], eyes.z - position[2]))
}

/**
 * The whole rotation of a panel that looks at the eyes, in the order in which it is applied: first
 * facing and then tilted. It is what `rotation` receives in the scene, and the press boxes that
 * hang from the same group inherit it.
 */
export function panelRotation(position: Triple, eyes: Point): [number, number, number, 'YXZ'] {
  return [tiltTowardEyes(position, eyes), facingEyes(position, eyes), 0, 'YXZ']
}

/** How many metres from the eyes the centre of a panel ends up, counting the height. */
export function distanceFromEyes(position: Triple, eyes: Point): number {
  return Math.hypot(position[0] - eyes.x, position[1] - eyes.y, position[2] - eyes.z)
}

/**
 * How many degrees something of that height written at that point of the panel takes up in the eye.
 *
 * Counting the foreshortening: a row far from the centre of a large panel, or a panel that does
 * not look at the eyes, is no longer seen head-on.
 */
export function letterAngle(pose: PanelPose, eyes: Point, localX: number, localY: number, height: number): number {
  const low = pointOnPanel(pose, localX, localY - height / 2)
  const high = pointOnPanel(pose, localX, localY + height / 2)
  const a = { x: low.x - eyes.x, y: low.y - eyes.y, z: low.z - eyes.z }
  const b = { x: high.x - eyes.x, y: high.y - eyes.y, z: high.z - eyes.z }
  const cosine = (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z))
  return (Math.acos(Math.min(1, cosine)) * 180) / Math.PI
}

/**
 * How far away, head-on, something of that height would have to be to take up the same as it does
 * there: the distance with which the text is handed to `legibilityProblems`.
 */
export function readingDistance(pose: PanelPose, eyes: Point, localX: number, localY: number, height: number): number {
  const radians = (letterAngle(pose, eyes, localX, localY, height) * Math.PI) / 180
  return height / (2 * Math.tan(radians / 2))
}

/**
 * A text written on a panel, as the measuring canvas records it (`DrawnText`): centre and box, in
 * metres and in the panel's coordinates.
 */
export interface WrittenText {
  readonly text: string
  readonly x: number
  readonly y: number
  readonly width: number
  /** The height of its box: that of the font times the line height (`LINE_HEIGHT`). */
  readonly height: number
}

/** How much a recorded text takes up in the eye, with the font it was written in. */
function textAngle(text: WrittenText, pose: PanelPose, eyes: Point, lineHeight: number): number {
  return letterAngle(pose, eyes, text.x, text.y, text.height / lineHeight)
}

/** The font height of a recorded text, in millimetres and with one decimal, to say it. */
function millimetres(text: WrittenText, lineHeight: number): string {
  return ((text.height / lineHeight) * 1000).toFixed(1)
}

/**
 * The texts that are not read at a glance from those eyes, **as the canvas records them**: with
 * the size they were written at, in the row where they were written and with the foreshortening.
 *
 * @param lineHeight How much box height the font takes up (`LINE_HEIGHT`).
 */
export function unreadableTexts(
  texts: readonly WrittenText[],
  pose: PanelPose,
  eyes: Point,
  lineHeight: number,
  minimum = MIN_READING_DEGREES,
): string[] {
  return texts
    .map((text) => ({ text, degrees: textAngle(text, pose, eyes, lineHeight) }))
    .filter(({ degrees }) => degrees < minimum)
    .map(({ text, degrees }) => `«${text.text}» at ${millimetres(text, lineHeight)} mm takes up ${degrees.toFixed(2)}°`)
}

/** The text that reads worst from those eyes and how many degrees it takes up, or `null` if there is none. */
export function worstText(
  texts: readonly WrittenText[],
  pose: PanelPose,
  eyes: Point,
  lineHeight: number,
): { text: string; degrees: number } | null {
  let worst: { text: string; degrees: number } | null = null
  for (const text of texts) {
    const degrees = textAngle(text, pose, eyes, lineHeight)
    if (worst == null || degrees < worst.degrees) worst = { text: text.text, degrees }
  }
  return worst
}

/** The reading distance of the text that reads worst: the one the whole panel has to be measured with. */
export function worstReadingDistance(texts: readonly WrittenText[], pose: PanelPose, eyes: Point, lineHeight: number): number {
  return Math.max(...texts.map((text) => readingDistance(pose, eyes, text.x, text.y, text.height / lineHeight)))
}

/** The texts written at a size that is not in the list: written by hand, or shrunk to fit. */
export function sizesOffList(texts: readonly WrittenText[], lineHeight: number, sizes: readonly number[]): string[] {
  return texts
    .filter((text) => !sizes.some((size) => Math.abs(text.height / lineHeight - size) < 1e-6))
    .map((text) => `«${text.text}» at ${millimetres(text, lineHeight)} mm`)
}

/** A button of the panel: centre and measurements, in metres. */
export interface PanelButton {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Whether the centre of a text lands inside a button: it is its label. */
export function centreInside(text: WrittenText, button: PanelButton): boolean {
  return Math.abs(text.x - button.x) <= button.width / 2 && Math.abs(text.y - button.y) <= button.height / 2
}

/** No text belongs to any button: the panel writes labels and the buttons carry icons. */
export function noTextOwnsAButton(): boolean {
  return false
}

/**
 * The texts that run into a button that is not theirs.
 *
 * The legibility instrument checks that the texts do not overlap each other, but a button is a
 * rectangle, not a text: a label that grows when the font is enlarged runs into the row of buttons
 * without anything flagging it.
 *
 * @param ownsButton Which text is a button's own, and may go inside. By default, the one whose
 *   centre is inside it; in a panel of labels with no letters on the buttons none is, and so a
 *   label that runs more than halfway into a button does not pass either.
 */
export function textsOnButtons(
  texts: readonly WrittenText[],
  buttons: readonly PanelButton[],
  ownsButton: (text: WrittenText, button: PanelButton) => boolean = centreInside,
): string[] {
  const problems: string[] = []
  for (const text of texts) {
    for (const button of buttons) {
      if (ownsButton(text, button)) continue
      const overlaps =
        Math.abs(text.x - button.x) * 2 < text.width + button.width &&
        Math.abs(text.y - button.y) * 2 < text.height + button.height
      if (overlaps) problems.push(`«${text.text}» runs into the button at (${button.x.toFixed(2)}, ${button.y.toFixed(2)})`)
    }
  }
  return problems
}
