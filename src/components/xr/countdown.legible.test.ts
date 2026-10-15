import { describe, expect, it } from 'vitest'
import { MALLET_NOTICE, MALLET_TEXT, drawMalletNotice } from './XRHud'
import { LINE_HEIGHT } from './canvasPanel'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import { MIN_READING_DEGREES, sizesOffList, unreadableTexts, worstReadingDistance } from '../../lib/panelReading'
import { translator } from '../../lib/textos'
import { XR_UI, panelViews } from '../game/GameWorld'

/**
 * The countdown's notice to pick up the mallet, measured instead of looked at.
 *
 * It is the phrase that explains why the 1 stays still: if it cannot be read, the countdown
 * looks hung. In both languages, with both ways of grabbing and from where the game is played:
 * over the serve spot, facing forward and at three eye heights.
 */

const LANGUAGES = ['en', 'es'] as const
const VIEWS = panelViews(XR_UI.countdown, undefined)

function all(): { where: string; texts: DrawnText[] }[] {
  return LANGUAGES.flatMap((lang) =>
    [false, true].map((withOneTap) => {
      const { ctx, drawnTexts: texts } = recordingCanvas()
      drawMalletNotice(ctx, translator(lang), withOneTap)
      return { where: `${lang}${withOneTap ? ' with one tap' : ''}`, texts }
    }),
  )
}

describe('the notice to pick up the mallet', () => {
  it('reads in both languages and with both ways of grabbing', () => {
    for (const { where, texts } of all()) {
      expect(texts.length, 'nothing was measured').toBeGreaterThan(0)
      const panel = { width: MALLET_NOTICE[0], height: MALLET_NOTICE[1] }
      const readingDistance = Math.max(...VIEWS.map(({ pose, eyes: eyePoint }) => worstReadingDistance(texts, pose, eyePoint, LINE_HEIGHT)))
      expect(legibilityProblems(texts, { panel, distance: readingDistance }), where).toEqual([])
    }
  })

  it(`and every letter, at a glance: none drops below ${MIN_READING_DEGREES}° nor is written off the list`, () => {
    for (const { where, texts } of all()) {
      for (const view of VIEWS) {
        expect(unreadableTexts(texts, view.pose, view.eyes, LINE_HEIGHT), `${where}, ${view.where}`).toEqual([])
      }
      expect(sizesOffList(texts, LINE_HEIGHT, Object.values(MALLET_TEXT)), where).toEqual([])
    }
  })
})
