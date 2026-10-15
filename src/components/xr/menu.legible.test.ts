import { afterEach, describe, expect, it } from 'vitest'
import { drawRowNames } from './XRMenu'
import { LINE_HEIGHT } from './canvasPanel'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import { MENU_BOXES, MENU_PANEL, MENU_RECORD_X, MENU_ROW, MENU_TEXT } from '../../lib/xrMenuLayout'
import { GAME_MODE_HINTS, GAME_MODE_LABELS, GAME_MODE_ORDER } from '../../lib/gameMode'
import { SCENERIES } from '../../lib/settings'
import { SCENERY_LABELS } from '../../lib/scenery'
import {
  EYE_HEIGHTS,
  MIN_READING_DEGREES,
  eyesAt,
  centreInside,
  panelRotation,
  pointOnPanel,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
} from '../../lib/panelReading'
import { panelPoints, tablePoints, whatThePanelHides } from '../../lib/panelOcclusion'
import { REFERENCE_EYE_HEIGHT, uiRiseOverWorld, worldRise } from '../../lib/uiHeight'
import { HALF_WIDTH } from '../../lib/puckPhysics'
import { translator } from '../../lib/textos'
import { MENU_EN } from '../../lib/menuWords'
import { MENU_DEGREES, setGameName, degreesFromFront, gameName } from '../../lib/menuTemplate'
import { SCOREBOARD_SIZE } from './XRHud'
import { PANEL_HEIGHT, PANEL_WIDTH } from './XRTutorial'
import {
  COLUMN,
  COLUMN_SCALE,
  XR_QUIT,
  XR_UI,
  XR_UI_ROTATION,
  atColumnScale,
  fromPlayerSpace,
  distanceFromPlayer,
  panelViews,
} from '../game/GameWorld'

/**
 * The labels of the menu panel, measured instead of looked at.
 *
 * In both languages: Spanish is longer and is where a name runs off the panel, overlaps the one
 * next to it or shrinks until it cannot be read. **And from where the game is played**: each text
 * in its row, with the panel where it is planted and rotated as it is rotated, at three eye
 * heights and with the world standing or at their height.
 */

const LANGUAGES = ['en', 'es'] as const
// Where the menu comes up, almost straight ahead (`XR_UI.menu`): it is where it is read.
const VIEWS = panelViews(XR_UI.menu, XR_UI_ROTATION.menu)

/**
 * Everything the panel can write: each mode and scenery, with «Más opciones» folded and
 * unfolded, in both languages.
 */
function allMoments(): { where: string; texts: DrawnText[] }[] {
  const moments: { where: string; texts: DrawnText[] }[] = []
  for (const lang of LANGUAGES) {
    for (const moreOptions of [true, false]) {
      for (const levels of [false, true]) {
        for (const gameMode of GAME_MODE_ORDER) {
          for (const scenery of SCENERIES) {
            const { ctx, drawnTexts: texts } = recordingCanvas()
            drawRowNames(ctx, translator(lang), levels, gameMode, scenery, null, moreOptions)
            const folded = moreOptions ? '' : ' folded'
            moments.push({ where: `${lang} ${levels ? 'levels' : 'practice'} ${gameMode} ${scenery}${folded}`, texts })
          }
        }
      }
    }
  }
  return moments
}

describe('the names of the menu rows read', () => {
  it('with each mode and each scenery, without overlapping or running off', () => {
    for (const { where, texts } of allMoments()) {
      expect(texts.length, 'nothing was measured').toBeGreaterThan(0)
      // Measured as they are painted: the whole column is scaled (`COLUMN_SCALE`).
      const scaled = atColumnScale(texts)
      const readingDistance = Math.max(...VIEWS.map(({ pose, eyes: eyePoint }) => worstReadingDistance(scaled, pose, eyePoint, LINE_HEIGHT)))
      const panel = { width: MENU_PANEL.width * COLUMN_SCALE, height: MENU_PANEL.height * COLUMN_SCALE }
      expect(legibilityProblems(scaled, { panel, distance: readingDistance }), where).toEqual([])
    }
  })

  /**
   * And what this came to fix: inside the headset the modes were **only names**
   * and the scenery switch **only an icon**. Both now say what they are.
   */
  it('say what the chosen mode is and which scenery is on', () => {
    for (const lang of LANGUAGES) {
      const t = translator(lang)
      for (const gameMode of GAME_MODE_ORDER) {
        const { ctx, drawnTexts: texts } = recordingCanvas()
        drawRowNames(ctx, t, false, gameMode, 'place')
        const phrase = t(GAME_MODE_HINTS[gameMode])
        expect(texts.some((e) => phrase.startsWith(e.text.trim())), `${lang} ${gameMode}`).toBe(true)
      }
      for (const scenery of SCENERIES) {
        const { ctx, drawnTexts: texts } = recordingCanvas()
        drawRowNames(ctx, t, false, 'practice', scenery, null, true)
        expect(texts.map((e) => e.text), `${lang} ${scenery}`).toContain(t(SCENERY_LABELS[scenery]))
      }
    }
  })
})

describe('the menu is named after the cabinet', () => {
  afterEach(() => setGameName(null))

  it('top left, untranslated, without overlapping «Más opciones» or running off, in both languages', () => {
    // The package's one and the one the hall passes (the `name` of the catalogue, today the same).
    for (const name of [null, 'Glide Hockey']) {
      setGameName(name)
      for (const { where, texts } of allMoments()) {
        const title = texts.find((e) => e.text === gameName())
        expect(title, `${where} ${name}`).toBeDefined()
        expect(title!.height / LINE_HEIGHT, `${where} ${name}`).toBeCloseTo(MENU_TEXT.title, 9)
        expect(title!.y).toBeCloseTo(MENU_ROW.title, 9)
        const more = MENU_BOXES['more options']
        expect(title!.x + title!.width / 2, `${where} ${name}`).toBeLessThan(more.position[0] - more.size[0] / 2)
        const scaled = atColumnScale(texts)
        const panel = { width: MENU_PANEL.width * COLUMN_SCALE, height: MENU_PANEL.height * COLUMN_SCALE }
        expect(legibilityProblems(scaled, { panel }), `${where} ${name}`).toEqual([])
        for (const view of VIEWS) {
          expect(unreadableTexts(scaled, view.pose, view.eyes, LINE_HEIGHT), `${where} ${name}, ${view.where}`).toEqual([])
        }
      }
    }
  })

  it("the one the hall passes wins over the package's", () => {
    setGameName('Air Hockey')
    const { ctx, drawnTexts: texts } = recordingCanvas()
    drawRowNames(ctx, translator('es'), false, 'challenge')
    expect(texts.map((e) => e.text)).toContain('Air Hockey')
  })
})

describe('each mode carries its name', () => {
  it('below its icon, inside its button and without shrinking, in both languages', () => {
    for (const lang of LANGUAGES) {
      const t = translator(lang)
      const { ctx, drawnTexts: texts } = recordingCanvas()
      drawRowNames(ctx, t, false, 'challenge')
      for (const mode of GAME_MODE_ORDER) {
        const name = texts.find((e) => e.text === t(GAME_MODE_LABELS[mode]))
        expect(name, `${lang} ${mode}`).toBeDefined()
        const { position, size } = MENU_BOXES[`mode ${mode}`]
        expect(Math.abs(name!.x - position[0]) * 2 + name!.width, `${lang} ${mode} across`).toBeLessThanOrEqual(size[0])
        expect(Math.abs(name!.y - position[1]) * 2 + name!.height, `${lang} ${mode} in height`).toBeLessThanOrEqual(size[1] + 1e-9)
        expect(name!.height / LINE_HEIGHT).toBeCloseTo(MENU_TEXT.mode, 9)
      }
    }
  })
})

describe('the menu says of each mode whether it counts for a medal', () => {
  it('on the line of the «Modo» label, in words: only the challenge counts', () => {
    for (const lang of LANGUAGES) {
      const t = translator(lang)
      for (const gameMode of GAME_MODE_ORDER) {
        const { ctx, drawnTexts: texts } = recordingCanvas()
        drawRowNames(ctx, t, gameMode === 'levels', gameMode, 'place')
        const phrase = t(gameMode === 'challenge' ? 'Counts for a medal' : 'Does not count for a medal')
        const written = texts.find((e) => e.text === phrase)
        const label = texts.find((e) => e.text === t('Mode'))!
        expect(written, `${lang} ${gameMode}`).toBeDefined()
        expect(written!.y).toBeCloseTo(label.y)
        expect(written!.x).toBeGreaterThan(label.x)
      }
    }
  })

  it('and if the hall takes the medals from another mode, the challenge does not count either', () => {
    const { ctx, drawnTexts: texts } = recordingCanvas()
    const other = { medals: { bronze: 1, silver: 2, gold: 3 }, better: 'higher', unit: 'points', record: null, mode: 'levels' } as const
    drawRowNames(ctx, translator('en'), false, 'challenge', 'place', other)
    expect(texts.map((e) => e.text)).toContain('Does not count for a medal')
  })
})

describe('the menu starts with the mode, and only practice asks', () => {
  /** The names of the rows that are painted with that mode. */
  function rows(gameMode: (typeof GAME_MODE_ORDER)[number], moreOptions = true): string[] {
    const { ctx, drawnTexts: texts } = recordingCanvas()
    drawRowNames(ctx, translator('en'), gameMode === 'levels', gameMode, 'place', null, moreOptions)
    return texts
      .map((e) => e.text)
      .filter((text) => ['Mode', 'Level', 'Goals', 'Stage', 'When hit', 'More options', 'Fewer options'].includes(text))
  }

  it("practice: the mode, the machine's level and the goals", () => {
    expect(rows('practice')).toEqual(['Fewer options', 'When hit', 'Mode', 'Level', 'Goals'])
  })

  it('levels: the mode and which level is played; the rest is set by the ladder', () => {
    expect(rows('levels')).toEqual(['Fewer options', 'When hit', 'Mode', 'Stage'])
  })

  it('the challenge: only the mode, and play; with nothing folded and no button, even if asked for', () => {
    expect(rows('challenge')).toEqual(['Mode'])
    expect(rows('challenge', false)).toEqual(['Mode'])
  })

  it('folded, as in the others: the mode, and what the mode specifies; the rest, behind «Más opciones»', () => {
    expect(rows('practice', false)).toEqual(['More options', 'Mode'])
    expect(rows('levels', false)).toEqual(['More options', 'Mode', 'Stage'])
    expect(rows('duel', false)).toEqual(['More options', 'Mode'])
  })

  it('«Más opciones» and «Menos opciones» fit in their button, in both languages', () => {
    for (const lang of LANGUAGES) {
      for (const moreOptions of [false, true]) {
        const { ctx, drawnTexts: texts } = recordingCanvas()
        const t = translator(lang)
        drawRowNames(ctx, t, false, 'practice', 'place', null, moreOptions)
        const text = t(moreOptions ? MENU_EN.fewerOptions : MENU_EN.moreOptions)
        const drawnText = texts.find((e) => e.text === text)
        expect(drawnText, `${lang} ${text}`).toBeDefined()
        const { position, size } = MENU_BOXES['more options']
        expect(Math.abs(drawnText!.x - position[0]) * 2 + drawnText!.width, `${lang} ${text}`).toBeLessThanOrEqual(size[0])
        expect(drawnText!.height / LINE_HEIGHT).toBeCloseTo(MENU_TEXT.toggle, 9)
      }
    }
  })
})

/**
 * That every letter reads at a glance **from where the game is played**, just as the canvas
 * records it: the size it was written at —shrinking included—, in its row and with the
 * foreshortening.
 */
describe('every letter of the menu reads at a glance', () => {
  it(`none drops below ${MIN_READING_DEGREES}°, at any moment, language or eye height`, () => {
    for (const { where, texts } of allMoments()) {
      for (const view of VIEWS) {
        expect(unreadableTexts(atColumnScale(texts), view.pose, view.eyes, LINE_HEIGHT), `${where}, ${view.where}`).toEqual([])
      }
    }
  })

  it('and all of them are written at a size from the list, without shrinking', () => {
    for (const { where, texts } of allMoments()) {
      expect(sizesOffList(texts, LINE_HEIGHT, Object.values(MENU_TEXT)), where).toEqual([])
    }
  })

  it('and no label gets into a button or under the figures of the record', () => {
    // The buttons and the record are geometry: the instrument does not see them. Here no text
    // belongs to a button, so any brush counts.
    const buttons = [
      ...Object.values(MENU_BOXES).map(({ position, size }) => ({ x: position[0], y: position[1], width: size[0], height: size[1] })),
      // Up to four 4 cm figures.
      { x: MENU_RECORD_X, y: MENU_ROW.record, width: 0.1, height: 0.05 },
    ]
    // The only things written inside a button are the name of each mode, in its own, and
    // «Más opciones» (or «Menos»), in its own.
    const modeNames = new Set(LANGUAGES.flatMap((lang) => GAME_MODE_ORDER.map((mode) => translator(lang)(GAME_MODE_LABELS[mode]))))
    const foldLabels = new Set(LANGUAGES.flatMap((lang) => [MENU_EN.moreOptions, MENU_EN.fewerOptions].map((phrase) => translator(lang)(phrase))))
    const itsOwn = (text: DrawnText, button: { x: number; y: number; width: number; height: number }) =>
      centreInside(text, button) &&
      ((modeNames.has(text.text) && Math.abs(button.y - MENU_ROW.mode) < 1e-9) ||
        (foldLabels.has(text.text) && Math.abs(button.y - MENU_ROW.title) < 1e-9))
    for (const { where, texts } of allMoments()) {
      expect(textsOnButtons(texts, buttons, itsOwn), where).toEqual([])
    }
  })

  it('the control: the name of the scenery at 24 mm, with the panel at 1.45 m, did not make it', () => {
    const { texts } = allMoments().find(({ where }) => where === 'es practice practice place')!
    const sceneryName = texts.find((e) => e.text === translator('es')(SCENERY_LABELS.place))!
    const [x, y] = fromPlayerSpace([0, 0.52, -0.25])
    const asItWas = { position: [x, y, -1.45] as const, rotation: [-0.2, 0, 0] as const }
    expect(unreadableTexts([{ ...sceneryName, height: 0.024 * LINE_HEIGHT }], asItWas, eyesAt(1.6), LINE_HEIGHT)).toHaveLength(1)
  })
})

describe('where the menu comes up', () => {
  it(`at ${MENU_DEGREES}° or less from the front of whoever plays`, () => {
    expect(degreesFromFront(fromPlayerSpace(XR_UI.menu))).toBeLessThanOrEqual(MENU_DEGREES)
  })

  it('at the distance of the column and at eye height: the font takes up the same in the eye', () => {
    expect(distanceFromPlayer(XR_UI.menu)).toBeCloseTo(distanceFromPlayer(XR_UI.panel), 9)
    expect(fromPlayerSpace(XR_UI.menu)[1]).toBeCloseTo(eyesAt(REFERENCE_EYE_HEIGHT).y, 9)
  })

  it('facing whoever plays', () => {
    expect(XR_UI_ROTATION.menu).toEqual(panelRotation(fromPlayerSpace(XR_UI.menu), eyesAt(REFERENCE_EYE_HEIGHT)))
  })

  it('without hiding the scoreboard or the demonstration; of the table, at most the back corner', () => {
    // In the menu phase nobody plays: that it shows over the left edge of the back gets in
    // nobody's way, and on starting it moves aside. The goal sign does not appear in the menu.
    const size = { width: MENU_PANEL.width * COLUMN_SCALE, height: MENU_PANEL.height * COLUMN_SCALE }
    const [x, y, z] = fromPlayerSpace(XR_UI.menu)
    for (const eyeHeight of EYE_HEIGHTS) {
      for (const atEyeHeight of [false, true]) {
        const world = worldRise(eyeHeight, atEyeHeight)
        const pose = { position: [x, y + world + uiRiseOverWorld(eyeHeight, atEyeHeight), z] as const, rotation: XR_UI_ROTATION.menu }
        const raise = (points: ReturnType<typeof tablePoints>) => points.map((p) => ({ ...p, y: p.y + world }))
        const where = `eyes at ${eyeHeight} m${atEyeHeight ? ', world at their height' : ''}`
        expect(
          whatThePanelHides(pose, size, eyesAt(eyeHeight), [
            { what: 'the scoreboard', points: raise(panelPoints(fromPlayerSpace(XR_UI.scoreboard), SCOREBOARD_SIZE, 6)) },
            {
              what: 'the demonstration',
              points: raise(panelPoints(fromPlayerSpace(XR_UI.tutorial), { width: PANEL_WIDTH, height: PANEL_HEIGHT }, 6)),
            },
          ]),
          where,
        ).toEqual([])
        const table = raise(tablePoints(13))
        const hidden = whatThePanelHides(pose, size, eyesAt(eyeHeight), [{ what: 'the table', points: table }])
        const howMany = hidden.length === 0 ? 0 : Number(/at (\d+) of/.exec(hidden[0])![1])
        expect(howMany / table.length, where).toBeLessThan(0.15)
      }
    }
  })

  it('the control: on the column, at 55°, it came up out of sight', () => {
    expect(degreesFromFront(fromPlayerSpace(XR_UI.panel))).toBeGreaterThan(MENU_DEGREES)
  })
})

describe('where the column is planted: the end and the exit notice', () => {
  it('wholly off the table and far from where the mallet moves, not one corner over it', () => {
    // It was a metre away and hanging over the board; now it sits beside the table, and its
    // bottom edge can drop below the height of the board without touching it.
    const pose = { position: fromPlayerSpace(XR_UI.panel), rotation: XR_UI_ROTATION.panel }
    const w = (MENU_PANEL.width * COLUMN_SCALE) / 2
    const h = (MENU_PANEL.height * COLUMN_SCALE) / 2
    for (const [u, v] of [[-w, -h], [w, -h], [-w, h], [w, h]]) {
      expect(pointOnPanel(pose, u, v).x, `corner ${u}, ${v}`).toBeLessThan(-HALF_WIDTH - 0.3)
    }
  })

  it("the hall's rule: at 1.4–1.6 m from the eyes, between 50° and 65° to the left, at their height", () => {
    const [x, y, z] = fromPlayerSpace(XR_UI.panel)
    const eyes = eyesAt(REFERENCE_EYE_HEIGHT)
    const azimuth = (Math.atan2(-x, -z) * 180) / Math.PI
    expect(distanceFromPlayer(XR_UI.panel)).toBeGreaterThanOrEqual(1.4)
    expect(distanceFromPlayer(XR_UI.panel)).toBeLessThanOrEqual(1.6)
    expect(azimuth).toBeGreaterThanOrEqual(50)
    expect(azimuth).toBeLessThanOrEqual(65)
    expect(COLUMN.azimuth).toBeCloseTo(azimuth, 9)
    expect(y).toBeCloseTo(eyes.y, 9)
    // Outside the rectangle of the table, and far from where the mallet moves.
    expect(x).toBeLessThan(-HALF_WIDTH - 0.4)
  })

  it('facing whoever plays: rotated towards the eyes, not facing the table', () => {
    expect(XR_UI_ROTATION.panel).toEqual(panelRotation(fromPlayerSpace(XR_UI.panel), eyesAt(REFERENCE_EYE_HEIGHT)))
    // A real rotation: with the column at 55° to the left, the panel looks towards the right.
    expect(Math.abs(XR_UI_ROTATION.panel[1])).toBeGreaterThan(0.8)
  })

  it('the button that opens it is on the same side and in its place: it is pressed and it opens there', () => {
    expect(XR_QUIT).toEqual(XR_UI.panel)
    expect(XR_UI_ROTATION.quit).toEqual(XR_UI_ROTATION.panel)
  })
})

/**
 * And what this came to fix: **that the panel does not get in front of what has to be seen**.
 *
 * The instrument that measures legibility says whether the panel reads, not whether it is in the
 * way, and they are two different things: centred and at eye height, the menu read perfectly and
 * hid half the table. This is looked at from the eyes of whoever plays, at the three heights and
 * with the hall's play height standing or low, because the panel rises with the eyes and the
 * table does not (see `XRUiHeight` and `XRWorldHeight`).
 */
describe('what the menu lets you see', () => {
  const SIZE = { width: MENU_PANEL.width * COLUMN_SCALE, height: MENU_PANEL.height * COLUMN_SCALE }

  /** Each view: where the panel ends up and how much the world has moved under it. */
  const VIEWS_WITH_WORLD = EYE_HEIGHTS.flatMap((eyeHeight) =>
    [false, true].map((atEyeHeight) => {
      const world = worldRise(eyeHeight, atEyeHeight)
      const [x, y, z] = fromPlayerSpace(XR_UI.panel)
      return {
        where: `eyes at ${eyeHeight} m${atEyeHeight ? ', world at their height' : ''}`,
        pose: { position: [x, y + world + uiRiseOverWorld(eyeHeight, atEyeHeight), z] as const, rotation: XR_UI_ROTATION.panel },
        eyes: eyesAt(eyeHeight),
        world,
      }
    }),
  )

  /** What is behind the panel, raised by however much the world has risen. */
  function whatIsBehind(world: number) {
    const raise = (points: ReturnType<typeof tablePoints>) => points.map((p) => ({ ...p, y: p.y + world }))
    return [
      { what: 'the table', points: raise(tablePoints(13)) },
      { what: 'the scoreboard', points: raise(panelPoints(fromPlayerSpace(XR_UI.scoreboard), SCOREBOARD_SIZE, 6)) },
      {
        what: 'the gesture demonstration',
        points: raise(panelPoints(fromPlayerSpace(XR_UI.tutorial), { width: PANEL_WIDTH, height: PANEL_HEIGHT }, 6)),
      },
    ]
  }

  it('does not hide the board, nor the scoreboard, nor the demonstration, from any height', () => {
    for (const { where, pose, eyes, world } of VIEWS_WITH_WORLD) {
      expect(whatThePanelHides(pose, SIZE, eyes, whatIsBehind(world)), where).toEqual([])
    }
  })

  it('nor leaning to one side of the table or stepping back: it is played from the end, not walked around', () => {
    // In air hockey nobody walks around the table —the mallet does not go past the halfway
    // line—, but one does move in front of one's goal. From there the column cannot fall over
    // the table either.
    const pose = { position: fromPlayerSpace(XR_UI.panel), rotation: XR_UI_ROTATION.panel }
    for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) {
      for (const z of [-0.1, 0.2, 0.5]) {
        for (const height of EYE_HEIGHTS) {
          const eyes = { x, y: height, z }
          expect(whatThePanelHides(pose, SIZE, eyes, whatIsBehind(0)), `eyes at ${x}, ${height}, ${z}`).toEqual([])
        }
      }
    }
  })

  it('the control: centred over the table and at eye height, it hid all three', () => {
    // The demonstration is no longer straight ahead —it goes to one side of the sign
    // (`tutorialPlacement`)— and even so a centred menu overlapped its edge; when it was straight
    // ahead, it hid it whole.
    const asItWas = fromPlayerSpace([0, 0.62, 0.2])
    const eyes = eyesAt(REFERENCE_EYE_HEIGHT)
    expect(
      whatThePanelHides(
        { position: asItWas, rotation: panelRotation(asItWas, eyes) },
        { width: MENU_PANEL.width, height: MENU_PANEL.height },
        eyes,
        whatIsBehind(0),
      ),
    ).toEqual([
      'the panel hides the table at 116 of 196 points',
      'the panel hides the scoreboard at 49 of 49 points',
      'the panel hides the gesture demonstration at 10 of 49 points',
    ])
  })
})
