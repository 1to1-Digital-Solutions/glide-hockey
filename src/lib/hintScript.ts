import type { Hand } from './settings'
import type { HintScript } from './hints'
import { GOAL_WIDTH, MALLET_RADIUS, PUCK_RADIUS, TABLE_CENTER_Z } from './gameConfig'
import { playerStart } from './opponent'
import { HALF_LENGTH, HALF_WIDTH } from './puckPhysics'

/**
 * The visual hints of this game: what is shown on entering, and what turns each one off.
 *
 * **What cannot be seen by looking at the table** is three things. Where to stand —facing it and
 * one step away, since in air hockey there is no sideways stance—. That the mallet **is grabbed
 * with the hand**, by taking it to the mallet and squeezing, and not by pointing at it with the
 * ray: it is the mistake that costs the whole first match, and the one that had to be fixed by
 * hand in `lib/malletGrab.ts` («pointing feels like driving a cursor»). And what is done with
 * it: **pushing it against the puck**, not waiting for the puck to come.
 *
 * The engine —when each one turns on and when it turns off— is in `lib/hints.ts`, the same file
 * in the sixteen games. Here is what belongs to this one: the script and the dimensions of what
 * is drawn, which come from here and not from inside the scene so that the test can measure
 * **the same numbers that are drawn** and not a copy of them.
 *
 * **What has to be picked up, highlighted, is not here**, and on purpose: the mallet already
 * lights up by itself while the countdown waits for it (`highlighted` in
 * `components/game/Mallet.tsx`). It was born from a different complaint —«the countdown stays
 * stopped at 1 with no explanation»— and that is why it stays where it is: it answers *why it
 * does not start*, which is a question that is still there once the deadline of any hint has
 * passed. Adding an amber halo here around the same mallet would be drawing the same sentence
 * twice.
 *
 * The dimensions are in **table coordinates** —the X axis from rail to rail, the Z from goal to
 * goal, `y = 0` on the surface and the player defending `+Z`—, except the footprints, which go
 * on the floor and at the feet of whoever enters. Whoever draws them plants them in the right
 * place (`components/game/Hints.tsx`).
 */

/**
 * What a hint of this game can wait for or take for granted.
 *
 * `grab`, `hit` and `goal` are **the same milestones the tutorial already uses**
 * (`lib/tutorial.ts`), and they are recorded by the same places that already know what happens:
 * the mallet when the hand closes on it and the table at the first hit and the first goal. That
 * way a hint listens to nothing and stops the game for nobody: it is deduced.
 *
 * `round` is the fourth and does not come from the tutorial: it says that **the match has
 * started**, which here is the same as saying there is a mallet and a puck on the table. In the
 * menu the board is empty on purpose —it is what makes starting noticeable—, and a hint that
 * points at a mallet that is not there is worse than no hint.
 */
export type HintFact = 'round' | 'grab' | 'hit' | 'goal'

/**
 * The script.
 *
 * - **`floor`**, the two footprints of where to stand. They are shown **from the moment the
 *   cabinet is entered**, because getting into position is the only thing that can be done with
 *   the table empty, and they are the last to turn off: they go with the first hit, which is
 *   when whoever plays is really in position.
 * - **`controller`**, the real controller with the grab button lit. It waits for there to be a
 *   match, and here that **is a deliberate departure** from what the other games do —which show
 *   it from the moment of entering—: in the menu the grab button does nothing, because the
 *   panels are operated with the ray. A lit button that does not respond teaches a lie. It
 *   comes out **from the first match** (it used to wait until the tutorial had been seen) and
 *   turns off with the same thing as the ghost mallet: with `grab` or at twelve seconds. It
 *   goes **beside the ghost mallet** (`controllerBesideMallet`) and not on the hand: the hand
 *   is taken by the tutorial's copy.
 * - **`gesture`**, the ghost mallet pushing towards the puck, again and again. It is what
 *   really cannot be guessed, and that is why it lasts longer than the controller.
 * - **`goal`**, the mark on the opposite goal: where what is hit goes. **It says nothing before
 *   having the mallet** —with nothing to hit with, a target is decoration—, so it waits for
 *   `grab`, and goes with the first goal.
 *
 * **The two that sit on the table turn off with `grab`**, which is what keeps them out of the
 * problem of covering the game: the puck does not leave until the mallet is in the hand
 * (`MILESTONE_BEFORE_PUCK_MOVES`), so when something starts running across the table there is
 * none left on it. The one on the goal stays, but it is **painted at the back**, where a decal
 * cannot cover anything that slides over it.
 */
export const HINT_SCRIPT = [
  { id: 'floor', until: 'hit', expiresAfter: 15 },
  { id: 'controller', from: 'round', until: 'grab', expiresAfter: 12 },
  { id: 'gesture', from: 'round', until: 'grab', expiresAfter: 12 },
  { id: 'goal', from: 'grab', until: 'goal', expiresAfter: 12 },
] as const satisfies HintScript<HintFact>

/** What each one is called, so that the scene does not draw them by a made-up name. */
export type MalletHint = (typeof HINT_SCRIPT)[number]['id']

/**
 * Which of them sit on the table, instead of being painted on it or on the floor.
 *
 * **It is the list that decides what must have turned off before the puck leaves.** A decal on
 * the surface cannot cover anything that slides over it; what rises from it —the ghost mallet,
 * the controller model— is on the line that goes from the eyes to the puck, and then it is only
 * acceptable if it disappears before there is a puck to follow.
 */
export const HINTS_ON_THE_TABLE: readonly MalletHint[] = ['gesture', 'controller']

/**
 * The milestone from which the puck may move.
 *
 * Here it is free and not by luck: the countdown **stops at the last second** until the mallet
 * is in the hand (see `malletHeld` in `lib/gameStore.ts`), so `grab` always happens before the
 * serve. The test checks it, because it is the kind of thing that breaks by itself the day
 * someone makes the match start without waiting for anybody.
 */
export const MILESTONE_BEFORE_PUCK_MOVES = 'grab' satisfies HintFact

/* --- The dimensions of what is drawn --- */

/**
 * The two footprints, at the feet of whoever enters, and what each one measures.
 *
 * **Facing forward and level, not staggered**: that is the air hockey stance and half of the
 * message. In billiards the back foot drops behind because the arm goes back and forth along
 * the axis of the cue; here both hands work in front of the body and what is needed is to be
 * able to reach both rails without moving the feet, which is what a square stance gives.
 *
 * They go just behind the near edge of the table, which the game leaves 20 cm from the origin
 * (`TABLE_CENTER_Z`), and shoulder-width apart.
 */
export const FOOTPRINT = { length: 0.26, width: 0.1 }
export const FOOTPRINTS: readonly { x: number; z: number }[] = [
  { x: -0.11, z: 0.03 },
  { x: 0.11, z: 0.03 },
]

/** At what height the footprints are drawn above the floor, before the rasterisation bias. */
export const FOOTPRINTS_Y = 0.005

/**
 * The push the ghost mallet makes: where it goes, how long it takes and what part is the arm
 * drawing back.
 *
 * **It goes back slowly and pushes fast**, which is what tells a hit from a swaying motion.
 * With the two stretches equal what was shown was a windscreen wiper.
 *
 * The travel comes from where the mallet starts (`playerStart()`) and from where the puck is at
 * the serve —in the centre—: it draws back a hand's breadth behind its place and goes as far as
 * brushing the puck. That it ends **touching it** is half of the lesson: a ghost that stops
 * halfway teaches how to move the mallet, not how to hit.
 */
export const PUSH = {
  /** How far it draws back behind where the mallet starts, in metres. */
  back: 0.14,
  /** How long a whole push takes, in seconds. */
  period: 1.6,
  /** What part of that cycle is the arm drawing back. */
  returnAt: 0.62,
} as const

/** Where the puck is at the serve: in the centre of the table. The end of the push comes from there. */
export const PUCK_AT_SERVE = { x: 0, z: 0 } as const

/**
 * Where the ghost mallet passes: from further back than its place to touching the puck.
 *
 * The two ends are computed and not written: that way the ghost keeps showing the right
 * gesture the day the mallet starts somewhere else or the puck changes size.
 */
export function pushTravel(): { from: number; to: number } {
  const start = playerStart().z
  return { from: start + PUSH.back, to: PUCK_AT_SERVE.z + PUCK_RADIUS + MALLET_RADIUS }
}

/**
 * How far the mallet is drawn back at this moment of the push: from 0 —touching the puck— to 1
 * —all the way back—.
 */
export function pushReturn(progress: number): number {
  const step = Math.min(1, Math.max(0, progress))
  if (step < PUSH.returnAt) return step / PUSH.returnAt
  return 1 - (step - PUSH.returnAt) / (1 - PUSH.returnAt)
}

/** Where the ghost mallet is at that moment of the push, in table coordinates. */
export function ghostMalletAt(progress: number): { x: number; z: number } {
  const { from, to } = pushTravel()
  const drawnBack = pushReturn(progress)
  return { x: PUCK_AT_SERVE.x, z: to + (from - to) * drawnBack }
}

/**
 * The mark of the opposite goal: where what is hit goes.
 *
 * It goes **against the back and painted on the surface**, not raised like a target: the puck
 * passes through there, and the only thing that can stay while playing is a decal. It takes up
 * the whole opening of the goal because that is what can be used —whoever aims at the exact
 * centre is shooting at the easiest thing to stop—, and it comes inwards just enough not to be
 * confused with the back rail.
 */
export const GOAL_MARK = {
  /** How wide the mark is: the whole opening of the goal. */
  width: GOAL_WIDTH,
  /**
   * How far it reaches into the table.
   *
   * **Fourteen centimetres and not eight.** It is looked at from the other end of a two-metre
   * table and almost level with it, so what is seen of a strip lying flat is not what it
   * measures: it is what is left of it foreshortened. With eight it read as one more of the
   * lines the table already has painted, and on top of that the machine's mallet, which
   * defends right in front, ate half of it.
   */
  depth: 0.14,
  /** And how far from the back its centre is planted, leaving it wholly inside the table. */
  z: -HALF_LENGTH + 0.085,
} as const

/**
 * The real controller beside the ghost mallet: a hand's breadth from its side, at the height of
 * the hand above the board and enlarged just enough for the button to be read from the eyes.
 *
 * The mallet is picked up with whichever hand is free (`MalletHand`), but the hint shows one:
 * **the hall's dominant hand** (`xrcade:hand`), which is the one that reaches first. To the right
 * of the mallet for a right-hander; for a left-hander, the left one and to its left, mirrored.
 *
 * It is planted beside **where the mallet starts** (`playerStart()`), which is where the ghost
 * begins its push and where the hand is going to reach. TO BE CALIBRATED WITH THE HEADSET: the
 * three figures.
 */
export const CONTROLLER_BESIDE_MALLET = {
  /** How far it moves away from the centre of the mallet towards the hand's side, in metres: a hand's breadth of air between the tip of the controller and the ring. */
  separation: 0.26,
  /** At what height above the board, in metres: where the hand goes when picking up the mallet. */
  height: 0.1,
  /** The controller measures about 12 cm: at almost a metre from the eyes, enlarging it is welcome. */
  scale: 1.5,
} as const

/**
 * Where the controller goes, in table coordinates, and how much it turns about the vertical
 * (three's `rotation.y`): what leaves **the side of the grab button facing the eyes**.
 *
 * The model is drawn as a controller in the hand, pointing at −Z; the grab button of the right
 * one is on its left side (−X). Without turning, seen from the eyes it would be seen end-on;
 * turned like this it is seen from the side, with the button towards whoever plays and the tip
 * towards the ghost. The eyes are above the origin of the player's space, and the table at
 * `TABLE_CENTER_Z` from it. The left one has the grab button on its +X, and the turn that makes
 * it face is the mirror of the right one's.
 */
export function controllerBesideMallet(hand: Hand = 'right'): { position: { x: number; y: number; z: number }; rotation: number } {
  const side = hand === 'left' ? -1 : 1
  const mallet = playerStart()
  const position = { x: mallet.x + side * CONTROLLER_BESIDE_MALLET.separation, y: CONTROLLER_BESIDE_MALLET.height, z: mallet.z }
  const ahead = -(position.z + TABLE_CENTER_Z)
  return { position: position, rotation: Math.atan2(side * ahead, side * position.x) }
}

/** At what height what goes as a decal on the table surface is drawn. */
export const DECAL_Y = 0.002

/**
 * Whether a point of the table falls inside it, with whatever margin you want to give it.
 *
 * It serves for the only thing that can be measured without goggles about what is drawn on
 * top: that it does not stick out. A hint half off the table does not read as a hint, it reads
 * as a bug.
 */
export function onTheTable(point: { x: number; z: number }, margin = 0): boolean {
  return Math.abs(point.x) <= HALF_WIDTH + margin && Math.abs(point.z) <= HALF_LENGTH + margin
}

/** And whether it falls in the player's half, which is where the mallet can move. */
export function inPlayerHalf(point: { x: number; z: number }): boolean {
  return onTheTable(point) && point.z >= 0
}
