import { describe, expect, it } from 'vitest'
import { CONFIRM_BOXES, CONFIRM_SIZE, CONFIRM_TEXT, dibujarElAviso } from './XRHud'
import { ALTO_DE_LINEA } from './canvasPanel'
import { lienzoQueApunta, problemasDeLegibilidad, type Escrito } from './legibilidad'
import {
  MIN_READING_DEGREES,
  eyesAt,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
} from '../../lib/panelReading'
import { traductor } from '../../lib/textos'
import {
  ESCALA_DE_LA_COLUMNA,
  XR_UI,
  XR_UI_ROTATION,
  aLaEscalaDeLaColumna,
  delEspacioDelJugador,
  vistasDelPanel,
} from '../game/GameWorld'

/**
 * El aviso de dejar la partida, medido en vez de mirado, en los dos idiomas y desde donde se
 * juega: en el sitio del menú (`XR_UI.panel`), girado como él y a tres alturas de ojos.
 */

const IDIOMAS = ['en', 'es'] as const
const VISTAS = vistasDelPanel(XR_UI.panel, XR_UI_ROTATION.panel)

function medir(lang: (typeof IDIOMAS)[number]): Escrito[] {
  const { ctx, escritos } = lienzoQueApunta()
  dibujarElAviso(ctx, traductor(lang))
  return escritos
}

describe('el aviso de dejar la partida', () => {
  it('se lee en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      const escritos = aLaEscalaDeLaColumna(medir(lang))
      expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
      const panel = { width: CONFIRM_SIZE[0] * ESCALA_DE_LA_COLUMNA, height: CONFIRM_SIZE[1] * ESCALA_DE_LA_COLUMNA }
      const distancia = Math.max(...VISTAS.map(({ pose, ojos }) => worstReadingDistance(escritos, pose, ojos, ALTO_DE_LINEA)))
      expect(problemasDeLegibilidad(escritos, { panel, distancia }), lang).toEqual([])
    }
  })
})

describe('cada letra del aviso se lee de un vistazo', () => {
  it(`ninguna baja de ${MIN_READING_DEGREES}°, en los dos idiomas y a cualquier altura de ojos`, () => {
    for (const lang of IDIOMAS) {
      for (const vista of VISTAS) {
        expect(unreadableTexts(aLaEscalaDeLaColumna(medir(lang)), vista.pose, vista.ojos, ALTO_DE_LINEA), `${lang}, ${vista.donde}`).toEqual([])
      }
    }
  })

  it('y todas se escriben con un tamaño de la lista, sin encogerse', () => {
    // «Back to the menu» no cabía en su botón y se encogía a 25 mm.
    for (const lang of IDIOMAS) {
      expect(sizesOffList(medir(lang), ALTO_DE_LINEA, Object.values(CONFIRM_TEXT)), lang).toEqual([])
    }
  })

  it('y la pregunta no se mete en los botones, ni la etiqueta de uno en otro', () => {
    const botones = Object.values(CONFIRM_BOXES).map(({ position, size }) => ({
      x: position[0],
      y: position[1],
      width: size[0],
      height: size[1],
    }))
    for (const lang of IDIOMAS) {
      expect(textsOnButtons(medir(lang), botones), lang).toEqual([])
    }
  })

  it('el control: «Back to the menu» encogida y con el panel a 1,45 m no llegaba', () => {
    const volver = medir('en').find((e) => e.texto === 'Back to the menu')!
    const [x, y] = delEspacioDelJugador([0, 0.52, -0.25])
    const comoEstaba = { position: [x, y, -1.45] as const, rotation: [-0.2, 0, 0] as const }
    expect(unreadableTexts([{ ...volver, alto: 0.0252 * ALTO_DE_LINEA }], comoEstaba, eyesAt(1.6), ALTO_DE_LINEA)).toHaveLength(1)
  })
})
