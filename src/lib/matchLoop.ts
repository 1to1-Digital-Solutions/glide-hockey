import {
  GOAL_PAUSE_SECONDS,
  PLAYER_MALLET_SPEED,
  type OpponentSkill,
} from './gameConfig'
import { NEW_POSSESSION, goalFeat, touch, type Feat, type Possession } from './feats'
import { opponentStart, playerStart, stepOpponent } from './opponent'
import {
  NO_IMPACT,
  constrainMallet,
  isRallyOver,
  isStalled,
  rallySeconds,
  serve,
  stallSeconds,
  stepPuck,
  strongerImpact,
  type Body,
  type Impact,
  type Scorer,
  type Vec2,
} from './puckPhysics'

/**
 * The match loop: what happens on the table in one frame.
 *
 * It is a pure function of the state of the table and of the time elapsed. The
 * scene (`components/game/Rink.tsx`) passes it the clock and places the
 * result, so the whole match can be played in a test, without a browser and
 * without waiting in real time for a goal to fall.
 *
 * **Simulated time is clock time.** A frame advances the seconds it has taken
 * to arrive, split into steps of exactly `STEP_SECONDS`; what does not make up
 * a step is kept for the next frame. Not clipping them is what makes the match
 * last the same on a machine that paints sixty frames per second as on one
 * that paints fifteen.
 *
 * The step is **always the same size**, and not the frame split into equal
 * pieces, because the table is a chaotic system: two hits that leave one
 * ten-thousandth apart end in different rallies. With the step tied to the
 * frame rate the same match lasted eleven seconds at 60 frames per second,
 * twenty-four at 7 and at 56 it never ended, even though in none of the three
 * it ran in slow motion. With the fixed step the match is the same on every
 * machine and the only thing that changes is how often it is painted.
 *
 * The only thing that does get clipped is the absurd frame: a tab coming back
 * from the background delivers a `delta` of seconds, or of minutes, and with
 * it the match would advance all at once, with goals scored without anybody
 * seeing them. Of that frame `MAX_FRAME_SECONDS` is simulated and the rest of
 * the time is taken as not having happened. They are two different things
 * —«this frame arrived very late» and «this machine is slow»— and only the
 * first one asks for clipping.
 */

/**
 * What one simulation step advances, in seconds. Always the same.
 *
 * It is the resolution with which hits are detected: within a step the mallets
 * are where the previous one left them, and the player's moves at 4.5 m/s. In
 * 1/60 s it covers 7.5 cm, little more than half of what the contact between
 * mallet and puck measures, so there is no way for it to cross it without
 * touching it.
 */
const STEP_SECONDS = 1 / 60

/**
 * Maximum time simulated in one frame, in seconds.
 *
 * It is the border between a slow machine and a tab coming back from the
 * background: below it real time is simulated and above it what is left over
 * is discarded. A quarter of a second is four frames per second —around there
 * nobody is playing any more— and it is at the same time the most the table
 * can jump all at once.
 */
export const MAX_FRAME_SECONDS = 0.25

/**
 * Where the player's mallet goes among the ones passed to the physics, which
 * is how the physics says which one has hit the puck (see `stepPuck`).
 */
const PLAYER_MALLET = 0
/** And where the machine's goes: it is what counts its hits for the seed. */
const OPPONENT_MALLET = 1

/** Everything that has to be remembered of a match between frame and frame. */
export interface TableState {
  puck: Body
  /** The player's mallet, with the velocity with which it hits. */
  player: Body
  /** The machine's mallet, likewise. */
  opponent: Body
  /** Seconds left of celebrating the goal before serving again. */
  pause: number
  /** How long the puck has been dead: past the deadline it is served again. */
  stalled: number
  /**
   * How long the rally has gone without a goal. Past the deadline it is served
   * again: it is what cuts the exchanges the dead puck does not see, because
   * in them the puck does not stop (`RALLY_SECONDS`).
   */
  rally: number
  /** Who scored the last goal: it decides which way the serve goes. */
  pendingServe: Scorer | null
  /** Times the player's mallet has hit the puck in this match. */
  playerHits: number
  /**
   * The seed of this match: it is what makes the machine not shoot the same in
   * two matches in a row, and two with the same seed be the same match.
   */
  seed: number
  /** Rallies played: it goes up with each serve from the centre. */
  plays: number
  /** Times the machine has hit the puck **in this rally**. */
  opponentHits: number
  /**
   * Clock time left over from the last frame without making up a step.
   *
   * It is what keeps the step fixed without losing or inventing seconds: it is
   * kept here and the next frame plays it. It never reaches `STEP_SECONDS`.
   */
  leftover: number
  /**
   * How the possession stands since the last serve (who touched it last, how many times and from
   * where): it is what says whether a goal is a feat (`feats.ts`).
   */
  possession: Possession
}

/** The table freshly set: the puck at the centre and each mallet in its place. */
export function startTable({
  skill,
  lastScorer,
  seed = 0,
}: {
  skill: OpponentSkill
  /** Who scored the last thing that was played, to know which way the serve goes. */
  lastScorer: Scorer | null
  /**
   * Which seed the machine plays with. The scene passes it the match number
   * (`runId`), so a match does not repeat the shots of the previous one; a
   * test passes whichever it wants and the whole match repeats identically.
   */
  seed?: number
}): TableState {
  return {
    // At the start it always goes towards the machine, whoever won the
    // previous point: the first move of the match is the player's (see
    // `serve`).
    puck: serve(null),
    player: { position: playerStart(), velocity: { x: 0, z: 0 } },
    opponent: { position: opponentStart(skill), velocity: { x: 0, z: 0 } },
    pause: 0,
    stalled: 0,
    rally: 0,
    pendingServe: lastScorer,
    playerHits: 0,
    seed,
    plays: 0,
    opponentHits: 0,
    leftover: 0,
    possession: NEW_POSSESSION,
  }
}

export interface FrameInput {
  /** Clock seconds since the previous frame. */
  delta: number
  /** Where the player is pointing. The mallet follows, it does not jump there. */
  pointer: Vec2
  /**
   * Whether the mallet is **held in the hand** (headset). Then it does not chase the pointer: it
   * is wherever the hand is, because a mallet that trails behind your hand does not feel held,
   * it feels dragged. With the mouse it keeps chasing, which is what gives it weight on a
   * screen.
   */
  inHand?: boolean
  skill: OpponentSkill
  /**
   * Whether the puck is in play. Outside the match the mallets keep responding
   * —that way you get into position during the countdown— but the puck waits
   * at the centre.
   */
  playing: boolean
}

export interface FrameResult {
  table: TableState
  /**
   * The goals of the frame, in order. It is a list and not one goal because a
   * frame is several simulation steps; the caller takes them to the scoreboard
   * one by one.
   */
  goals: readonly Scorer[]
  /**
   * Some mallet has hit the puck in this frame.
   *
   * The next two are what the game tells with sound, and that is why they are
   * a yes or a no and not a count: the several steps of a frame all fall in
   * the same millisecond, so two hits in there would not be heard as two hits
   * but as one stronger hit.
   */
  struck: boolean
  /** The puck has bounced off some rail. */
  bounced: boolean
  /** How hard: the strongest hit and the strongest bounce of the frame, in m/s. */
  impact: Impact
  /** The feats of the goals of the frame, in order (`goalFeat`). */
  feats: readonly Feat[]
}

/**
 * How many clock seconds a frame brings.
 *
 * Zero if the clock says nothing usable —a frame with no time, or one with a
 * `delta` that is not a number—, and at most `MAX_FRAME_SECONDS`.
 */
function frameSeconds(delta: number): number {
  if (!Number.isFinite(delta) || delta <= 0) return 0
  return Math.min(delta, MAX_FRAME_SECONDS)
}

/** The table after a frame of `delta` seconds. */
export function advanceTable(
  table: TableState,
  input: FrameInput,
): FrameResult {
  const elapsed = frameSeconds(input.delta)
  if (elapsed === 0) return { table, goals: [], struck: false, bounced: false, impact: NO_IMPACT, feats: [] }

  // The whole steps that fit in what has accumulated are played and what is
  // left over waits for the next frame. Since `elapsed` comes capped, so does
  // the number of steps: a frame that arrives very late does not drag the next
  // one into simulating even more, which is the death spiral of a loop like
  // this.
  const pending = table.leftover + elapsed
  const steps = Math.floor(pending / STEP_SECONDS)

  let current: TableState = {
    ...table,
    leftover: pending - steps * STEP_SECONDS,
  }
  const goals: Scorer[] = []
  const feats: Feat[] = []
  let struck = false
  let bounced = false
  let impact: Impact = NO_IMPACT
  // With the mallet in the hand, the path the hand has made since the previous
  // frame is **spread** over the steps of this one, instead of being covered
  // whole in the first. It is what makes the speed of the mallet be that of
  // the hand and not that of the machine: putting the movement of one frame
  // into a step of 1/60, the mallet went `60/fps` times faster than the hand
  // did —at 45 frames per second it hit a third harder, at 90 a third softer,
  // and in the spare steps it hit with the mallet stopped—.
  const handFrom = table.player.position
  const simulated = steps * STEP_SECONDS
  for (let i = 0; i < steps; i++) {
    const step = advanceStep(current, input, STEP_SECONDS, handPath(handFrom, input, simulated / pending, (i + 1) / steps))
    current = step.table
    if (step.goal != null) goals.push(step.goal)
    if (step.feat != null) feats.push(step.feat)
    struck = struck || step.struck
    bounced = bounced || step.bounced
    impact = strongerImpact(impact, step.impact)
  }

  return { table: current, goals, struck, bounced, impact, feats: feats }
}

/** What a simulation step leaves, besides the table. */
interface StepOutcome {
  table: TableState
  goal: Scorer | null
  struck: boolean
  bounced: boolean
  impact: Impact
  feat: Feat | null
}

/** A step in which nothing worth telling happens. */
const QUIET = { goal: null, struck: false, bounced: false, impact: NO_IMPACT, feat: null } as const

/**
 * How far the hand has got in step `part` of those of this frame.
 *
 * `progress` is the portion of the frame that does get simulated: what is left
 * over without filling a step is played by the next frame, so that stretch of
 * the path is not covered yet either. Without a mallet in the hand there is no
 * path to spread: the pointer is the target and the mallet follows at its own
 * pace.
 */
function handPath(from: Vec2, { pointer, inHand = false }: FrameInput, progress: number, part: number): Vec2 {
  if (!inHand) return pointer
  const t = progress * part
  return {
    x: from.x + (pointer.x - from.x) * t,
    z: from.z + (pointer.z - from.z) * t,
  }
}

/** One simulation step: what really moves the table. */
function advanceStep(
  table: TableState,
  { skill, playing, inHand = false }: FrameInput,
  dt: number,
  /** Where the player's mallet goes in this step. */
  pointer: Vec2,
): StepOutcome {
  const player = movePlayer(table.player, pointer, dt, inHand)

  if (!playing) return { table: { ...table, player }, ...QUIET }

  if (table.pause > 0) {
    const pause = table.pause - dt
    // The serve opens a rally: it raises the count and leaves the machine's
    // hits at zero, which is what makes the next rally not repeat the shots of
    // this one (see `AimSeed` in `opponent.ts`).
    const serving = pause <= 0
    return {
      table: {
        ...table,
        player,
        pause,
        puck: serving ? serve(table.pendingServe) : table.puck,
        plays: serving ? table.plays + 1 : table.plays,
        opponentHits: serving ? 0 : table.opponentHits,
        possession: serving ? NEW_POSSESSION : table.possession,
      },
      ...QUIET,
    }
  }

  const opponent = stepOpponent(
    {
      puck: table.puck,
      mallet: table.opponent.position,
      playerMallet: player.position,
      skill,
      dt,
    },
    { match: table.seed, rally: table.plays, hit: table.opponentHits },
  )

  const result = stepPuck({
    puck: table.puck,
    mallets: [player, opponent],
    dt,
  })
  const playerHits =
    table.playerHits + (result.struckBy.includes(PLAYER_MALLET) ? 1 : 0)
  // Each hit of its own changes the plan of the next one: without this, the
  // machine would choose the same shot during the whole rally and an exchange
  // would always come out the same.
  const opponentHits =
    table.opponentHits + (result.struckBy.includes(OPPONENT_MALLET) ? 1 : 0)
  // A hit is a hit whoever gives it: the puck sounds the same leaving the
  // player's mallet as leaving the machine's.
  const struck = result.struckBy.length > 0
  // Who has touched the puck in this step, with the puck where it was when touched.
  const possession = result.struckBy.reduce<Possession>(
    (before, mallet) => touch(before, mallet === PLAYER_MALLET ? 'player' : 'opponent', table.puck.position.z),
    table.possession,
  )

  if (result.goal != null) {
    return {
      table: {
        ...table,
        player,
        opponent,
        puck: result.puck,
        pause: GOAL_PAUSE_SECONDS,
        stalled: 0,
        rally: 0,
        pendingServe: result.goal,
        playerHits,
        opponentHits,
        possession: NEW_POSSESSION,
      },
      goal: result.goal,
      struck,
      bounced: result.bounced,
      impact: result.impact,
      feat: goalFeat(possession, result.goal),
    }
  }

  // Neither of the two mallets crosses the centre line, so a puck stopped
  // where the other one does not reach leaves the match frozen. It is served
  // again, as on the real table.
  const stalled = stallSeconds(table.stalled, result.puck, dt)
  const rally = rallySeconds(table.rally, dt)
  // It is served again for two different reasons —the dead puck and the rally
  // that does not end— and both start a new rally: both counts to zero.
  const reserve = isStalled(stalled) || isRallyOver(rally)

  return {
    table: {
      ...table,
      player,
      opponent,
      puck: reserve ? serve(table.pendingServe) : result.puck,
      stalled: reserve ? 0 : stalled,
      rally: reserve ? 0 : rally,
      playerHits,
      // Serving again opens a rally, the same as serving after a goal.
      plays: reserve ? table.plays + 1 : table.plays,
      opponentHits: reserve ? 0 : opponentHits,
      possession: reserve ? NEW_POSSESSION : possession,
    },
    goal: null,
    struck,
    bounced: result.bounced,
    impact: result.impact,
    feat: null,
  }
}

/**
 * Brings the player's mallet closer to where they point, without exceeding its speed.
 *
 * The resulting velocity is the real one and not the intended one: it is the
 * one it hits with, so a mallet that reaches the end of its travel has to stop
 * pushing.
 *
 * **Held in the hand it chases nothing**: it goes where the hand goes, and the speed cap
 * would stop being a weight and become a lag between the hand and what is seen in it. The
 * velocity still comes from the real movement, so a hard hit hits hard without having to
 * fake anything.
 */
function movePlayer(mallet: Body, target: Vec2, dt: number, inHand: boolean): Body {
  const from = mallet.position
  const delta = { x: target.x - from.x, z: target.z - from.z }
  const distance = Math.hypot(delta.x, delta.z)
  const budget = PLAYER_MALLET_SPEED * dt

  const step =
    inHand || distance <= budget || distance === 0
      ? delta
      : { x: (delta.x / distance) * budget, z: (delta.z / distance) * budget }

  const position = constrainMallet(
    { x: from.x + step.x, z: from.z + step.z },
    'player',
  )

  return {
    position,
    velocity: {
      x: (position.x - from.x) / dt,
      z: (position.z - from.z) / dt,
    },
  }
}
