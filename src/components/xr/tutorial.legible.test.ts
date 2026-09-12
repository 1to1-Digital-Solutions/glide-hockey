import { describe, expect, it } from 'vitest'
import {
  FRASES,
  FRASES_CON_UN_TOQUE,
  PANEL_HEIGHT,
  PANEL_WIDTH,
  dibujarElPaso,
  repartoDelPaso,
} from './XRTutorial'
import { lienzoQueApunta, problemasDeLegibilidad } from './legibilidad'
import { ALTO_DEL_MANDO } from './mandoDibujado'
import { TUTORIAL_STEPS } from '../../lib/tutorial'
import { traductor } from '../../lib/textos'

/**
 * El panel del tutorial, medido en vez de mirado.
 *
 * Es el texto más nuevo del juego y el único que **nadie ha visto todavía con el
 * visor puesto**: una frase que se saliera del panel se descubriría en la sesión
 * de pruebas y costaría una tanda entera. Se recorren los dos idiomas, los dos
 * modos de agarre —mantener y un toque, que dicen frases distintas— y todos los
 * pasos.
 */

const IDIOMAS = ['en', 'es'] as const
const PANEL = { width: PANEL_WIDTH, height: PANEL_HEIGHT }

describe('el panel del tutorial se lee', () => {
  it('en cada paso, con los dos agarres y en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      for (const frases of [FRASES, FRASES_CON_UN_TOQUE]) {
        for (const step of TUTORIAL_STEPS) {
          const { ctx, escritos } = lienzoQueApunta()
          dibujarElPaso(ctx, step, frases, traductor(lang))
          const donde = `${lang} ${step}: «${traductor(lang)(frases[step])}»`
          expect(escritos.length, donde).toBeGreaterThan(0)
          expect(problemasDeLegibilidad(escritos, { panel: PANEL }), donde).toEqual([])
        }
      }
    }
  })

  /**
   * El control de la propia medida: un panel del que no se leyera nada daría cero
   * problemas igual que uno perfecto. Estrechado a la mitad tiene que cantar.
   */
  it('y la medida se entera cuando la frase no cabe', () => {
    const { ctx, escritos } = lienzoQueApunta()
    dibujarElPaso(ctx, TUTORIAL_STEPS[0], FRASES, traductor('es'))
    const estrecho = { width: PANEL.width / 2, height: PANEL.height }
    expect(problemasDeLegibilidad(escritos, { panel: estrecho }).join(' ')).toContain(
      'se sale del panel',
    )
  })

  /**
   * El mando dibujado no es texto, así que el instrumento no lo apunta y un choque
   * con él no se cantaría solo. Se comprueba contra el reparto de verdad —el mismo
   * que se pinta, no una copia—: ocupa 18 cm de alto y es justo lo que la frase
   * larga se comía al crecer hacia abajo.
   */
  it('y ninguna frase se mete en el mando dibujado', () => {
    for (const lang of IDIOMAS) {
      for (const frases of [FRASES, FRASES_CON_UN_TOQUE]) {
        for (const step of TUTORIAL_STEPS) {
          const { ctx, escritos } = lienzoQueApunta()
          dibujarElPaso(ctx, step, frases, traductor(lang))
          const { mando } = repartoDelPaso(ctx, step, frases, traductor(lang))
          const arriba = mando + ALTO_DEL_MANDO / 2
          const abajo = mando - ALTO_DEL_MANDO / 2
          for (const escrito of escritos) {
            const pisa = escrito.y - escrito.alto / 2 < arriba && escrito.y + escrito.alto / 2 > abajo
            expect(pisa, `${lang} ${step}: «${escrito.texto}» pisa el mando`).toBe(false)
          }
          // Y el mando entero cabe en el panel.
          expect(abajo, `${lang} ${step}: el mando se sale por abajo`).toBeGreaterThan(
            -PANEL_HEIGHT / 2,
          )
        }
      }
    }
  })

  it('sin paso que enseñar no escribe nada: el tutorial se ha acabado', () => {
    const { ctx, escritos } = lienzoQueApunta()
    dibujarElPaso(ctx, null, FRASES, traductor('es'))
    expect(escritos).toEqual([])
  })
})
