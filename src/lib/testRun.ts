import type { GoalSignView } from './goal'

/**
 * The run, drivable from a browser test without playing it: the common hook of the hall
 * (`CommonRun` from `e2e/support/common.ts`).
 *
 * Scoring real goals in an e2e means carrying the mallet with the emulator and waiting for the
 * puck to go in, which depends on the machine and on the aim. What the common screenshots look at
 * —the goal sign before starting, on crossing the bronze and at the end— does not depend on how
 * the points were scored but on how many the run carries, and that can be handed to it ready-made.
 *
 * **The key carries the name of the game**: the seventeen are installed at once inside the hall and
 * the slot on `window` is a single one; two games calling their own thing `__run` would clobber each other.
 *
 * **It only counts if somebody asks for it**: the test creates `window.__runGlideHockey` before loading
 * the page and the state of the run (`gameStore.ts`) leaves there what can be asked of it. In a
 * real run this does nothing, which is what allows leaving it in place. It is read from
 * `globalThis` and not from `window`: on the page they are the same, and that way `src/lib` is not tied to the browser.
 */

/** What a test can do to the run. */
export interface TestRun {
  /** Starts a run of the challenge, the record's mode, with no tutorial; the serve, with `score`. */
  start?: () => void
  /** Serves if it has not been served and sets the points of the run in progress. */
  score?: (points: number) => void
  /** Ends it as if the machine had won the round: it counts for the hall. */
  end?: () => void
  /** What the goal sign says now, or `null` if it is not showing. */
  sign?: () => GoalSignView | null
}

declare global {
  var __runGlideHockey: TestRun | undefined
}

/** Leaves at hand what can be done, if somebody has asked for it. */
export function exposeTestRun(api: Required<TestRun>): void {
  const run = globalThis.__runGlideHockey
  if (run == null) return
  Object.assign(run, api)
}
