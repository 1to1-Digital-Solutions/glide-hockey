import { describe, expect, it } from 'vitest'
import {
  GAP_ABOVE_SCOREBOARD,
  REMAINING_TEMPLATE,
  BACK_SCOREBOARD,
  CHALLENGE_MISSION,
  BACK_NEONS,
  THRESHOLD_SOUND,
  TUTORIAL_TO_ONE_SIDE,
  scoreboardTopEdge,
  withNowItCountsNotice,
  givesMedal,
  medalPhrase,
  scoreboardOmits,
  remainingText,
  signRun,
  signPose,
  thresholdPulses,
  signPlacement,
  tutorialPlacement,
  type GameInPlay,
  type SignProportion,
} from './scoreboardSign'
import { challengeRound } from './challenge'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from './gameConfig'
import { GAME_MODE_LABELS, GAME_MODE_ORDER } from './gameMode'
import { MEDALS, goalSign, medalToCelebrate, type Goal } from './goal'
import { eyesAt, pointOnPanel } from './panelReading'
import { HALF_LENGTH } from './puckPhysics'
import { BASE_GOAL_POINTS, goalPoints } from './scoring'
import { HAPTIC_RECIPES } from './hapticFeedback'
import { softTranslator } from './textos'
import { REFERENCE_EYE_HEIGHT } from './uiHeight'

/**
 * The goal sign on the table: that it hangs above the back scoreboard, facing whoever plays, and
 * that it tells the right run.
 */

/** What the sign measures per metre of distance: 24° wide by 4.5° high, like the real one. */
const PROPORTION: SignProportion = {
  width: 2 * Math.tan((12 * Math.PI) / 180),
  height: 2 * Math.tan((2.25 * Math.PI) / 180),
}

const EYES = eyesAt(REFERENCE_EYE_HEIGHT)

describe('where the sign hangs', () => {
  const placement = signPlacement(PROPORTION)
  const pose = signPose(placement)
  const height = PROPORTION.height * placement.distance

  it("the back scoreboard is over the machine's goal, leaning towards whoever plays", () => {
    expect(BACK_SCOREBOARD.center[2]).toBeLessThan(-HALF_LENGTH)
    expect(BACK_SCOREBOARD.center[0]).toBe(0)
    expect(BACK_SCOREBOARD.tilt).toBeLessThan(0)
    // Its top edge, in the player's space: somewhat further back than its centre.
    const edge = scoreboardTopEdge()
    expect(edge.y).toBeCloseTo(TABLE_HEIGHT + BACK_SCOREBOARD.center[1] + (BACK_SCOREBOARD.height / 2) * Math.cos(BACK_SCOREBOARD.tilt))
    expect(edge.z).toBeLessThan(TABLE_CENTER_Z + BACK_SCOREBOARD.center[2])
  })

  it("above the scoreboard and centred: its bottom edge, a finger away from the scoreboard's top one", () => {
    const edge = scoreboardTopEdge()
    const bottom = pointOnPanel(pose, 0, -height / 2)

    expect(placement.position[0]).toBeCloseTo(0)
    expect(bottom.x).toBeCloseTo(edge.x)
    expect(bottom.y).toBeCloseTo(edge.y + GAP_ABOVE_SCOREBOARD)
    expect(bottom.z).toBeCloseTo(edge.z)
  })

  it('it hangs from table space, which is where the interface hangs from', () => {
    expect(pose.position[1]).toBeCloseTo(placement.position[1] + TABLE_HEIGHT)
    expect(pose.position[2]).toBeCloseTo(placement.position[2] + TABLE_CENTER_Z)
    expect(pose.rotation).toBe(placement.rotation)
  })

  it('it faces the eyes of whoever plays: it is read straight on and at the distance it says', () => {
    const [x, y, z] = pose.position
    const towardEyes = { x: EYES.x - x, y: EYES.y - y, z: EYES.z - z }
    const distance = Math.hypot(towardEyes.x, towardEyes.y, towardEyes.z)
    expect(placement.distance).toBeCloseTo(distance)

    // The panel's normal comes from two of its points: one step to the right and another upwards.
    const center = pointOnPanel(pose, 0, 0)
    const right = pointOnPanel(pose, 1, 0)
    const top = pointOnPanel(pose, 0, 1)
    const u = { x: right.x - center.x, y: right.y - center.y, z: right.z - center.z }
    const v = { x: top.x - center.x, y: top.y - center.y, z: top.z - center.z }
    const normal = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x }
    const cosine = (normal.x * towardEyes.x + normal.y * towardEyes.y + normal.z * towardEyes.z) / distance
    expect(cosine).toBeCloseTo(1, 5)
    expect(placement.rotation[3]).toBe('YXZ')
  })

  it("at the back of the table: a little over two metres away, beyond the machine's goal", () => {
    expect(placement.distance).toBeGreaterThan(2)
    expect(placement.distance).toBeLessThan(2.6)
    expect(pose.position[2]).toBeLessThan(TABLE_CENTER_Z - HALF_LENGTH)
  })
})

const GOAL: Goal = {
  medals: { bronze: 1500, silver: 8000, gold: 20000 },
  better: 'higher',
  unit: 'points in the challenge',
  record: 2300,
  mode: 'challenge',
}

const en = softTranslator('en')
const es = softTranslator('es')

/** A challenge half way through: what has to be said about it, with whatever changes. */
function challenge(changes: Partial<GameInPlay> = {}): GameInPlay {
  return { goal: GOAL, gameMode: 'challenge', gameState: 'playing', round: 1, goals: 0, points: 0, streak: 0, record: 0, ...changes }
}

describe('the run the sign is told about', () => {
  it('in the menu nothing is hung', () => {
    expect(signRun(challenge({ gameState: 'menu' }), en)).toBeNull()
  })

  it('in the first countdown: the mission and the thresholds', () => {
    const run = signRun(challenge({ gameState: 'countdown' }), en)

    expect(run?.phase).toBe('before')
    expect(goalSign(run!, en)).toMatchObject({
      title: 'Win games until you lose one',
      detail: 'Bronze 1,500 · Silver 8,000 · Gold 20,000',
    })
    expect(goalSign(signRun(challenge({ gameState: 'countdown' }), es)!, es).title).toBe('Gana partidos hasta perder uno')
    expect(es(CHALLENGE_MISSION)).not.toBe(CHALLENGE_MISSION)
  })

  it('with the puck in play: the threshold that is missing, the points so far and what remains', () => {
    const run = signRun(challenge({ points: 340, goals: 4, streak: 2 }), es)

    expect(run).toMatchObject({ phase: 'playing', points: 340, remaining: 'Ronda 1 · a 3 goles · gol +140' })
    expect(goalSign(run!, es)).toMatchObject({ title: 'Bronce a 1500 · llevas 340', detail: 'Ronda 1 · a 3 goles · gol +140' })
    expect(medalToCelebrate(run!)).toBeNull()
  })

  it('the countdown of the following rounds is already playing: it does not go back to the mission', () => {
    expect(signRun(challenge({ gameState: 'countdown', round: 2, goals: 4, points: 500 }), en)?.phase).toBe('playing')
    // Nor that of the first one, if a goal has already gone in.
    expect(signRun(challenge({ gameState: 'countdown', goals: 1 }), en)?.phase).toBe('playing')
  })

  it('once a threshold is crossed, the medal belongs to whoever plays and the sign goes for the next one', () => {
    const run = signRun(challenge({ round: 4, points: 1650, goals: 14 }), en)

    expect(medalToCelebrate(run!)).toBe('bronze')
    expect(goalSign(run!, en).title).toBe('Silver at 8,000 · you have 1,650')
  })

  it('at the end: what was achieved and what was missing', () => {
    const run = signRun(challenge({ gameState: 'finished', round: 4, points: 1650, goals: 17 }), es)

    expect(run?.phase).toBe('end')
    expect(goalSign(run!, es)).toMatchObject({
      title: 'Bronce · 1650 points in the challenge',
      detail: 'Te han faltado 6350 para la plata',
    })
  })

  it('outside the challenge, inside the hall: it says quietly that it does not count for a medal', () => {
    for (const gameMode of GAME_MODE_ORDER.filter((mode) => mode !== 'challenge')) {
      const run = signRun(challenge({ gameMode, points: 900 }), es)

      expect(goalSign(run!, es)).toMatchObject({ title: `${es(GAME_MODE_LABELS[gameMode])} · no cuenta para medalla`, subdued: true })
      expect(medalToCelebrate(run!)).toBeNull()
    }
  })

  it('if the hall says the medals come from another mode, the challenge does not count either', () => {
    const run = signRun(challenge({ goal: { ...GOAL, mode: 'levels' } }), en)

    expect(goalSign(run!, en).title).toBe('Challenge · does not count for a medal')
  })

  it('with the game opened on its own: in the challenge, the mission and the record stored here', () => {
    const run = signRun(challenge({ goal: undefined, gameState: 'countdown', record: 3100 }), en)

    expect(goalSign(run!, en)).toMatchObject({ title: 'Win games until you lose one', detail: 'Your record 3,100' })
    // With no stored record there is no second line.
    const withoutRecord = signRun(challenge({ goal: null, gameState: 'countdown' }), en)
    expect(goalSign(withoutRecord!, en).detail).toBeNull()
  })

  it('with the game opened on its own and outside the challenge nothing is hung', () => {
    expect(signRun(challenge({ goal: null, gameMode: 'practice', record: 12 }), en)).toBeNull()
  })
})

describe('what remains', () => {
  it('the round, how many goals it is played to and what the next goal is worth', () => {
    expect(REMAINING_TEMPLATE).toContain('{points}')
    expect(remainingText(1, 0, en)).toBe(`Round 1 · to 3 goals · goal +${BASE_GOAL_POINTS}`)
    expect(remainingText(2, 0, es)).toBe('Ronda 2 · a 5 goles · gol +100')
  })

  it("the next goal is worth more with the streak so far and with the round's level", () => {
    const fourth = challengeRound(4)
    expect(remainingText(1, 3, en)).toBe(`Round 1 · to 3 goals · goal +${goalPoints({ difficulty: 'easy', streak: 4 })}`)
    expect(remainingText(4, 0, en)).toBe(`Round 4 · to ${fourth.goalTarget} goals · goal +${goalPoints({ difficulty: fourth.difficulty, streak: 1 })}`)
    expect(goalPoints({ difficulty: fourth.difficulty, streak: 1 })).toBeGreaterThan(BASE_GOAL_POINTS)
  })

  it('and with the lap of the ladder, past round fifteen', () => {
    const secondLap = challengeRound(16)
    expect(secondLap.lap).toBe(2)
    expect(remainingText(16, 0, en)).toBe(`Round 16 · to 3 goals · goal +${BASE_GOAL_POINTS * secondLap.multiplier}`)
  })
})

describe('what the menu says about each mode', () => {
  it('only the challenge gives a medal, with the hall and without it', () => {
    for (const goal of [GOAL, null, undefined]) {
      expect(GAME_MODE_ORDER.filter((mode) => givesMedal(goal, mode))).toEqual(['challenge'])
    }
    expect(medalPhrase(null, 'challenge')).toBe('Counts for a medal')
    expect(medalPhrase(GOAL, 'practice')).toBe('Does not count for a medal')
    expect(es(medalPhrase(null, 'challenge'))).toBe('Cuenta para medalla')
    expect(es(medalPhrase(null, 'duel'))).toBe('No cuenta para medalla')
  })

  it('if the hall takes the medals from another mode, here none gives them', () => {
    const other = { ...GOAL, mode: 'levels' }
    expect(GAME_MODE_ORDER.filter((mode) => givesMedal(other, mode))).toEqual([])
  })
})

describe('what the scoreboard omits', () => {
  it('in the challenge that counts: the points always, and the round while playing', () => {
    expect(scoreboardOmits(signRun(challenge({ gameState: 'countdown' }), en))).toEqual({ points: true, round: true })
    expect(scoreboardOmits(signRun(challenge({ points: 300 }), en))).toEqual({ points: true, round: true })
    // At the end the sign says what was missing: the round it stopped at goes back to the scoreboard.
    expect(scoreboardOmits(signRun(challenge({ gameState: 'finished' }), en))).toEqual({ points: true, round: false })
  })

  it("with the game opened on its own, the same: the challenge's sign says the points so far", () => {
    expect(scoreboardOmits(signRun(challenge({ goal: null }), en))).toEqual({ points: true, round: true })
  })

  it('where the sign does not tell the run, or there is no sign, it omits nothing', () => {
    expect(scoreboardOmits(signRun(challenge({ gameMode: 'practice' }), en))).toEqual({ points: false, round: false })
    expect(scoreboardOmits(null)).toEqual({ points: false, round: false })
  })
})

describe('the crossed threshold', () => {
  it('it has its sound, one per medal', () => {
    expect(new Set(MEDALS.map((medal) => THRESHOLD_SOUND[medal])).size).toBe(MEDALS.length)
  })

  it('it is felt in the mallet hand, stronger the better the medal is', () => {
    const strength = (medal: (typeof MEDALS)[number]) => thresholdPulses(medal, 'left')[0]

    expect(strength('bronze').hand).toBe('left')
    expect(strength('silver').intensity).toBeGreaterThan(strength('bronze').intensity)
    expect(strength('gold').intensity).toBeGreaterThan(strength('silver').intensity)
    expect(thresholdPulses('gold', 'right')).toHaveLength(1)
  })

  it('it comes out after the pulse of the goal that crossed it, which would otherwise cut it off', () => {
    expect(thresholdPulses('bronze', 'right')[0].delay).toBeGreaterThanOrEqual(HAPTIC_RECIPES.arrival.ms)
  })

  it('without the mallet in the hand nothing vibrates', () => {
    expect(thresholdPulses('gold', null)).toEqual([])
  })
})

describe('what moves away from the sign', () => {
  it('the tutorial goes to one side, at the same distance and at the same height it had straight ahead', () => {
    const straightAhead = tutorialPlacement(0)
    expect(straightAhead[0]).toBe(0)
    expect(straightAhead[1]).toBeCloseTo(0.72, 10)
    expect(straightAhead[2]).toBeCloseTo(0, 10)

    const [x, y, z] = tutorialPlacement()
    const eyes = eyesAt(REFERENCE_EYE_HEIGHT)
    // In the player's space: on the right, 1.2 m away horizontally and a finger above the eyes.
    expect(x).toBeGreaterThan(0)
    expect(Math.hypot(x - eyes.x, z + TABLE_CENTER_Z - eyes.z)).toBeCloseTo(TUTORIAL_TO_ONE_SIDE.distance, 10)
    expect(y + TABLE_HEIGHT - eyes.y).toBeCloseTo(TUTORIAL_TO_ONE_SIDE.aboveEyes, 10)
    expect((Math.atan2(x, -(z + TABLE_CENTER_Z)) * 180) / Math.PI).toBeCloseTo(TUTORIAL_TO_ONE_SIDE.azimuth, 10)
  })

  it('the two neon strips, from top to bottom, and the lower one shorter', () => {
    const [top, bottom] = BACK_NEONS.strips
    expect(top.y - bottom.y).toBeCloseTo(0.3, 10)
    expect(bottom.width).toBeLessThan(top.width)
    expect(BACK_NEONS.thickness).toBeGreaterThan(0)
  })
})

describe('when the tutorial closes, the sign announces that it now counts', () => {
  const view = { title: 'Win games until you lose one', detail: 'Bronze 1500', bar: null, medal: null, subdued: false }
  const es = softTranslator('es')

  it('in the challenge, the big line says it in the language of whoever plays', () => {
    expect(withNowItCountsNotice(view, 'challenge', true, es)).toEqual({ ...view, title: 'Ahora cuenta para medalla' })
    expect(withNowItCountsNotice(view, 'challenge', true, softTranslator('en'))?.title).toBe('Now it counts for a medal')
  })

  it('once the notice is over, outside the challenge, with the sign subdued or with no sign, the usual', () => {
    expect(withNowItCountsNotice(view, 'challenge', false, es)).toBe(view)
    expect(withNowItCountsNotice(view, 'practice', true, es)).toBe(view)
    const subdued = { ...view, subdued: true }
    expect(withNowItCountsNotice(subdued, 'challenge', true, es)).toBe(subdued)
    expect(withNowItCountsNotice(null, 'challenge', true, es)).toBeNull()
  })
})
