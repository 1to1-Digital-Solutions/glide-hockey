/**
 * The goal of the run, said up front: what the sign reads at each moment.
 *
 * It is the same file in every game of the hall, together with
 * `components/xr/GoalSign.tsx`, and that is why it **imports nothing from the game**: no three, no
 * React, not its dictionary. What belongs to each game —the mission sentence, what the player has
 * left, where the sign hangs— comes in through parameters.
 *
 * **How it is mounted in a game:**
 *
 * 1. The scene receives `goal?: Goal` from the hall, just like `challenge` and `onFinish`, and passes
 *    it down to where the scoreboard is built. Without it (the game opened on its own) the sign says
 *    the mission and the local record.
 * 2. The phrases here are in English and are their own key. The game's dictionary learns them
 *    by putting `...GOAL_ES` **first** in its translations object (first, so that a phrase the
 *    game already had does not clash).
 * 3. With the state of the run a `Run` is built and the view is asked for, already translated:
 *    `goalSign({ goal, phase, points, mission: t(MISSION), remaining: '♥♥♡', counts }, t)`.
 *    - `phase`: `'before'` (countdown or until the first attempt), `'playing'`, `'end'`.
 *    - `points`: what has been scored so far, in the record's unit (strokes, if lower is better).
 *    - `remaining`: what the player has left, already written: lives, shots, time or holes.
 *    - `counts: countsForMedal(goal, mode)`: `false` in practice and in any mode that is not
 *      the record's; then `mode` is the name that is shown.
 * 4. The view is given to `<GoalSign>` with its place, its orientation and the distance it is
 *    read from, and `medalToCelebrate(run)` in `celebrate` so that it celebrates each threshold.
 * 5. What the sign already says is removed from the scoreboard next to it, and the panel is measured
 *    in a test with the game's mission in both languages (`goalSign.legible.test.ts` shows how).
 *
 * **The record is the one from before the run**, the hall's and the local one: the one there was
 * when «Jugar» was pressed. One read after saving the new best would make it say «¡Nuevo récord!» and
 * «Has igualado tu récord» at the same time. Without a record (`null`), the first best is «¡Primer
 * récord!»; a game that already celebrates it on its own scoreboard passes `recordShownElsewhere` so
 * as not to say it twice.
 *
 * **At the end, a third line** (`footer`) says why it ended (`endReason`, which each game gives: «tres
 * al suelo», «ibas tarde») and how it stood against the record («Tu mejor 31»). On crossing a threshold
 * the sign does not only change colour: the title says the medal (`cheer`, «¡Bronce!») while the
 * celebration lasts. And if the record's points are not counted like the mission («13 palos» against
 * «Bronce 1900»), `asCount` translates the bronze into what is counted the first time.
 *
 * **The figures are given to it as numbers** and the sign writes them as they are read in each
 * language, just like the plate of the hall's cabinet (`formatRecordValue`, in xrcade): English
 * separates the thousands with a comma from four digits on («7,000») and Spanish with a dot and
 * **from five on** («7000», «17.000»), which is the rule of the RAE and of CLDR, not an oversight.
 * The separator is one more phrase of the dictionary (`,`), so it comes from the same translator and
 * there is no need to tell it the language: from it comes the number of digits from which to group
 * and the decimal sign.
 */

/** What the hall passes to the scene: the game's thresholds and the player's best. */
export type Goal = {
  medals: { bronze: number; silver: number; gold: number }
  better: 'higher' | 'lower'
  unit: string
  record: number | null
  mode: string
}

export const MEDALS = ['bronze', 'silver', 'gold'] as const
export type Medal = (typeof MEDALS)[number]

/** Which moment of the run it is. */
export type GoalPhase = 'before' | 'playing' | 'end'

/** A translator: the phrase in English is the key, and the placeholders go between braces. */
export type Translate = (key: string, values?: Record<string, string | number>) => string

/** What the game knows about the run and the sign needs. */
export interface Run {
  /** What the hall passed. Without it, the game is open on its own and there are no medals. */
  goal?: Goal | null
  phase: GoalPhase
  /** What has been scored so far, in the record's unit. */
  points: number
  /** The mission in one sentence, already translated: «Encesta hasta fallar 3 veces». */
  mission: string
  /** What the player has left, already written: lives, shots, time, holes. */
  remaining?: string | null
  /** Whether this run counts for the medal. `false` in practice. By default, yes. */
  counts?: boolean
  /** What the thing being played is called, already translated, to say that it does not count. */
  mode?: string
  /** The local record, for when there is no `goal`. */
  record?: number | null
  /** What is better, for when there is no `goal`. By default, higher. */
  better?: 'higher' | 'lower'
  /**
   * Why it ended, already translated: «Tres al suelo». It is only said at the end, and short: it
   * shares a line with the record, and each game's sign test measures it.
   */
  endReason?: string | null
  /**
   * What a figure of the record is worth in what is counted, already translated: `1900` → «≈ 13 palos».
   * For when the record's unit is not the mission's; it is said before the first run,
   * instead of the bronze figure (and without the silver, so that the whole line fits).
   */
  asCount?: ((points: number) => string) | null
  /** The game already says the record on its own scoreboard: the sign does not repeat it. */
  recordShownElsewhere?: boolean
}

/** What the sign paints: two lines at most and a bar. */
export interface GoalSignView {
  title: string
  detail: string | null
  /** From 0 to 1, or `null` if there is no bar. With «lower is better» it is the margin left. */
  bar: number | null
  /** Which medal the colour is about: the one being chased or the one earned. */
  medal: Medal | null
  /** It is said quietly: the run does not count for a medal. */
  subdued: boolean
  /** At the end, the third line: why it ended and how it stood against the record. */
  footer?: string
  /** The medal that is already the player's, said out loud («¡Bronce!»): the title while it is celebrated. */
  cheer?: string
}

/**
 * The phrases of the sign in Spanish. The English is not stored: it is the key.
 *
 * They go here and not in each game's dictionary so that the sign says the same in all of them; each
 * dictionary includes them with `...GOAL_ES`.
 */
export const GOAL_ES = {
  // The thousands separator, which is translated too: «17,000» is «17.000». From it comes the rest
  // of how a figure is written (`NOTATION`): with a dot it is grouped from five digits on.
  ',': '.',
  Bronze: 'Bronce',
  Silver: 'Plata',
  Gold: 'Oro',
  'Bronze {bronze} · Silver {silver} · Gold {gold}': 'Bronce {bronze} · Plata {silver} · Oro {gold}',
  'Gold {gold} or less · Silver {silver} · Bronze {bronze}': 'Oro {gold} o menos · Plata {silver} · Bronce {bronze}',
  '{medal} at {target} · you have {score}': '{medal} a {target} · llevas {score}',
  '{medal} with {target} or less · you have {score}': '{medal} con {target} o menos · llevas {score}',
  'Gold · your record {record} · you have {score}': 'Oro · tu récord {record} · llevas {score}',
  'Gold · new record {score}': 'Oro · nuevo récord {score}',
  'No medal within reach · you have {score}': 'Ya sin medalla · llevas {score}',
  'Your record {record} · you have {score}': 'Tu récord {record} · llevas {score}',
  'Your record {record}': 'Tu récord {record}',
  'You have {score}': 'Llevas {score}',
  'You scored {score}': 'Has hecho {score}',
  '{medal} · {score} {unit}': '{medal} · {score} {unit}',
  'No medal · {score} {unit}': 'Sin medalla · {score} {unit}',
  '{missing} short of bronze': 'Te han faltado {missing} para el bronce',
  '{missing} short of silver': 'Te han faltado {missing} para la plata',
  '{missing} short of gold': 'Te han faltado {missing} para el oro',
  '{missing} short of your record': 'Te han faltado {missing} para tu récord',
  '{extra} too many for bronze': 'Te han sobrado {extra} para el bronce',
  '{extra} too many for silver': 'Te han sobrado {extra} para la plata',
  '{extra} too many for gold': 'Te han sobrado {extra} para el oro',
  '{extra} over your record': 'Te han sobrado {extra} para tu récord',
  'You matched your record': 'Has igualado tu récord',
  'New record!': '¡Nuevo récord!',
  'First record!': '¡Primer récord!',
  'Your best {record}': 'Tu mejor {record}',
  'Bronze!': '¡Bronce!',
  'Silver!': '¡Plata!',
  'Gold!': '¡Oro!',
  'Bronze {asCount} · Gold {gold}': 'Bronce {asCount} · Oro {gold}',
  'Gold {gold} or less · Bronze {asCount}': 'Oro {gold} o menos · Bronce {asCount}',
  '{mode} · does not count for a medal': '{mode} · no cuenta para medalla',
} as const

const NAME: Record<Medal, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }
const CHEER: Record<Medal, string> = { bronze: 'Bronze!', silver: 'Silver!', gold: 'Gold!' }
const SHORT_OF: Record<Medal, string> = {
  bronze: '{missing} short of bronze',
  silver: '{missing} short of silver',
  gold: '{missing} short of gold',
}
const TOO_MANY: Record<Medal, string> = {
  bronze: '{extra} too many for bronze',
  silver: '{extra} too many for silver',
  gold: '{extra} too many for gold',
}

/** Without a translator, in English: it fills in the placeholders and nothing else. */
const EN: Translate = (key, values) =>
  values === undefined ? key : key.replace(/\{(\w+)\}/g, (_, placeholder: string) => String(values[placeholder]))

/**
 * How a figure is written according to the thousands separator the translator gives: the decimal
 * sign and the number of digits from which it is grouped. They are the rules of the hall's cabinet:
 * with a comma (English) from four, «1,240»; with a dot (Spanish) from five, «1240» and «12.400».
 * A separator that is not here is written like the English one.
 */
const NOTATION: Record<string, { decimal: string; from: number }> = {
  ',': { decimal: '.', from: 4 },
  '.': { decimal: ',', from: 5 },
}

/**
 * A figure as it is read in that language, without `Intl`: outside the browser (the port to Godot)
 * there is none. The thousands, grouped if the whole part reaches the digits required; the decimals,
 * if there were any, up to three, rounded and with the other sign.
 */
function figure(value: number, thousands: string): string {
  if (!Number.isFinite(value)) return String(value)
  const { decimal, from } = NOTATION[thousands] ?? NOTATION[',']
  // The whole part and the decimal part separately, so that the rounding does not invent decimals.
  const absolute = Math.abs(value)
  let whole = Math.trunc(absolute)
  let thousandths = Math.round((absolute - whole) * 1000)
  if (thousandths === 1000) {
    whole += 1
    thousandths = 0
  }
  const digits = String(whole)
  const grouped = digits.length < from ? digits : digits.replace(/\B(?=(\d{3})+$)/g, thousands)
  const rest = String(thousandths).padStart(3, '0').replace(/0+$/, '')
  return `${value < 0 ? '-' : ''}${grouped}${rest ? decimal + rest : ''}`
}

/** The game's translator, writing the figures of the placeholders as they are read in its language. */
function withThousands(t: Translate): Translate {
  const thousands = t(',')
  return (key, values) => {
    if (values === undefined) return t(key)
    const written: Record<string, string | number> = {}
    for (const [placeholder, value] of Object.entries(values)) {
      written[placeholder] = typeof value === 'number' ? figure(value, thousands) : value
    }
    return t(key, written)
  }
}

/** Whether `a` is a better mark than `b`. */
function isBetter(a: number, b: number, better: 'higher' | 'lower'): boolean {
  return better === 'higher' ? a > b : a < b
}

/** A part of a whole, from 0 to 1. A whole that measures nothing is complete. */
function fraction(part: number, total: number): number {
  return total > 0 ? Math.min(1, Math.max(0, part / total)) : 1
}

/** Whether what is being played is the mode the medals come from. Without a goal there is nothing to discount. */
export function countsForMedal(goal: Goal | null | undefined, mode: string): boolean {
  return goal == null || goal.mode === mode
}

/** The best medal that score gives, or `null` if it does not reach any. */
export function medalEarned(goal: Goal, points: number): Medal | null {
  const reaches = (medal: Medal) =>
    goal.better === 'higher' ? points >= goal.medals[medal] : points <= goal.medals[medal]
  return [...MEDALS].reverse().find(reaches) ?? null
}

/**
 * The threshold that has just been crossed on going from one medal to another, or `null`.
 *
 * Only going up counts: with «lower is better» the medal is lost stroke by stroke, and that is not
 * celebrated.
 */
export function thresholdCrossed(before: Medal | null, now: Medal | null): Medal | null {
  if (now == null) return null
  return before == null || MEDALS.indexOf(now) > MEDALS.indexOf(before) ? now : null
}

/**
 * The medal that is already the player's, which is the one the sign celebrates when it changes.
 *
 * With «higher is better» it is won as soon as the threshold is crossed; with «lower is better» it is
 * nobody's until it ends. Without a goal, or in a mode that does not count, there is none.
 */
export function medalToCelebrate(run: Run): Medal | null {
  const { goal, phase } = run
  if (goal == null || run.counts === false || phase === 'before') return null
  if (goal.better === 'lower' && phase !== 'end') return null
  return medalEarned(goal, run.points)
}

/** How long the celebration of a threshold lasts, in seconds: the colour; the pulse ends earlier. */
export const CELEBRATION_SECONDS = 1.2
const PULSE_SECONDS = 0.5
const GROWTH = 0.12

/**
 * How much the sign grows at those seconds after crossing a threshold: it goes up and returns to 1
 * in half a second. It is all of the celebration that moves: nothing full screen.
 */
export function celebrationPulse(seconds: number): number {
  if (seconds <= 0 || seconds >= PULSE_SECONDS) return 1
  return 1 + GROWTH * Math.sin((Math.PI * seconds) / PULSE_SECONDS)
}

/**
 * How the run stood against the record from before: what was missing, what was over or that it has been beaten.
 * Without a record, the first mark; a zero when higher is better is not a mark, and nothing is said.
 */
function againstRecord(record: number | null, points: number, better: 'higher' | 'lower', t: Translate): string | null {
  if (record == null) return better === 'lower' || points > 0 ? t('First record!') : null
  if (points === record) return t('You matched your record')
  if (isBetter(points, record, better)) return t('New record!')
  return better === 'higher'
    ? t('{missing} short of your record', { missing: record - points })
    : t('{extra} over your record', { extra: points - record })
}

/** The third line of the end, if there is anything to say in it. */
function withFooter(view: GoalSignView, ...parts: (string | null | undefined)[]): GoalSignView {
  const footer = parts.filter((part): part is string => part != null && part !== '').join(' · ')
  return footer === '' ? view : { ...view, footer }
}

/** The game on its own, without the hall: the mission and the local record. */
function withoutGoal(run: Run, t: Translate): GoalSignView {
  const { phase, points, mission } = run
  const record = run.record ?? null
  const better = run.better ?? 'higher'
  const base = { bar: null, medal: null, subdued: false }
  if (phase === 'before') {
    return { ...base, title: mission, detail: record == null ? null : t('Your record {record}', { record }) }
  }
  if (phase === 'end') {
    const view = {
      ...base,
      title: t('You scored {score}', { score: points }),
      detail: run.recordShownElsewhere === true ? null : againstRecord(record, points, better, t),
    }
    return withFooter(view, run.endReason)
  }
  return {
    ...base,
    title:
      record == null
        ? t('You have {score}', { score: points })
        : t('Your record {record} · you have {score}', { record, score: points }),
    detail: run.remaining ?? null,
    bar: record == null ? null : better === 'higher' ? fraction(points, record) : fraction(record - points, record),
  }
}

/**
 * Before starting: the mission and the three thresholds. The first time, if the game knows how to
 * translate it, the bronze said in what is counted **instead of** its figure, and the gold, without the
 * silver: «Bronce ≈ 7 palos · Oro 7000». It is what a beginner chases and how far the game goes; with the
 * figure and the silver, the line shrank below the minimum font with the eyes at 1.9 m (stick-rush).
 */
function before(goal: Goal, mission: string, t: Translate, asCount: Run['asCount']): GoalSignView {
  const translated = goal.record == null && asCount != null ? asCount(goal.medals.bronze) : null
  const higher = goal.better === 'higher'
  return {
    title: mission,
    detail:
      translated == null
        ? t(higher ? 'Bronze {bronze} · Silver {silver} · Gold {gold}' : 'Gold {gold} or less · Silver {silver} · Bronze {bronze}', goal.medals)
        : t(
            higher
              ? 'Bronze {asCount} · Gold {gold}'
              : 'Gold {gold} or less · Bronze {asCount}',
            { ...goal.medals, asCount: translated },
          ),
    bar: null,
    medal: null,
    subdued: false,
  }
}

/** Playing for higher: the next threshold still missing; with the gold in hand, one's own record. */
function playingForHigher(goal: Goal, points: number, remaining: string | null, t: Translate): GoalSignView {
  const { medals, record } = goal
  const next = MEDALS.find((medal) => points < medals[medal])
  if (next != null) {
    const from = next === 'bronze' ? 0 : medals[MEDALS[MEDALS.indexOf(next) - 1]]
    return {
      title: t('{medal} at {target} · you have {score}', {
        medal: t(NAME[next]),
        target: medals[next],
        score: points,
      }),
      detail: remaining,
      bar: fraction(points - from, medals[next] - from),
      medal: next,
      subdued: false,
    }
  }
  const toBeat = record != null && record > medals.gold && points <= record
  return {
    title: toBeat
      ? t('Gold · your record {record} · you have {score}', { record, score: points })
      : t('Gold · new record {score}', { score: points }),
    detail: remaining,
    bar: toBeat ? fraction(points - medals.gold, record - medals.gold) : 1,
    medal: 'gold',
    subdued: false,
  }
}

/**
 * Playing for lower: the best mark that can still be made, with the margin left.
 *
 * Here what has been scored only goes up, so there is no threshold to reach but one not to go past:
 * first one's own record, if it is better than the gold, and then the gold, the silver and the bronze.
 */
function playingForLower(goal: Goal, points: number, remaining: string | null, t: Translate): GoalSignView {
  const { medals, record } = goal
  const base = { detail: remaining, subdued: false }
  if (record != null && record < medals.gold && points <= record) {
    return {
      ...base,
      title: t('Your record {record} · you have {score}', { record, score: points }),
      bar: fraction(record - points, record),
      medal: 'gold',
    }
  }
  const reach = medalEarned(goal, points)
  if (reach == null) {
    return { ...base, title: t('No medal within reach · you have {score}', { score: points }), bar: 0, medal: null }
  }
  return {
    ...base,
    title: t('{medal} with {target} or less · you have {score}', {
      medal: t(NAME[reach]),
      target: medals[reach],
      score: points,
    }),
    bar: fraction(medals[reach] - points, medals[reach]),
    medal: reach,
  }
}

/**
 * At the end: what was earned and what was missing, which is the phrase that makes one play again; and
 * below, why it ended and how it stood against the record from before.
 */
function end(goal: Goal, run: Run, t: Translate): GoalSignView {
  const { points } = run
  const { medals, better, record } = goal
  const earned = medalEarned(goal, points)
  const unit = t(goal.unit)
  const title =
    earned == null
      ? t('No medal · {score} {unit}', { score: points, unit })
      : t('{medal} · {score} {unit}', { medal: t(NAME[earned]), score: points, unit })
  const next = earned == null ? 'bronze' : MEDALS[MEDALS.indexOf(earned) + 1]
  const mark = run.recordShownElsewhere === true ? null : againstRecord(record, points, better, t)
  if (next == null) {
    return withFooter({ title, detail: mark, bar: null, medal: earned, subdued: false }, run.endReason)
  }
  const detail =
    better === 'higher'
      ? t(SHORT_OF[next], { missing: medals[next] - points })
      : t(TOO_MANY[next], { extra: points - medals[next] })
  // Short of the record, the bare record: «Tu mejor 31». What was missing the detail already says.
  const against =
    record == null || mark == null || !isBetter(record, points, better) ? mark : t('Your best {record}', { record })
  return withFooter({ title, detail, bar: null, medal: earned, subdued: false }, run.endReason, against)
}

/**
 * What the sign says with that run, already translated.
 *
 * `t` is the game's translator; without it, it comes out in English. The figures come out as they are read in each language.
 */
export function goalSign(run: Run, translate: Translate = EN): GoalSignView {
  const t = withThousands(translate)
  const { goal, phase, points, mission } = run
  if (run.counts === false) {
    return {
      title:
        goal == null
          ? mission
          : t('{mode} · does not count for a medal', { mode: run.mode ?? mission }),
      detail: null,
      bar: null,
      medal: null,
      subdued: true,
    }
  }
  if (goal == null) return withoutGoal(run, t)
  if (phase === 'before') return before(goal, mission, t, run.asCount)
  const view =
    phase === 'end'
      ? end(goal, run, t)
      : goal.better === 'higher'
        ? playingForHigher(goal, points, run.remaining ?? null, t)
        : playingForLower(goal, points, run.remaining ?? null, t)
  const celebrate = medalToCelebrate(run)
  return celebrate == null ? view : { ...view, cheer: t(CHEER[celebrate]) }
}
