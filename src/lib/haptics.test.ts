import { describe, expect, it, vi } from 'vitest'
import {
  FINAL_PULSE,
  GOAL_STRENGTH,
  PRESS_PULSE,
  pulseHand,
  pulsePressed,
  eventPulses,
  playPulses,
  frameEvents,
  type HapticSession,
  type HapticSource,
} from './haptics'
import { thresholdPulses } from './scoreboardSign'
import { OPPONENT_SKILLS } from './gameConfig'
import { advanceTable, startTable, type TableState } from './matchLoop'
import { HALF_LENGTH, HALF_WIDTH, type Vec2 } from './puckPhysics'
import { HAPTIC_RECIPES, pulsesFor } from './hapticFeedback'

function source(handedness: string, pulse?: (value: number, duration: number) => unknown) {
  return {
    handedness,
    gamepad: pulse ? { hapticActuators: [{ pulse }] } : { hapticActuators: [] },
  }
}

/**
 * What was seen with the headset: the two controllers vibrated for the whole rally. It was the
 * slide of the puck —an overlapping tap every 90 ms while it moved— and, since it was never
 * known which hand held the mallet, it went to both. What remains: the mallet striking the puck,
 * in its hand.
 */
describe('what is felt of the table', () => {
  it('the mallet strike is an impact in the hand that holds it, and only in that one', () => {
    const pulses = eventPulses({ type: 'hit', strength: 0.6 }, 'left')
    expect(pulses).toEqual(pulsesFor({ type: 'impact', hand: 'left', strength: 0.6 }))
    expect(pulses.every((p) => p.hand === 'left')).toBe(true)
  })

  it('the stronger the collision, the stronger the pulse', () => {
    const weak = eventPulses({ type: 'hit', strength: 0.1 }, 'right')[0]
    const sharp = eventPulses({ type: 'hit', strength: 1 }, 'right')[0]
    expect(sharp.intensity).toBeGreaterThan(weak.intensity)
  })

  it('a strength that is not a number counts as a whole strike, it does not reach the actuator', () => {
    const [pulse] = eventPulses({ type: 'hit', strength: Number.NaN }, 'right')
    expect(pulse.intensity).toBe(HAPTIC_RECIPES.impact.max)
  })

  it('the goal is a soft arrival, weaker than any strike', () => {
    const [goal] = eventPulses({ type: 'goal' }, 'right')
    expect(goal).toEqual(pulsesFor({ type: 'arrival', hand: 'right', strength: GOAL_STRENGTH })[0])
    expect(goal.intensity).toBeLessThan(eventPulses({ type: 'hit', strength: 0 }, 'right')[0].intensity)
  })

  it('the end of the match, long and in the mallet hand', () => {
    expect(eventPulses({ type: 'end' }, 'left')).toEqual([
      { hand: 'left', intensity: FINAL_PULSE.intensity, ms: FINAL_PULSE.durationMs, delay: 0 },
    ])
  })

  it('the medal threshold crossed, the one of the goal sign, in the mallet hand', () => {
    expect(eventPulses({ type: 'threshold', medal: 'silver' }, 'left')).toEqual(thresholdPulses('silver', 'left'))
    expect(eventPulses({ type: 'threshold', medal: 'gold' }, 'right')[0].hand).toBe('right')
  })

  it('with no hand on the mallet nothing vibrates: never both «just in case»', () => {
    for (const event of [{ type: 'hit', strength: 1 }, { type: 'goal' }, { type: 'end' }, { type: 'threshold', medal: 'gold' }] as const) {
      expect(eventPulses(event, null), event.type).toEqual([])
    }
  })
})

describe('what reaches the hand from each frame', () => {
  const skill = OPPONENT_SKILLS.medium
  /** The player's mallet parked in a corner of its own half, far from where the puck goes by. */
  const parked: Vec2 = { x: HALF_WIDTH - 0.08, z: HALF_LENGTH - 0.08 }

  it('the puck sliding loose and bouncing off the rails: zero pulses', () => {
    let table: TableState = startTable({ skill, lastScorer: null, seed: 7 })
    let bounces = 0
    let looseFrames = 0
    let pulses = 0
    for (let i = 0; i < 90 * 20; i++) {
      const before = table.playerHits
      const frame = advanceTable(table, { delta: 1 / 90, pointer: parked, skill, playing: true })
      table = frame.table
      if (frame.bounced) bounces += 1
      if (table.playerHits > before || frame.goals.length > 0) continue
      looseFrames += 1
      for (const event of frameEvents(before, frame)) pulses += eventPulses(event, 'right').length
    }
    // So that the test does not measure nothing: the puck moved and hit the rails.
    expect(bounces).toBeGreaterThan(3)
    expect(looseFrames).toBeGreaterThan(90 * 15)
    expect(pulses).toBe(0)
  })

  it('the player strike does, with the strength of the collision', () => {
    const before = startTable({ skill, lastScorer: null })
    const events = frameEvents(0, {
      table: { ...before, playerHits: 1 },
      goals: [],
      impact: { strike: 3, bounce: 0 },
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'hit' })
    expect((events[0] as { strength: number }).strength).toBeGreaterThan(0)
  })

  it('the machine strike does not belong to the hand of the player', () => {
    const table = startTable({ skill, lastScorer: null })
    expect(frameEvents(0, { table: { ...table, opponentHits: 1 }, goals: [], impact: { strike: 4, bounce: 0 } })).toEqual([])
  })

  it('and the goal', () => {
    const table = startTable({ skill, lastScorer: null })
    expect(frameEvents(0, { table: table, goals: ['player'], impact: { strike: 0, bounce: 0 } })).toEqual([{ type: 'goal' }])
  })
})

describe('playing the pulses', () => {
  it('pulses only the controller of that hand', () => {
    const left = vi.fn()
    const right = vi.fn()
    const session: HapticSession = { inputSources: [source('left', left), source('right', right)] }

    expect(pulseHand(session, 'right', 0.5, 30)).toBe(true)
    expect(right).toHaveBeenCalledWith(0.5, 30)
    expect(left).not.toHaveBeenCalled()
  })

  it('the tail of a strike goes out with its delay, on the clock of the caller', () => {
    const right = vi.fn()
    const session: HapticSession = { inputSources: [source('right', right)] }
    const scheduled: { fire: () => void; ms: number }[] = []

    playPulses(session, eventPulses({ type: 'hit', strength: 1 }, 'right'), (fire, ms) => scheduled.push({ fire, ms }))

    expect(right).toHaveBeenCalledTimes(1)
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].ms).toBe(HAPTIC_RECIPES.impact.ms)
    scheduled[0].fire()
    expect(right).toHaveBeenCalledTimes(2)
  })

  it('a controller with no actuator, or that rejects the pulse, breaks nothing', () => {
    const rejects = vi.fn(() => Promise.reject(new Error('no permission')))
    const throws = vi.fn(() => {
      throw new Error('disconnected')
    })
    const session: HapticSession = {
      inputSources: [source('left', throws), source('right', rejects), source('none')],
    }

    expect(pulseHand(session, 'left', 0.5, 30)).toBe(false)
    expect(pulseHand(session, 'right', 0.5, 30)).toBe(true)
  })

  it('without a session there is nobody to pulse', () => {
    expect(pulseHand(null, 'left', 0.5, 30)).toBe(false)
  })
})

describe('a controller that claims to have an actuator but has none', () => {
  it('is skipped without breaking', () => {
    // `hapticActuators` is in the standard but not every browser fills it in
    // the same way: some leave it empty and others put an object without `pulse`.
    const withNothing = { gamepad: undefined, handedness: 'left' }
    const withNoList = { gamepad: {}, handedness: 'right' }
    const withNoPulse = { gamepad: { hapticActuators: [{}] }, handedness: 'none' }
    const session = {
      inputSources: [withNothing, withNoList, withNoPulse],
    } as unknown as HapticSession

    expect(pulseHand(session, 'left', 0.5, 30)).toBe(false)
    expect(pulseHand(session, 'right', 0.5, 30)).toBe(false)
  })
})

/**
 * The tap that confirms a headset button.
 *
 * Inside the headset the controller is not drawn and what is pressed is a floating rectangle:
 * without this tap, the button gives no sign of having heard anything. It goes **to the
 * controller that pressed** and not to both hands, since answering the other would be
 * answering someone who has done nothing.
 */
describe('the tap of a button', () => {
  /** A pointer event like the one that arrives from a headset controller. */
  const fromController = (source: HapticSource) => ({ nativeEvent: { inputSource: source } })

  it('vibrates the controller that presses it', () => {
    const pulse = vi.fn(() => Promise.resolve(true))

    expect(pulsePressed(fromController(source('right', pulse)))).toBe(true)
    expect(pulse).toHaveBeenCalledWith(PRESS_PULSE.intensity, PRESS_PULSE.durationMs)
  })

  it('with the mouse there is no controller, and nothing happens', () => {
    // It is the desktop case: the same menu, with nothing to vibrate.
    expect(pulsePressed({ nativeEvent: {} })).toBe(false)
    expect(pulsePressed(null)).toBe(false)
  })

  it('a controller with no actuator is still a controller', () => {
    expect(pulsePressed(fromController(source('right')))).toBe(false)
  })

  it('an actuator that fails does not stop the match', () => {
    const broken: HapticSource = {
      handedness: 'right',
      gamepad: {
        hapticActuators: [
          {
            pulse: () => {
              throw new Error('no actuator')
            },
          },
        ],
      },
    }

    expect(pulsePressed(fromController(broken))).toBe(false)
  })

  it('and one that returns a broken promise does not dirty the console either', () => {
    const rejecting: HapticSource = {
      handedness: 'right',
      gamepad: { hapticActuators: [{ pulse: () => Promise.reject(new Error('no')) }] },
    }

    expect(pulsePressed(fromController(rejecting))).toBe(true)
  })

  it('a tap of zero strength is not a tap', () => {
    const pulse = vi.fn(() => Promise.resolve(true))

    expect(
      pulsePressed(fromController(source('right', pulse)), { ...PRESS_PULSE, intensity: 0 }),
    ).toBe(false)
    expect(pulse).not.toHaveBeenCalled()
  })
})
