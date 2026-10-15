import {
  GOAL_WIDTH,
  MALLET_RADIUS,
  MALLET_RESTITUTION,
  MAX_PUCK_SPEED,
  PUCK_FRICTION,
  PUCK_RADIUS,
  SERVE_SPEED,
  TABLE_LENGTH,
  TABLE_WIDTH,
  WALL_RESTITUTION,
} from './gameConfig'

/**
 * The physics of the puck: bounces, hits and goals.
 *
 * It is a plane, not a 3D world. The puck never leaves the table, so the
 * simulation is two coordinates —`x` across, `z` along— and the scene only
 * lifts them to the height of the surface. That is what lets all of this be
 * pure functions that can be tested without opening the browser, and what
 * avoids bringing in a physics engine: the ones the R3F ecosystem uses run in
 * WebAssembly and the security policy of the xrcade hall blocks them (see
 * `docs/xrcade.md`).
 *
 * The origin is the centre of the table. The player defends the end of
 * positive `z`, which is the one in front of them; the machine, the one of
 * negative `z`.
 */

export interface Vec2 {
  x: number
  z: number
}

/** A round object that moves across the table. */
export interface Body {
  position: Vec2
  velocity: Vec2
}

/** Who has scored the goal. */
export type Scorer = 'player' | 'opponent'

/** Whose each half of the table is. */
export type Side = 'player' | 'opponent'

export const HALF_WIDTH = TABLE_WIDTH / 2
export const HALF_LENGTH = TABLE_LENGTH / 2

/**
 * How far the puck may advance within one simulation step.
 *
 * At top speed it covers 10 cm per frame, more than the radius of the puck: in
 * a single step it would land on the other side of a mallet without having
 * touched it. With short steps the hit is always detected, and on top of that
 * the bounce off the rail falls where it should instead of one frame later.
 */
const MAX_STEP_DISTANCE = 0.02

/** Sub-steps per frame. The cap cuts short an absurd `dt` —a tab coming back
 * from the background— instead of hanging the loop. */
const MAX_SUBSTEPS = 24

function magnitude(v: Vec2): number {
  return Math.hypot(v.x, v.z)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Clips the speed to the game's cap while keeping the direction. */
function capSpeed(velocity: Vec2): Vec2 {
  const speed = magnitude(velocity)
  if (speed <= MAX_PUCK_SPEED || speed === 0) return velocity
  const scale = MAX_PUCK_SPEED / speed
  return { x: velocity.x * scale, z: velocity.z * scale }
}

/**
 * Whether the whole puck fits through the gap of the goal.
 *
 * It is required to fit whole, not to graze it: right at the edge, the puck
 * would go through where the scene draws the post, and a goal that is seen
 * going in through the iron is not accepted as a goal.
 */
export function fitsThroughGoal(x: number): boolean {
  return Math.abs(x) <= GOAL_WIDTH / 2 - PUCK_RADIUS
}

/** Keeps a mallet inside the table and inside its own half. */
export function constrainMallet(position: Vec2, side: Side): Vec2 {
  const sideLimit = HALF_WIDTH - MALLET_RADIUS
  // The mallet does not cross the centre line: it is the rule of the table
  // game and, without it, the machine would defend inside the opposite goal.
  // It is measured by the edge of the mallet, so its centre stays one radius
  // away from the centre.
  const centerLimit = MALLET_RADIUS
  const backLimit = HALF_LENGTH - MALLET_RADIUS

  return {
    x: clamp(position.x, -sideLimit, sideLimit),
    z:
      side === 'player'
        ? clamp(position.z, centerLimit, backLimit)
        : clamp(position.z, -backLimit, -centerLimit),
  }
}

/**
 * Resolves the hit of a mallet against the puck.
 *
 * The mallet has infinite mass —a hand carries it, not the physics—, so the
 * collision is resolved in its frame of reference: only the velocity of the
 * puck changes, and it does so by reflecting the component that brings them
 * together. Adding the velocity of the mallet is what turns a sharp hit into a
 * shot and a follow-through into a pass.
 *
 * Returns `null` if they do not touch.
 */
/**
 * How hard each thing happened in a step, in metres per second: the approach
 * speed of the mallet hit and the normal component with which the puck reached
 * the rail. Zero if there was none. It is what tells a graze from a sharp hit,
 * and whoever sounds and whoever vibrates scale with it.
 */
export interface Impact {
  strike: number
  bounce: number
}

export const NO_IMPACT: Impact = { strike: 0, bounce: 0 }

/** The strongest impact of each kind between two. */
export function strongerImpact(a: Impact, b: Impact): Impact {
  return { strike: Math.max(a.strike, b.strike), bounce: Math.max(a.bounce, b.bounce) }
}

/** The puck after a mallet hit, with the approach speed that caused it. */
export type MalletHit = Body & { approach: number }

export function resolveMalletHit(puck: Body, mallet: Body): MalletHit | null {
  const contact = PUCK_RADIUS + MALLET_RADIUS
  const offset = {
    x: puck.position.x - mallet.position.x,
    z: puck.position.z - mallet.position.z,
  }
  const distance = magnitude(offset)
  if (distance >= contact) return null

  // Centres exactly on top of each other: there is no collision direction to
  // deduce, so it is given one towards the goal opposite the mallet and we
  // carry on. It happens at the start of the match if someone leaves the
  // mallet on the serve spot.
  const normal =
    distance > 0
      ? { x: offset.x / distance, z: offset.z / distance }
      : { x: 0, z: mallet.position.z <= 0 ? 1 : -1 }

  const position = {
    x: mallet.position.x + normal.x * contact,
    z: mallet.position.z + normal.z * contact,
  }

  const relative = {
    x: puck.velocity.x - mallet.velocity.x,
    z: puck.velocity.z - mallet.velocity.z,
  }
  const approach = relative.x * normal.x + relative.z * normal.z
  // They were already moving apart: the contact is what is left of an earlier
  // hit and reflecting again here would leave it buzzing stuck to the mallet.
  if (approach >= 0) return { position, velocity: puck.velocity, approach: 0 }

  const impulse = (1 + MALLET_RESTITUTION) * approach
  return {
    position,
    velocity: capSpeed({
      x: puck.velocity.x - impulse * normal.x,
      z: puck.velocity.z - impulse * normal.z,
    }),
    approach: -approach,
  }
}

/**
 * Where the mallet was at fraction `t` of the step.
 *
 * The mallet arrives at `position` with `velocity`, so where it came from can
 * be deduced: `position - velocity * dt`. Sweeping it along that segment is
 * what makes a hit be detected where it happened and not where the hand ended.
 */
function malletAt(mallet: Body, dt: number, t: number): Body {
  const remaining = (1 - t) * dt
  return {
    position: {
      x: mallet.position.x - mallet.velocity.x * remaining,
      z: mallet.position.z - mallet.velocity.z * remaining,
    },
    velocity: mallet.velocity,
  }
}

export interface StepInput {
  puck: Body
  /** The mallets that can hit it, with the velocity they carry. */
  mallets: readonly Body[]
  /** Seconds elapsed since the previous step. */
  dt: number
}

export interface StepResult {
  puck: Body
  /** Who has scored in this step, or `null` if the rally goes on. */
  goal: Scorer | null
  /** The puck has bounced off a rail. */
  bounced: boolean
  /**
   * Which mallets have hit it, by their position in `mallets`.
   *
   * It says which one and not only that there was a hit because both mallets
   * hit the same puck and the caller needs to know whose it was: it is what
   * tells a counter-attack by the player from a clearance by the machine.
   */
  struckBy: readonly number[]
  /** How hard the strongest hit and the strongest bounce of the step were. */
  impact: Impact
}

/**
 * Advances the simulation `dt` seconds.
 *
 * As soon as there is a goal it stops: the puck stays where it went in and the
 * caller decides what to do with the rally (celebrate it and serve from the
 * centre, see `serve`).
 */
export function stepPuck({ puck, mallets, dt }: StepInput): StepResult {
  if (!Number.isFinite(dt) || dt <= 0) {
    return { puck, goal: null, bounced: false, struckBy: [], impact: NO_IMPACT }
  }

  // What moves within the step is not only the puck: **the mallet too**, and
  // with the headset on it is in the hand, with no speed cap. If it were taken
  // to be still at the place where it arrives, a fast hand would appear on the
  // other side of the puck without having grazed it. So the sub-steps are set
  // by whichever of the two runs faster.
  const speed = magnitude(puck.velocity)
  const malletTravel = mallets.reduce(
    (largest, mallet) => Math.max(largest, magnitude(mallet.velocity) * dt),
    0,
  )
  const steps = clamp(
    Math.ceil(Math.max(speed * dt, malletTravel) / MAX_STEP_DISTANCE),
    1,
    MAX_SUBSTEPS,
  )
  const subDt = dt / steps

  let current = puck
  let bounced = false
  let impact: Impact = NO_IMPACT
  const struckBy: number[] = []

  for (let i = 0; i < steps; i++) {
    const moved = advance(current, subDt)
    current = moved.puck
    bounced = bounced || moved.bounced
    impact = strongerImpact(impact, { strike: 0, bounce: moved.bounceSpeed })
    if (moved.goal != null) {
      return { puck: current, goal: moved.goal, bounced, struckBy, impact }
    }

    for (let index = 0; index < mallets.length; index++) {
      const hit = resolveMalletHit(current, malletAt(mallets[index], dt, (i + 1) / steps))
      if (hit == null) continue
      // A contact that does not change the velocity is the trace of the
      // previous hit: the puck was already moving apart and here it is only
      // put back in place. Recording it as a hit would count one same push as
      // many times as the frames they take to come apart.
      const pushed =
        hit.velocity.x !== current.velocity.x ||
        hit.velocity.z !== current.velocity.z
      if (pushed && !struckBy.includes(index)) struckBy.push(index)
      impact = strongerImpact(impact, { strike: hit.approach, bounce: 0 })
      current = { position: hit.position, velocity: hit.velocity }
    }
  }
  return { puck: current, goal: null, bounced, struckBy, impact }
}

/** One sub-step: friction, advance and collision against the rails. */
function advance(
  puck: Body,
  dt: number,
): { puck: Body; goal: Scorer | null; bounced: boolean; bounceSpeed: number } {
  // Exponential decay and not a subtraction: this way slowing down does not
  // depend on how often it is called, which is what would happen with a fixed
  // loss per step.
  const drag = Math.exp(-PUCK_FRICTION * dt)
  let velocity = { x: puck.velocity.x * drag, z: puck.velocity.z * drag }
  let x = puck.position.x + velocity.x * dt
  let z = puck.position.z + velocity.z * dt
  let bounced = false
  // The speed at which it reached the rail, in the direction of the rail: it
  // is what is heard and what is felt, before the bounce takes it away.
  let bounceSpeed = 0
  const sideLimit = HALF_WIDTH - PUCK_RADIUS
  if (x < -sideLimit || x > sideLimit) {
    x = clamp(x, -sideLimit, sideLimit)
    bounceSpeed = Math.max(bounceSpeed, Math.abs(velocity.x))
    velocity = { x: -velocity.x * WALL_RESTITUTION, z: velocity.z }
    bounced = true
  }

  const endLimit = HALF_LENGTH - PUCK_RADIUS
  if (z < -endLimit || z > endLimit) {
    if (fitsThroughGoal(x)) {
      // The machine's end (negative z) is a goal for the player, and vice versa.
      return {
        puck: { position: { x, z }, velocity },
        goal: z < 0 ? 'player' : 'opponent',
        bounced,
        bounceSpeed,
      }
    }
    z = clamp(z, -endLimit, endLimit)
    bounceSpeed = Math.max(bounceSpeed, Math.abs(velocity.z))
    velocity = { x: velocity.x, z: -velocity.z * WALL_RESTITUTION }
    bounced = true
  }
  return { puck: { position: { x, z }, velocity }, goal: null, bounced, bounceSpeed }
}

/**
 * Speed below which the puck is taken for dead, in m/s.
 *
 * It is not zero: a puck crawling at ten centimetres per second in a corner
 * nobody reaches is, as far as the match goes, a stopped puck.
 */
export const STALL_SPEED = 0.35

/** Seconds it may stay like that before serving from the centre again. */
export const STALL_SECONDS = 4

/**
 * How long the puck has been stopped after `dt` seconds.
 *
 * It accumulates while it goes slowly and resets to zero as soon as someone
 * moves it. It is needed because both mallets are forbidden to cross the
 * centre line: a puck that comes to rest in the machine's half, beyond where
 * the machine comes out to fetch it, cannot be touched by anyone and the match
 * freezes without anything failing. Real tables have the same rule.
 */
export function stallSeconds(previous: number, puck: Body, dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return previous
  const speed = magnitude(puck.velocity)
  return speed < STALL_SPEED ? previous + dt : 0
}

/** Whether it is time to serve again because the puck has been dead too long. */
export function isStalled(seconds: number): boolean {
  return seconds >= STALL_SECONDS
}

/**
 * Seconds a rally may last without a goal before serving again.
 *
 * The dead-puck rule does not catch everything: there are rallies in which the
 * puck never stops —a fast exchange between the machine's mallet and a rail,
 * or between the two mallets, that repeats itself identically because the
 * machine always hits towards the same place— and without this they never end.
 * With the player's mallet still, 4 % of the simulated matches were still
 * alive at 200 seconds. A normal rally against the machine lasts a few
 * seconds: twenty without a goal is an exchange, not a match.
 */
export const RALLY_SECONDS = 20

/** How long the rally has gone without a goal after `dt` more seconds. */
export function rallySeconds(previous: number, dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return previous
  return previous + dt
}

/** Whether it is time to serve again because the rally does not end. */
export function isRallyOver(seconds: number): boolean {
  return seconds >= RALLY_SECONDS
}

/**
 * The puck placed at the centre to serve.
 *
 * It goes towards whoever has just conceded the goal —towards the player if
 * the machine scored—, which is how the serve goes on the table: the one who
 * is losing the point gets the first chance. At the start of the match nobody
 * has scored and the puck goes towards the machine, so that the first move is
 * the player's.
 */
export function serve(lastScorer: Scorer | null): Body {
  const towardsPlayer = lastScorer === 'opponent'
  return {
    position: { x: 0, z: 0 },
    velocity: { x: 0, z: towardsPlayer ? SERVE_SPEED : -SERVE_SPEED },
  }
}
