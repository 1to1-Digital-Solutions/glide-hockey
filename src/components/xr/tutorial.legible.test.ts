import { describe, expect, it } from 'vitest'
import {
  BOTON,
  BOTONES,
  FRASES,
  FRASES_CON_UN_TOQUE,
  PANEL_HEIGHT,
  PANEL_WIDTH,
  TUTORIAL_TEXT,
  dibujarElPaso,
  repartoDelPaso,
} from './XRTutorial'
import { ALTO_DE_LINEA } from './canvasPanel'
import { lienzoQueApunta, problemasDeLegibilidad, type Escrito } from './legibilidad'
import { ALTO_DEL_MANDO } from './mandoDibujado'
import { TUTORIAL_STEPS } from '../../lib/tutorial'
import { traductor } from '../../lib/textos'
import { HALF_LENGTH } from '../../lib/puckPhysics'
import { REFERENCE_EYE_HEIGHT } from '../../lib/uiHeight'
import {
  MIN_READING_DEGREES,
  eyesAt,
  pointOnPanel,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
  type PanelPose,
} from '../../lib/panelReading'
import { XR_UI, XR_UI_ROTATION, delEspacioDelJugador, vistasDelPanel } from '../game/GameWorld'

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
const VISTAS = vistasDelPanel(XR_UI.tutorial, XR_UI_ROTATION.tutorial)

/** A qué distancia se miden los problemas: la de lectura del texto que peor se lee, con el escorzo. */
function distancia(escritos: readonly Escrito[]): number {
  return Math.max(...VISTAS.map(({ pose, ojos }) => worstReadingDistance(escritos, pose, ojos, ALTO_DE_LINEA)))
}

/** Lo que escribe cada paso, con los dos agarres y en los dos idiomas. */
function todosLosPasos(): { donde: string; escritos: Escrito[] }[] {
  const pasos: { donde: string; escritos: Escrito[] }[] = []
  for (const lang of IDIOMAS) {
    for (const frases of [FRASES, FRASES_CON_UN_TOQUE]) {
      for (const step of TUTORIAL_STEPS) {
        const { ctx, escritos } = lienzoQueApunta()
        dibujarElPaso(ctx, step, frases, traductor(lang))
        pasos.push({ donde: `${lang} ${step}: «${traductor(lang)(frases[step])}»`, escritos })
      }
    }
  }
  return pasos
}

describe('el panel del tutorial se lee', () => {
  it('en cada paso, con los dos agarres y en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      for (const frases of [FRASES, FRASES_CON_UN_TOQUE]) {
        for (const step of TUTORIAL_STEPS) {
          const { ctx, escritos } = lienzoQueApunta()
          dibujarElPaso(ctx, step, frases, traductor(lang))
          const donde = `${lang} ${step}: «${traductor(lang)(frases[step])}»`
          expect(escritos.length, donde).toBeGreaterThan(0)
          expect(problemasDeLegibilidad(escritos, { panel: PANEL, distancia: distancia(escritos) }), donde).toEqual([])
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

/**
 * Que cada letra del tutorial se lea de un vistazo desde donde se juega, **tal como la apunta el
 * lienzo**: el contador y los botones iban a 30 y 32 mm y «Saltar tutorial» se encogía a 29 para
 * caber, y a metro y medio se quedaban en 1°.
 */
describe('cada letra del tutorial se lee de un vistazo', () => {
  it(`ninguna baja de ${MIN_READING_DEGREES}°, en cada paso, agarre, idioma y altura de ojos`, () => {
    for (const { donde, escritos } of todosLosPasos()) {
      for (const vista of VISTAS) {
        expect(unreadableTexts(escritos, vista.pose, vista.ojos, ALTO_DE_LINEA), `${donde}, ${vista.donde}`).toEqual([])
      }
    }
  })

  it('y todas se escriben con un tamaño de la lista, sin encogerse', () => {
    for (const { donde, escritos } of todosLosPasos()) {
      expect(sizesOffList(escritos, ALTO_DE_LINEA, Object.values(TUTORIAL_TEXT)), donde).toEqual([])
    }
  })

  it('y ninguna frase se mete en los botones de abajo', () => {
    const botones = BOTONES.map((boton) => ({ x: boton.x, y: BOTON.y, width: BOTON.width, height: BOTON.height }))
    for (const { donde, escritos } of todosLosPasos()) {
      expect(textsOnButtons(escritos, botones), donde).toEqual([])
    }
  })

  it('el control: el contador a 30 mm, en el sitio y con el giro de antes, no llegaba', () => {
    const { escritos } = todosLosPasos()[0]
    const contador = escritos.find((e) => e.texto.startsWith('1/'))!
    const comoEstaba: PanelPose = { position: delEspacioDelJugador([0, 0.66, -0.35]), rotation: [-0.2, 0, 0] }
    expect(unreadableTexts([{ ...contador, alto: 0.03 * ALTO_DE_LINEA }], comoEstaba, eyesAt(1.6), ALTO_DE_LINEA)).toHaveLength(1)
  })
})

describe('dónde se planta el tutorial', () => {
  it('por encima de la vista del fondo de la mesa: no tapa el pasillo del disco', () => {
    // La recta de los ojos al borde del fondo de la mesa, donde para el disco la máquina, pasa por
    // debajo del borde de abajo del panel.
    const ojos = eyesAt(REFERENCE_EYE_HEIGHT)
    const tutorial: PanelPose = { position: delEspacioDelJugador(XR_UI.tutorial), rotation: XR_UI_ROTATION.tutorial }
    const abajo = pointOnPanel(tutorial, 0, -PANEL_HEIGHT / 2)
    const fondo = delEspacioDelJugador([0, 0, -HALF_LENGTH])
    const recta = ojos.y + ((fondo[1] - ojos.y) * abajo.z) / fondo[2]
    expect(abajo.y - recta).toBeGreaterThan(0.05)
  })
})
