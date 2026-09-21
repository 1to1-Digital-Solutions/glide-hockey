import { describe, expect, it } from 'vitest'
import { dibujarLosNombres } from './XRMenu'
import { ALTO_DE_LINEA } from './canvasPanel'
import { lienzoQueApunta, problemasDeLegibilidad, type Escrito } from './legibilidad'
import { MENU_BOXES, MENU_PANEL, MENU_RECORD_X, MENU_ROW, MENU_TEXT } from '../../lib/xrMenuLayout'
import { GAME_MODE_HINTS, GAME_MODE_ORDER } from '../../lib/gameMode'
import { SCENERIES } from '../../lib/ajustes'
import { SCENERY_LABELS } from '../../lib/scenery'
import {
  EYE_HEIGHTS,
  MIN_READING_DEGREES,
  eyesAt,
  noTextOwnsAButton,
  panelRotation,
  pointOnPanel,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
} from '../../lib/panelReading'
import { panelPoints, tablePoints, whatThePanelHides } from '../../lib/panelOcclusion'
import { REFERENCE_EYE_HEIGHT, uiRiseOverWorld, worldRise } from '../../lib/uiHeight'
import { HALF_WIDTH } from '../../lib/puckPhysics'
import { traductor } from '../../lib/textos'
import { SCOREBOARD_SIZE } from './XRHud'
import { PANEL_HEIGHT, PANEL_WIDTH } from './XRTutorial'
import { XR_UI, XR_UI_ROTATION, delEspacioDelJugador, vistasDelPanel } from '../game/GameWorld'

/**
 * Los rótulos del panel del menú, medidos en vez de mirados.
 *
 * En los dos idiomas: el español es más largo y es donde un nombre se sale del panel, se pisa
 * con el de al lado o se encoge hasta no leerse. **Y desde donde se juega**: cada texto en su
 * fila, con el panel donde se planta y girado como se gira, a tres alturas de ojos y con el mundo
 * de pie o a la altura de ellos.
 */

const IDIOMAS = ['en', 'es'] as const
const VISTAS = vistasDelPanel(XR_UI.panel, XR_UI_ROTATION.panel)

/** Todo lo que puede escribir el panel: cada modo y decorado, en los dos idiomas. */
function todosLosMomentos(): { donde: string; escritos: Escrito[] }[] {
  const momentos: { donde: string; escritos: Escrito[] }[] = []
  for (const lang of IDIOMAS) {
    for (const levels of [false, true]) {
      for (const gameMode of GAME_MODE_ORDER) {
        for (const scenery of SCENERIES) {
          const { ctx, escritos } = lienzoQueApunta()
          dibujarLosNombres(ctx, traductor(lang), levels, gameMode, scenery)
          momentos.push({ donde: `${lang} ${levels ? 'niveles' : 'práctica'} ${gameMode} ${scenery}`, escritos })
        }
      }
    }
  }
  return momentos
}

describe('los nombres de las filas del menú se leen', () => {
  it('con cada modo y cada decorado, sin pisarse ni salirse', () => {
    for (const { donde, escritos } of todosLosMomentos()) {
      expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
      const distancia = Math.max(...VISTAS.map(({ pose, ojos }) => worstReadingDistance(escritos, pose, ojos, ALTO_DE_LINEA)))
      expect(problemasDeLegibilidad(escritos, { panel: MENU_PANEL, distancia }), donde).toEqual([])
    }
  })

  /**
   * Y lo que se ha venido a arreglar: dentro del visor los modos eran **solo nombres**
   * y el interruptor del decorado **solo un icono**. Los dos dicen ya lo que son.
   */
  it('dicen qué es el modo elegido y qué decorado está puesto', () => {
    for (const lang of IDIOMAS) {
      const t = traductor(lang)
      for (const gameMode of GAME_MODE_ORDER) {
        const { ctx, escritos } = lienzoQueApunta()
        dibujarLosNombres(ctx, t, false, gameMode, 'place')
        const frase = t(GAME_MODE_HINTS[gameMode])
        expect(escritos.some((e) => frase.startsWith(e.texto.trim())), `${lang} ${gameMode}`).toBe(true)
      }
      for (const scenery of SCENERIES) {
        const { ctx, escritos } = lienzoQueApunta()
        dibujarLosNombres(ctx, t, false, 'practice', scenery)
        expect(escritos.map((e) => e.texto), `${lang} ${scenery}`).toContain(t(SCENERY_LABELS[scenery]))
      }
    }
  })
})

/**
 * Que cada letra se lea de un vistazo **desde donde se juega**, tal como la apunta el lienzo: el
 * tamaño con que se escribió —encogida incluida—, en su fila y con el escorzo.
 */
describe('cada letra del menú se lee de un vistazo', () => {
  it(`ninguna baja de ${MIN_READING_DEGREES}°, en ningún momento, idioma ni altura de ojos`, () => {
    for (const { donde, escritos } of todosLosMomentos()) {
      for (const vista of VISTAS) {
        expect(unreadableTexts(escritos, vista.pose, vista.ojos, ALTO_DE_LINEA), `${donde}, ${vista.donde}`).toEqual([])
      }
    }
  })

  it('y todas se escriben con un tamaño de la lista, sin encogerse', () => {
    for (const { donde, escritos } of todosLosMomentos()) {
      expect(sizesOffList(escritos, ALTO_DE_LINEA, Object.values(MENU_TEXT)), donde).toEqual([])
    }
  })

  it('y ningún rótulo se mete en un botón ni debajo de las cifras del récord', () => {
    // Los botones y el récord son geometría: el instrumento no los ve. Aquí ningún texto es de un
    // botón, así que cuenta cualquier roce.
    const botones = [
      ...Object.values(MENU_BOXES).map(({ position, size }) => ({ x: position[0], y: position[1], width: size[0], height: size[1] })),
      // Hasta cuatro cifras de 4 cm.
      { x: MENU_RECORD_X, y: MENU_ROW.record, width: 0.1, height: 0.05 },
    ]
    for (const { donde, escritos } of todosLosMomentos()) {
      expect(textsOnButtons(escritos, botones, noTextOwnsAButton), donde).toEqual([])
    }
  })

  it('el control: el nombre del decorado a 24 mm, con el panel a 1,45 m, no llegaba', () => {
    const { escritos } = todosLosMomentos().find(({ donde }) => donde === 'es práctica practice place')!
    const decorado = escritos.find((e) => e.texto === traductor('es')(SCENERY_LABELS.place))!
    const [x, y] = delEspacioDelJugador([0, 0.52, -0.25])
    const comoEstaba = { position: [x, y, -1.45] as const, rotation: [-0.2, 0, 0] as const }
    expect(unreadableTexts([{ ...decorado, alto: 0.024 * ALTO_DE_LINEA }], comoEstaba, eyesAt(1.6), ALTO_DE_LINEA)).toHaveLength(1)
  })
})

describe('dónde se planta el menú', () => {
  it('cerca, pero con su borde de abajo por encima del tablero', () => {
    // Inclinado hacia los ojos, el borde de abajo se acerca y sube menos de lo que mide el panel.
    const abajo = pointOnPanel({ position: delEspacioDelJugador(XR_UI.panel), rotation: XR_UI_ROTATION.panel }, 0, -MENU_PANEL.height / 2)
    const tablero = delEspacioDelJugador([0, 0, 0])[1]
    expect(abajo.y - tablero).toBeGreaterThan(0.02)
  })

  it('delante, arriba y a la derecha: se ve sin girarse y no está en medio', () => {
    const [x, y, z] = delEspacioDelJugador(XR_UI.panel)
    const ojos = eyesAt(REFERENCE_EYE_HEIGHT)
    // Delante: el panel está hacia donde se juega, no de lado ni a la espalda.
    expect(z).toBeLessThan(0)
    expect((Math.atan2(x, -z) * 180) / Math.PI).toBeLessThan(60)
    // A la derecha, y fuera del rectángulo de la mesa.
    expect(x).toBeGreaterThan(HALF_WIDTH)
    // Arriba: por encima de la horizontal de los ojos.
    expect(y).toBeGreaterThan(ojos.y)
  })
})

/**
 * Y lo que se ha venido a arreglar: **que el panel no se ponga delante de lo que hay que ver**.
 *
 * El instrumento que mide la legibilidad dice si el panel se lee, no si estorba, y son dos cosas
 * distintas: centrado y a la altura de los ojos, el menú se leía perfectamente y tapaba media
 * mesa. Esto se mira desde los ojos de quien juega, a las tres alturas y con la altura de juego
 * del salón de pie o baja, porque el panel sube con los ojos y la mesa no (ver `XRUiHeight` y
 * `XRWorldHeight`).
 */
describe('lo que el menú deja ver', () => {
  const MEDIDAS = { width: MENU_PANEL.width, height: MENU_PANEL.height }

  /** Cada vista: dónde queda el panel y cuánto se ha movido el mundo bajo él. */
  const VISTAS_CON_MUNDO = EYE_HEIGHTS.flatMap((ojos) =>
    [false, true].map((aLaAlturaDeLosOjos) => {
      const mundo = worldRise(ojos, aLaAlturaDeLosOjos)
      const [x, y, z] = delEspacioDelJugador(XR_UI.panel)
      return {
        donde: `ojos a ${ojos} m${aLaAlturaDeLosOjos ? ', mundo a su altura' : ''}`,
        pose: { position: [x, y + mundo + uiRiseOverWorld(ojos, aLaAlturaDeLosOjos), z] as const, rotation: XR_UI_ROTATION.panel },
        ojos: eyesAt(ojos),
        mundo,
      }
    }),
  )

  /** Lo que hay detrás del panel, subido lo que haya subido el mundo. */
  function loQueHayDetras(mundo: number) {
    const subir = (puntos: ReturnType<typeof tablePoints>) => puntos.map((p) => ({ ...p, y: p.y + mundo }))
    return [
      { que: 'la mesa', puntos: subir(tablePoints(13)) },
      { que: 'el marcador', puntos: subir(panelPoints(delEspacioDelJugador(XR_UI.scoreboard), SCOREBOARD_SIZE, 6)) },
      {
        que: 'la demostración del gesto',
        puntos: subir(panelPoints(delEspacioDelJugador(XR_UI.tutorial), { width: PANEL_WIDTH, height: PANEL_HEIGHT }, 6)),
      },
    ]
  }

  it('no tapa el tablero, ni el marcador, ni la demostración, desde ninguna altura', () => {
    for (const { donde, pose, ojos, mundo } of VISTAS_CON_MUNDO) {
      expect(whatThePanelHides(pose, MEDIDAS, ojos, loQueHayDetras(mundo)), donde).toEqual([])
    }
  })

  it('el control: centrado sobre la mesa y a la altura de los ojos, tapaba los tres', () => {
    const comoEstaba = delEspacioDelJugador([0, 0.62, 0.2])
    const ojos = eyesAt(REFERENCE_EYE_HEIGHT)
    expect(
      whatThePanelHides(
        { position: comoEstaba, rotation: panelRotation(comoEstaba, ojos) },
        MEDIDAS,
        ojos,
        loQueHayDetras(0),
      ),
    ).toEqual([
      'el panel tapa la mesa en 106 de 196 puntos',
      'el panel tapa el marcador en 49 de 49 puntos',
      'el panel tapa la demostración del gesto en 49 de 49 puntos',
    ])
  })
})
