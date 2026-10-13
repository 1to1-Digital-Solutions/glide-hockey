import { describe, expect, it } from 'vitest'
import {
  BUTTON,
  PANEL_BUTTONS,
  PHRASES,
  PHRASES_WITH_ONE_TAP,
  PANEL_HEIGHT,
  PANEL_WIDTH,
  TUTORIAL_TEXT,
  drawStep,
  stepLayout,
} from './XRTutorial'
import { signAspect } from './GoalSign'
import { SCOREBOARD_SIZE } from './XRHud'
import { LINE_HEIGHT } from './canvasPanel'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import { CONTROLLER_HEIGHT } from './drawnController'
import { TUTORIAL_STEPS } from '../../lib/tutorial'
import { translator } from '../../lib/textos'
import { tutorialPlacement } from '../../lib/scoreboardSign'
import { panelPoints, tablePoints, whatThePanelHides } from '../../lib/panelOcclusion'
import { REFERENCE_EYE_HEIGHT } from '../../lib/uiHeight'
import {
  MIN_READING_DEGREES,
  distanceFromEyes,
  eyesAt,
  panelRotation,
  pointOnPanel,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
  type PanelPose,
} from '../../lib/panelReading'
import { SIGN_PLACEMENT } from '../game/ScoreboardSign'
import { XR_UI, XR_UI_ROTATION, fromPlayerSpace, panelViews } from '../game/GameWorld'

/**
 * The tutorial panel, measured instead of looked at.
 *
 * It is the newest text of the game and the only one that **nobody has seen yet
 * with the headset on**: a phrase that ran off the panel would be discovered in
 * the test session and would cost a whole round. Both languages are covered,
 * both grab modes —hold and one tap, which say different phrases— and all the
 * steps.
 */

const LANGUAGES = ['en', 'es'] as const
const PANEL = { width: PANEL_WIDTH, height: PANEL_HEIGHT }
const VIEWS = panelViews(XR_UI.tutorial, XR_UI_ROTATION.tutorial)

/** At what distance the problems are measured: the reading one of the text that reads worst, with the foreshortening. */
function readingDistance(texts: readonly DrawnText[]): number {
  return Math.max(...VIEWS.map(({ pose, eyes: eyePoint }) => worstReadingDistance(texts, pose, eyePoint, LINE_HEIGHT)))
}

/** What each step writes, with both grabs and in both languages. */
function allSteps(): { where: string; texts: DrawnText[] }[] {
  const steps: { where: string; texts: DrawnText[] }[] = []
  for (const lang of LANGUAGES) {
    for (const phrases of [PHRASES, PHRASES_WITH_ONE_TAP]) {
      for (const step of TUTORIAL_STEPS) {
        const { ctx, drawnTexts: texts } = recordingCanvas()
        drawStep(ctx, step, phrases, translator(lang))
        steps.push({ where: `${lang} ${step}: «${translator(lang)(phrases[step])}»`, texts })
      }
    }
  }
  return steps
}

describe('the tutorial panel reads', () => {
  it('at each step, with both grabs and in both languages', () => {
    for (const lang of LANGUAGES) {
      for (const phrases of [PHRASES, PHRASES_WITH_ONE_TAP]) {
        for (const step of TUTORIAL_STEPS) {
          const { ctx, drawnTexts: texts } = recordingCanvas()
          drawStep(ctx, step, phrases, translator(lang))
          const where = `${lang} ${step}: «${translator(lang)(phrases[step])}»`
          expect(texts.length, where).toBeGreaterThan(0)
          expect(legibilityProblems(texts, { panel: PANEL, distance: readingDistance(texts) }), where).toEqual([])
        }
      }
    }
  })

  /**
   * The control of the measurement itself: a panel of which nothing was read would
   * give zero problems just like a perfect one. Narrowed to half it has to complain.
   */
  it('and the measurement notices when the phrase does not fit', () => {
    const { ctx, drawnTexts: texts } = recordingCanvas()
    drawStep(ctx, TUTORIAL_STEPS[0], PHRASES, translator('es'))
    const narrow = { width: PANEL.width / 2, height: PANEL.height }
    expect(legibilityProblems(texts, { panel: narrow }).join(' ')).toContain(
      'runs off the panel',
    )
  })

  /**
   * The drawn controller is not text, so the instrument does not record it and a
   * clash with it would not be called out by itself. It is checked against the real
   * layout —the same one that is painted, not a copy—: it takes up 18 cm of height
   * and is exactly what the long phrase ate into as it grew downwards.
   */
  it('and no phrase gets into the drawn controller', () => {
    for (const lang of LANGUAGES) {
      for (const phrases of [PHRASES, PHRASES_WITH_ONE_TAP]) {
        for (const step of TUTORIAL_STEPS) {
          const { ctx, drawnTexts: texts } = recordingCanvas()
          drawStep(ctx, step, phrases, translator(lang))
          const { controller: controllerY } = stepLayout(ctx, step, phrases, translator(lang))
          const top = controllerY + CONTROLLER_HEIGHT / 2
          const bottom = controllerY - CONTROLLER_HEIGHT / 2
          for (const drawnText of texts) {
            const overlaps = drawnText.y - drawnText.height / 2 < top && drawnText.y + drawnText.height / 2 > bottom
            expect(overlaps, `${lang} ${step}: «${drawnText.text}» overlaps the controller`).toBe(false)
          }
          // And the whole controller fits in the panel.
          expect(bottom, `${lang} ${step}: the controller runs off the bottom`).toBeGreaterThan(
            -PANEL_HEIGHT / 2,
          )
        }
      }
    }
  })

  it('with no step to show it writes nothing: the tutorial is over', () => {
    const { ctx, drawnTexts: texts } = recordingCanvas()
    drawStep(ctx, null, PHRASES, translator('es'))
    expect(texts).toEqual([])
  })
})

/**
 * That every letter of the tutorial reads at a glance from where the game is played, **just as
 * the canvas records it**: the counter and the buttons were at 30 and 32 mm and «Saltar tutorial»
 * shrank to 29 to fit, and at a metre and a half they were left at 1°.
 */
describe('every letter of the tutorial reads at a glance', () => {
  it(`none drops below ${MIN_READING_DEGREES}°, at each step, grab, language and eye height`, () => {
    for (const { where, texts } of allSteps()) {
      for (const view of VIEWS) {
        expect(unreadableTexts(texts, view.pose, view.eyes, LINE_HEIGHT), `${where}, ${view.where}`).toEqual([])
      }
    }
  })

  it('and all of them are written at a size from the list, without shrinking', () => {
    for (const { where, texts } of allSteps()) {
      expect(sizesOffList(texts, LINE_HEIGHT, Object.values(TUTORIAL_TEXT)), where).toEqual([])
    }
  })

  it('and no phrase gets into the buttons below', () => {
    const buttons = PANEL_BUTTONS.map((button) => ({ x: button.x, y: BUTTON.y, width: BUTTON.width, height: BUTTON.height }))
    for (const { where, texts } of allSteps()) {
      expect(textsOnButtons(texts, buttons), where).toEqual([])
    }
  })

  it('the control: the counter at 30 mm, in the place and with the rotation it had before, did not make it', () => {
    const { texts } = allSteps()[0]
    const counter = texts.find((e) => e.text.startsWith('1/'))!
    const asItWas: PanelPose = { position: fromPlayerSpace([0, 0.66, -0.35]), rotation: [-0.2, 0, 0] }
    expect(unreadableTexts([{ ...counter, height: 0.03 * LINE_HEIGHT }], asItWas, eyesAt(1.6), LINE_HEIGHT)).toHaveLength(1)
  })
})

describe('where the tutorial is planted', () => {
  const SIZE = { width: PANEL_WIDTH, height: PANEL_HEIGHT }
  /** What the sign measures where it hangs, and the scoreboard. */
  const SIGN = {
    width: signAspect().width * SIGN_PLACEMENT.distance,
    height: signAspect().height * SIGN_PLACEMENT.distance,
  }

  /** The sign and the scoreboard, which rise with the eyes just like the tutorial. */
  function whatIsRead(rise: number) {
    const sign = fromPlayerSpace(SIGN_PLACEMENT.position)
    const scoreboard = fromPlayerSpace(XR_UI.scoreboard)
    return [
      { what: 'the sign', points: panelPoints([sign[0], sign[1] + rise, sign[2]], SIGN, 8) },
      { what: 'the scoreboard', points: panelPoints([scoreboard[0], scoreboard[1] + rise, scoreboard[2]], SCOREBOARD_SIZE, 8) },
    ]
  }

  it('does not hide the table: neither the board nor the puck, from the eyes it was placed with', () => {
    const eyes = eyesAt(REFERENCE_EYE_HEIGHT)
    const tutorial: PanelPose = { position: fromPlayerSpace(XR_UI.tutorial), rotation: XR_UI_ROTATION.tutorial }
    const table = [
      { what: 'the table', points: tablePoints(13) },
      { what: 'the puck and the mallets', points: tablePoints(13).map((p) => ({ ...p, y: p.y + 0.12 })) },
    ]
    expect(whatThePanelHides(tutorial, SIZE, eyes, table)).toEqual([])
  })

  it('neither the goal sign nor the scoreboard, at any eye height: it is to one side', () => {
    for (const { where: place, pose, eyes: eyePoint } of VIEWS) {
      const rise = pose.position[1] - fromPlayerSpace(XR_UI.tutorial)[1]
      expect(whatThePanelHides(pose, SIZE, eyePoint, whatIsRead(rise)), place).toEqual([])
    }
  })

  it("with two degrees of gap between its edge and the sign's", () => {
    const eyes = eyesAt(REFERENCE_EYE_HEIGHT)
    const azimuth = (p: { x: number; z: number }) => (Math.atan2(p.x - eyes.x, -(p.z - eyes.z)) * 180) / Math.PI
    const tutorial: PanelPose = { position: fromPlayerSpace(XR_UI.tutorial), rotation: XR_UI_ROTATION.tutorial }
    const sign: PanelPose = { position: fromPlayerSpace(SIGN_PLACEMENT.position), rotation: SIGN_PLACEMENT.rotation }
    const tutorialEdge = Math.min(...[-1, 1].map((y) => azimuth(pointOnPanel(tutorial, -PANEL_WIDTH / 2, (y * PANEL_HEIGHT) / 2))))
    const signEdge = Math.max(...[-1, 1].map((y) => azimuth(pointOnPanel(sign, SIGN.width / 2, (y * SIGN.height) / 2))))
    expect(tutorialEdge - signEdge).toBeGreaterThan(1.5)
    // And without going further away than needed: it is still seen by turning the head a little.
    expect(tutorialEdge - signEdge).toBeLessThan(3)
  })

  it('at the same distance from the eyes it had facing forward: every letter takes up the same', () => {
    const eyes = eyesAt(REFERENCE_EYE_HEIGHT)
    expect(distanceFromEyes(fromPlayerSpace(XR_UI.tutorial), eyes)).toBeCloseTo(
      distanceFromEyes(fromPlayerSpace(tutorialPlacement(0)), eyes),
      10,
    )
  })

  it('the control: facing forward, where it was, it hid the whole sign and scoreboard', () => {
    const eyes = eyesAt(REFERENCE_EYE_HEIGHT)
    const position = fromPlayerSpace(tutorialPlacement(0))
    const facing: PanelPose = { position, rotation: panelRotation(position, eyes) }
    expect(whatThePanelHides(facing, SIZE, eyes, whatIsRead(0))).toEqual([
      'the panel hides the sign at 81 of 81 points',
      'the panel hides the scoreboard at 81 of 81 points',
    ])
  })
})
