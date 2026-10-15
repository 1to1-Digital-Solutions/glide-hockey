/**
 * When each visual hint turns on and when it turns off. Without three and without React.
 *
 * **What problem it solves.** A headset game is entered standing, with the hands busy and with
 * nothing to read: if on entering one cannot see what has to be done, all that is left is the
 * tutorial —and the tutorial is the safety net, not the path—. The hints are what teaches the
 * gesture without words: a mark on the floor that says where to stand, the silhouette of what
 * has to be grabbed, the real controller with its button lit, a line that says where what is
 * struck goes.
 *
 * **And the mistake not to make is leaving them on.** A permanent hint stops being a hint and
 * becomes stage that gets in the way: it covers the game, competes for the pixels and keeps
 * explaining something that whoever plays already knows. That is why each hint declares **two
 * ways of turning off** and either of the two is enough:
 *
 * - the **milestone** that makes it useless —as soon as the gesture is done once, it is not
 *   needed—, and
 * - a **deadline**, in case that milestone never comes: whoever stays looking at the ceiling
 *   has no reason either to be left with the ghost of the mallet in front for the rest of the
 *   round.
 *
 * The milestones are the same ones the tutorial already uses (`lib/tutorial.ts`): they are noted
 * by the places that already know what happens —grabbing, striking—, so a hint does not need to
 * listen to anything or stop the game for anybody. It is **deduced**.
 *
 * It is the same file in the thirteen games; what changes from one to another —which hints
 * there are and which milestone turns each one off— goes in its `lib/hintScript.ts`.
 *
 * ## Where this comes from
 *
 * References were looked for before writing it, and what taught the most was **what there is
 * not**:
 *
 * - **Highlighting what can be grabbed is documented and has rules.** Meta calls it
 *   *affordances* and *signifiers* and asks to show the four states —pointed at, grabbed, held,
 *   missed— with glow, squash or throb
 *   (developers.meta.com/horizon/design/hands-best-practices and
 *   .../hands-plain-language-principles, principle 16), and **expressly warns against the
 *   highlight that turns on and off abruptly**: it annoys and tires. That is where `CROSSFADE`
 *   comes from: here nothing appears or disappears in one frame. Half-Life: Alyx does the same
 *   with the gloves —"the object glows so that you know what you are pointing at"— as opposed
 *   to the "loud yellow mesh" of other games (roadtovr.com, *Inside XR Design*).
 * - **Teaching the gesture without words too**, and with a name: *Instructed Motion*, which is
 *   what the arrows of Beat Saber do; without them "the movements would be chaotic and people
 *   would wave their arms at random" (roadtovr.com, *Inside XR Design*). Owlchemy Labs
 *   (Job Simulator) takes it to the opposite extreme from the tutorial: you hand it to someone
 *   and tell them "do whatever you want", and what teaches is the environment
 *   (venturebeat.com).
 * - **And about turning them off nobody says anything.** Not Meta, not Valve, not the talks:
 *   the highlight of what can be grabbed is documented as a **permanent state** of the
 *   interaction, and the teleport arc as a control, not as a hint that is no longer needed once
 *   learned. That is the part that is added here, and it is the one most needed: a permanent
 *   highlight in a game that lasts a minute is stage that covers the game. That is why the
 *   deadline and the milestone are not an implementation detail — they are the only thing in
 *   this file that was not written anywhere.
 */

/**
 * The least and the most that a hint that never gets resolved can last, in seconds.
 *
 * The floor is how long someone takes to look down and understand a drawing with the headset
 * on; the ceiling is where a hint stops being one. They are not tastes: both ends are watched by
 * `scriptProblems`, which is what prevents the next hint someone adds from staying on forever
 * "only while it is being tested".
 */
export const MIN_EXPIRY = 4
export const MAX_EXPIRY = 20

/**
 * How long a hint takes to appear completely or to go away completely, in seconds.
 *
 * **Nothing appears or disappears abruptly.** An object that turns on or off in one frame
 * reads, with the headset on, as a flicker of the scene —which is just what we have spent
 * rounds chasing—, and on top of that it steals the gaze at the wrong time.
 */
export const CROSSFADE = 0.45

/** How much and how fast what is waiting for someone to grab it throbs. */
export const THROB = { strength: 0.12, speed: 3.2 } as const

/**
 * What colour **all** the hints are painted, in the thirteen games.
 *
 * Written here and not taken from each game's palette on purpose, for the same reason as the
 * controller's mark (`RealController.tsx`, where this amber comes from): a hint is not stage,
 * it is a sentence, and it has to stand apart from the stage — from the green of a felt, from
 * the dirt of a cage and from the living room of whoever plays, which is the scenery nobody
 * chose. And it has to be the same in all of them: whoever learns in one game that what throbs
 * in amber is what has to be done does not ask it again in the next one.
 */
export const HINT_MARK_COLOR = '#ffc233'

/**
 * A hint: what it is called, what turns it off and how long it holds if nothing is done.
 *
 * `Milestone` is the name the game gives to what whoever plays has already done, which is the
 * same one its tutorial uses.
 */
export interface Hint<Milestone extends string = string> {
  /** What it is called. It is the only thing the scene looks at to decide whether it paints it. */
  readonly id: string
  /** The milestone that turns it off: as soon as it is done once, the hint is not needed. */
  readonly until: Milestone
  /** And if that milestone does not come, after how many seconds it goes away by itself. */
  readonly expiresAfter: number
  /**
   * The milestone that turns it on, if it does not turn on from the start.
   *
   * It is for what only makes sense to show afterwards: the target's mark says nothing
   * to whoever does not have the mallet in the hand yet.
   */
  readonly from?: Milestone
}

/** The script of a game: all its hints. */
export type HintScript<Milestone extends string> = readonly Hint<Milestone>[]

/** What whoever plays has already done. It accumulates: doing something is not undone. */
export type MilestoneFacts<Milestone extends string> = Readonly<Record<Milestone, boolean>>

/**
 * Is this hint shown right now?
 *
 * @param seconds How long **this** hint has been showable, not how long the round has run.
 *   Each one has its clock because not all start at once: the one that waits for a milestone
 *   (`from`) starts when that milestone comes, and measuring its deadline from the start of the
 *   round would leave it expired before appearing.
 */
export function hintOn<Milestone extends string>(
  hint: Hint<Milestone>,
  facts: MilestoneFacts<Milestone>,
  seconds: number,
): boolean {
  if (facts[hint.until]) return false
  if (hint.from !== undefined && !facts[hint.from]) return false
  return seconds < hint.expiresAfter
}

/** The clock of each hint and which ones are being shown, between one frame and the next. */
export interface HintsState {
  /** How long each hint has been showable, by its name. */
  readonly clocks: Record<string, number>
  /** The ones shown in this frame. */
  readonly lit: Set<string>
}

/** Nothing being shown and all the clocks at zero. */
export function noHints(): HintsState {
  return { clocks: {}, lit: new Set() }
}

/**
 * Advances the clock of each hint and leaves noted which ones are shown.
 *
 * **It mutates what it receives on purpose**: it is the same object that lives between frames,
 * and returning a new one ninety times a second is garbage to collect. The grab latch does the
 * same, for the same reason.
 *
 * A hint that cannot be shown yet has its clock **stopped at zero**: that way, when its
 * milestone comes, it has its whole deadline left.
 */
export function advanceHints<Milestone extends string>(
  script: HintScript<Milestone>,
  facts: MilestoneFacts<Milestone>,
  state: HintsState,
  delta: number,
): HintsState {
  state.lit.clear()
  for (const hint of script) {
    const can = hint.from === undefined || facts[hint.from]
    const clock = can ? (state.clocks[hint.id] ?? 0) + Math.max(0, delta) : 0
    state.clocks[hint.id] = clock
    if (hintOn(hint, facts, clock)) state.lit.add(hint.id)
  }
  return state
}

/**
 * What is seen of a hint this frame, moving toward what is due without jumps.
 *
 * It is kept in the scene and not here because it depends on the frame —and because the exact
 * moment a milestone is met is not in `MilestoneFacts`, which only says it already happened—.
 * This is the arithmetic, which can be tested: from 0 to 1 in `crossfade` seconds, and from 1
 * to 0 in the same.
 *
 * @param crossfade How long the whole trip takes. A crossfade of zero —or the clock stopped—
 *   jumps straight to where it is due, which is what an instant fade would do.
 */
export function moveToward(current: number, target: number, delta: number, crossfade: number = CROSSFADE): number {
  const step = crossfade > 0 ? Math.max(0, delta) / crossfade : Infinity
  return target > current ? Math.min(target, current + step) : Math.max(target, current - step)
}

/**
 * The throb of what is waiting: a factor around 1 with which to scale or raise the
 * opacity.
 *
 * It is what separates a hint from the stage. With `strength` at zero it stays still, which is
 * what `prefers-reduced-motion` asks for.
 */
export function throb(
  seconds: number,
  strength: number = THROB.strength,
  speed: number = THROB.speed,
): number {
  return 1 + strength * Math.sin(seconds * speed)
}

/**
 * Where a demonstration that repeats is at: which lap it is on and how far into that lap.
 *
 * A silhouette that does the gesture only once is missed by whoever was looking elsewhere,
 * which on entering is half the people. It repeats until the hint turns off, and **each lap
 * can be done somewhere else** —another hole, another height—, which is what says that the
 * gesture holds for all of them and not only for that one.
 */
export function sweepPhase(seconds: number, period: number): { lap: number; progress: number } {
  if (!(period > 0)) return { lap: 0, progress: 0 }
  const elapsed = Math.max(0, seconds)
  return { lap: Math.floor(elapsed / period), progress: (elapsed % period) / period }
}

/**
 * What is wrong with a hint script. It returns **sentences**, not a `false`.
 *
 * Like the instrument that measures the legibility of a panel: a test that only said "the
 * script is wrong" would force reading the whole script to know what. What it catches is what
 * slips in by accident —a repeated hint, a deadline that was set "while it is being tested" and
 * stayed, one that turns on and off with the same thing—, and each game runs it from its own
 * test.
 */
export function scriptProblems(script: HintScript<string>): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const hint of script) {
    if (seen.has(hint.id)) problems.push(`the hint "${hint.id}" is twice in the script`)
    seen.add(hint.id)
    if (hint.expiresAfter < MIN_EXPIRY) {
      problems.push(
        `the hint "${hint.id}" lasts ${hint.expiresAfter} s: below ${MIN_EXPIRY} s there is not enough time even to look at it`,
      )
    }
    if (hint.expiresAfter > MAX_EXPIRY) {
      problems.push(
        `the hint "${hint.id}" lasts ${hint.expiresAfter} s: past ${MAX_EXPIRY} s it stops being a hint and is part of the stage`,
      )
    }
    if (hint.from !== undefined && hint.from === hint.until) {
      problems.push(
        `the hint "${hint.id}" turns on and off with the same milestone, "${hint.until}": it would never be seen`,
      )
    }
  }
  return problems
}
