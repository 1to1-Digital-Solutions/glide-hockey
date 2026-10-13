/**
 * Numbers for the headset, drawn with segments.
 *
 * **Why not `<Text>`.** The drei component downloads its fonts from a CDN
 * and the game has to work on a headset with no way out to the internet —
 * besides, the security policy of xrcade's hall blocks it (see `docs/xrcade.md`).
 * Self-hosting a font would be tens of kilobytes and one more file to copy in
 * order to paint ten symbols.
 *
 * A seven-segment display, on the other hand, is seven rectangles: it fits in
 * a table, weighs nothing and reads from afar, which is what a scoreboard
 * hanging at the other end of the table needs.
 *
 * The table is pure logic and that is why it lives here: `XRNumber` only paints
 * the rectangles this function tells it to.
 */

/**
 * The seven segments, by their usual names:
 *
 * ```
 *  --a--
 * |     |
 * f     b
 * |     |
 *  --g--
 * |     |
 * e     c
 * |     |
 *  --d--
 * ```
 */
export type Segment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g'

/** Which segments light up in each digit. */
export const DIGIT_SEGMENTS: readonly Segment[][] = [
  ['a', 'b', 'c', 'd', 'e', 'f'], // 0
  ['b', 'c'], // 1
  ['a', 'b', 'g', 'e', 'd'], // 2
  ['a', 'b', 'g', 'c', 'd'], // 3
  ['f', 'g', 'b', 'c'], // 4
  ['a', 'f', 'g', 'c', 'd'], // 5
  ['a', 'f', 'g', 'e', 'c', 'd'], // 6
  ['a', 'b', 'c'], // 7
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'], // 8
  ['a', 'b', 'c', 'd', 'f', 'g'], // 9
]

/**
 * The digits of a number, from the most significant to the least.
 *
 * Only non-negative integers: nothing else is shown in the headset —goals,
 * points, rounds— and a seven-segment display has nothing to draw a sign or a
 * decimal point with. Whatever arrives odd counts as zero, which is better than
 * leaving the scoreboard blank with no explanation.
 */
export function digitsOf(value: number): number[] {
  if (!Number.isFinite(value) || value <= 0) return [0]
  return String(Math.floor(value)).split('').map(Number)
}

/**
 * Where each segment goes inside its digit and how much it measures, in
 * fractions of the digit's height.
 *
 * In fractions and not in metres so that a single number —the size passed by
 * whoever paints it— scales the whole set without throwing it out of square.
 */
export const SEGMENT_THICKNESS = 0.14

/** Position (x, y) and whether the segment lies flat, in fractions of the height. */
export const SEGMENT_LAYOUT: Record<
  Segment,
  { x: number; y: number; horizontal: boolean }
> = {
  a: { x: 0, y: 0.5, horizontal: true },
  b: { x: 0.25, y: 0.25, horizontal: false },
  c: { x: 0.25, y: -0.25, horizontal: false },
  d: { x: 0, y: -0.5, horizontal: true },
  e: { x: -0.25, y: -0.25, horizontal: false },
  f: { x: -0.25, y: 0.25, horizontal: false },
  g: { x: 0, y: 0, horizontal: true },
}

/** Width of a digit relative to its height, already counting the spacing. */
export const DIGIT_ADVANCE = 0.68
