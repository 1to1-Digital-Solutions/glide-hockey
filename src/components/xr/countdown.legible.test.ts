import { describe, expect, it } from 'vitest'
import { MALLET_NOTICE, MALLET_TEXT, drawMalletNotice } from './XRHud'
import { LINE_HEIGHT } from './canvasPanel'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import { MIN_READING_DEGREES, sizesOffList, unreadableTexts, worstReadingDistance } from '../../lib/panelReading'
import { translator } from '../../lib/textos'
import { XR_UI, panelViews } from '../game/GameWorld'

/**
 * El aviso de coger el mazo de la cuenta atrás, medido en vez de mirado.
 *
 * Es la frase que explica por qué el 1 se queda parado: si no se lee, la cuenta atrás parece
 * colgada. En los dos idiomas, con las dos formas de agarrar y desde donde se juega: sobre el
 * punto de saque, de frente y a tres alturas de ojos.
 */

const IDIOMAS = ['en', 'es'] as const
const VISTAS = panelViews(XR_UI.countdown, undefined)

function todos(): { donde: string; escritos: DrawnText[] }[] {
  return IDIOMAS.flatMap((lang) =>
    [false, true].map((conUnToque) => {
      const { ctx, drawnTexts: escritos } = recordingCanvas()
      drawMalletNotice(ctx, translator(lang), conUnToque)
      return { donde: `${lang}${conUnToque ? ' con un toque' : ''}`, escritos }
    }),
  )
}

describe('el aviso de coger el mazo', () => {
  it('se lee en los dos idiomas y con las dos formas de agarrar', () => {
    for (const { donde, escritos } of todos()) {
      expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
      const panel = { width: MALLET_NOTICE[0], height: MALLET_NOTICE[1] }
      const distancia = Math.max(...VISTAS.map(({ pose, eyes: ojos }) => worstReadingDistance(escritos, pose, ojos, LINE_HEIGHT)))
      expect(legibilityProblems(escritos, { panel, distance: distancia }), donde).toEqual([])
    }
  })

  it(`y cada letra, de un vistazo: ninguna baja de ${MIN_READING_DEGREES}° ni se escribe fuera de la lista`, () => {
    for (const { donde, escritos } of todos()) {
      for (const vista of VISTAS) {
        expect(unreadableTexts(escritos, vista.pose, vista.eyes, LINE_HEIGHT), `${donde}, ${vista.where}`).toEqual([])
      }
      expect(sizesOffList(escritos, LINE_HEIGHT, Object.values(MALLET_TEXT)), donde).toEqual([])
    }
  })
})
