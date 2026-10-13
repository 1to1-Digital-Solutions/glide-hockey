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
 * El aviso de dejar la partida, medido en vez de mirado, en los dos idiomas y desde donde se
 * juega: en el sitio del menú (`XR_UI.panel`), girado como él y a tres alturas de ojos.
 */

const IDIOMAS = ['en', 'es'] as const
const VISTAS = panelViews(XR_UI.panel, XR_UI_ROTATION.panel)

function medir(lang: (typeof IDIOMAS)[number]): DrawnText[] {
  const { ctx, drawnTexts: escritos } = recordingCanvas()
  drawExitNotice(ctx, translator(lang))
  return escritos
}

describe('el aviso de dejar la partida', () => {
  it('se lee en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      const escritos = atColumnScale(medir(lang))
      expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
      const panel = { width: CONFIRM_SIZE[0] * COLUMN_SCALE, height: CONFIRM_SIZE[1] * COLUMN_SCALE }
      const distancia = Math.max(...VISTAS.map(({ pose, eyes: ojos }) => worstReadingDistance(escritos, pose, ojos, LINE_HEIGHT)))
      expect(legibilityProblems(escritos, { panel, distance: distancia }), lang).toEqual([])
    }
  })
})

describe('cada letra del aviso se lee de un vistazo', () => {
  it(`ninguna baja de ${MIN_READING_DEGREES}°, en los dos idiomas y a cualquier altura de ojos`, () => {
    for (const lang of IDIOMAS) {
      for (const vista of VISTAS) {
        expect(unreadableTexts(atColumnScale(medir(lang)), vista.pose, vista.eyes, LINE_HEIGHT), `${lang}, ${vista.where}`).toEqual([])
      }
    }
  })

  it('y todas se escriben con un tamaño de la lista, sin encogerse', () => {
    // «Back to the menu» no cabía en su botón y se encogía a 25 mm.
    for (const lang of IDIOMAS) {
      expect(sizesOffList(medir(lang), LINE_HEIGHT, Object.values(CONFIRM_TEXT)), lang).toEqual([])
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
    const volver = medir('en').find((e) => e.text === 'Back to the menu')!
    const [x, y] = fromPlayerSpace([0, 0.52, -0.25])
    const comoEstaba = { position: [x, y, -1.45] as const, rotation: [-0.2, 0, 0] as const }
    expect(unreadableTexts([{ ...volver, height: 0.0252 * LINE_HEIGHT }], comoEstaba, eyesAt(1.6), LINE_HEIGHT)).toHaveLength(1)
  })
})
