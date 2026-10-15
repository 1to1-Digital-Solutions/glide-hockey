/**
 * Counting how many times each piece of the scene is mounted.
 *
 * «The screen flickers on entering» is what has been reported most often about the headset and
 * the only thing that has never been reproduced from a screen. One possible cause was removed
 * —the gesture demonstration repainting the whole tree ninety times per second— and in two
 * games it went away; in this one it did not. So the cause of this one is another, and guessing
 * the next one costs another round of tests with the goggles on.
 *
 * This does not fix the flicker: it turns it into a number. If on entering the session the world
 * is mounted twice, that **is** a flicker —React throws the tree away and builds it again, and
 * in a headset that is seen as a flash—, and it is seen here without putting anything on your
 * head. If it is mounted only once, the flicker is not a remount and it has to be looked for
 * somewhere else, which is also knowing something.
 *
 * It only counts **if somebody asks for it**: the test creates `window.__mounts` before loading
 * the page. In a real run this does nothing.
 */

declare global {
  interface Window {
    __mounts?: Record<string, number>
    /** How many shader programs the renderer has compiled so far. See `recordPrograms`. */
    __programs?: number
  }
}

/** Is somebody counting mounts? */
export function isMountCountRequested(): boolean {
  return typeof window !== 'undefined' && window.__mounts != null
}

/**
 * Records that `what` has just been mounted.
 *
 * It is called from an effect with no dependencies, which is the place where React reports a
 * mount and only one. In development strict mode the effects run twice on purpose, so this
 * number is read in production —which is how it is exported to the headset—.
 */
export function countMount(what: string): void {
  if (!isMountCountRequested()) return
  const counts = window.__mounts
  /* v8 ignore next -- `isMountCountRequested` guarantees it, but the type does not know */
  if (counts == null) return
  counts[what] = (counts[what] ?? 0) + 1
}

/**
 * How many shader programs the renderer has compiled so far.
 *
 * The other suspect of the flicker, and the one that did yield something: on opening the
 * session **three new programs** were compiled —the materials that only exist inside the
 * headset: the panels, the drawn controller— and compiling a shader blocks the thread. On a
 * screen that is a lost frame; in a headset, at 72 per second and per eye, it is a flash.
 *
 * It is recorded so that a test can say **how many are left to compile when the session is
 * already open**, which is what has to be kept at zero.
 */
export function recordPrograms(howMany: number): void {
  if (!isMountCountRequested()) return
  window.__programs = howMany
}
