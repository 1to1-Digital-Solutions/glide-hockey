import { describe, expect, it } from 'vitest'
import { dibujarLosNombres } from './XRMenu'
import { ALTO_DE_LINEA } from './canvasPanel'
import { lienzoQueApunta, problemasDeLegibilidad, type Escrito } from './legibilidad'
import { MENU_BOXES, MENU_PANEL, MENU_RECORD_X, MENU_ROW, MENU_TEXT } from '../../lib/xrMenuLayout'
import { GAME_MODE_HINTS, GAME_MODE_ORDER } from '../../lib/gameMode'
import { SCENERIES } from '../../lib/ajustes'
import { SCENERY_LABELS } from '../../lib/scenery'
import {
  MIN_READING_DEGREES,
  eyesAt,
  noTextOwnsAButton,
  pointOnPanel,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
} from '../../lib/panelReading'
import { traductor } from '../../lib/textos'
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
})
