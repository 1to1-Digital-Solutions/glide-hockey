import { describe, expect, it } from 'vitest'
import {
  GOAL_WIDTH,
  MALLET_RADIUS,
  OPPONENT_SKILLS,
  PUCK_RADIUS,
  type OpponentSkill,
} from './gameConfig'
import {
  aimPoint,
  goalGaps,
  openPost,
  opponentStart,
  opponentTarget,
  planFor,
  playerStart,
  stepOpponent,
  unitHash,
  type AimSeed,
  type OpponentPlan,
} from './opponent'
import { HALF_LENGTH, HALF_WIDTH, fitsThroughGoal, type Body } from './puckPhysics'

const easy = OPPONENT_SKILLS.easy
const medium = OPPONENT_SKILLS.medium
const impossible = OPPONENT_SKILLS.impossible

/** A puck at rest wherever it is told. */
function still(x: number, z: number): Body {
  return { position: { x, z }, velocity: { x: 0, z: 0 } }
}

/** The first hit of the first rally of the match `match`. */
function seed(match: number, rally = 0, hit = 0): AimSeed {
  return { match, rally, hit }
}

/**
 * A seed that makes that difficulty choose that plan.
 *
 * The tests that look at **where** it shoots do not want to depend on which
 * plan a particular number gets: the first one that gives the plan to be looked
 * at is searched for.
 */
function seedFor(skill: OpponentSkill, plan: OpponentPlan): AimSeed {
  for (let hit = 0; hit < 200; hit += 1) {
    const candidate = seed(1, 0, hit)
    if (planFor(skill, candidate) === plan) return candidate
  }
  throw new Error(`there is no seed that gives the plan «${plan}»`)
}

describe('where the machine wants to go', () => {
  it('stands between the puck and its goal when it is far away', () => {
    const target = opponentTarget(
      {
        puck: still(0.4, 0.6),
        mallet: { x: 0, z: -0.8 },
        playerMallet: playerStart(),
        skill: easy,
      },
      seed(1),
    )

    // At its defence depth, covering the side the puck is coming from.
    expect(target.z).toBeLessThan(0)
    expect(target.x).toBeGreaterThan(0)
  })

  it('goes out to hit the puck when it has it close in its half', () => {
    const puck = still(0, -0.5)
    const target = opponentTarget(
      {
        puck,
        mallet: { x: 0, z: -0.6 },
        playerMallet: playerStart(),
        skill: easy,
      },
      seed(1),
    )

    // Behind the puck with respect to the player's goal: to push it towards it
    // you have to get on the other side.
    expect(target.z).toBeLessThan(puck.position.z)
  })

  it('gets ahead to where the puck is going, not to where it is', () => {
    const movingRight: Body = {
      position: { x: 0, z: 0.6 },
      velocity: { x: 2, z: 0 },
    }

    const target = opponentTarget(
      {
        puck: movingRight,
        mallet: { x: 0, z: -0.8 },
        playerMallet: playerStart(),
        skill: impossible,
      },
      seed(1),
    )

    expect(target.x).toBeGreaterThan(0)
  })

  it('defends further forward the higher the level', () => {
    const puck = still(0, 0.6)
    const mallet = { x: 0, z: -0.8 }

    const playerMallet = playerStart()
    const weak = opponentTarget({ puck, mallet, playerMallet, skill: easy }, seed(1))
    const tough = opponentTarget({ puck, mallet, playerMallet, skill: impossible }, seed(1))

    expect(tough.z).toBeGreaterThan(weak.z)
  })

  it('places itself behind the puck on the line of the shot, and the plan chooses that line', () => {
    // The same puck and the same mallet with two different plans leave the
    // machine in two different places: it is what makes the hit go another way.
    const shared = {
      puck: still(0, -0.5),
      mallet: { x: 0, z: -0.6 },
      playerMallet: { x: 0.2, z: 0.85 },
      skill: impossible,
    }

    const atGap = opponentTarget(shared, seedFor(impossible, 'gap'))
    const crossed = opponentTarget(shared, seedFor(impossible, 'cross'))

    expect(atGap.x).not.toBeCloseTo(crossed.x, 4)
  })
})

describe('how the machine moves', () => {
  it('does not move faster than its level allows', () => {
    const mallet = { x: 0, z: -0.2 }
    const dt = 1 / 60

    const moved = stepOpponent(
      {
        puck: still(0.5, 0.9),
        mallet,
        playerMallet: playerStart(),
        skill: easy,
        dt,
      },
      seed(1),
    )

    const travelled = Math.hypot(
      moved.position.x - mallet.x,
      moved.position.z - mallet.z,
    )
    expect(travelled).toBeLessThanOrEqual(easy.maxSpeed * dt + 1e-9)
  })

  it('never crosses the centre line chasing the puck', () => {
    let mallet = opponentStart(impossible)

    for (let i = 0; i < 200; i++) {
      mallet = stepOpponent(
        {
          puck: still(0, 0.9),
          mallet,
          playerMallet: playerStart(),
          skill: impossible,
          dt: 1 / 60,
        },
        seed(1),
      ).position
    }

    expect(mallet.z).toBeLessThanOrEqual(-MALLET_RADIUS)
  })

  it('reports the velocity with which it arrives, which is the one that hits', () => {
    const moved = stepOpponent(
      {
        puck: still(0, -0.5),
        mallet: { x: 0, z: -0.95 },
        playerMallet: playerStart(),
        skill: impossible,
        dt: 1 / 60,
      },
      seed(1),
    )

    expect(Math.hypot(moved.velocity.x, moved.velocity.z)).toBeGreaterThan(0)
  })

  it('stays still on an impossible jump in time', () => {
    const mallet = { x: 0.1, z: -0.5 }

    const moved = stepOpponent(
      {
        puck: still(0, 0),
        mallet,
        playerMallet: playerStart(),
        skill: easy,
        dt: 0,
      },
      seed(1),
    )

    expect(moved.position).toEqual(mallet)
    expect(moved.velocity).toEqual({ x: 0, z: 0 })
  })

  it('not even with the mix of shots does it exceed its speed or leave its half', () => {
    // The seeded randomness changes **where** it aims, not what it can do: if a
    // plan took it out of its half or sped it up, it would stop being an
    // opponent and become a cheat. The three options are gone through.
    for (const plan of ['gap', 'cross', 'bank'] as const) {
      const planSeed = seedFor(impossible, plan)
      let mallet = opponentStart(impossible)
      for (let i = 0; i < 300; i++) {
        const step = stepOpponent(
          {
            puck: still(0, -0.4),
            mallet,
            playerMallet: { x: 0.25, z: 0.8 },
            skill: impossible,
            dt: 1 / 60,
          },
          planSeed,
        )
        const travelled = Math.hypot(step.position.x - mallet.x, step.position.z - mallet.z)
        expect(travelled, plan).toBeLessThanOrEqual(impossible.maxSpeed / 60 + 1e-9)
        mallet = step.position
        expect(mallet.z, plan).toBeLessThanOrEqual(-MALLET_RADIUS)
        expect(Math.abs(mallet.x), plan).toBeLessThanOrEqual(HALF_WIDTH - MALLET_RADIUS + 1e-9)
      }
    }
  })
})

describe('the starting position', () => {
  it('leaves the machine in its half', () => {
    const start = opponentStart(impossible)

    expect(start.z).toBeLessThanOrEqual(-MALLET_RADIUS)
    expect(start.z).toBeGreaterThanOrEqual(-HALF_LENGTH)
  })
})

describe('the gap the player\'s mallet leaves', () => {
  it('is measured from the edge of the mallet to the point through which the puck goes in', () => {
    // A mallet right against the left post leaves no gap on that side, and the
    // right one is left whole: that is what is read, not which half its centre
    // is in.
    const reach = GOAL_WIDTH / 2 - PUCK_RADIUS
    const hugging = goalGaps({ x: -reach, z: 0.9 })

    expect(hugging.left).toBe(0)
    expect(hugging.right).toBeGreaterThan(0)
  })

  it('with the mallet in the centre the two gaps are the same', () => {
    const { left, right } = goalGaps({ x: 0, z: 0.9 })
    expect(left).toBeCloseTo(right, 10)
  })

  it('the open post is the one with the bigger gap, and tied the left one', () => {
    expect(openPost({ x: 0.3, z: 0.9 })).toBe(-1)
    expect(openPost({ x: -0.3, z: 0.9 })).toBe(1)
    expect(openPost({ x: 0, z: 0.9 })).toBe(-1)
  })
})

describe('the plan of each hit', () => {
  it('is the same for the same seed and another for another', () => {
    const same = planFor(impossible, seed(7, 3, 2))
    expect(planFor(impossible, seed(7, 3, 2))).toBe(same)

    // And with another match, another roll: that another plan comes up in one
    // of the first ten is what says the seed reaches this far.
    const others = Array.from({ length: 10 }, (_, i) => planFor(impossible, seed(8 + i, 3, 2)))
    expect(others.some((plan) => plan !== same)).toBe(true)
  })

  it('on easy it almost always goes for the gap: it is what makes it readable', () => {
    const plans = Array.from({ length: 200 }, (_, i) => planFor(easy, seed(1, 0, i)))
    const atGap = plans.filter((plan) => plan === 'gap').length

    expect(atGap / plans.length).toBeGreaterThan(0.85)
    // And never at the rail: a bounce cannot be seen coming, and on Easy that
    // is no opponent.
    expect(plans).not.toContain('bank')
  })

  it('on impossible the three plans show up and none rules', () => {
    const plans = Array.from({ length: 300 }, (_, i) => planFor(impossible, seed(1, 0, i)))
    for (const plan of ['gap', 'cross', 'bank'] as const) {
      const count = plans.filter((candidate) => candidate === plan).length
      expect(count / plans.length, plan).toBeGreaterThan(0.15)
      expect(count / plans.length, plan).toBeLessThan(0.5)
    }
  })
})

describe('which part of the goal it shoots at', () => {
  const inFront = { x: 0.3, z: 0.7 }

  it('at the gap the player is not covering', () => {
    const atGap = seedFor(medium, 'gap')
    expect(aimPoint({ x: 0.3, z: 0.7 }, medium, atGap).x).toBeLessThan(0)
    expect(aimPoint({ x: -0.3, z: 0.7 }, medium, atGap).x).toBeGreaterThan(0)
  })

  it('never at the centre, even if the player is in the centre', () => {
    // Always shooting at the middle, a mallet stopped in front of the goal is
    // a perfect plug: the puck comes and goes between the two and the rally
    // never ends.
    for (const plan of ['gap', 'cross', 'bank'] as const) {
      expect(aimPoint({ x: 0, z: 0.7 }, impossible, seedFor(impossible, plan)).x).not.toBe(0)
    }
  })

  it('aims at where the whole puck fits, not at the post', () => {
    for (const plan of ['gap', 'cross'] as const) {
      const { x } = aimPoint(inFront, impossible, seedFor(impossible, plan))
      expect(fitsThroughGoal(x), plan).toBe(true)
    }
  })

  it('the cross shot goes to the post opposite the shot at the gap', () => {
    const atGap = aimPoint(inFront, impossible, seedFor(impossible, 'gap'))
    const crossed = aimPoint(inFront, impossible, seedFor(impossible, 'cross'))

    expect(Math.sign(crossed.x)).toBe(-Math.sign(atGap.x))
    expect(Math.abs(crossed.x)).toBeCloseTo(Math.abs(atGap.x), 10)
  })

  it('the shot off the rail aims outside the table: it is the mirror image of the post', () => {
    // It is not a place, it is a direction: the straight line to the mirror
    // image is the one that, after bouncing off the rail, passes through the
    // post.
    const bank = aimPoint(inFront, impossible, seedFor(impossible, 'bank'))
    const atGap = aimPoint(inFront, impossible, seedFor(impossible, 'gap'))

    // On the other side from the shot at the gap, and beyond the rail.
    expect(Math.sign(bank.x)).toBe(-Math.sign(atGap.x))
    expect(Math.abs(bank.x)).toBeGreaterThan(HALF_WIDTH)

    // And the bounce takes it to the open post: reflected in the rail, the
    // mirror image falls again exactly where the shot at the gap aims.
    const railX = Math.sign(bank.x) * (HALF_WIDTH - PUCK_RADIUS)
    expect(2 * railX - bank.x).toBeCloseTo(atGap.x, 10)
  })

  it('aims at the player\'s goal and not at its own', () => {
    for (const plan of ['gap', 'cross', 'bank'] as const) {
      expect(aimPoint(inFront, impossible, seedFor(impossible, plan)).z).toBe(HALF_LENGTH)
    }
  })

  it('in a hundred rallies of medium difficulty no corner takes more than 70 %', () => {
    // The number that says whether the opponent can be memorised. With the
    // player's mallet still —which is the worst case: the open side does not
    // change— none of the places it shoots at can take the overwhelming
    // majority of the hits, or by the third match you know where the puck is
    // going to go.
    const atRest = { x: 0.2, z: 0.85 }
    const targets = Array.from({ length: 100 }, (_, rally) =>
      aimPoint(atRest, medium, seed(11, rally, 0)).x.toFixed(4),
    )

    const tally = new Map<string, number>()
    for (const target of targets) tally.set(target, (tally.get(target) ?? 0) + 1)

    expect(Math.max(...tally.values()) / targets.length).toBeLessThanOrEqual(0.7)
    // And the three targets come up: its not taking 70 % cannot be because it
    // shares out between two and forgets the third.
    expect(tally.size).toBe(3)
  })
})

describe('the hash that chooses the plan', () => {
  it('always returns the same for the same numbers, and between 0 and 1', () => {
    for (let i = 0; i < 50; i += 1) {
      const value = unitHash(i, i * 7, i * 13)
      expect(unitHash(i, i * 7, i * 13)).toBe(value)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('spreads evenly: it is what makes the proportions of the script hold', () => {
    const samples = Array.from({ length: 4000 }, (_, i) => unitHash(3, i, 0))
    const quarters = [0, 0, 0, 0]
    for (const sample of samples) quarters[Math.min(3, Math.floor(sample * 4))] += 1

    for (const quarter of quarters) {
      expect(quarter / samples.length).toBeGreaterThan(0.21)
      expect(quarter / samples.length).toBeLessThan(0.29)
    }
  })

  it('changing any of the three numbers changes the result', () => {
    const base = unitHash(1, 2, 3)
    expect(unitHash(2, 2, 3)).not.toBe(base)
    expect(unitHash(1, 3, 3)).not.toBe(base)
    expect(unitHash(1, 2, 4)).not.toBe(base)
  })
})
