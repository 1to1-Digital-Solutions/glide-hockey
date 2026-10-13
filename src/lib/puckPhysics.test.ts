import { describe, expect, it } from 'vitest'
import {
  GOAL_WIDTH,
  MALLET_RADIUS,
  MAX_PUCK_SPEED,
  PUCK_RADIUS,
} from './gameConfig'
import {
  HALF_LENGTH,
  HALF_WIDTH,
  STALL_SECONDS,
  STALL_SPEED,
  constrainMallet,
  fitsThroughGoal,
  isStalled,
  rallySeconds,
  resolveMalletHit,
  serve,
  stallSeconds,
  stepPuck,
  type Body,
} from './puckPhysics'

/** A mallet at rest wherever it is told. */
function still(x: number, z: number): Body {
  return { position: { x, z }, velocity: { x: 0, z: 0 } }
}

describe('the puck', () => {
  it('bounces off the side rail and comes back inwards', () => {
    const puck: Body = {
      position: { x: HALF_WIDTH - PUCK_RADIUS, z: 0 },
      velocity: { x: 3, z: 0 },
    }

    const { puck: after, bounced } = stepPuck({ puck, mallets: [], dt: 1 / 60 })

    expect(bounced).toBe(true)
    expect(after.velocity.x).toBeLessThan(0)
    expect(Math.abs(after.position.x)).toBeLessThanOrEqual(
      HALF_WIDTH - PUCK_RADIUS,
    )
  })

  it('goes into the machine\'s goal and that is a goal for the player', () => {
    const puck: Body = { position: { x: 0, z: -0.9 }, velocity: { x: 0, z: -3 } }

    const { goal } = stepPuck({ puck, mallets: [], dt: 0.1 })

    expect(goal).toBe('player')
  })

  it('going in through your own goal is a goal for the machine', () => {
    const puck: Body = { position: { x: 0, z: 0.9 }, velocity: { x: 0, z: 3 } }

    const { goal } = stepPuck({ puck, mallets: [], dt: 0.1 })

    expect(goal).toBe('opponent')
  })

  it('bounces off the end if it does not fit whole through the gap', () => {
    // Just outside the post: the puck would touch the iron, so it is no goal.
    const x = GOAL_WIDTH / 2 - PUCK_RADIUS + 0.01
    const puck: Body = { position: { x, z: -0.9 }, velocity: { x: 0, z: -3 } }

    const { goal, puck: after } = stepPuck({ puck, mallets: [], dt: 0.1 })

    expect(goal).toBeNull()
    expect(after.velocity.z).toBeGreaterThan(0)
  })

  it('does not go through a mallet even if in one frame it covers more than it', () => {
    // At top speed and with a long step, the puck would jump from one side of
    // the mallet to the other without touching it if the simulation did not
    // split the step.
    const puck: Body = { position: { x: 0, z: -0.4 }, velocity: { x: 0, z: -6 } }

    const { puck: after, struckBy } = stepPuck({
      puck,
      mallets: [still(0, -0.8)],
      dt: 0.05,
    })

    expect(struckBy).toEqual([0])
    expect(after.velocity.z).toBeGreaterThan(0)
    expect(after.position.z).toBeGreaterThan(-0.8)
  })

  it('says which of the two mallets has hit', () => {
    // The machine's is in its place and the player's, in the middle of the
    // way: without knowing which it was, a clearance by the machine and a
    // counter-attack by the player are the same piece of data.
    const puck: Body = { position: { x: 0, z: 0.4 }, velocity: { x: 0, z: 2 } }

    const { struckBy } = stepPuck({
      puck,
      mallets: [still(0, -0.8), still(0, 0.6)],
      dt: 0.05,
    })

    expect(struckBy).toEqual([1])
  })

  it('does not count as a hit the contact the puck is already moving away from', () => {
    // Freshly hit, the puck still overlaps the mallet for a few frames. There
    // is no new push there, only the trace of the previous one: counting it
    // would multiply one hit by the frames they take to come apart.
    const mallet = still(0, 0.6)
    const puck: Body = {
      position: { x: 0, z: 0.5 },
      velocity: { x: 0, z: -3 },
    }

    const { struckBy, puck: after } = stepPuck({
      puck,
      mallets: [mallet],
      dt: 0.01,
    })

    expect(struckBy).toEqual([])
    expect(after.velocity.z).toBeLessThan(0)
  })

  it('slows down by itself as time goes by', () => {
    const puck: Body = { position: { x: 0, z: 0 }, velocity: { x: 0, z: -2 } }

    const { puck: after } = stepPuck({ puck, mallets: [], dt: 0.5 })

    expect(Math.abs(after.velocity.z)).toBeLessThan(2)
  })

  it('ignores an impossible jump in time instead of teleporting', () => {
    const puck: Body = { position: { x: 0, z: 0 }, velocity: { x: 1, z: 1 } }

    const { puck: after } = stepPuck({ puck, mallets: [], dt: Number.NaN })

    expect(after).toBe(puck)
  })
})

describe('the hit of a mallet', () => {
  it('sends the puck back the way it came', () => {
    const puck: Body = {
      position: { x: 0, z: PUCK_RADIUS + MALLET_RADIUS - 0.01 },
      velocity: { x: 0, z: -2 },
    }

    const hit = resolveMalletHit(puck, still(0, 0))

    expect(hit).not.toBeNull()
    expect(hit!.velocity.z).toBeGreaterThan(0)
  })

  it('launches a stopped puck if the mallet pushes it', () => {
    const puck: Body = {
      position: { x: 0, z: PUCK_RADIUS + MALLET_RADIUS - 0.01 },
      velocity: { x: 0, z: 0 },
    }
    const mallet: Body = { position: { x: 0, z: 0 }, velocity: { x: 0, z: 4 } }

    const hit = resolveMalletHit(puck, mallet)

    expect(hit!.velocity.z).toBeGreaterThan(1)
  })

  it('does not hit again a puck that is already moving away', () => {
    const puck: Body = {
      position: { x: 0, z: PUCK_RADIUS + MALLET_RADIUS - 0.01 },
      velocity: { x: 0, z: 3 },
    }

    const hit = resolveMalletHit(puck, still(0, 0))

    expect(hit!.velocity).toEqual(puck.velocity)
  })

  it('never leaves the puck above the top speed', () => {
    const puck: Body = {
      position: { x: 0, z: PUCK_RADIUS + MALLET_RADIUS - 0.01 },
      velocity: { x: 0, z: -5 },
    }
    const mallet: Body = { position: { x: 0, z: 0 }, velocity: { x: 0, z: 20 } }

    const hit = resolveMalletHit(puck, mallet)

    expect(Math.hypot(hit!.velocity.x, hit!.velocity.z)).toBeLessThanOrEqual(
      MAX_PUCK_SPEED + 1e-9,
    )
  })

  it('a mallet at rest cannot send the puck back faster than it arrived', () => {
    // The table does not manufacture energy. A stopped mallet is a wall: it
    // gives back a little less than it receives. With the restitution above 1
    // there used to be, the puck shot off a motionless mallet and the table
    // played by itself.
    for (const incoming of [1, 3, 5]) {
      const puck: Body = {
        position: { x: 0, z: PUCK_RADIUS + MALLET_RADIUS - 0.01 },
        velocity: { x: 0, z: -incoming },
      }

      const hit = resolveMalletHit(puck, still(0, 0))

      expect(Math.hypot(hit!.velocity.x, hit!.velocity.z), `arriving at ${incoming} m/s`).toBeLessThan(incoming)
    }
  })

  it('but a mallet that advances does counter-attack: the hand provides the strength', () => {
    // And it leaves faster than it arrived, with no need to make anything up:
    // the impulse is computed with the relative velocity.
    const puck: Body = {
      position: { x: 0, z: PUCK_RADIUS + MALLET_RADIUS - 0.01 },
      velocity: { x: 0, z: -2 },
    }
    const mallet: Body = { position: { x: 0, z: 0 }, velocity: { x: 0, z: 3 } }

    const hit = resolveMalletHit(puck, mallet)

    expect(hit!.velocity.z).toBeGreaterThan(2)
  })

  it('does not touch the puck if it does not get to reach it', () => {
    const puck: Body = { position: { x: 0, z: 0.5 }, velocity: { x: 0, z: 0 } }

    expect(resolveMalletHit(puck, still(0, 0))).toBeNull()
  })
})

describe('the limits of a mallet', () => {
  it('does not let the player cross the centre line', () => {
    const inside = constrainMallet({ x: 0, z: -0.5 }, 'player')

    expect(inside.z).toBeGreaterThanOrEqual(MALLET_RADIUS)
  })

  it('does not let the machine cross it either', () => {
    const inside = constrainMallet({ x: 0, z: 0.5 }, 'opponent')

    expect(inside.z).toBeLessThanOrEqual(-MALLET_RADIUS)
  })

  it('keeps the mallet inside the rails', () => {
    const inside = constrainMallet({ x: 99, z: -99 }, 'opponent')

    expect(inside.x).toBeLessThanOrEqual(HALF_WIDTH - MALLET_RADIUS)
    expect(inside.z).toBeGreaterThanOrEqual(-(HALF_LENGTH - MALLET_RADIUS))
  })
})

describe('the serve', () => {
  it('goes towards the machine at the start of the match', () => {
    expect(serve(null).velocity.z).toBeLessThan(0)
  })

  it('goes towards whoever has just conceded the goal', () => {
    expect(serve('opponent').velocity.z).toBeGreaterThan(0)
    expect(serve('player').velocity.z).toBeLessThan(0)
  })

  it('leaves the puck at the centre', () => {
    expect(serve(null).position).toEqual({ x: 0, z: 0 })
  })
})

describe('the gap of the goal', () => {
  it('lets the puck through at the centre', () => {
    expect(fitsThroughGoal(0)).toBe(true)
  })

  it('does not let it through grazing the post', () => {
    expect(fitsThroughGoal(GOAL_WIDTH / 2 - PUCK_RADIUS + 0.001)).toBe(false)
  })
})

describe('the dead puck', () => {
  it('counts nothing while the puck is moving', () => {
    const puck: Body = { position: { x: 0, z: 0 }, velocity: { x: 0, z: -2 } }

    expect(stallSeconds(3, puck, 1)).toBe(0)
  })

  it('accumulates the time it has been stopped', () => {
    const puck: Body = { position: { x: 0, z: 0 }, velocity: { x: 0, z: 0 } }

    expect(stallSeconds(1, puck, 0.5)).toBe(1.5)
  })

  it('also counts the one that crawls without getting anywhere', () => {
    const slow: Body = {
      position: { x: 0, z: 0 },
      velocity: { x: STALL_SPEED / 2, z: 0 },
    }

    expect(stallSeconds(0, slow, 1)).toBe(1)
  })

  it('orders a new serve once the deadline has passed, and not before', () => {
    expect(isStalled(STALL_SECONDS - 0.01)).toBe(false)
    expect(isStalled(STALL_SECONDS)).toBe(true)
  })
})

describe('how hard each thing happens', () => {
  it('the mallet hit tells the speed at which they were approaching', () => {
    // Puck at 2 m/s against a mallet coming head-on at 1 m/s: they approach at 3.
    const puck: Body = {
      position: { x: 0, z: PUCK_RADIUS + MALLET_RADIUS - 0.01 },
      velocity: { x: 0, z: -2 },
    }
    const mallet: Body = { position: { x: 0, z: 0 }, velocity: { x: 0, z: 1 } }
    expect(resolveMalletHit(puck, mallet)!.approach).toBeCloseTo(3, 5)
  })

  it('a contact that was already moving apart has no strength', () => {
    const puck: Body = {
      position: { x: 0, z: PUCK_RADIUS + MALLET_RADIUS - 0.01 },
      velocity: { x: 0, z: 3 },
    }
    expect(resolveMalletHit(puck, still(0, 0))!.approach).toBe(0)
  })

  it('the step reports the strongest hit and the strongest bounce, and nothing when there is nothing', () => {
    const rail: Body = {
      position: { x: HALF_WIDTH - PUCK_RADIUS, z: 0 },
      velocity: { x: 3, z: 0 },
    }
    const { impact } = stepPuck({ puck: rail, mallets: [], dt: 1 / 60 })
    // The strength of the bounce is the speed at which it reached the rail
    // (minus the friction of one step), not the one it carries after losing
    // 10 %.
    expect(impact.bounce).toBeGreaterThan(2.9)
    expect(impact.bounce).toBeLessThanOrEqual(3)
    expect(impact.strike).toBe(0)

    const struck: Body = {
      position: { x: 0, z: PUCK_RADIUS + MALLET_RADIUS - 0.01 },
      velocity: { x: 0, z: -2 },
    }
    const hit = stepPuck({ puck: struck, mallets: [still(0, 0)], dt: 1 / 60 })
    expect(hit.impact.strike).toBeGreaterThan(1.9)
    expect(hit.impact.bounce).toBe(0)

    const loose: Body = { position: { x: 0, z: 0 }, velocity: { x: 1, z: 0 } }
    expect(stepPuck({ puck: loose, mallets: [], dt: 1 / 60 }).impact).toEqual({ strike: 0, bounce: 0 })
  })
})

describe('the puck trapped under the mallet', () => {
  it('goes towards the goal opposite the mallet\'s if they are right on top of each other', () => {
    // It happens at the start if someone leaves the mallet on the serve spot:
    // without a collision direction to deduce, the puck would stay inside the
    // mallet for ever and the match would freeze without anything failing.
    const mallet = { position: { x: 0, z: -1 }, velocity: { x: 0, z: 0 } }
    const puck = { position: { x: 0, z: -1 }, velocity: { x: 0, z: 0 } }

    const resolved = resolveMalletHit(puck, mallet)

    expect(resolved).not.toBeNull()
    expect(resolved?.position.z).toBeGreaterThan(-1)
  })

  it('and the other way round with the mallet on the other side of the table', () => {
    const mallet = { position: { x: 0, z: 1 }, velocity: { x: 0, z: 0 } }
    const puck = { position: { x: 0, z: 1 }, velocity: { x: 0, z: 0 } }

    expect(resolveMalletHit(puck, mallet)?.position.z).toBeLessThan(1)
  })
})

describe('the clocks of the rally', () => {
  it('an impossible clock jump moves nothing forward', () => {
    // `dt` comes from the browser: on coming back from a background tab it can
    // arrive as zero, negative or NaN, and with that the clocks would run off.
    for (const dt of [0, -1, Number.NaN]) {
      expect(stallSeconds(2, { position: { x: 0, z: 0 }, velocity: { x: 0, z: 0 } }, dt)).toBe(2)
      expect(rallySeconds(2, dt)).toBe(2)
    }
  })

  it('the stopped puck keeps adding up, and as soon as it moves it goes back to zero', () => {
    const atRest = { position: { x: 0, z: 0 }, velocity: { x: 0, z: 0 } }
    const moving = { position: { x: 0, z: 0 }, velocity: { x: 0, z: 5 } }

    expect(stallSeconds(1, atRest, 0.5)).toBeCloseTo(1.5, 9)
    expect(stallSeconds(1, moving, 0.5)).toBe(0)
  })

  it('the rally adds up whatever happens: only the goal cuts it short', () => {
    expect(rallySeconds(1, 0.5)).toBeCloseTo(1.5, 9)
  })
})
