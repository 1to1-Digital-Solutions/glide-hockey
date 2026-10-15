import {
  GOAL_WIDTH,
  MALLET_RADIUS,
  PUCK_RADIUS,
  type OpponentSkill,
} from './gameConfig'
import {
  HALF_LENGTH,
  HALF_WIDTH,
  constrainMallet,
  type Body,
  type Vec2,
} from './puckPhysics'
import { deriveSeed } from './seed'

/**
 * How the machine plays.
 *
 * Two intentions and nothing else: **defending**, standing between the puck and
 * its goal, and **attacking**, getting behind the puck to push it towards the
 * player's. What separates Easy from Impossible is not which one it chooses, but
 * how fast it moves, how far ahead it gets of where the puck is going to be,
 * from how far away it goes out to fetch it and **how much it mixes its shots**
 * (see `OPPONENT_SKILLS` in `gameConfig.ts`).
 *
 * **It does not cheat and it never will**: it never moves faster than the player
 * nor crosses the centre line. It loses because it does not get there in time,
 * which is a reason you understand by watching it.
 *
 * **But what it chooses cannot be guessed.** Always attacking the same post, by
 * the third match you know where it is going to shoot and the game ends there.
 * So there are three plans —at the gap, cross and off the rail— and the one of
 * each hit comes from a **hash of the match, the rally and the hit**
 * (`unitHash`): not a `Math.random`, not a counter. The machine of table-tennis
 * does the same with its placement, and for the same reason: with real
 * randomness the same match never repeats twice, cannot be tested and does not
 * cross over to Godot with its tests; with the hash, two matches with the same
 * seed are the same match and to the player it looks like what it is, an
 * opponent that will not let itself be read.
 *
 * It is a pure function of the state of the table: whoever calls it moves the
 * mallet and passes the result to the physics, just as it does with the
 * player's.
 */

export interface OpponentInput {
  puck: Body
  /** Where its mallet is now. */
  mallet: Vec2
  /** Where the player has theirs: it is the one whose gap has to be found. */
  playerMallet: Vec2
  skill: OpponentSkill
  /** Seconds elapsed since the previous step. */
  dt: number
}

/**
 * Which hit is being talked about. It is what makes the shot unpredictable
 * without being random: the same three numbers always give the same plan.
 */
export interface AimSeed {
  /** The match. Two matches with a different seed do not choose the same shots. */
  match: number
  /** The rally within the match: it goes up with each serve. */
  rally: number
  /** The hit within the rally: it goes up each time the machine touches the puck. */
  hit: number
}

/**
 * A value between 0 and 1 from three integers: always the same for the same ones.
 *
 * It is the `unitHash` of the table-tennis machine with one more number —the
 * match—, and mixed with `Math.imul` instead of by adding: `imul` is exact at 32
 * bits, and with the sum a large seed went out of the integers a `double`
 * represents without losing anything, which is where a hash stops repeating.
 */
export function unitHash(a: number, b: number, c: number): number {
  let x =
    (Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca6b) ^ Math.imul(c, 0xc2b2ae35) ^ 0x1b873593) >>>
    0
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0
  return ((x ^ (x >>> 15)) >>> 0) / 0x100000000
}

/**
 * The seed of the table: the `match` of `AimSeed` with which the machine chooses its shots.
 *
 * Outside the challenge it is the match number (`runId`), which does not repeat the shots of the
 * previous match. **In the challenge it comes from its seed and from the round**, with
 * `deriveSeed`: two people with the same challenge see the same shots in each round, and conceding
 * goals in round 2 does not change those of round 3, which do not depend on how many matches have
 * been started before.
 */
export function tableSeed(challengeSeed: number | null, runId: number, round: number): number {
  return challengeSeed === null ? runId : deriveSeed(challengeSeed, round)
}

/** How far the puck reaches inside the goal without grazing the post. */
const GOAL_REACH = GOAL_WIDTH / 2 - PUCK_RADIUS
/** And how far its centre reaches before touching a rail. */
const PUCK_SIDE_LIMIT = HALF_WIDTH - PUCK_RADIUS

/** Which plan the machine has for this hit. */
export type OpponentPlan =
  /** At the post the player's mallet leaves most open. */
  | 'gap'
  /** At the other one, the one it does cover: the one that fools whoever goes to the gap too early. */
  | 'cross'
  /** At the rail, so that the puck reaches the goal from the opposite side. */
  | 'bank'

/**
 * How much gap the player's mallet leaves at each post, in metres.
 *
 * **The mallet is read, not the player's side.** A mallet a hand's breadth from
 * the left post covers it even if its centre is in the right half of the goal,
 * and a mallet outside the frame covers neither of the two. What decides is how
 * much room is left between the edge of the mallet and the point through which
 * the puck goes in.
 */
export function goalGaps(playerMallet: Vec2): { left: number; right: number } {
  const gap = (post: number) =>
    Math.max(0, Math.abs(post - playerMallet.x) - MALLET_RADIUS)
  return { left: gap(-GOAL_REACH), right: gap(GOAL_REACH) }
}

/**
 * The post with the bigger gap: `-1` the left one, `1` the right one.
 *
 * Tied —the mallet in the centre— it shoots to the left: it does not matter
 * which, what will not do is the dead spot of shooting right at it. Always
 * aiming at the middle, a player who leaves the mallet in front of their goal is
 * a perfect plug: the puck goes back and forth in a straight line between the
 * two mallets and the rally never ends.
 */
export function openPost(playerMallet: Vec2): -1 | 1 {
  const { left, right } = goalGaps(playerMallet)
  return right > left ? 1 : -1
}

/** Which plan is due on this hit, according to how mixed this difficulty plays. */
export function planFor(skill: OpponentSkill, seed: AimSeed): OpponentPlan {
  const roll = unitHash(seed.match, seed.rally, seed.hit)
  if (roll < skill.bank) return 'bank'
  if (roll < skill.bank + skill.cross) return 'cross'
  return 'gap'
}

/**
 * Which point the machine shoots at on this hit.
 *
 * It aims at where the whole puck fits, not at the post: grazing it, it would
 * not go in (see `fitsThroughGoal`).
 *
 * The shot off the rail does not aim at the rail: it aims at the **mirror image**
 * of the post on the other side of it, which is the point that makes the puck
 * bounce and end up going in. It is a point outside the table on purpose —it is
 * not a place, it is a direction—, and it comes from the geometry and not from
 * a number picked by eye: the bounce keeps the angle, so the straight line to
 * the mirror image is exactly the one that passes through the post after
 * bouncing. With the restitution of the rail below one the puck opens up a
 * little towards it on the way out, and that puts it further inside the goal,
 * not outside.
 */
export function aimPoint(playerMallet: Vec2, skill: OpponentSkill, seed: AimSeed): Vec2 {
  const open = openPost(playerMallet)
  switch (planFor(skill, seed)) {
    case 'cross':
      return { x: -open * GOAL_REACH, z: HALF_LENGTH }
    case 'bank':
      // It bounces off the rail on the side the player covers and ends at the
      // open post: this way the puck crosses in front of them instead of
      // reaching them head-on, which is what makes them change sides.
      return { x: -open * (2 * PUCK_SIDE_LIMIT + GOAL_REACH), z: HALF_LENGTH }
    default:
      return { x: open * GOAL_REACH, z: HALF_LENGTH }
  }
}

/**
 * Where the opponent's mallet wants to be.
 *
 * Attack only when the puck is in its half and within range: going out to
 * fetch it in the other half is not allowed (`constrainMallet`) and chasing it
 * up to the line leaves the goal open to the first rebound.
 */
export function opponentTarget(
  { puck, mallet, playerMallet, skill }: Omit<OpponentInput, 'dt'>,
  seed: AimSeed,
): Vec2 {
  // Where the puck is going, not where it is: chasing the current position
  // always arrives late, and it is exactly what makes the lowest difficulty weak.
  const predicted: Vec2 = {
    x: puck.position.x + puck.velocity.x * skill.anticipation,
    z: puck.position.z + puck.velocity.z * skill.anticipation,
  }

  const reach = Math.hypot(
    puck.position.x - mallet.x,
    puck.position.z - mallet.z,
  )
  const inOwnHalf = puck.position.z < 0

  if (inOwnHalf && reach <= skill.attackRange) {
    // Behind the puck, on the line that joins it with the point it shoots at:
    // on advancing, the hit goes that way instead of at any rail.
    const goal = aimPoint(playerMallet, skill, seed)
    const toGoal = {
      x: goal.x - puck.position.x,
      z: goal.z - puck.position.z,
    }
    const distance = Math.hypot(toGoal.x, toGoal.z)
    const contact = PUCK_RADIUS + MALLET_RADIUS
    if (distance > 0) {
      return {
        x: puck.position.x - (toGoal.x / distance) * contact,
        z: puck.position.z - (toGoal.z / distance) * contact,
      }
    }
  }

  // Defence: at the depth its difficulty gives it, covering the vertical of
  // the puck. The angle is closed by aiming a little towards the centre, which
  // is where the bounces off the rail come from.
  return {
    x: predicted.x * 0.85,
    z: -HALF_LENGTH + skill.defenseDepth * HALF_LENGTH,
  }
}

/**
 * The opponent's mallet after `dt` seconds: towards where it wants to go,
 * without exceeding its top speed nor leaving its half.
 *
 * It also returns the velocity with which it arrives, which is the one the
 * physics needs to know how hard it hits (see `resolveMalletHit`).
 */
export function stepOpponent(
  { puck, mallet, playerMallet, skill, dt }: OpponentInput,
  seed: AimSeed,
): Body {
  if (!Number.isFinite(dt) || dt <= 0) {
    return { position: mallet, velocity: { x: 0, z: 0 } }
  }

  const target = opponentTarget({ puck, mallet, playerMallet, skill }, seed)
  const delta = { x: target.x - mallet.x, z: target.z - mallet.z }
  const distance = Math.hypot(delta.x, delta.z)
  const budget = skill.maxSpeed * dt

  const step =
    distance <= budget || distance === 0
      ? delta
      : { x: (delta.x / distance) * budget, z: (delta.z / distance) * budget }

  const position = constrainMallet(
    { x: mallet.x + step.x, z: mallet.z + step.z },
    'opponent',
  )

  return {
    position,
    // The real one, not the intended one: the clipping by speed and by the
    // edges of the table has to show in the strength of the hit, or the machine
    // would shoot from a rail as if it had arrived at full tilt.
    velocity: {
      x: (position.x - mallet.x) / dt,
      z: (position.z - mallet.z) / dt,
    },
  }
}

/** Where the machine waits before the rally starts. */
export function opponentStart(skill: OpponentSkill): Vec2 {
  return constrainMallet(
    { x: 0, z: -HALF_LENGTH + skill.defenseDepth * HALF_LENGTH },
    'opponent',
  )
}

/** Where the player's mallet starts: in front of their goal. */
export function playerStart(): Vec2 {
  return constrainMallet({ x: 0, z: HALF_LENGTH * 0.72 }, 'player')
}
