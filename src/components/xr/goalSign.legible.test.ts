import { describe, expect, it } from 'vitest'
import {
  DRAW_DISTANCE,
  SIGN_FONT,
  SIGN_PANEL,
  drawSign,
  signScale,
  signAspect,
} from './GoalSign'
import { LINE_HEIGHT } from './canvasPanel'
import { MIN_ANGLE, minTextHeight, recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import {
  GOAL_ES,
  goalSign,
  type Goal,
  type Run,
  type Translate,
  type GoalSignView,
} from '../../lib/goal'

/**
 * The goal sign, measured instead of looked at.
 *
 * It is the same test in every game of the hall: it measures the common phrases of the sign, in
 * both languages, higher-is-better and lower-is-better, in each phase. **The mission and what
 * remains belong to each game**, so each one also measures its own, with its translator, just
 * like here:
 *
 *     const { ctx, drawnTexts } = recordingCanvas()
 *     drawSign(ctx, goalSign(run, t))
 *     expect(legibilityProblems(drawnTexts, { panel: SIGN_PANEL, distance: DRAW_DISTANCE })).toEqual([])
 *
 * It is measured at the draw distance: the sign is enlarged with the real distance, so what it
 * takes up in the eye is the same at two metres as at twenty.
 */

const en: Translate = (key, values) =>
  values === undefined ? key : key.replace(/\{(\w+)\}/g, (_, placeholder: string) => String(values[placeholder]))
const es: Translate = (key, values) => en((GOAL_ES as Record<string, string>)[key] ?? key, values)
const LANGUAGES = { en, es }

/** With three-digit figures, which is when it takes up the most. */
const HIGHER: Goal = {
  medals: { bronze: 120, silver: 260, gold: 400 },
  better: 'higher',
  unit: 'points in challenge',
  record: 520,
  mode: 'challenge',
}
const LOWER: Goal = {
  medals: { bronze: 135, silver: 127, gold: 123 },
  better: 'lower',
  unit: 'strokes on the round',
  record: 119,
  mode: 'challenge',
}

/** With thresholds in the thousands: the longest figures a game of the hall ever writes. */
const THOUSANDS: Goal = {
  medals: { bronze: 1500, silver: 8000, gold: 20000 },
  better: 'higher',
  unit: 'points in challenge',
  record: 104250,
  mode: 'challenge',
}

const base = { mission: 'Score until you miss 3 times', remaining: 'Lives ♥♥♡ · 0:47' }

/** An end reason like the one a game gives when it ends: short, going before the record on the same line. */
const END_REASON = { en: 'Three clays on the ground', es: 'Tres platos al suelo' }

/** Every thing the sign ever says: each phase, each threshold, with a record and without one. */
function runs(): Run[] {
  const all: Run[] = []
  for (const goal of [HIGHER, LOWER, { ...HIGHER, record: null }, { ...LOWER, record: null }]) {
    all.push({ ...base, goal, phase: 'before', points: 0 })
    for (const points of [0, 118, 125, 130, 200, 300, 450, 519, 999]) {
      all.push({ ...base, goal, phase: 'playing', points })
      all.push({ ...base, goal, phase: 'end', points })
    }
    all.push({ ...base, goal, phase: 'playing', points: 0, counts: false, mode: 'One minute' })
  }
  for (const goal of [THOUSANDS, { ...THOUSANDS, record: null }]) {
    all.push({ ...base, goal, phase: 'before', points: 0 })
    for (const points of [0, 1450, 7900, 19950, 20000, 103900, 104250, 188800]) {
      all.push({ ...base, goal, phase: 'playing', points })
      all.push({ ...base, goal, phase: 'end', points })
    }
  }
  for (const record of [null, 520]) {
    for (const phase of ['before', 'playing', 'end'] as const) {
      all.push({ ...base, phase, points: 480, record })
      all.push({ ...base, phase, points: 480, record, better: 'lower' })
    }
  }
  return all
}

function measure(view: GoalSignView, celebration: Parameters<typeof drawSign>[2] = null): DrawnText[] {
  const { ctx, drawnTexts } = recordingCanvas()
  drawSign(ctx, view, celebration)
  return drawnTexts
}

/** How many degrees the font of a text takes up in the eye, at the draw distance. */
function degrees(drawn: DrawnText): number {
  return (2 * Math.atan(drawn.height / LINE_HEIGHT / (2 * DRAW_DISTANCE)) * 180) / Math.PI
}

describe('the goal sign can be read', () => {
  it('in each phase, higher and lower is better, with the hall and without it, in both languages', () => {
    for (const [lang, t] of Object.entries(LANGUAGES)) {
      const endReason = END_REASON[lang as keyof typeof END_REASON]
      const withEndReason = runs().filter((run) => run.phase === 'end').map((run) => ({ ...run, endReason }))
      for (const run of [...runs(), ...withEndReason]) {
        const view = goalSign(run, t)
        const drawnTexts = measure(view)
        expect(drawnTexts.length, 'nothing was measured').toBeGreaterThan(0)
        expect(
          legibilityProblems(drawnTexts, { panel: SIGN_PANEL, distance: DRAW_DISTANCE }),
          `${lang}: ${view.title} / ${view.detail} / ${view.footer}`,
        ).toEqual([])
      }
    }
  })

  it('and while it celebrates a threshold, which says the medal in the title', () => {
    const view = goalSign({ ...base, goal: HIGHER, phase: 'playing', points: 260 }, es)
    const [title, detail] = measure(view, 'silver')

    expect(title.text).toBe('¡Plata!')
    expect(detail).toEqual(measure(view)[1])
    expect(legibilityProblems(measure(view, 'silver'), { panel: SIGN_PANEL, distance: DRAW_DISTANCE })).toEqual([])
  })

  it('while playing it writes no more than two lines; at the end, three at most', () => {
    for (const run of runs()) {
      const lines = measure(goalSign({ ...run, endReason: END_REASON.es }, es)).length
      expect(lines).toBeLessThanOrEqual(run.phase === 'end' ? 3 : 2)
    }
  })

  it('with three lines the font drops without going past the minimum, and everything fits on the panel', () => {
    const view = goalSign({ ...base, goal: { ...HIGHER, record: 520 }, phase: 'end', points: 130, endReason: END_REASON.es }, es)
    const [title, detail, footer] = measure(view)

    expect(footer.text).toBe('Tres platos al suelo · Tu mejor 520')
    expect(degrees(title)).toBeCloseTo(1.2, 1)
    expect(degrees(detail)).toBeCloseTo(1.0, 1)
    expect(degrees(footer)).toBeGreaterThan(MIN_ANGLE)
    expect(title.y + title.height / 2).toBeLessThan(SIGN_PANEL.height / 2)
    expect(footer.y - footer.height / 2).toBeGreaterThan(-SIGN_PANEL.height / 2)
  })

  it('the playing phrase is read at a glance: almost twice the minimum, without shrinking', () => {
    const [title, detail] = measure(goalSign({ ...base, goal: HIGHER, phase: 'playing', points: 130 }, es))

    expect(title.text).toBe('Plata a 260 · llevas 130')
    expect(degrees(title)).toBeCloseTo(1.4, 1)
    expect(degrees(detail)).toBeCloseTo(1.2, 1)
    expect(SIGN_FONT.title).toBeGreaterThan(minTextHeight(DRAW_DISTANCE) * 1.8)
  })

  it('with thresholds in the thousands it barely shrinks: «Oro a 20.000 · llevas 19.950» stays above 1.2°', () => {
    const [title] = measure(goalSign({ ...base, goal: THOUSANDS, phase: 'playing', points: 19950 }, es))

    expect(title.text).toBe('Oro a 20.000 · llevas 19.950')
    expect(degrees(title)).toBeGreaterThan(1.2)
  })

  it('a long phrase shrinks until it fits, without dropping below the minimum that can be read', () => {
    const [title] = measure(
      goalSign({ ...base, goal: LOWER, phase: 'playing', points: 121 }, es),
    )

    expect(title.text).toBe('Oro con 123 o menos · llevas 121')
    expect(degrees(title)).toBeLessThan(1.4)
    expect(degrees(title)).toBeGreaterThan(MIN_ANGLE)
  })

  it('a single line sits centred; with the bar, everything fits inside the panel', () => {
    const [single] = measure(goalSign({ ...base, goal: HIGHER, phase: 'playing', points: 0, counts: false }, en))

    expect(single.y).toBeCloseTo(0)

    const [title, detail] = measure(goalSign({ ...base, goal: HIGHER, phase: 'playing', points: 130 }, en))
    expect(title.y).toBeGreaterThan(detail.y)
    expect(detail.y - detail.height / 2).toBeGreaterThan(-SIGN_PANEL.height / 2)
  })
})

describe('the size of the sign', () => {
  it('grows with the distance: it takes up the same in the eye at two metres as at twenty', () => {
    expect(signScale(DRAW_DISTANCE)).toBe(1)
    expect(signScale(20)).toBe(20 / DRAW_DISTANCE)

    const { width, height } = signAspect()
    for (const distance of [2, 7.75, 20]) {
      expect(SIGN_PANEL.width * signScale(distance)).toBeCloseTo(width * distance)
      expect(SIGN_PANEL.height * signScale(distance)).toBeCloseTo(height * distance)
    }
  })

  it('does not go past 24° wide or 4.5° high: it does not cover the game', () => {
    const angle = (metres: number) => (2 * Math.atan(metres / (2 * DRAW_DISTANCE)) * 180) / Math.PI

    expect(angle(SIGN_PANEL.width)).toBeLessThanOrEqual(24.01)
    expect(angle(SIGN_PANEL.height)).toBeLessThanOrEqual(4.51)
  })
})
