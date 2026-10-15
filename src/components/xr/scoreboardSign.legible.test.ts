import { describe, expect, it } from 'vitest'
import {
  DRAW_DISTANCE,
  SIGN_PANEL,
  drawSign,
  signScale,
  signAspect,
} from './GoalSign'
import { SCOREBOARD_SIZE, goalsRow } from './XRHud'
import { LINE_HEIGHT } from './canvasPanel'
import { MIN_ANGLE, recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import { SIGN_PLACEMENT } from '../game/ScoreboardSign'
import { XR_UI, fromPlayerSpace, panelViews } from '../game/GameWorld'
import {
  BACK_SCOREBOARD,
  BACK_NEONS,
  withNowItCountsNotice,
  signRun,
  signPlacement,
  type GameInPlay,
} from '../../lib/scoreboardSign'
import { TABLE_CENTER_Z } from '../../lib/gameConfig'
import { GAME_MODE_ORDER } from '../../lib/gameMode'
import { goalSign, type Goal, type GoalSignView } from '../../lib/goal'
import { hiddenByPanel, panelPoints, tablePoints, whatThePanelHides } from '../../lib/panelOcclusion'
import { EYE_HEIGHTS, eyesAt, letterAngle, pointOnPanel, type PanelPose, type Point } from '../../lib/panelReading'
import { softTranslator } from '../../lib/textos'
import { REFERENCE_EYE_HEIGHT, uiRiseOverWorld, worldRise } from '../../lib/uiHeight'

/**
 * The sign above the scoreboard, measured where it really hangs.
 *
 * `goalSign.legible.test.ts` measures the phrases common to every game; here go the air hockey
 * ones —the mission of the challenge, the round with what the next goal is worth, the name of
 * each mode— with this game's thresholds in the thousands, and what is only known with the table
 * in front: how many degrees each letter takes up from where the game is played, whether it stays
 * inside what is seen without turning the head and whether it hides the table or the scoreboard.
 */

const LANGUAGES = ['en', 'es'] as const

/** The thresholds of air hockey in the hall, with a six-figure record. */
const GOAL: Goal = {
  medals: { bronze: 1500, silver: 8000, gold: 20000 },
  better: 'higher',
  unit: 'points in the challenge',
  record: 104250,
  mode: 'challenge',
}

/** The runs that are measured: from the first countdown to a challenge of two laps. */
const MOMENTS: Partial<GameInPlay>[] = [
  { gameState: 'countdown' },
  { gameState: 'playing' },
  { round: 2, points: 340, goals: 5, streak: 2 },
  { round: 5, points: 1650, goals: 20, streak: 4 },
  { round: 9, points: 9875, goals: 50, streak: 8 },
  { round: 12, points: 19850, goals: 70, streak: 11 },
  { round: 15, points: 31200, goals: 90, streak: 12 },
  { round: 28, points: 123450, goals: 180, streak: 12 },
  { gameState: 'finished', round: 1, points: 0, goals: 3 },
  { gameState: 'finished', round: 4, points: 1650, goals: 20 },
  { gameState: 'finished', round: 10, points: 12340, goals: 60 },
  { gameState: 'finished', round: 16, points: 31200, goals: 95 },
  { gameState: 'finished', round: 30, points: 123450, goals: 190 },
]

/** Everything the sign gets to say in this game, in that language. */
function signViews(lang: (typeof LANGUAGES)[number]): GoalSignView[] {
  const t = softTranslator(lang)
  const all: GoalSignView[] = []
  const base: GameInPlay = { gameMode: 'challenge', gameState: 'playing', round: 1, goals: 0, points: 0, streak: 0, record: 104250 }
  for (const hallGoal of [GOAL, { ...GOAL, record: null }, null]) {
    for (const moment of MOMENTS) {
      all.push(goalSign(signRun({ ...base, goal: hallGoal, ...moment }, t)!, t))
    }
  }
  // On closing the tutorial, the notice that it now counts, with whatever it says below in the countdown.
  for (const hallGoal of [GOAL, null]) {
    const view = goalSign(signRun({ ...base, goal: hallGoal, gameState: 'countdown' }, t)!, t)
    all.push(withNowItCountsNotice(view, 'challenge', true, t)!)
  }
  for (const gameMode of GAME_MODE_ORDER) {
    if (gameMode === 'challenge') continue
    all.push(goalSign(signRun({ ...base, goal: GOAL, gameMode }, t)!, t))
  }
  return all
}

function measure(view: GoalSignView): DrawnText[] {
  const { ctx, drawnTexts: texts } = recordingCanvas()
  drawSign(ctx, view)
  return texts
}

/** What is written, taken to the size at which it hangs: the sign grows with the distance. */
function hung(texts: readonly DrawnText[]): DrawnText[] {
  const k = signScale(SIGN_PLACEMENT.distance)
  return texts.map((e) => ({ ...e, x: e.x * k, y: e.y * k, width: e.width * k, height: e.height * k }))
}

/** Where it is read from: at three eye heights, with the world standing or at their height. */
const VIEWS = panelViews(SIGN_PLACEMENT.position, SIGN_PLACEMENT.rotation)

/** The degrees each letter of the hung sign takes up, seen from those eyes. */
function degrees(texts: readonly DrawnText[], pose: PanelPose, eyes: Point): number[] {
  return hung(texts).map((e) => letterAngle(pose, eyes, e.x, e.y, e.height / LINE_HEIGHT))
}

/** What the sign measures where it hangs, in metres. */
const SIZE = {
  width: signAspect().width * SIGN_PLACEMENT.distance,
  height: signAspect().height * SIGN_PLACEMENT.distance,
}

describe('the sign above the scoreboard reads', () => {
  it('everything it says fits and does not overlap, in both languages', () => {
    for (const lang of LANGUAGES) {
      for (const view of signViews(lang)) {
        const texts = measure(view)
        expect(texts.length, 'nothing was measured').toBeGreaterThan(0)
        expect(
          legibilityProblems(texts, { panel: SIGN_PANEL, distance: DRAW_DISTANCE }),
          `${lang}: ${view.title} / ${view.detail}`,
        ).toEqual([])
      }
    }
  })

  it('from where the game is played, at any eye height, every letter is above what can be read', () => {
    for (const lang of LANGUAGES) {
      for (const view of signViews(lang)) {
        const texts = measure(view)
        for (const { where: place, pose, eyes: eyePoint } of VIEWS) {
          degrees(texts, pose, eyePoint).forEach((angle, i) => {
            expect(angle, `${lang}: «${texts[i].text}», ${place}`).toBeGreaterThan(MIN_ANGLE)
          })
        }
      }
    }
  })

  it('the mission reads at a glance in the countdown: more than 1.2° in both languages', () => {
    for (const lang of LANGUAGES) {
      const t = softTranslator(lang)
      const run = signRun(
        { goal: GOAL, gameMode: 'challenge', gameState: 'countdown', round: 1, goals: 0, points: 0, streak: 0, record: 0 },
        t,
      )
      const texts = measure(goalSign(run!, t))
      const [mission] = degrees(texts, VIEWS[2].pose, VIEWS[2].eyes)

      expect(texts[0].text).toBe(lang === 'es' ? 'Gana partidos hasta perder uno' : 'Win games until you lose one')
      expect(mission, lang).toBeGreaterThan(1.2)
    }
  })

  it('what is looked at while playing —the threshold and what remains— is above one degree on the way to gold', () => {
    for (const lang of LANGUAGES) {
      const t = softTranslator(lang)
      for (const moment of MOMENTS.filter((m) => m.gameState == null)) {
        const run = signRun(
          { goal: GOAL, gameMode: 'challenge', gameState: 'playing', round: 1, goals: 0, points: 0, streak: 0, record: 0, ...moment },
          t,
        )
        const texts = measure(goalSign(run!, t))
        // With the gold in hand the common phrase goes on to carry the record and the current
        // score, two six-figure numbers: it is the longest the sign gets to say and the one that
        // shrinks most. With the thousands separated and from the lowest eyes it stays at 0.84°
        // («Gold · your record 104,250 · you have 31,200»), above the minimum (0.75°); before
        // the gold («Silver at 8,000 · you have 1,650»), at 1.16°.
        const withGold = (moment.points ?? 0) >= GOAL.medals.gold
        for (const { where: place, pose, eyes: eyePoint } of VIEWS) {
          const [threshold, remaining] = degrees(texts, pose, eyePoint)
          expect(threshold, `${lang}: «${texts[0].text}», ${place}`).toBeGreaterThan(withGold ? 0.8 : 1.15)
          expect(remaining, `${lang}: «${texts[1].text}», ${place}`).toBeGreaterThan(1)
        }
      }
    }
    // And with what almost the whole run has —four figures—, at its full size.
    const t = softTranslator('es')
    const run = signRun(
      { goal: GOAL, gameMode: 'challenge', gameState: 'playing', round: 5, goals: 20, points: 1650, streak: 4, record: 0 },
      t,
    )
    const texts = measure(goalSign(run!, t))
    expect(texts.map((e) => e.text)).toEqual(['Plata a 8000 · llevas 1650', 'Ronda 5 · a 5 goles · gol +270'])
    const [threshold, remaining] = degrees(texts, VIEWS[2].pose, VIEWS[2].eyes)
    // Four figures in Spanish go without a dot, as on the hall's plaque: the line does not shrink from its 1.4°.
    expect(threshold).toBeGreaterThan(1.39)
    expect(remaining).toBeGreaterThan(1.15)
  })
})

describe('where the sign ends up for whoever plays', () => {
  /** Which way a point falls seen from those eyes: to one side and upwards, in degrees. */
  function direction(point: Point, eyes: Point): { azimuth: number; elevation: number } {
    const ground = Math.hypot(point.x - eyes.x, point.z - eyes.z)
    return {
      azimuth: (Math.atan2(point.x - eyes.x, -(point.z - eyes.z)) * 180) / Math.PI,
      elevation: (Math.atan2(point.y - eyes.y, ground) * 180) / Math.PI,
    }
  }

  /** The four corners of the hung sign. */
  function corners(pose: PanelPose): Point[] {
    return [-1, 1].flatMap((x) => [-1, 1].map((y) => pointOnPanel(pose, (x * SIZE.width) / 2, (y * SIZE.height) / 2)))
  }

  it('hangs with the measurements of the real sign, above the scoreboard', () => {
    expect(SIGN_PLACEMENT).toEqual(signPlacement(signAspect()))
    expect(XR_UI.scoreboard).toBe(BACK_SCOREBOARD.center)
    expect(SCOREBOARD_SIZE).toEqual({ width: BACK_SCOREBOARD.width, height: BACK_SCOREBOARD.height })
    // Above the whole scoreboard, and without going over a metre wide.
    const top = fromPlayerSpace(XR_UI.scoreboard)[1] + SCOREBOARD_SIZE.height / 2
    const pose = { position: fromPlayerSpace(SIGN_PLACEMENT.position), rotation: SIGN_PLACEMENT.rotation }
    for (const corner of corners(pose)) expect(corner.y).toBeGreaterThan(top)
    expect(SIZE.width).toBeLessThan(1)
  })

  it('is seen without turning or lifting the head: straight ahead, at eye level, at any stature', () => {
    for (const { where: place, pose, eyes: eyePoint } of VIEWS) {
      for (const corner of corners(pose)) {
        const { azimuth, elevation } = direction(corner, eyePoint)
        expect(Math.abs(azimuth), place).toBeLessThan(13)
        expect(elevation, place).toBeGreaterThan(-1)
        expect(elevation, place).toBeLessThan(6)
      }
    }
  })

  /** Each view with how much the world has moved under the interface, which does not rise with it. */
  const VIEWS_WITH_WORLD = EYE_HEIGHTS.flatMap((height) =>
    [false, true].map((atEyeHeight) => {
      const world = worldRise(height, atEyeHeight)
      const rise = world + uiRiseOverWorld(height, atEyeHeight)
      const [x, y, z] = fromPlayerSpace(SIGN_PLACEMENT.position)
      return {
        where: `eyes at ${height} m${atEyeHeight ? ', world at their height' : ''}`,
        pose: { position: [x, y + rise, z] as const, rotation: SIGN_PLACEMENT.rotation },
        eyes: eyesAt(height),
        world,
        rise,
      }
    }),
  )

  /** What it cannot hide: the whole table —the puck and both goals— and the scoreboard. */
  function whatIsBehind(world: number, rise: number) {
    const scoreboard = fromPlayerSpace(XR_UI.scoreboard)
    return [
      { what: 'the table', points: tablePoints(13).map((p) => ({ ...p, y: p.y + world })) },
      // The puck and the mallets stand a hand span above the board.
      { what: 'the puck and the mallets', points: tablePoints(13).map((p) => ({ ...p, y: p.y + world + 0.12 })) },
      { what: 'the scoreboard', points: panelPoints([scoreboard[0], scoreboard[1] + rise, scoreboard[2]], SCOREBOARD_SIZE, 6) },
    ]
  }

  it("does not hide the table, nor the puck, nor the machine's goal, nor the scoreboard, from any height", () => {
    for (const { where, pose, eyes, world, rise } of VIEWS_WITH_WORLD) {
      expect(whatThePanelHides(pose, SIZE, eyes, whatIsBehind(world, rise)), where).toEqual([])
    }
  })

  it("nor moving in front of one's goal, which is where whoever plays moves about", () => {
    const pose = { position: fromPlayerSpace(SIGN_PLACEMENT.position), rotation: SIGN_PLACEMENT.rotation }
    for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) {
      for (const z of [-0.1, 0.2, 0.5]) {
        const eyes = { x, y: REFERENCE_EYE_HEIGHT, z }
        expect(whatThePanelHides(pose, SIZE, eyes, whatIsBehind(0, 0)), `eyes at ${x}, ${z}`).toEqual([])
      }
    }
  })

  it('and the scoreboard does not hide it: it stays whole above', () => {
    const scoreboard = fromPlayerSpace(XR_UI.scoreboard)
    for (const { where, pose, eyes, rise } of VIEWS_WITH_WORLD) {
      const inFront = {
        position: [scoreboard[0], scoreboard[1] + rise, scoreboard[2]] as const,
        rotation: [BACK_SCOREBOARD.tilt, 0, 0] as const,
      }
      const hidden = panelPoints(pose.position, SIZE, 8).filter((point) => hiddenByPanel(inFront, SCOREBOARD_SIZE, eyes, point))
      expect(hidden, where).toEqual([])
    }
  })

  it('the control: at the height of the scoreboard and in front of it, it hid it', () => {
    const scoreboard = fromPlayerSpace(XR_UI.scoreboard)
    const inFront = { position: [scoreboard[0], scoreboard[1], scoreboard[2] + 0.3] as const }
    expect(
      whatThePanelHides(inFront, SIZE, eyesAt(REFERENCE_EYE_HEIGHT), whatIsBehind(0, 0)).some((phrase) => phrase.includes('the scoreboard')),
    ).toBe(true)
  })
})

describe('the neon strips of the back wall, behind the sign', () => {
  /** The back wall of the room (`ROOM_DEPTH` of `Room.tsx`, ten metres centred on the table). */
  const WALL = TABLE_CENTER_Z - 10 / 2 + 0.03

  /** The two strips, point by point, with however much the world has moved: the room does not rise with the interface. */
  function strips(world: number, drop = 0): Point[] {
    return BACK_NEONS.strips.flatMap((strip) =>
      panelPoints([0, strip.y - drop + world, WALL], { width: strip.width, height: BACK_NEONS.thickness }, 40),
    )
  }

  /** The reference eyes of the round (1.4–1.9 m), standing and with the world at their height. */
  const EYES = [1.4, 1.5, 1.6, 1.7, 1.8, 1.9].flatMap((height) =>
    [false, true].map((atEyeHeight) => {
      const world = worldRise(height, atEyeHeight)
      const [x, y, z] = fromPlayerSpace(SIGN_PLACEMENT.position)
      return {
        where: `eyes at ${height} m${atEyeHeight ? ', world at their height' : ''}`,
        pose: { position: [x, y + world + uiRiseOverWorld(height, atEyeHeight), z] as const, rotation: SIGN_PLACEMENT.rotation },
        eyes: eyesAt(height),
        world,
      }
    }),
  )

  it('the sign does not overlap them from any eye height: they stay above', () => {
    for (const { where, pose, eyes, world } of EYES) {
      expect(strips(world).filter((point) => hiddenByPanel(pose, SIZE, eyes, point)), where).toEqual([])
    }
  })

  it('with 0.4° of gap in the worst case: standing and with the eyes at 1.9 m', () => {
    const elevation = (y: number, z: number, eyes: Point) => (Math.atan2(y - eyes.y, -(z - eyes.z)) * 180) / Math.PI
    const gaps = EYES.map(({ pose, eyes, world }) => {
      const top = pointOnPanel(pose, 0, SIZE.height / 2)
      const strip = Math.min(...BACK_NEONS.strips.map((t) => t.y)) - BACK_NEONS.thickness / 2 + world
      return elevation(strip, WALL, eyes) - elevation(top.y, top.z, eyes)
    })
    expect(Math.min(...gaps)).toBeGreaterThan(0.35)
    expect(gaps.indexOf(Math.min(...gaps))).toBe(EYES.findIndex((o) => o.where === 'eyes at 1.9 m'))
  })

  it('the control: fifteen centimetres lower, where they were, at 1.9 m the bottom one ended up behind', () => {
    const { pose, eyes, world } = EYES.find((o) => o.where === 'eyes at 1.9 m')!
    expect(strips(world, 0.15).filter((point) => hiddenByPanel(pose, SIZE, eyes, point)).length).toBeGreaterThan(0)
    // And from 1.6 m it did not: that is why it was not seen when placing it.
    const reference = EYES.find((o) => o.where === 'eyes at 1.6 m')!
    expect(strips(0, 0.15).filter((point) => hiddenByPanel(reference.pose, SIZE, reference.eyes, point))).toEqual([])
  })
})

describe('the scoreboard, with the sign above it', () => {
  it('the goals go in their row, and in the middle when the sign already says the points and the round', () => {
    expect(goalsRow({ points: false, round: false })).toBeGreaterThan(0)
    expect(goalsRow({ points: true, round: true })).toBe(0)
    // On finishing the round comes back, and the goals go to their top row to make room for it.
    expect(goalsRow({ points: true, round: false })).toBe(goalsRow({ points: false, round: false }))
  })
})
