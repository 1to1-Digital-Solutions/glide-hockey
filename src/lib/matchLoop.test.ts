import { describe, expect, it } from 'vitest'
import {
  GOAL_PAUSE_SECONDS,
  MALLET_RESTITUTION,
  MAX_PUCK_SPEED,
  OPPONENT_SKILLS,
  PLAYER_MALLET_SPEED,
} from './gameConfig'
import {
  MAX_FRAME_SECONDS,
  advanceTable,
  startTable,
  type FrameInput,
  type TableState,
} from './matchLoop'
import { playerStart, tableSeed } from './opponent'
import { RALLY_SECONDS, type Scorer, type Vec2 } from './puckPhysics'

/**
 * The clock of the match and what the table does with it.
 *
 * What is watched here is that **simulated time is clock time**: a match has
 * to last the same on a machine that paints sixty frames per second as on one
 * that paints fifteen. Clipping the step —which is what the scene used to do—
 * the game went into slow motion as soon as the machine could not keep up, and
 * that does not show in a fast browser: it only shows by giving it slow
 * frames, which is what these tests do.
 *
 * The rates tested include on purpose **some that are not multiples of the
 * simulation step** —7, 23, 45 and 56 frames per second—. Measuring only with
 * 60, 30 and 15, a loop that splits the frame into equal pieces passes too,
 * one that does not go into slow motion but simulates a different match on
 * each machine: at 7 it lasted twice as long and at 56 it never ended.
 */

const skill = OPPONENT_SKILLS.impossible

/** The player still where they start: there is no mouse to move in a test. */
const pointer: Vec2 = playerStart()

function frame(delta: number, extra: Partial<FrameInput> = {}): FrameInput {
  return { delta, pointer, skill, playing: true, ...extra }
}

/** Plays `seconds` clock seconds in frames of `frameSeconds`. */
function play(
  table: TableState,
  {
    frameSeconds,
    seconds,
    input,
  }: {
    frameSeconds: number
    seconds: number
    input?: Partial<FrameInput>
  },
): { table: TableState; goals: Scorer[] } {
  let current = table
  const goals: Scorer[] = []

  for (let played = 0; played < seconds - 1e-9; played += frameSeconds) {
    const result = advanceTable(current, frame(frameSeconds, input))
    current = result.table
    goals.push(...result.goals)
  }

  return { table: current, goals }
}

/** The speed at which the loose puck of `loosePuck` sets off, in m/s. */
const LOOSE_SPEED = 0.8

/**
 * The table with the puck launched across the player's half.
 *
 * Nobody reaches it there —the machine does not cross the centre line and the
 * player's mallet stays in front of their goal—, so what is measured is the
 * clock and nothing else.
 */
function loosePuck(): TableState {
  return {
    ...startTable({ skill, lastScorer: null }),
    puck: { position: { x: -0.4, z: 0.2 }, velocity: { x: LOOSE_SPEED, z: 0 } },
  }
}

/** How far apart the one that has advanced most and the one that has advanced least are. */
function spread(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values)
}

describe('the puck advances with the clock, not with the frames', () => {
  // From a machine with room to spare to one that is choking, and none of 45,
  // 23 and 7 is a multiple of the step: they are the ones that do not fit
  // exactly in the frame.
  const RATES = [60, 45, 30, 23, 15, 7]

  /**
   * The most two rates can drift apart: one simulation step not played.
   *
   * The step is fixed, so what does not make up a whole one is kept for the
   * next frame and at any given instant one rate may be one step ahead of the
   * other. Never more than one: it is an offset, not a drift, and that is why
   * it does not grow with the seconds played.
   */
  const ONE_STEP = LOOSE_SPEED / 60

  /** What the puck has advanced across in `seconds`, at each rate. */
  function travelled(seconds: number): number[] {
    const start = loosePuck().puck.position.x
    return RATES.map((fps) => {
      const { table } = play(loosePuck(), { frameSeconds: 1 / fps, seconds })
      return table.puck.position.x - start
    })
  }

  it('covers the same in one second at any frame rate', () => {
    const distances = travelled(1)

    // That it has really moved: if the puck stayed nailed down, all the rates
    // would agree on zero and the test would say nothing.
    for (const distance of distances) {
      expect(distance).toBeGreaterThan(0.5)
    }

    expect(spread(distances)).toBeLessThanOrEqual(ONE_STEP)
  })

  it('and the offset does not grow however many seconds are played', () => {
    // Six times more match. If the step depended on the frame, this is where
    // the difference would multiply instead of staying where it was.
    expect(spread(travelled(6))).toBeLessThanOrEqual(ONE_STEP)
  })

  it('the player\'s mallet covers the same going towards the pointer', () => {
    // Half a metre of path and a tenth of a second: it has no time to arrive,
    // which is what makes it measure what it advances and not where it ends up
    // stopped.
    const target: Vec2 = { x: 0.4, z: 0.2 }
    const start = startTable({ skill, lastScorer: null }).player.position

    const distances = [60, 40, 20, 10].map((fps) => {
      const { table } = play(startTable({ skill, lastScorer: null }), {
        frameSeconds: 1 / fps,
        seconds: 0.1,
        input: { pointer: target, playing: false },
      })
      const { x, z } = table.player.position
      return Math.hypot(x - start.x, z - start.z)
    })

    for (const distance of distances) {
      expect(distance).toBeGreaterThan(0.4)
    }
    expect(spread(distances)).toBeLessThanOrEqual(PLAYER_MALLET_SPEED / 60)
  })
})

describe('a whole match', () => {
  /**
   * Clock seconds the machine takes to score `goals` goals with the player's
   * mallet stopped. It is the match of the browser test, played here without
   * waiting in real time.
   */
  function secondsToConcede(frameSeconds: number, goals: number): number {
    let table = startTable({ skill, lastScorer: null })
    let conceded = 0
    let clock = 0

    while (conceded < goals) {
      const result = advanceTable(table, frame(frameSeconds))
      table = result.table
      conceded += result.goals.length
      clock += frameSeconds

      if (clock > 120) throw new Error('the machine never got to score')
    }

    return clock
  }

  it('lasts the same with slow frames as with fast frames', () => {
    // 56 and 7 are here because of what happened when splitting the frame into
    // equal pieces: at 7 the same match lasted twenty-four seconds and at 56
    // it never got to end, without going into slow motion in either of the two.
    const durations = [60, 56, 45, 23, 15, 7].map((fps) =>
      secondsToConcede(1 / fps, 3),
    )

    // The match is the same, so the difference is only that of rounding to the
    // frame in which each goal falls.
    expect(spread(durations)).toBeLessThan(0.5)
    // And it lasts what a short match lasts: if it took a minute, the browser
    // test that plays it would run out of time even if all the rates agreed.
    expect(Math.max(...durations)).toBeLessThan(30)
  })
})

describe('the rally that does not end', () => {
  /**
   * Browser frames: about 8 ms with some jitter, which is what turns one match
   * into a different one. The generator is seeded so that the test is the same
   * every time.
   */
  function jitteredFrames(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return 0.008 + (state / 4294967296 - 0.5) * 0.004
    }
  }

  /**
   * Seconds the machine takes to score `goals` with the player's mallet
   * stopped and frames with jitter. It is the match of the browser test.
   */
  function secondsToConcedeJittered(seed: number, goals: number): number {
    const nextFrame = jitteredFrames(seed)
    let table = startTable({ skill, lastScorer: null })
    let conceded = 0
    let clock = 0

    while (conceded < goals) {
      const delta = nextFrame()
      const result = advanceTable(table, frame(delta))
      table = result.table
      conceded += result.goals.filter((g) => g === 'opponent').length
      clock += delta
      if (clock > 300) return clock
    }

    return clock
  }

  it('none of two hundred matches with the mallet stopped is left unfinished', () => {
    // Before the rally rule, 4 % of these matches were still alive at 200 s:
    // an exchange between the machine's mallet and a rail that repeated itself
    // identically for ever. With three goals and a cap of RALLY_SECONDS per
    // rally, the longest one has to stay well under the minute.
    const durations = Array.from({ length: 200 }, (_, seed) =>
      secondsToConcedeJittered(seed + 1, 3),
    )

    expect(Math.max(...durations)).toBeLessThan(60)
  })

  it('past the deadline without a goal it is served from the centre, and the count goes back to zero', () => {
    // The puck crossing the width where nobody reaches, with the rally about
    // to expire: the next step cuts it short.
    const almost: TableState = { ...loosePuck(), rally: RALLY_SECONDS - 1 / 120 }

    const served = advanceTable(almost, frame(1 / 60)).table

    expect(Math.hypot(served.puck.position.x, served.puck.position.z)).toBeLessThan(0.05)
    expect(served.rally).toBe(0)
    expect(served.stalled).toBe(0)
  })

  it('the rally counts the time played, not that of the celebration', () => {
    const shot: TableState = {
      ...startTable({ skill, lastScorer: null }),
      puck: { position: { x: 0, z: -0.7 }, velocity: { x: 0, z: -6 } },
      rally: 12,
    }

    const scored = play(shot, { frameSeconds: 1 / 60, seconds: 0.2 })
    expect(scored.goals).toEqual(['player'])
    expect(scored.table.rally).toBe(0)

    // While the goal is being celebrated the rally does not run.
    const celebrating = play(scored.table, {
      frameSeconds: 1 / 60,
      seconds: GOAL_PAUSE_SECONDS / 2,
    })
    expect(celebrating.table.rally).toBe(0)
  })

  it('outside the match the rally does not run either', () => {
    const idle = play(loosePuck(), {
      frameSeconds: 1 / 60,
      seconds: 2,
      input: { playing: false },
    })
    expect(idle.table.rally).toBe(0)
  })
})

describe('coming back from the background', () => {
  it('does not move the match forward more than what is seen in one frame', () => {
    const table = startTable({ skill, lastScorer: null })

    // Half an hour with the tab asleep, and the cap: the table ends up the
    // same, because of the huge frame only the cap is played and the rest has
    // not happened.
    const asleep = advanceTable(table, frame(1800))
    const capped = advanceTable(table, frame(MAX_FRAME_SECONDS))

    expect(asleep.table).toEqual(capped.table)
    expect(asleep.goals).toEqual(capped.goals)
    // And that cap is small: the most the puck can jump is what it covers at
    // full speed in a quarter of a second, not half a match.
    const jumped = Math.hypot(
      asleep.table.puck.position.x - table.puck.position.x,
      asleep.table.puck.position.z - table.puck.position.z,
    )
    expect(jumped).toBeLessThanOrEqual(MAX_PUCK_SPEED * MAX_FRAME_SECONDS)
  })

  it('a frame with no time leaves the table as it was', () => {
    const table = startTable({ skill, lastScorer: null })

    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = advanceTable(table, frame(delta))
      expect(result.table).toBe(table)
      expect(result.goals).toEqual([])
    }
  })
})

describe('the goal', () => {
  /** The table with the puck going into the machine's goal. */
  function shotOnGoal(): TableState {
    return {
      ...startTable({ skill, lastScorer: null }),
      puck: { position: { x: 0, z: -0.7 }, velocity: { x: 0, z: -6 } },
    }
  }

  it('is scored, is celebrated and then it is served from the centre', () => {
    const scored = play(shotOnGoal(), { frameSeconds: 1 / 60, seconds: 0.2 })

    expect(scored.goals).toEqual(['player'])
    expect(scored.table.pause).toBeGreaterThan(0)
    expect(scored.table.pendingServe).toBe('player')

    // While the celebration lasts the puck waits where it went in.
    const celebrating = play(scored.table, {
      frameSeconds: 1 / 60,
      seconds: GOAL_PAUSE_SECONDS / 2,
    })
    expect(celebrating.table.pause).toBeGreaterThan(0)
    expect(celebrating.table.puck.position).toEqual(scored.table.puck.position)

    // And as soon as it is over, it goes back to the centre and sets off
    // towards the machine, which is the one that has conceded it.
    let served = celebrating.table
    while (served.pause > 0) {
      served = advanceTable(served, frame(1 / 60)).table
    }
    expect(
      Math.hypot(served.puck.position.x, served.puck.position.z),
    ).toBeLessThan(0.05)
    expect(served.puck.velocity.z).toBeLessThan(0)
  })

  it('counts the same goal only once even if the frame is long', () => {
    const long = advanceTable(shotOnGoal(), frame(MAX_FRAME_SECONDS))

    expect(long.goals).toEqual(['player'])
  })
})

describe('outside the match', () => {
  it('moves the mallets but leaves the puck still', () => {
    const table = startTable({ skill, lastScorer: null })
    const target: Vec2 = { x: 0.3, z: 0.5 }

    const result = advanceTable(
      table,
      frame(1 / 60, { pointer: target, playing: false }),
    )

    expect(result.table.puck).toEqual(table.puck)
    expect(result.table.opponent).toEqual(table.opponent)
    expect(result.table.player.position.x).toBeGreaterThan(
      table.player.position.x,
    )
  })
})

/**
 * What the table reports so that the scene puts sound to it: the mallet hit,
 * the bounce off the rail and the goal (see `components/game/Rink.tsx`).
 *
 * It is checked here, and not in the scene, because it is what decides whether
 * a sound gets to play: the scene only translates each report into its noise.
 */
describe('what sounds on the table', () => {
  /** Puck going into the player's mallet, which waits stopped where it starts. */
  function shotAtPlayer(): TableState {
    const { z } = playerStart()
    return {
      ...startTable({ skill, lastScorer: null }),
      puck: { position: { x: 0, z: z - 0.15 }, velocity: { x: 0, z: 3 } },
    }
  }

  /** Puck launched against the right-hand rail, far from the two mallets. */
  function shotAtRail(): TableState {
    return {
      ...startTable({ skill, lastScorer: null }),
      puck: { position: { x: 0.45, z: 0.2 }, velocity: { x: 6, z: 0 } },
    }
  }

  it('the puck sliding across the table does not sound like anything', () => {
    const quiet = advanceTable(loosePuck(), frame(1 / 60))

    expect(quiet.struck).toBe(false)
    expect(quiet.bounced).toBe(false)
    expect(quiet.goals).toEqual([])
  })

  it('reports the mallet hit, and only the hit', () => {
    const hit = advanceTable(shotAtPlayer(), frame(1 / 60))

    expect(hit.struck).toBe(true)
    expect(hit.bounced).toBe(false)
    // And the hit is real: the puck sets off back towards the machine.
    expect(hit.table.puck.velocity.z).toBeLessThan(0)
  })

  it('reports the bounce off the rail, and only the bounce', () => {
    const rail = advanceTable(shotAtRail(), frame(1 / 60))
    expect(rail.bounced).toBe(true)
    expect(rail.struck).toBe(false)
    expect(rail.table.puck.velocity.x).toBeLessThan(0)
  })

  it('says how hard: a puck at six metres per second does not graze the rail', () => {
    // It is what the sound and the vibration scale with: a graze and a sharp
    // hit no longer sound the same.
    const rail = advanceTable(shotAtRail(), frame(1 / 60))
    expect(rail.impact.bounce).toBeGreaterThan(5)
    expect(rail.impact.strike).toBe(0)

    const hit = advanceTable(shotAtPlayer(), frame(1 / 60))
    expect(hit.impact.strike).toBeGreaterThan(2.5)
    expect(hit.impact.bounce).toBe(0)

    const quiet = advanceTable(loosePuck(), frame(1 / 60))
    expect(quiet.impact).toEqual({ strike: 0, bounce: 0 })
  })

  it('the puck stopped on the mallet does not sound once per frame', () => {
    // After the hit the puck moves apart: the contact that is left is the
    // trace of the previous push and announcing it again would set the mallet
    // rattling while the puck comes away.
    let table = advanceTable(shotAtPlayer(), frame(1 / 60)).table
    const reports = [0, 1, 2].map(() => {
      const next = advanceTable(table, frame(1 / 60))
      table = next.table
      return next.struck
    })

    expect(reports).toEqual([false, false, false])
  })

  it('outside the match the table is silent', () => {
    const paused = advanceTable(
      shotAtRail(),
      frame(1 / 60, { playing: false }),
    )

    expect(paused.struck).toBe(false)
    expect(paused.bounced).toBe(false)
  })

  it('during the celebration of the goal nothing sounds either', () => {
    const scored = play(
      {
        ...startTable({ skill, lastScorer: null }),
        puck: { position: { x: 0, z: -0.7 }, velocity: { x: 0, z: -6 } },
      },
      { frameSeconds: 1 / 60, seconds: 0.2 },
    )
    expect(scored.goals).toEqual(['player'])

    const celebrating = advanceTable(scored.table, frame(1 / 60))
    expect(celebrating.table.pause).toBeGreaterThan(0)
    expect(celebrating.struck).toBe(false)
    expect(celebrating.bounced).toBe(false)
  })
})

describe('the mallet held in the hand', () => {
  /**
   * With the mouse the mallet chases the pointer at a capped speed, and that is what gives
   * it weight on a screen. Held in the hand that cap stops being weight and becomes lag:
   * the hand goes ahead and the mallet behind, which is exactly what made it not feel
   * held.
   */
  const farAway = { x: 0.3, z: 0.25 }

  it('goes where the hand goes, without stopping on the way', () => {
    const start = startTable({ skill, lastScorer: null })
    const { table } = advanceTable(start, {
      delta: 1 / 60,
      pointer: farAway,
      skill,
      playing: true,
      inHand: true,
    })

    expect(table.player.position.x).toBeCloseTo(farAway.x, 5)
    expect(table.player.position.z).toBeCloseTo(farAway.z, 5)
  })

  it('with the mouse it keeps chasing, which is what gives it weight', () => {
    const start = startTable({ skill, lastScorer: null })
    const { table } = advanceTable(start, {
      delta: 1 / 60,
      pointer: farAway,
      skill,
      playing: true,
    })

    // In one frame it does not arrive: it has moved, but far less than the hand.
    const travelled = Math.hypot(
      table.player.position.x - start.player.position.x,
      table.player.position.z - start.player.position.z,
    )
    expect(travelled).toBeGreaterThan(0)
    expect(travelled).toBeLessThan(0.1)
  })

  /**
   * What follows measures the two things that broke when the mallet was put in the hand, and
   * that cannot be seen from a screen because with the mouse they do not happen: there the
   * mallet chases with a speed cap and all of this holds by itself.
   */
  const PUCK_AT_REST: Vec2 = { x: 0, z: 0.5 }
  /** Where the hand sets off from, to the left of the puck and level with it. */
  const SWIPE_START: Vec2 = { x: -0.45, z: 0.5 }

  /** Sweeps the hand in a straight line over the stopped puck. */
  function swipe({
    speed,
    fps,
    phase = 0,
  }: {
    /** How many metres per second the hand goes at. */
    speed: number
    fps: number
    /** An initial nudge: it moves the sweep within the simulation step. */
    phase?: number
  }): { touched: boolean; exitSpeed: number } {
    const dt = 1 / fps
    let table: TableState = {
      ...startTable({ skill, lastScorer: null }),
      puck: { position: PUCK_AT_REST, velocity: { x: 0, z: 0 } },
      player: { position: SWIPE_START, velocity: { x: 0, z: 0 } },
    }
    let x = SWIPE_START.x + phase
    for (let i = 0; i < Math.ceil(0.95 / speed / dt) + 3; i++) {
      x += speed * dt
      table = advanceTable(table, frame(dt, { pointer: { x, z: SWIPE_START.z }, inHand: true })).table
      if (table.playerHits > 0) {
        return { touched: true, exitSpeed: Math.hypot(table.puck.velocity.x, table.puck.velocity.z) }
      }
    }
    return { touched: false, exitSpeed: 0 }
  }

  /** Twenty identical sweeps, shifted within the simulation step. */
  const PHASES = Array.from({ length: 20 }, (_, i) => (i / 20) * 0.02)

  it('a fast swipe does not go through the puck without touching it', () => {
    // The contact between mallet and puck measures 11.6 cm. A hand at 9 m/s covers 20 cm in
    // a step of 1/60, so the mallet appeared on the other side without having grazed it:
    // measured, at 45 frames per second a sweep at 7 m/s missed **always** and at 9 the
    // puck stayed still seven times out of ten. And it depended on the phase, so the same
    // hit sometimes went in and sometimes did not, which is what cannot be played.
    for (const fps of [45, 72, 90]) {
      for (const speed of [6, 9, 12]) {
        const misses = PHASES.filter((phase) => !swipe({ speed, fps, phase }).touched)
        expect(misses, `${speed} m/s at ${fps} frames`).toEqual([])
      }
    }
  })

  it('the same swipe hits the same at 45, 72 and 90 frames', () => {
    // The mallet covered the path of a whole frame within a step of 1/60, so its speed came
    // out multiplied by `60/fps`: at 45 it hit a third harder than at 60 and at 90 a third
    // softer. The same hand has to hit the same in all three.
    const speed = 1.5
    const exitSpeeds = [45, 72, 90].map((fps) => swipe({ speed, fps }).exitSpeed)
    for (const exitSpeed of exitSpeeds) expect(exitSpeed).toBeCloseTo(exitSpeeds[0], 2)
    expect(exitSpeeds[0]).toBeGreaterThan(0)
  })

  it('and it hits the same wherever it falls within the step', () => {
    const exitSpeeds = PHASES.map((phase) => swipe({ speed: 1.5, fps: 90, phase }).exitSpeed)
    expect(Math.max(...exitSpeeds) - Math.min(...exitSpeeds)).toBeLessThan(0.05)
  })

  it('the strength of the hit is that of the hand, no more and no less', () => {
    // An elastic collision: the puck leaves at `(1 + restitution)` times what the hand goes
    // at. It is the sum that makes moving slowly push and moving fast shoot.
    for (const speed of [0.6, 1.5, 3]) {
      const { exitSpeed } = swipe({ speed, fps: 72 })
      const expected = Math.min((1 + MALLET_RESTITUTION) * speed, MAX_PUCK_SPEED)
      expect(exitSpeed, `${speed} m/s`).toBeCloseTo(expected, 1)
    }
  })

  it('a hit with the hand hits with the speed of the hand', () => {
    // The velocity comes from the real movement, so there is nothing to fake: moving fast
    // hits hard and moving slowly, softly.
    const start = startTable({ skill, lastScorer: null })
    const { table } = advanceTable(start, {
      delta: 1 / 60,
      pointer: farAway,
      skill,
      playing: true,
      inHand: true,
    })

    expect(Math.hypot(table.player.velocity.x, table.player.velocity.z)).toBeGreaterThan(4.5)
  })
})

describe('the challenge: the same seed, the same table', () => {
  /**
   * Twenty seconds of each of the first three rounds with the player's mallet
   * stopped: where the puck is every half second and the goals that fall. The
   * machine attacks and chooses a shot on each hit, so two seeds that chose
   * the same would leave the same trail and two that did not, would not.
   */
  function rounds(seed: number, runId = 1) {
    return [1, 2, 3].map((round) => {
      let table = startTable({ skill, lastScorer: null, seed: tableSeed(seed, runId + round, round) })
      const trail: string[] = []
      for (let step = 1; step <= 60 * 20; step += 1) {
        const result = advanceTable(table, frame(1 / 60))
        table = result.table
        for (const goal of result.goals) trail.push(goal)
        if (step % 30 === 0) trail.push(`${table.puck.position.x.toFixed(5)},${table.puck.position.z.toFixed(5)}`)
      }
      return trail
    })
  }

  it('with the same seed the machine shoots the same in each round', () => {
    expect(rounds(4_000_000_000)).toEqual(rounds(4_000_000_000))
  })

  it('even if other matches have been started before: the round rules, not the match number', () => {
    expect(rounds(20_260_925, 1)).toEqual(rounds(20_260_925, 40))
  })

  it('with another seed, another match', () => {
    expect(rounds(1)).not.toEqual(rounds(2))
  })

  it('without a challenge, the seed is the match number, as always', () => {
    expect(tableSeed(null, 7, 3)).toBe(7)
    expect(tableSeed(5, 7, 3)).not.toBe(tableSeed(5, 7, 4))
  })
})
