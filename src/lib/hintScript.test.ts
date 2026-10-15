import { describe, expect, it } from 'vitest'

import { MAX_EXPIRY, MIN_EXPIRY, scriptProblems, type HintScript } from './hints'
import { GOAL_WIDTH, MALLET_RADIUS, PUCK_RADIUS, TABLE_CENTER_Z } from './gameConfig'
import {
  HINTS_ON_THE_TABLE,
  DECAL_Y,
  PUCK_AT_SERVE,
  PUSH,
  HINT_SCRIPT,
  MILESTONE_BEFORE_PUCK_MOVES,
  FOOTPRINT,
  FOOTPRINTS,
  FOOTPRINTS_Y,
  CONTROLLER_BESIDE_MALLET,
  GOAL_MARK,
  inPlayerHalf,
  controllerBesideMallet,
  ghostMalletAt,
  pushReturn,
  pushTravel,
  onTheTable,
  type MalletHint,
  type HintFact,
} from './hintScript'
import { playerStart } from './opponent'
import { HALF_LENGTH, HALF_WIDTH } from './puckPhysics'
import { TUTORIAL_STEPS } from './tutorial'

/**
 * The hint script, measured.
 *
 * What is checked here is what cannot be seen by looking at the scene: that no hint stays on,
 * that what rises from the table has disappeared before the puck leaves, and that what is drawn
 * falls where it is said to fall. How it looks —whether the ghost reads as a push or as a
 * smudge— is a headset matter, and it is noted in `docs/pendiente-de-visor.md`.
 */

const MILESTONES: readonly HintFact[] = ['round', 'grab', 'hit', 'goal']

/**
 * The script as the engine sees it.
 *
 * `as const` on the script leaves each hint with its exact type —the one that waits for nothing
 * does not even have the `from` field—, which is exactly what makes a misspelt `from` not
 * compile. To go through them all they have to be looked at with the common type.
 */
const SCRIPT: HintScript<HintFact> = HINT_SCRIPT

describe('the script leaves no hint on', () => {
  it('the common guard says so, which returns sentences and not a yes', () => {
    expect(scriptProblems(HINT_SCRIPT)).toEqual([])
  })

  it('and each deadline falls within what a hint can last', () => {
    for (const hint of HINT_SCRIPT) {
      expect(hint.expiresAfter, hint.id).toBeGreaterThanOrEqual(MIN_EXPIRY)
      expect(hint.expiresAfter, hint.id).toBeLessThanOrEqual(MAX_EXPIRY)
    }
  })

  it('the milestones it names are milestones someone records', () => {
    // A made-up milestone would leave the hint on for ever: nobody would ever set it to
    // true, and the deadline would be the only thing that turned it off.
    for (const hint of SCRIPT) {
      expect(MILESTONES, `«${hint.id}» turns off with a milestone that does not exist`).toContain(hint.until)
      if (hint.from !== undefined) {
        expect(MILESTONES, `«${hint.id}» waits for a milestone that does not exist`).toContain(hint.from)
      }
    }
  })

  it('and three of the four are the tutorial ones, not a separate list', () => {
    // They are recorded by the same places that already know what happens. A second list would
    // end up disagreeing with the first, and then the hint and the lesson would go their own way.
    for (const step of TUTORIAL_STEPS) expect(MILESTONES).toContain(step)
  })
})

describe('what rises from the table is removed before anything runs across it', () => {
  it('all the ones that sit on it turn off with the milestone that precedes the serve', () => {
    // It is the rule that does not have to be checked again with the headset: a decal cannot
    // cover anything that slides over it, but what rises is on the line that goes from the eyes
    // to the puck. The countdown stops until the mallet is in the hand, so that milestone always
    // arrives before the serve.
    for (const id of HINTS_ON_THE_TABLE) {
      const hint = HINT_SCRIPT.find((one) => one.id === id)
      expect(hint, `«${id}» is not in the script`).toBeDefined()
      expect(hint!.until, id).toBe(MILESTONE_BEFORE_PUCK_MOVES)
    }
  })

  it('and the one that stays while playing is a decal, not raised', () => {
    const decals = HINT_SCRIPT.map((hint) => hint.id).filter(
      (id): id is MalletHint => !HINTS_ON_THE_TABLE.includes(id),
    )
    expect(decals).toContain('goal')
    // A decal is separated by biasing the depth, not by rising: if this grew, it would stop
    // being a decal and would go back to the problem of covering.
    expect(DECAL_Y).toBeLessThanOrEqual(0.005)
    expect(FOOTPRINTS_Y).toBeLessThanOrEqual(0.01)
  })
})

describe('the footprints say where to stand', () => {
  it('behind the near edge of the table, not on top of it', () => {
    // The near edge is 20 cm from the feet of whoever enters. A footprint past that would ask
    // to step inside the table.
    const nearEdge = TABLE_CENTER_Z + HALF_LENGTH
    for (const footprint of FOOTPRINTS) {
      expect(footprint.z - FOOTPRINT.length / 2, 'a footprint goes under the table').toBeGreaterThan(
        nearEdge,
      )
    }
  })

  it('they are two, level and without overlapping', () => {
    // Level and not staggered: it is the air hockey stance, and the stance is half of the
    // message.
    expect(FOOTPRINTS).toHaveLength(2)
    const [left, right] = FOOTPRINTS
    expect(left.z).toBe(right.z)
    expect(Math.abs(right.x - left.x)).toBeGreaterThan(FOOTPRINT.width)
  })

  it('and centred on the table, which is where you play facing forward', () => {
    const center = FOOTPRINTS.reduce((sum, footprint) => sum + footprint.x, 0) / FOOTPRINTS.length
    expect(center).toBeCloseTo(0, 6)
  })
})

describe('the ghost mallet shows the push', () => {
  it('it starts behind where the mallet starts and ends touching the puck', () => {
    // That it ends touching it is half of the lesson: a ghost that stops halfway teaches how
    // to move the mallet, not how to hit.
    const { from, to } = pushTravel()
    expect(from).toBeGreaterThan(playerStart().z)
    expect(to).toBeCloseTo(PUCK_AT_SERVE.z + PUCK_RADIUS + MALLET_RADIUS, 6)
  })

  it('and it does not leave the table or cross into the opposite half', () => {
    // A ghost that crosses the line would show a movement the game does not allow.
    for (let i = 0; i <= 40; i += 1) {
      const where = ghostMalletAt(i / 40)
      expect(inPlayerHalf(where), `at ${i / 40} it is outside`).toBe(true)
      expect(Math.abs(where.z), `at ${i / 40} it goes out through the back`).toBeLessThanOrEqual(
        HALF_LENGTH,
      )
    }
  })

  it('it goes back slowly and pushes fast: that is a hit and not a swaying motion', () => {
    // With the two stretches equal what was shown was a windscreen wiper.
    expect(PUSH.returnAt).toBeGreaterThan(0.5)
    const drawingBack = PUSH.returnAt
    const pushing = 1 - PUSH.returnAt
    expect(drawingBack).toBeGreaterThan(pushing)
  })

  it('the whole cycle: from the puck, all the way back, and back to the puck', () => {
    expect(pushReturn(0)).toBeCloseTo(0, 6)
    expect(pushReturn(PUSH.returnAt)).toBeCloseTo(1, 6)
    expect(pushReturn(1)).toBeCloseTo(0, 6)
    // And it is continuous along both stretches: a jump would look like a jerk.
    expect(pushReturn(PUSH.returnAt / 2)).toBeCloseTo(0.5, 6)
    expect(pushReturn((1 + PUSH.returnAt) / 2)).toBeCloseTo(0.5, 6)
  })

  it('and a progress outside the cycle does not take it off the table', () => {
    // The clock of the pass should not give it, but an odd number here would leave the ghost
    // shot off to the middle of nowhere instead of still at one end.
    expect(pushReturn(-3)).toBe(0)
    expect(pushReturn(4)).toBe(0)
    expect(inPlayerHalf(ghostMalletAt(-3))).toBe(true)
    expect(inPlayerHalf(ghostMalletAt(9))).toBe(true)
  })

  it('and it lasts as long as looking lasts, not as long as a match lasts', () => {
    expect(PUSH.period).toBeGreaterThan(0.8)
    expect(PUSH.period).toBeLessThan(3)
  })
})

describe('the controller goes beside the ghost mallet, with the grab button facing', () => {
  it("a hand's breadth from the mallet, on the side of the playing hand, above the table and in their half", () => {
    const { position } = controllerBesideMallet()
    const mallet = playerStart()
    const span = Math.hypot(position.x - mallet.x, position.z - mallet.z)
    expect(span).toBeGreaterThanOrEqual(0.15)
    expect(span).toBeLessThanOrEqual(0.3)
    expect(position.x).toBeGreaterThan(mallet.x)
    expect(inPlayerHalf(position)).toBe(true)
    // Above the board, at the height of the hand: not as a decal nor floating far away.
    expect(position.y).toBeGreaterThan(0.05)
    expect(position.y).toBeLessThan(0.2)
    expect(CONTROLLER_BESIDE_MALLET.scale).toBeGreaterThanOrEqual(1)
  })

  it("it does not get in the ghost's way: there is air between the two", () => {
    const { position } = controllerBesideMallet()
    // The controller (≈12 cm long, enlarged) points towards the ghost; its tip does not reach the ring.
    const length = 0.12 * CONTROLLER_BESIDE_MALLET.scale
    expect(position.x - length).toBeGreaterThan(MALLET_RADIUS)
  })

  it('turned until the side of the grab button faces the eyes', () => {
    const { position, rotation } = controllerBesideMallet()
    // The grab button of the right controller is on its −X side; turned `rotation` about the
    // vertical it ends up at (−cos, 0, sin). Towards the eyes: from the controller to the origin,
    // in plan view.
    const grabButton = { x: -Math.cos(rotation), z: Math.sin(rotation) }
    const toward = { x: -position.x, z: -(position.z + TABLE_CENTER_Z) }
    const n = Math.hypot(toward.x, toward.z)
    expect(grabButton.x * (toward.x / n) + grabButton.z * (toward.z / n)).toBeCloseTo(1, 9)
  })

  it('for a left-hander, the left one mirrored: on the other side of the mallet and with its grab button (+X) facing', () => {
    expect(controllerBesideMallet()).toEqual(controllerBesideMallet('right'))
    const { position, rotation } = controllerBesideMallet('left')
    const mallet = playerStart()
    const rightOne = controllerBesideMallet('right')
    expect(position.x - mallet.x).toBeCloseTo(-(rightOne.position.x - mallet.x), 12)
    expect([position.y, position.z]).toEqual([rightOne.position.y, rightOne.position.z])
    expect(inPlayerHalf(position)).toBe(true)
    // The grab button of the left one is on its +X: turned `rotation`, it ends up at (cos, 0, −sin).
    const grabButton = { x: Math.cos(rotation), z: -Math.sin(rotation) }
    const toward = { x: -position.x, z: -(position.z + TABLE_CENTER_Z) }
    const n = Math.hypot(toward.x, toward.z)
    expect(grabButton.x * (toward.x / n) + grabButton.z * (toward.z / n)).toBeCloseTo(1, 9)
  })
})

describe('the goal mark says where the puck goes', () => {
  it('it takes up the whole opening and does not leave the table', () => {
    expect(GOAL_MARK.width).toBe(GOAL_WIDTH)
    expect(GOAL_MARK.width / 2).toBeLessThanOrEqual(HALF_WIDTH)
    const inside = GOAL_MARK.z + GOAL_MARK.depth / 2
    const outside = GOAL_MARK.z - GOAL_MARK.depth / 2
    expect(onTheTable({ x: GOAL_MARK.width / 2, z: inside })).toBe(true)
    expect(onTheTable({ x: 0, z: outside })).toBe(true)
  })

  it('in the opposite half, which is where it has to be sent', () => {
    expect(GOAL_MARK.z).toBeLessThan(0)
    expect(inPlayerHalf({ x: 0, z: GOAL_MARK.z })).toBe(false)
  })
})

describe('the ruler they are measured with', () => {
  it('what is off the table stays off, with a margin or without one', () => {
    expect(onTheTable({ x: 0, z: 0 })).toBe(true)
    expect(onTheTable({ x: HALF_WIDTH + 0.2, z: 0 })).toBe(false)
    expect(onTheTable({ x: HALF_WIDTH + 0.2, z: 0 }, 0.3)).toBe(true)
    expect(onTheTable({ x: 0, z: HALF_LENGTH + 0.2 })).toBe(false)
  })
})
