/**
 * When the press of a headset button counts.
 *
 * The problem: in an immersive session one same button receives more than one
 * pointer. The two controllers can cross over it and a grab usually registers
 * two pointers almost at once. Without a filter, the buttons that add or
 * subtract —the menu's goals— would fire twice per press.
 *
 * The rule: a press counts if the window has passed since the previous one that
 * counted. And if there is no clock to trust, it counts all the same: when in
 * doubt a button responds, it never stays silent — a whole menu that does not
 * react leaves no trace in the console to explain it.
 *
 * It is pure logic so that it can be tested without a headset: `XRPressable`
 * only draws and calls whatever this decides.
 */

/** Window, in milliseconds, during which a second press is ignored. */
export const PRESS_DEBOUNCE_MS = 300

/**
 * When it was pressed, in milliseconds, or `null` if there is no clock available.
 *
 * `performance` is in every browser; the fallback is for the environments
 * where the game is mounted without it (a test, a server render) and it
 * exists so as not to break, not to block.
 */
export function pressTime(): number | null {
  return typeof performance !== 'undefined' ? performance.now() : null
}

/**
 * Does this press count?
 *
 * @param now when it was pressed, or `null` if it is not known
 * @param lastPress when the previous one counted, or `null` if there has been none
 * @param disabled whether the button is disabled
 */
export function pressCounts(
  now: number | null,
  lastPress: number | null,
  disabled = false,
): boolean {
  if (disabled) return false
  if (now == null || lastPress == null) return true
  return now - lastPress >= PRESS_DEBOUNCE_MS
}
