import { describe, expect, it } from 'vitest'
import { CONFIRM_BOXES, CONFIRM_SIZE, CONFIRM_TEXT, drawExitNotice } from './XRHud'
import { LINE_HEIGHT } from './canvasPanel'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import {
  MIN_READING_DEGREES,
  eyesAt,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
} from '../../lib/panelReading'
import { translator } from '../../lib/textos'
import {
  COLUMN_SCALE,
  XR_UI,
  XR_UI_ROTATION,
  atColumnScale,
  fromPlayerSpace,
  panelViews,
} from '../game/GameWorld'

/**
 * The notice about leaving the match, measured instead of looked at, in both languages and from
 * where the game is played: at the menu's place (`XR_UI.panel`), rotated like it and at three
 * eye heights.
 */

const LANGUAGES = ['en', 'es'] as const
const VIEWS = panelViews(XR_UI.panel, XR_UI_ROTATION.panel)

function measure(lang: (typeof LANGUAGES)[number]): DrawnText[] {
  const { ctx, drawnTexts: texts } = recordingCanvas()
  drawExitNotice(ctx, translator(lang))
  return texts
}

describe('the notice about leaving the match', () => {
  it('reads in both languages', () => {
    for (const lang of LANGUAGES) {
      const texts = atColumnScale(measure(lang))
      expect(texts.length, 'nothing was measured').toBeGreaterThan(0)
      const panel = { width: CONFIRM_SIZE[0] * COLUMN_SCALE, height: CONFIRM_SIZE[1] * COLUMN_SCALE }
      const readingDistance = Math.max(...VIEWS.map(({ pose, eyes: eyePoint }) => worstReadingDistance(texts, pose, eyePoint, LINE_HEIGHT)))
      expect(legibilityProblems(texts, { panel, distance: readingDistance }), lang).toEqual([])
    }
  })
})

describe('every letter of the notice reads at a glance', () => {
  it(`none drops below ${MIN_READING_DEGREES}°, in both languages and at any eye height`, () => {
    for (const lang of LANGUAGES) {
      for (const view of VIEWS) {
        expect(unreadableTexts(atColumnScale(measure(lang)), view.pose, view.eyes, LINE_HEIGHT), `${lang}, ${view.where}`).toEqual([])
      }
    }
  })

  it('and all of them are written at a size from the list, without shrinking', () => {
    // «Back to the menu» did not fit in its button and shrank to 25 mm.
    for (const lang of LANGUAGES) {
      expect(sizesOffList(measure(lang), LINE_HEIGHT, Object.values(CONFIRM_TEXT)), lang).toEqual([])
    }
  })

  it('and the question does not get into the buttons, nor the label of one into another', () => {
    const buttons = Object.values(CONFIRM_BOXES).map(({ position, size }) => ({
      x: position[0],
      y: position[1],
      width: size[0],
      height: size[1],
    }))
    for (const lang of LANGUAGES) {
      expect(textsOnButtons(measure(lang), buttons), lang).toEqual([])
    }
  })

  it('the control: «Back to the menu» shrunk and with the panel at 1.45 m did not make it', () => {
    const back = measure('en').find((e) => e.text === 'Back to the menu')!
    const [x, y] = fromPlayerSpace([0, 0.52, -0.25])
    const asItWas = { position: [x, y, -1.45] as const, rotation: [-0.2, 0, 0] as const }
    expect(unreadableTexts([{ ...back, height: 0.0252 * LINE_HEIGHT }], asItWas, eyesAt(1.6), LINE_HEIGHT)).toHaveLength(1)
  })
})
