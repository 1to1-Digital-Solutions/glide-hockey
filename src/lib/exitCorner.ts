/**
 * Where the exit goes in the settings panel, and what is wrong with it when it is not there.
 *
 * **The bottom right corner, the same in the thirteen.** The drawing was already unified —it is
 * the back arrow of `EXIT_ARROW`— but the **place** was not: nine games had it at the end
 * of the bottom row, three at the left tip of that row and one at mid height, in a
 * side column. With the headset on that is felt as having to look for it in each cabinet.
 * Reported like this: "the button to exit should always be in the same place in the config
 * menu (always at the bottom, or always on the left or always on the right). It depends on
 * the game, it is on one side or on the other".
 *
 * **Why bottom right and not another.** Two reasons, and neither is aesthetic:
 *
 * - It is where it already was in nine of the thirteen. Moving four leaves untouched what is
 *   already known by heart; choosing the other tip would have forced relearning nine games to
 *   fix three.
 * - It is the **row of the actions**, the one looked at when done choosing: play is in the middle
 *   of that row, so exiting does not force sweeping the panel with the ray, only reaching the
 *   end of the row already being looked at. Outside that row —at mid height, in a column— it
 *   crosses what is being chosen and gets pressed by accident, which is what the notice
 *   about leaving the round already taught.
 *
 * As in `legibility.ts`, this **returns sentences and not a `false`**: a test that only said
 * "the exit is wrong" would force opening the layout to know what to look at.
 */

/** A button of the panel, in metres and from the centre of the plate. */
export interface PanelBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** What the plate measures, to know whether the exit sticks out over the edge. */
export interface PanelSize {
  readonly width: number
  readonly height: number
}

/**
 * The slack the comparison is allowed, in metres.
 *
 * The layouts compute positions with divisions and sums of constants, so two buttons
 * of the same row may not land on the same `y` by a thousandth. Half a millimetre is not a
 * different row and has no reason to be one here.
 */
const TOLERANCE = 0.0005

export function exitProblems(
  exit: PanelBox,
  rest: readonly PanelBox[],
  panel: PanelSize,
): string[] {
  const problems: string[] = []

  if (exit.x <= 0) {
    problems.push(
      `the exit is in the left half of the panel (x=${exit.x.toFixed(3)}): it goes to the right`,
    )
  }

  // Its row is the one that overlaps it in height: the rows above may reach further to the
  // right —they are rows of options that take up the whole panel— and that is not a problem.
  const ownRow = rest.filter(
    (other) => Math.abs(other.y - exit.y) < (other.height + exit.height) / 2 - TOLERANCE,
  )
  const furtherRight = ownRow.filter(
    (other) => other.x + other.width / 2 > exit.x + exit.width / 2 + TOLERANCE,
  )
  if (furtherRight.length > 0) {
    problems.push(
      `there are ${furtherRight.length} button(s) of its own row further right than the exit: it has to be the last one of the row`,
    )
  }

  const below = rest.filter((other) => other.y < exit.y - TOLERANCE)
  if (below.length > 0) {
    problems.push(
      `there are ${below.length} button(s) below the exit: it goes in the bottom row of the panel`,
    )
  }

  if (exit.x + exit.width / 2 > panel.width / 2 + TOLERANCE) {
    problems.push('the exit sticks out of the panel on the right')
  }
  if (exit.y - exit.height / 2 < -panel.height / 2 - TOLERANCE) {
    problems.push('the exit sticks out of the panel at the bottom')
  }

  return problems
}
