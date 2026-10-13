import { describe, expect, it } from 'vitest'
import {
  MEDALS,
  GOAL_ES,
  CELEBRATION_SECONDS,
  goalSign,
  countsForMedal,
  thresholdCrossed,
  medalEarned,
  medalToCelebrate,
  celebrationPulse,
  type Goal,
  type Run,
  type Translate,
} from './goal'

/**
 * What the goal sign says at each moment of the run.
 *
 * It is the same file in every game of the hall, so there is nothing of any of them here: one
 * game in which higher is better (points, with lives) and another in which lower is better (strokes,
 * with holes), with the hall passing the goal and with the game opened on its own.
 */

/** Higher is better: 6, 16 and 40 points. */
const POINTS: Goal = {
  medals: { bronze: 6, silver: 16, gold: 40 },
  better: 'higher',
  unit: 'points',
  record: null,
  mode: 'challenge',
}

/** Lower is better: 35, 27 and 23 strokes. */
const STROKES: Goal = {
  medals: { bronze: 35, silver: 27, gold: 23 },
  better: 'lower',
  unit: 'strokes',
  record: null,
  mode: 'normal:9',
}

const MISSION = 'Score until you miss 3 times'

const run = (changes: Partial<Run>): Run => ({
  goal: POINTS,
  phase: 'playing',
  points: 0,
  mission: MISSION,
  ...changes,
})

/** The translator of a game in Spanish: its dictionary includes the sign's. */
const es: Translate = (key, values) => {
  const said = (GOAL_ES as Record<string, string>)[key] ?? key
  return values === undefined ? said : said.replace(/\{(\w+)\}/g, (_, placeholder: string) => String(values[placeholder]))
}

describe('before starting', () => {
  it('says the mission and the three thresholds', () => {
    expect(goalSign(run({ phase: 'before' }))).toEqual({
      title: MISSION,
      detail: 'Bronze 6 · Silver 16 · Gold 40',
      bar: null,
      medal: null,
      subdued: false,
    })
  })

  it('with «lower is better» the thresholds read the other way round: the gold first and «or less»', () => {
    const view = goalSign(run({ goal: STROKES, phase: 'before', mission: 'Nine holes' }))

    expect(view.title).toBe('Nine holes')
    expect(view.detail).toBe('Gold 23 or less · Silver 27 · Bronze 35')
  })

  it('in Spanish', () => {
    expect(goalSign(run({ phase: 'before' }), es).detail).toBe('Bronce 6 · Plata 16 · Oro 40')
    expect(goalSign(run({ goal: STROKES, phase: 'before' }), es).detail).toBe(
      'Oro 23 o menos · Plata 27 · Bronce 35',
    )
  })
})

describe('playing for higher', () => {
  it('says the next threshold still missing, what has been scored and what is left', () => {
    const view = goalSign(run({ points: 9, remaining: 'Lives ♥♥♡' }))

    expect(view.title).toBe('Silver at 16 · you have 9')
    expect(view.detail).toBe('Lives ♥♥♡')
    expect(view.medal).toBe('silver')
    // From the 6 of the bronze to the 16 of the silver, with 9: three out of ten.
    expect(view.bar).toBeCloseTo(0.3)
  })

  it('in Spanish: «Plata a 16 · llevas 9»', () => {
    expect(goalSign(run({ points: 9 }), es).title).toBe('Plata a 16 · llevas 9')
  })

  it('with nothing left for the player, the second line does not come out', () => {
    expect(goalSign(run({ points: 9 })).detail).toBeNull()
  })

  it('on crossing each threshold it moves on to the next, and the bar starts again', () => {
    const title = (points: number) => goalSign(run({ points })).title
    const bar = (points: number) => goalSign(run({ points })).bar

    expect(title(0)).toBe('Bronze at 6 · you have 0')
    expect(title(5)).toBe('Bronze at 6 · you have 5')
    expect(title(6)).toBe('Silver at 16 · you have 6')
    expect(title(15)).toBe('Silver at 16 · you have 15')
    expect(title(16)).toBe('Gold at 40 · you have 16')
    expect(title(39)).toBe('Gold at 40 · you have 39')

    expect(bar(0)).toBe(0)
    expect(bar(3)).toBeCloseTo(0.5)
    expect(bar(6)).toBe(0)
    expect(bar(16)).toBe(0)
    expect(bar(28)).toBeCloseTo(0.5)
  })

  it('with the gold in hand, the goal is one\'s own record', () => {
    const view = goalSign(run({ goal: { ...POINTS, record: 52 }, points: 46 }))

    expect(view.title).toBe('Gold · your record 52 · you have 46')
    expect(view.medal).toBe('gold')
    // From the 40 of the gold to the 52 of the record, with 46: half.
    expect(view.bar).toBeCloseTo(0.5)
    expect(goalSign(run({ goal: { ...POINTS, record: 52 }, points: 46 }), es).title).toBe(
      'Oro · tu récord 52 · llevas 46',
    )
  })

  it('matching it is not beating it: it is still the goal', () => {
    expect(goalSign(run({ goal: { ...POINTS, record: 52 }, points: 52 })).title).toBe(
      'Gold · your record 52 · you have 52',
    )
  })

  it('past the record, or without a record, or with one that did not reach the gold, it is a new record', () => {
    for (const record of [52, null, 12]) {
      const view = goalSign(run({ goal: { ...POINTS, record }, points: 53 }))
      expect(view.title, `${record}`).toBe('Gold · new record 53')
      expect(view.bar).toBe(1)
    }
  })
})

describe('playing for lower', () => {
  const playing = (points: number, record: number | null = null) =>
    goalSign(run({ goal: { ...STROKES, record }, points, remaining: 'Hole 4 of 9' }))

  it('says the best medal that can still be made and the margin left', () => {
    const view = playing(9)

    expect(view.title).toBe('Gold with 23 or less · you have 9')
    expect(view.detail).toBe('Hole 4 of 9')
    expect(view.medal).toBe('gold')
    expect(view.bar).toBeCloseTo(14 / 23)
  })

  it('in Spanish: «Oro con 23 o menos · llevas 9»', () => {
    expect(goalSign(run({ goal: STROKES, points: 9 }), es).title).toBe('Oro con 23 o menos · llevas 9')
  })

  it('on going past each threshold it drops to the next, and past the bronze there is no medal any more', () => {
    expect(playing(23).title).toBe('Gold with 23 or less · you have 23')
    expect(playing(23).bar).toBe(0)
    expect(playing(24).title).toBe('Silver with 27 or less · you have 24')
    expect(playing(28).title).toBe('Bronze with 35 or less · you have 28')
    expect(playing(35).medal).toBe('bronze')

    const out = playing(36)
    expect(out.title).toBe('No medal within reach · you have 36')
    expect(out.medal).toBeNull()
    expect(out.bar).toBe(0)
  })

  it('with a record better than the gold, the first thing is not to go past it', () => {
    const view = playing(9, 21)

    expect(view.title).toBe('Your record 21 · you have 9')
    expect(view.bar).toBeCloseTo(12 / 21)
    // Past the record, the gold is left.
    expect(playing(22, 21).title).toBe('Gold with 23 or less · you have 22')
  })

  it('a record that does not reach the gold is not the goal: the gold is', () => {
    expect(playing(9, 30).title).toBe('Gold with 23 or less · you have 9')
  })
})

describe('at the end', () => {
  const finish = (points: number, goal: Goal = POINTS, t?: Translate) =>
    goalSign(run({ goal, phase: 'end', points }), t)

  it('says what was earned and what was missing for the next one', () => {
    expect(finish(9, { ...POINTS, record: 9 })).toEqual({
      title: 'Bronze · 9 points',
      detail: '7 short of silver',
      bar: null,
      medal: 'bronze',
      subdued: false,
      footer: 'You matched your record',
      cheer: 'Bronze!',
    })
    expect(finish(20).title).toBe('Silver · 20 points')
    expect(finish(20).detail).toBe('20 short of gold')
  })

  it('without a medal, what was missing for the bronze', () => {
    const view = finish(2)

    expect(view.title).toBe('No medal · 2 points')
    expect(view.detail).toBe('4 short of bronze')
    expect(view.medal).toBeNull()
  })

  it('in Spanish: «Te han faltado 7 para la plata»', () => {
    expect(finish(9, POINTS, es).detail).toBe('Te han faltado 7 para la plata')
    expect(finish(2, POINTS, es).title).toBe('Sin medalla · 2 points')
    expect(finish(2, POINTS, es).detail).toBe('Te han faltado 4 para el bronce')
    expect(finish(20, POINTS, es).detail).toBe('Te han faltado 20 para el oro')
  })

  it('with the gold, what lies ahead is the record', () => {
    expect(finish(45, { ...POINTS, record: 52 }).detail).toBe('7 short of your record')
    expect(finish(52, { ...POINTS, record: 52 }).detail).toBe('You matched your record')
    expect(finish(60, { ...POINTS, record: 52 }).detail).toBe('New record!')
    // Without a previous mark, the first one.
    expect(finish(45).detail).toBe('First record!')
    expect(finish(45).title).toBe('Gold · 45 points')
  })

  it('for lower: what was over for the next one', () => {
    expect(finish(25, STROKES).title).toBe('Silver · 25 strokes')
    expect(finish(25, STROKES).detail).toBe('2 too many for gold')
    expect(finish(30, STROKES).detail).toBe('3 too many for silver')
    expect(finish(40, STROKES).title).toBe('No medal · 40 strokes')
    expect(finish(40, STROKES).detail).toBe('5 too many for bronze')
    expect(finish(25, STROKES, es).detail).toBe('Te han sobrado 2 para el oro')
  })

  it('for lower, with the gold: what was over for the record, or that it has been beaten', () => {
    expect(finish(22, { ...STROKES, record: 20 }).detail).toBe('2 over your record')
    expect(finish(19, { ...STROKES, record: 20 }).detail).toBe('New record!')
    expect(finish(20, { ...STROKES, record: 20 }).detail).toBe('You matched your record')
  })

  it('the unit goes through the game\'s translator', () => {
    const t: Translate = (key, values) => (key === 'points' ? 'puntos' : es(key, values))

    expect(finish(9, POINTS, t).title).toBe('Bronce · 9 puntos')
  })
})

describe('the end, against the record from before and with its reason', () => {
  const finish = (changes: Partial<Run>) => goalSign(run({ phase: 'end', ...changes }))

  it('the first run with a mark says «¡Primer récord!» and never «matched»', () => {
    const view = finish({ points: 9 })

    expect(view.footer).toBe('First record!')
    expect(JSON.stringify(view)).not.toContain('matched')
    expect(goalSign(run({ phase: 'end', points: 9 }), es).footer).toBe('¡Primer récord!')
    // For lower, any finished round is a mark; for higher, a zero is not.
    expect(finish({ goal: STROKES, points: 40 }).footer).toBe('First record!')
    expect(finish({ points: 0 }).footer).toBeUndefined()
  })

  it('short of the record it says the bare record; beaten or matched, it says so', () => {
    expect(finish({ goal: { ...POINTS, record: 31 }, points: 9 }).footer).toBe('Your best 31')
    expect(finish({ goal: { ...POINTS, record: 8 }, points: 9 }).footer).toBe('New record!')
    expect(finish({ goal: { ...STROKES, record: 30 }, points: 33 }).footer).toBe('Your best 30')
    expect(goalSign(run({ goal: { ...POINTS, record: 31 }, phase: 'end', points: 9 }), es).footer).toBe(
      'Tu mejor 31',
    )
  })

  it('the reason the game gives goes first, also in the game on its own', () => {
    expect(finish({ goal: { ...POINTS, record: 31 }, points: 9, endReason: 'Three on the floor' }).footer).toBe(
      'Three on the floor · Your best 31',
    )
    expect(finish({ goal: { ...POINTS, record: 30 }, points: 45, endReason: 'Out of time' })).toMatchObject({
      detail: 'New record!',
      footer: 'Out of time',
    })
    expect(finish({ goal: null, points: 4, record: 6, endReason: 'Out of time' })).toMatchObject({
      detail: '2 short of your record',
      footer: 'Out of time',
    })
    // While playing, the reason is still nothing.
    expect(goalSign(run({ points: 4, endReason: 'Out of time' })).footer).toBeUndefined()
  })

  it('a game that already says the record on its scoreboard does not hear it twice', () => {
    expect(finish({ points: 9, recordShownElsewhere: true }).footer).toBeUndefined()
    expect(finish({ points: 45, recordShownElsewhere: true }).detail).toBeNull()
    expect(finish({ goal: null, points: 9, recordShownElsewhere: true, endReason: 'Out of time' })).toMatchObject({
      detail: null,
      footer: 'Out of time',
    })
  })
})

describe('on crossing a threshold the sign says the medal', () => {
  it('for higher, as soon as it is theirs: «¡Bronce!», in their language', () => {
    expect(goalSign(run({ points: 5 })).cheer).toBeUndefined()
    expect(goalSign(run({ points: 6 })).cheer).toBe('Bronze!')
    expect(goalSign(run({ points: 20 }), es).cheer).toBe('¡Plata!')
    expect(goalSign(run({ points: 40 }), es).cheer).toBe('¡Oro!')
  })

  it('for lower, at the end; and never in what does not count', () => {
    expect(goalSign(run({ goal: STROKES, points: 20 })).cheer).toBeUndefined()
    expect(goalSign(run({ goal: STROKES, phase: 'end', points: 20 })).cheer).toBe('Gold!')
    expect(goalSign(run({ points: 20, counts: false })).cheer).toBeUndefined()
  })
})

describe('the bronze in what is counted', () => {
  const asCount = (points: number) => `≈ ${Math.round(points / 150)} sticks`

  it('the first time, before starting, the bronze is said in what is counted, and with the gold without the silver', () => {
    const goal: Goal = { ...POINTS, medals: { bronze: 1900, silver: 4000, gold: 7000 } }

    expect(goalSign(run({ goal, phase: 'before', asCount })).detail).toBe(
      'Bronze ≈ 13 sticks · Gold 7,000',
    )
    expect(goalSign(run({ goal, phase: 'before', asCount }), es).detail).toBe(
      'Bronce ≈ 13 sticks · Oro 7000',
    )
    expect(goalSign(run({ goal: STROKES, phase: 'before', asCount: () => '≈ 4 holes' })).detail).toBe(
      'Gold 23 or less · Bronze ≈ 4 holes',
    )
  })

  it('with a record it is already known what a figure is worth: the bare thresholds', () => {
    expect(goalSign(run({ goal: { ...POINTS, record: 3 }, phase: 'before', asCount })).detail).toBe(
      'Bronze 6 · Silver 16 · Gold 40',
    )
    expect(goalSign(run({ phase: 'before', asCount: null })).detail).toBe('Bronze 6 · Silver 16 · Gold 40')
  })
})

describe('a mode that does not count', () => {
  it('says it quietly, in one line and without a bar', () => {
    expect(goalSign(run({ counts: false, mode: 'Practice', points: 12, remaining: '3 balls' }))).toEqual({
      title: 'Practice · does not count for a medal',
      detail: null,
      bar: null,
      medal: null,
      subdued: true,
    })
    expect(goalSign(run({ counts: false, mode: 'Práctica' }), es).title).toBe(
      'Práctica · no cuenta para medalla',
    )
  })

  it('without a mode name it says the mission; and without the hall it does not talk about medals', () => {
    expect(goalSign(run({ counts: false })).title).toBe(`${MISSION} · does not count for a medal`)
    expect(goalSign(run({ goal: null, counts: false, mode: 'Practice' }))).toMatchObject({
      title: MISSION,
      subdued: true,
    })
  })

  it('the mode the medals come from counts; without a goal there is nothing to discount', () => {
    expect(countsForMedal(POINTS, 'challenge')).toBe(true)
    expect(countsForMedal(POINTS, 'practice')).toBe(false)
    expect(countsForMedal(null, 'practice')).toBe(true)
    expect(countsForMedal(undefined, 'practice')).toBe(true)
  })
})

describe('the game on its own, without a goal from the hall', () => {
  const standalone = (changes: Partial<Run>) => goalSign(run({ goal: undefined, ...changes }))

  it('before starting: the mission and the local record, if there is one', () => {
    expect(standalone({ phase: 'before', record: 31 })).toEqual({
      title: MISSION,
      detail: 'Your record 31',
      bar: null,
      medal: null,
      subdued: false,
    })
    expect(standalone({ phase: 'before' }).detail).toBeNull()
    expect(standalone({ phase: 'before', record: null }).detail).toBeNull()
  })

  it('playing: the record as the threshold, what has been scored and what is left', () => {
    const view = standalone({ points: 12, record: 30, remaining: 'Lives ♥♥♥' })

    expect(view.title).toBe('Your record 30 · you have 12')
    expect(view.detail).toBe('Lives ♥♥♥')
    expect(view.bar).toBeCloseTo(0.4)
    expect(standalone({ points: 45, record: 30 }).bar).toBe(1)
  })

  it('playing without a record: only what has been scored', () => {
    const view = standalone({ points: 12 })

    expect(view.title).toBe('You have 12')
    expect(view.detail).toBeNull()
    expect(view.bar).toBeNull()
  })

  it('playing for lower, the bar is the margin left up to the record', () => {
    expect(standalone({ points: 10, record: 40, better: 'lower' }).bar).toBeCloseTo(0.75)
    expect(standalone({ points: 50, record: 40, better: 'lower' }).bar).toBe(0)
    // A record of zero leaves no margin to measure.
    expect(standalone({ points: 0, record: 0, better: 'lower' }).bar).toBe(1)
  })

  it('at the end: what was done and how it stood against the record', () => {
    expect(standalone({ phase: 'end', points: 18, record: 30 })).toMatchObject({
      title: 'You scored 18',
      detail: '12 short of your record',
    })
    expect(standalone({ phase: 'end', points: 31, record: 30 }).detail).toBe('New record!')
    expect(standalone({ phase: 'end', points: 18 }).detail).toBe('First record!')
    expect(standalone({ phase: 'end', points: 0 }).detail).toBeNull()
    expect(standalone({ phase: 'end', points: 44, record: 40, better: 'lower' }).detail).toBe('4 over your record')
    expect(standalone({ phase: 'end', points: 38, record: 40, better: 'lower' }).detail).toBe('New record!')
  })
})

describe('the medals', () => {
  it('the one earned is the best the score reaches', () => {
    expect(medalEarned(POINTS, 5)).toBeNull()
    expect(medalEarned(POINTS, 6)).toBe('bronze')
    expect(medalEarned(POINTS, 16)).toBe('silver')
    expect(medalEarned(POINTS, 40)).toBe('gold')
    expect(medalEarned(STROKES, 36)).toBeNull()
    expect(medalEarned(STROKES, 35)).toBe('bronze')
    expect(medalEarned(STROKES, 27)).toBe('silver')
    expect(medalEarned(STROKES, 23)).toBe('gold')
  })

  it('a threshold is crossed on going up a medal, never on going down or staying', () => {
    expect(thresholdCrossed(null, 'bronze')).toBe('bronze')
    expect(thresholdCrossed('bronze', 'silver')).toBe('silver')
    expect(thresholdCrossed(null, 'gold')).toBe('gold')
    expect(thresholdCrossed('silver', 'silver')).toBeNull()
    expect(thresholdCrossed('gold', 'silver')).toBeNull()
    expect(thresholdCrossed('gold', null)).toBeNull()
    expect(thresholdCrossed(null, null)).toBeNull()
    expect(MEDALS).toEqual(['bronze', 'silver', 'gold'])
  })

  it('for higher it is celebrated as soon as the threshold is crossed; before starting there is nothing', () => {
    expect(medalToCelebrate(run({ phase: 'before', points: 0 }))).toBeNull()
    expect(medalToCelebrate(run({ points: 5 }))).toBeNull()
    expect(medalToCelebrate(run({ points: 6 }))).toBe('bronze')
    expect(medalToCelebrate(run({ phase: 'end', points: 41 }))).toBe('gold')
  })

  it('for lower it is nobody\'s until it ends', () => {
    expect(medalToCelebrate(run({ goal: STROKES, points: 3 }))).toBeNull()
    expect(medalToCelebrate(run({ goal: STROKES, phase: 'end', points: 25 }))).toBe('silver')
  })

  it('without a goal, or in a mode that does not count, there is no medal to celebrate', () => {
    expect(medalToCelebrate(run({ goal: null, points: 50 }))).toBeNull()
    expect(medalToCelebrate(run({ counts: false, points: 50 }))).toBeNull()
  })
})

describe('the pulse of the celebration', () => {
  it('grows and returns to its size before the celebration ends', () => {
    expect(celebrationPulse(0)).toBe(1)
    expect(celebrationPulse(-1)).toBe(1)
    expect(celebrationPulse(0.25)).toBeGreaterThan(1.1)
    expect(celebrationPulse(0.25)).toBeLessThan(1.2)
    expect(celebrationPulse(0.5)).toBe(1)
    expect(celebrationPulse(CELEBRATION_SECONDS)).toBe(1)
  })
})

describe('the figures', () => {
  /** Thresholds in the thousands, like those of archery or hockey. */
  const THOUSANDS: Goal = { ...POINTS, medals: { bronze: 500, silver: 7000, gold: 17000 }, record: 104250 }
  const withThousands = (changes: Partial<Run>, t?: Translate) => goalSign(run({ goal: THOUSANDS, ...changes }), t)

  it('English separates the thousands with a comma from four digits on', () => {
    expect(withThousands({ phase: 'before' }).detail).toBe('Bronze 500 · Silver 7,000 · Gold 17,000')
    expect(withThousands({ points: 1250 }).title).toBe('Silver at 7,000 · you have 1,250')
    expect(withThousands({ points: 1234567 }).title).toBe('Gold · new record 1,234,567')
  })

  it('Spanish, with a dot and from five on: «7000» and «17.000», like the plate of the cabinet', () => {
    expect(withThousands({ phase: 'before' }, es).detail).toBe('Bronce 500 · Plata 7000 · Oro 17.000')
    expect(withThousands({ points: 1250 }, es).title).toBe('Plata a 7000 · llevas 1250')
    expect(withThousands({ points: 999 }, es).title).toBe('Plata a 7000 · llevas 999')
    expect(withThousands({ goal: undefined, points: 9999 }, es).title).toBe('Llevas 9999')
    expect(withThousands({ goal: undefined, points: 10000 }, es).title).toBe('Llevas 10.000')
    expect(withThousands({ goal: undefined, points: 1234567 }, es).title).toBe('Llevas 1.234.567')
  })

  it('also the record, what was missing and what has been done', () => {
    expect(withThousands({ points: 20000 }, es).title).toBe('Oro · tu récord 104.250 · llevas 20.000')
    expect(withThousands({ phase: 'end', points: 5800 }, es)).toMatchObject({
      title: 'Bronce · 5800 points',
      detail: 'Te han faltado 1200 para la plata',
    })
    expect(withThousands({ phase: 'end', points: 5800 })).toMatchObject({
      title: 'Bronze · 5,800 points',
      detail: '1,200 short of silver',
    })
    expect(withThousands({ goal: undefined, phase: 'before', record: 31000 }, es).detail).toBe('Tu récord 31.000')
  })

  it('the separator comes from the game\'s translator: without that phrase in its dictionary, the English one', () => {
    const withoutTheSign: Translate = (key, values) =>
      values === undefined ? key : key.replace(/\{(\w+)\}/g, (_, placeholder: string) => String(values[placeholder]))

    expect(withThousands({ points: 1250 }, withoutTheSign).title).toBe('Silver at 7,000 · you have 1,250')
  })

  it('a separator that is neither the comma nor the dot is grouped as in English', () => {
    const withSpace: Translate = (key, values) => (key === ',' ? ' ' : es(key, values))

    expect(withThousands({ goal: undefined, points: 1234.5 }, withSpace).title).toBe('Llevas 1 234.5')
  })

  it('a negative figure can still be read, and it groups by its digits, not by the sign', () => {
    expect(withThousands({ goal: undefined, points: -1500 }).title).toBe('You have -1,500')
    expect(withThousands({ goal: undefined, points: -1500 }, es).title).toBe('Llevas -1500')
    expect(withThousands({ goal: undefined, points: -15000 }, es).title).toBe('Llevas -15.000')
  })

  it('the decimals take the other sign, up to three and rounded', () => {
    expect(withThousands({ goal: undefined, points: 1234.5 }).title).toBe('You have 1,234.5')
    expect(withThousands({ goal: undefined, points: 1234.5 }, es).title).toBe('Llevas 1234,5')
    expect(withThousands({ goal: undefined, points: 12345.678 }, es).title).toBe('Llevas 12.345,678')
    expect(withThousands({ goal: undefined, points: 0.1 + 0.2 }, es).title).toBe('Llevas 0,3')
    expect(withThousands({ goal: undefined, points: 2.25049 }).title).toBe('You have 2.25')
    // The rounding that reaches the whole part carries over: 9999,9996 is 10.000, and now it groups.
    expect(withThousands({ goal: undefined, points: 9999.9996 }, es).title).toBe('Llevas 10.000')
    expect(withThousands({ goal: undefined, points: 999.9996 }).title).toBe('You have 1,000')
  })

  it('what is not a figure is written as is, without grouping anything', () => {
    expect(withThousands({ goal: undefined, points: Number.NaN }).title).toBe('You have NaN')
    expect(withThousands({ goal: undefined, points: Number.POSITIVE_INFINITY }, es).title).toBe('Llevas Infinity')
  })
})

describe('the dictionary of the sign', () => {
  it('keeps the placeholders of each phrase when translating it', () => {
    const placeholders = (phrase: string) => [...phrase.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

    for (const [en, translated] of Object.entries(GOAL_ES)) expect(placeholders(translated), en).toEqual(placeholders(en))
  })
})
