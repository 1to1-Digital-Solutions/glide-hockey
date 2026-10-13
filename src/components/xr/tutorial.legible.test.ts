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
import { signAspect } from './GoalSign'
import { SCOREBOARD_SIZE } from './XRHud'
import { LINE_HEIGHT } from './canvasPanel'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import { ALTO_DEL_MANDO } from './drawnController'
import { TUTORIAL_STEPS } from '../../lib/tutorial'
import { traductor } from '../../lib/textos'
import { sitioDelTutorial } from '../../lib/scoreboardSign'
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
import { SITIO_DEL_CARTEL } from '../game/ScoreboardSign'
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
function distancia(escritos: readonly DrawnText[]): number {
  return Math.max(...VISTAS.map(({ pose, ojos }) => worstReadingDistance(escritos, pose, ojos, LINE_HEIGHT)))
}

/** Lo que escribe cada paso, con los dos agarres y en los dos idiomas. */
function todosLosPasos(): { donde: string; escritos: DrawnText[] }[] {
  const pasos: { donde: string; escritos: DrawnText[] }[] = []
  for (const lang of IDIOMAS) {
    for (const frases of [FRASES, FRASES_CON_UN_TOQUE]) {
      for (const step of TUTORIAL_STEPS) {
        const { ctx, drawnTexts: escritos } = recordingCanvas()
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
          const { ctx, drawnTexts: escritos } = recordingCanvas()
          dibujarElPaso(ctx, step, frases, traductor(lang))
          const donde = `${lang} ${step}: «${traductor(lang)(frases[step])}»`
          expect(escritos.length, donde).toBeGreaterThan(0)
          expect(legibilityProblems(escritos, { panel: PANEL, distance: distancia(escritos) }), donde).toEqual([])
        }
      }
    }
  })

  /**
   * El control de la propia medida: un panel del que no se leyera nada daría cero
   * problemas igual que uno perfecto. Estrechado a la mitad tiene que cantar.
   */
  it('y la medida se entera cuando la frase no cabe', () => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    dibujarElPaso(ctx, TUTORIAL_STEPS[0], FRASES, traductor('es'))
    const estrecho = { width: PANEL.width / 2, height: PANEL.height }
    expect(legibilityProblems(escritos, { panel: estrecho }).join(' ')).toContain(
      'runs off the panel',
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
          const { ctx, drawnTexts: escritos } = recordingCanvas()
          dibujarElPaso(ctx, step, frases, traductor(lang))
          const { mando } = repartoDelPaso(ctx, step, frases, traductor(lang))
          const arriba = mando + ALTO_DEL_MANDO / 2
          const abajo = mando - ALTO_DEL_MANDO / 2
          for (const escrito of escritos) {
            const pisa = escrito.y - escrito.height / 2 < arriba && escrito.y + escrito.height / 2 > abajo
            expect(pisa, `${lang} ${step}: «${escrito.text}» pisa el mando`).toBe(false)
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
    const { ctx, drawnTexts: escritos } = recordingCanvas()
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
        expect(unreadableTexts(escritos, vista.pose, vista.ojos, LINE_HEIGHT), `${donde}, ${vista.donde}`).toEqual([])
      }
    }
  })

  it('y todas se escriben con un tamaño de la lista, sin encogerse', () => {
    for (const { donde, escritos } of todosLosPasos()) {
      expect(sizesOffList(escritos, LINE_HEIGHT, Object.values(TUTORIAL_TEXT)), donde).toEqual([])
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
    const contador = escritos.find((e) => e.text.startsWith('1/'))!
    const comoEstaba: PanelPose = { position: delEspacioDelJugador([0, 0.66, -0.35]), rotation: [-0.2, 0, 0] }
    expect(unreadableTexts([{ ...contador, height: 0.03 * LINE_HEIGHT }], comoEstaba, eyesAt(1.6), LINE_HEIGHT)).toHaveLength(1)
  })
})

describe('dónde se planta el tutorial', () => {
  const MEDIDAS = { width: PANEL_WIDTH, height: PANEL_HEIGHT }
  /** Lo que mide el cartel donde cuelga, y el marcador. */
  const CARTEL = {
    width: signAspect().width * SITIO_DEL_CARTEL.distancia,
    height: signAspect().height * SITIO_DEL_CARTEL.distancia,
  }

  /** El cartel y el marcador, que suben con los ojos igual que el tutorial. */
  function loQueSeLee(sube: number) {
    const cartel = delEspacioDelJugador(SITIO_DEL_CARTEL.position)
    const marcador = delEspacioDelJugador(XR_UI.scoreboard)
    return [
      { que: 'el cartel', puntos: panelPoints([cartel[0], cartel[1] + sube, cartel[2]], CARTEL, 8) },
      { que: 'el marcador', puntos: panelPoints([marcador[0], marcador[1] + sube, marcador[2]], SCOREBOARD_SIZE, 8) },
    ]
  }

  it('no tapa la mesa: ni el tablero ni el disco, desde los ojos con los que se colocó', () => {
    const ojos = eyesAt(REFERENCE_EYE_HEIGHT)
    const tutorial: PanelPose = { position: delEspacioDelJugador(XR_UI.tutorial), rotation: XR_UI_ROTATION.tutorial }
    const mesa = [
      { que: 'la mesa', puntos: tablePoints(13) },
      { que: 'el disco y los mazos', puntos: tablePoints(13).map((p) => ({ ...p, y: p.y + 0.12 })) },
    ]
    expect(whatThePanelHides(tutorial, MEDIDAS, ojos, mesa)).toEqual([])
  })

  it('ni el cartel del objetivo ni el marcador, a ninguna altura de ojos: está a un lado', () => {
    for (const { donde, pose, ojos } of VISTAS) {
      const sube = pose.position[1] - delEspacioDelJugador(XR_UI.tutorial)[1]
      expect(whatThePanelHides(pose, MEDIDAS, ojos, loQueSeLee(sube)), donde).toEqual([])
    }
  })

  it('con dos grados de aire entre su canto y el del cartel', () => {
    const ojos = eyesAt(REFERENCE_EYE_HEIGHT)
    const azimut = (p: { x: number; z: number }) => (Math.atan2(p.x - ojos.x, -(p.z - ojos.z)) * 180) / Math.PI
    const tutorial: PanelPose = { position: delEspacioDelJugador(XR_UI.tutorial), rotation: XR_UI_ROTATION.tutorial }
    const cartel: PanelPose = { position: delEspacioDelJugador(SITIO_DEL_CARTEL.position), rotation: SITIO_DEL_CARTEL.rotation }
    const cantoDelTutorial = Math.min(...[-1, 1].map((y) => azimut(pointOnPanel(tutorial, -PANEL_WIDTH / 2, (y * PANEL_HEIGHT) / 2))))
    const cantoDelCartel = Math.max(...[-1, 1].map((y) => azimut(pointOnPanel(cartel, CARTEL.width / 2, (y * CARTEL.height) / 2))))
    expect(cantoDelTutorial - cantoDelCartel).toBeGreaterThan(1.5)
    // Y sin irse más lejos de lo que hace falta: se sigue viendo girando poco la cabeza.
    expect(cantoDelTutorial - cantoDelCartel).toBeLessThan(3)
  })

  it('a la misma distancia de los ojos que tenía de frente: cada letra ocupa lo mismo', () => {
    const ojos = eyesAt(REFERENCE_EYE_HEIGHT)
    expect(distanceFromEyes(delEspacioDelJugador(XR_UI.tutorial), ojos)).toBeCloseTo(
      distanceFromEyes(delEspacioDelJugador(sitioDelTutorial(0)), ojos),
      10,
    )
  })

  it('el control: de frente, donde estaba, tapaba el cartel y el marcador enteros', () => {
    const ojos = eyesAt(REFERENCE_EYE_HEIGHT)
    const position = delEspacioDelJugador(sitioDelTutorial(0))
    const deFrente: PanelPose = { position, rotation: panelRotation(position, ojos) }
    expect(whatThePanelHides(deFrente, MEDIDAS, ojos, loQueSeLee(0))).toEqual([
      'el panel tapa el cartel en 81 de 81 puntos',
      'el panel tapa el marcador en 81 de 81 puntos',
    ])
  })
})
