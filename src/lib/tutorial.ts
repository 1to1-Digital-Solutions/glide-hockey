import { gameStorage } from './storage'

/**
 * The tutorial seen inside the headset the first time.
 *
 * **The problem it solves.** The controls are not understood by looking at the scene: the
 * mallet is not in the hand until the fist closes, it is thrown with the arm —not with the
 * pointer— and it leaves **on release**, not on squeezing. Whoever arrives new first learns to
 * work the menu with the ray, which is exactly what is no use for throwing.
 *
 * **And how it was solved badly.** It was a slide show run by the clock, with the game
 * stopped: three phrases with a stick figure moving, each one its seconds, and when the time
 * ran out it was taken as learnt. Whoever watched it without doing anything left the same as
 * they came in, and whoever already knew it had to wait. Reported with the headset on: a next
 * button and a skip one are needed, it has to show **which button** of the controller is
 * pressed, and **the game must not stop**: if the step is grabbing and one grabs, the mallet
 * should really appear in the hand; if the step is throwing, it should not move on to the
 * next one until the mallet sticks.
 *
 * **How it is solved now: by achievement.** Each step is passed **by doing it**. The tutorial
 * has no clock: it waits. And there is always a way out —next and skip—, because a step that
 * is not achieved would leave someone locked inside it.
 *
 * Only the script lives here —which steps there are, what passes them and whether it has
 * already been seen—, with no three and no React, so that it can be tested without a browser
 * or a headset.
 */

/** What each step teaches, and what has to be done to pass it. */
export type TutorialStepKey =
  /** Closing the hand on the mallet: passed when it is in it. */
  | 'grab'
  /** Hitting the puck: passed with the first hit. */
  | 'hit'
  /** Scoring: passed with the first goal. */
  | 'goal'

/** The steps, in order. */
export const TUTORIAL_STEPS: readonly TutorialStepKey[] = ['grab', 'hit', 'goal']

/**
 * Which button of the controller each step teaches, so as to draw it highlighted.
 *
 * **It is half the lesson.** A phrase that says «el botón de agarre» only helps whoever
 * already knows which one it is; with the headset on, what is in the hand is a controller with
 * five buttons and none with its name written on it. `null` is a step that is not about
 * pressing anything.
 */
export type ControllerButton = 'agarre' | 'gatillo'

export const TUTORIAL_BUTTONS: Record<TutorialStepKey, ControllerButton | null> = {
  grab: 'agarre',
  hit: null,
  goal: null,
}

/**
 * What WebXR calls each of those buttons.
 *
 * It is the bridge between the everyday name —the one used when writing the lesson— and the
 * identifier of the controller profile, which is the one the part is found by inside the 3D
 * model when the tutorial shows it at real size over the hand (`RealController.tsx`).
 * Both names are the standard's and hold for any controller, not only for the Quest
 * ones.
 */
export const COMPONENTE_DEL_BOTON: Record<ControllerButton, string> = {
  agarre: 'xr-standard-squeeze',
  gatillo: 'xr-standard-trigger',
}

/**
 * What the player has already done. It **accumulates**: doing something is not undone.
 *
 * It lives in the state of the match and not here because it is written by the same places
 * that already note down what happens —picking up, throwing, sticking—, and that way the
 * tutorial needs neither to stop anyone's game nor to listen to anything: **it is deduced**.
 */
export type TutorialMilestones = Readonly<Record<TutorialStepKey, boolean>>

/** Nothing done yet. */
export const NO_MILESTONES: TutorialMilestones = { grab: false, hit: false, goal: false }

/** The earlier milestones plus the one just achieved. */
export function recordMilestone(milestones: TutorialMilestones, milestone: TutorialStepKey): TutorialMilestones {
  if (milestones[milestone]) return milestones
  return { ...milestones, [milestone]: true }
}

/**
 * Which step is due to be taught, or `null` if nothing is left.
 *
 * The first one that is not done, skipping those passed with the button. It is **computed**
 * instead of stored: a tutorial that keeps its own count ends up disagreeing with what happens
 * in the match, and here what rules is what happens in the match.
 *
 * @param skipped How many steps the player has skipped with the next button.
 */
export function tutorialStep(milestones: TutorialMilestones, skipped: number): TutorialStepKey | null {
  for (let i = Math.max(0, skipped); i < TUTORIAL_STEPS.length; i += 1) {
    const step = TUTORIAL_STEPS[i]
    if (!milestones[step]) return step
  }
  return null
}

/**
 * Where it is remembered that the tutorial has already been seen. With a prefix, like the
 * record, so as not to clash with anything else of the same origin.
 */
export const TUTORIAL_SEEN_KEY = 'glide-hockey:tutorial-seen'

/** What is written once it has been seen. */
/**
 * What is stored as "already seen": **the version of the lesson**, not a yes.
 *
 * Any other value shows it again, so raising this number is the way for whoever already saw
 * it to see it again when what it teaches has changed. Version 2 was the grab one —the
 * demonstration said «mantén el gatillo» and what is pressed is the grip one—; version **3**
 * is this one: the tutorial stopped being a slide show with the game stopped and came to be
 * done by playing, step by step and showing which button is pressed. Whoever saw version 2
 * has not done this one.
 */
export const TUTORIAL_SEEN_VALUE = '3'

/**
 * Has the demonstration already been seen?
 *
 * What is read is external input —anyone can edit it from the browser's tools—, so only the
 * exact value counts as seen: anything else shows it again, which is what the game did
 * before storing anything.
 */
export function tutorialSeen(storage: Pick<Storage, 'getItem'> | null = gameStorage()): boolean {
  if (storage === null) return false
  try {
    return storage.getItem(TUTORIAL_SEEN_KEY) === TUTORIAL_SEEN_VALUE
  } catch {
    // Storage blocked: it is shown again. Seeing it once too often is better than not
    // understanding.
    return false
  }
}

/**
 * Leaves a record that it has already been seen.
 *
 * @returns whether it was stored. A `false` is not an error: it means this browser stores
 *   nothing and the demonstration will be seen next time too.
 */
export function markTutorialSeen(storage: Storage | null = gameStorage()): boolean {
  if (storage === null) return false
  try {
    storage.setItem(TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE)
    return true
  } catch {
    return false
  }
}
