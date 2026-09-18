import { describe, expect, it } from 'vitest'
import { AVISO_DEL_MAZO, MALLET_TEXT, dibujarElAvisoDelMazo } from './XRHud'
import { ALTO_DE_LINEA } from './canvasPanel'
import { lienzoQueApunta, problemasDeLegibilidad, type Escrito } from './legibilidad'
import { MIN_READING_DEGREES, sizesOffList, unreadableTexts, worstReadingDistance } from '../../lib/panelReading'
import { traductor } from '../../lib/textos'
import { XR_UI, vistasDelPanel } from '../game/GameWorld'

/**
 * El aviso de coger el mazo de la cuenta atrás, medido en vez de mirado.
 *
 * Es la frase que explica por qué el 1 se queda parado: si no se lee, la cuenta atrás parece
 * colgada. En los dos idiomas, con las dos formas de agarrar y desde donde se juega: sobre el
 * punto de saque, de frente y a tres alturas de ojos.
 */

const IDIOMAS = ['en', 'es'] as const
const VISTAS = vistasDelPanel(XR_UI.countdown, undefined)

function todos(): { donde: string; escritos: Escrito[] }[] {
  return IDIOMAS.flatMap((lang) =>
    [false, true].map((conUnToque) => {
      const { ctx, escritos } = lienzoQueApunta()
      dibujarElAvisoDelMazo(ctx, traductor(lang), conUnToque)
      return { donde: `${lang}${conUnToque ? ' con un toque' : ''}`, escritos }
    }),
  )
}

describe('el aviso de coger el mazo', () => {
  it('se lee en los dos idiomas y con las dos formas de agarrar', () => {
    for (const { donde, escritos } of todos()) {
      expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
      const panel = { width: AVISO_DEL_MAZO[0], height: AVISO_DEL_MAZO[1] }
      const distancia = Math.max(...VISTAS.map(({ pose, ojos }) => worstReadingDistance(escritos, pose, ojos, ALTO_DE_LINEA)))
      expect(problemasDeLegibilidad(escritos, { panel, distancia }), donde).toEqual([])
    }
  })

  it(`y cada letra, de un vistazo: ninguna baja de ${MIN_READING_DEGREES}° ni se escribe fuera de la lista`, () => {
    for (const { donde, escritos } of todos()) {
      for (const vista of VISTAS) {
        expect(unreadableTexts(escritos, vista.pose, vista.ojos, ALTO_DE_LINEA), `${donde}, ${vista.donde}`).toEqual([])
      }
      expect(sizesOffList(escritos, ALTO_DE_LINEA, Object.values(MALLET_TEXT)), donde).toEqual([])
    }
  })
})
