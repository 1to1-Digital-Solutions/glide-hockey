import { describe, expect, it } from 'vitest'
import { dibujarLosNombres } from './XRMenu'
import { ALTO_DE_LINEA } from './canvasPanel'
import { lienzoQueApunta, problemasDeLegibilidad, type Escrito } from './legibilidad'
import { MENU_BOXES, MENU_PANEL, MENU_RECORD_X, MENU_ROW, MENU_TEXT } from '../../lib/xrMenuLayout'
import { GAME_MODE_HINTS, GAME_MODE_LABELS, GAME_MODE_ORDER } from '../../lib/gameMode'
import { SCENERIES } from '../../lib/ajustes'
import { SCENERY_LABELS } from '../../lib/scenery'
import {
  EYE_HEIGHTS,
  MIN_READING_DEGREES,
  eyesAt,
  centreInside,
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
import { GRADOS_DEL_MENU, gradosDelFrente } from '../../lib/plantillaDelMenu'
import { SCOREBOARD_SIZE } from './XRHud'
import { PANEL_HEIGHT, PANEL_WIDTH } from './XRTutorial'
import {
  COLUMNA,
  ESCALA_DE_LA_COLUMNA,
  XR_QUIT,
  XR_UI,
  XR_UI_ROTATION,
  aLaEscalaDeLaColumna,
  delEspacioDelJugador,
  distanciaDelJugador,
  vistasDelPanel,
} from '../game/GameWorld'

/**
 * Los rótulos del panel del menú, medidos en vez de mirados.
 *
 * En los dos idiomas: el español es más largo y es donde un nombre se sale del panel, se pisa
 * con el de al lado o se encoge hasta no leerse. **Y desde donde se juega**: cada texto en su
 * fila, con el panel donde se planta y girado como se gira, a tres alturas de ojos y con el mundo
 * de pie o a la altura de ellos.
 */

const IDIOMAS = ['en', 'es'] as const
// Donde nace el menú, casi de frente (`XR_UI.menu`): es donde se lee.
const VISTAS = vistasDelPanel(XR_UI.menu, XR_UI_ROTATION.menu)

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
      // Medidos como se pintan: la columna entera va escalada (`ESCALA_DE_LA_COLUMNA`).
      const escalados = aLaEscalaDeLaColumna(escritos)
      const distancia = Math.max(...VISTAS.map(({ pose, ojos }) => worstReadingDistance(escalados, pose, ojos, ALTO_DE_LINEA)))
      const panel = { width: MENU_PANEL.width * ESCALA_DE_LA_COLUMNA, height: MENU_PANEL.height * ESCALA_DE_LA_COLUMNA }
      expect(problemasDeLegibilidad(escalados, { panel, distancia }), donde).toEqual([])
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

describe('cada modo lleva su nombre', () => {
  it('debajo de su icono, dentro de su botón y sin encogerse, en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      const t = traductor(lang)
      const { ctx, escritos } = lienzoQueApunta()
      dibujarLosNombres(ctx, t, false, 'challenge')
      for (const modo of GAME_MODE_ORDER) {
        const nombre = escritos.find((e) => e.texto === t(GAME_MODE_LABELS[modo]))
        expect(nombre, `${lang} ${modo}`).toBeDefined()
        const { position, size } = MENU_BOXES[`modo ${modo}`]
        expect(Math.abs(nombre!.x - position[0]) * 2 + nombre!.ancho, `${lang} ${modo} a lo ancho`).toBeLessThanOrEqual(size[0])
        expect(Math.abs(nombre!.y - position[1]) * 2 + nombre!.alto, `${lang} ${modo} a lo alto`).toBeLessThanOrEqual(size[1] + 1e-9)
        expect(nombre!.alto / ALTO_DE_LINEA).toBeCloseTo(MENU_TEXT.mode, 9)
      }
    }
  })
})

describe('el menú dice de cada modo si cuenta para medalla', () => {
  it('en la línea del rótulo «Modo», con letras: solo el reto cuenta', () => {
    for (const lang of IDIOMAS) {
      const t = traductor(lang)
      for (const gameMode of GAME_MODE_ORDER) {
        const { ctx, escritos } = lienzoQueApunta()
        dibujarLosNombres(ctx, t, gameMode === 'levels', gameMode, 'place')
        const frase = t(gameMode === 'challenge' ? 'Counts for a medal' : 'Does not count for a medal')
        const escrita = escritos.find((e) => e.texto === frase)
        const rotulo = escritos.find((e) => e.texto === t('Mode'))!
        expect(escrita, `${lang} ${gameMode}`).toBeDefined()
        expect(escrita!.y).toBeCloseTo(rotulo.y)
        expect(escrita!.x).toBeGreaterThan(rotulo.x)
      }
    }
  })

  it('y si el salón saca las medallas de otro modo, el reto tampoco cuenta', () => {
    const { ctx, escritos } = lienzoQueApunta()
    const otro = { medallas: { bronce: 1, plata: 2, oro: 3 }, mejorEs: 'mas', unidad: 'points', record: null, modo: 'levels' } as const
    dibujarLosNombres(ctx, traductor('en'), false, 'challenge', 'place', otro)
    expect(escritos.map((e) => e.texto)).toContain('Does not count for a medal')
  })
})

describe('el menú empieza por el modo, y solo la práctica pregunta', () => {
  /** Los nombres de las filas que se pintan con ese modo. */
  function filas(gameMode: (typeof GAME_MODE_ORDER)[number]): string[] {
    const { ctx, escritos } = lienzoQueApunta()
    dibujarLosNombres(ctx, traductor('en'), gameMode === 'levels', gameMode, 'place')
    return escritos.map((e) => e.texto).filter((texto) => ['Mode', 'Level', 'Goals', 'Stage'].includes(texto))
  }

  it('la práctica: el modo, el nivel de la máquina y los goles', () => {
    expect(filas('practice')).toEqual(['Mode', 'Level', 'Goals'])
  })

  it('niveles: el modo y qué nivel se juega; el resto lo pone la escalera', () => {
    expect(filas('levels')).toEqual(['Mode', 'Stage'])
  })

  it('el reto: solo el modo, y a jugar', () => {
    expect(filas('challenge')).toEqual(['Mode'])
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
        expect(unreadableTexts(aLaEscalaDeLaColumna(escritos), vista.pose, vista.ojos, ALTO_DE_LINEA), `${donde}, ${vista.donde}`).toEqual([])
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
    // Lo único escrito dentro de un botón es el nombre de cada modo, en el suyo.
    const nombresDeLosModos = new Set(IDIOMAS.flatMap((lang) => GAME_MODE_ORDER.map((modo) => traductor(lang)(GAME_MODE_LABELS[modo]))))
    const suyo = (texto: Escrito, boton: { x: number; y: number; width: number; height: number }) =>
      nombresDeLosModos.has(texto.texto) && centreInside(texto, boton) && Math.abs(boton.y - MENU_ROW.mode) < 1e-9
    for (const { donde, escritos } of todosLosMomentos()) {
      expect(textsOnButtons(escritos, botones, suyo), donde).toEqual([])
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

describe('dónde nace el menú', () => {
  it(`a ${GRADOS_DEL_MENU}° o menos del frente de quien juega`, () => {
    expect(gradosDelFrente(delEspacioDelJugador(XR_UI.menu))).toBeLessThanOrEqual(GRADOS_DEL_MENU)
  })

  it('a la distancia de la columna y a la altura de los ojos: la letra ocupa en el ojo lo mismo', () => {
    expect(distanciaDelJugador(XR_UI.menu)).toBeCloseTo(distanciaDelJugador(XR_UI.panel), 9)
    expect(delEspacioDelJugador(XR_UI.menu)[1]).toBeCloseTo(eyesAt(REFERENCE_EYE_HEIGHT).y, 9)
  })

  it('de cara a quien juega', () => {
    expect(XR_UI_ROTATION.menu).toEqual(panelRotation(delEspacioDelJugador(XR_UI.menu), eyesAt(REFERENCE_EYE_HEIGHT)))
  })

  it('sin tapar el marcador ni la demostración; de la mesa, como mucho la esquina del fondo', () => {
    // En la fase de menú no se juega: que asome sobre el canto izquierdo del fondo no estorba a
    // nadie, y al empezar se aparta. El cartel del objetivo no sale en el menú.
    const medidas = { width: MENU_PANEL.width * ESCALA_DE_LA_COLUMNA, height: MENU_PANEL.height * ESCALA_DE_LA_COLUMNA }
    const [x, y, z] = delEspacioDelJugador(XR_UI.menu)
    for (const ojos of EYE_HEIGHTS) {
      for (const aLaAltura of [false, true]) {
        const mundo = worldRise(ojos, aLaAltura)
        const pose = { position: [x, y + mundo + uiRiseOverWorld(ojos, aLaAltura), z] as const, rotation: XR_UI_ROTATION.menu }
        const subir = (puntos: ReturnType<typeof tablePoints>) => puntos.map((p) => ({ ...p, y: p.y + mundo }))
        const donde = `ojos a ${ojos} m${aLaAltura ? ', mundo a su altura' : ''}`
        expect(
          whatThePanelHides(pose, medidas, eyesAt(ojos), [
            { que: 'el marcador', puntos: subir(panelPoints(delEspacioDelJugador(XR_UI.scoreboard), SCOREBOARD_SIZE, 6)) },
            {
              que: 'la demostración',
              puntos: subir(panelPoints(delEspacioDelJugador(XR_UI.tutorial), { width: PANEL_WIDTH, height: PANEL_HEIGHT }, 6)),
            },
          ]),
          donde,
        ).toEqual([])
        const mesa = subir(tablePoints(13))
        const tapados = whatThePanelHides(pose, medidas, eyesAt(ojos), [{ que: 'la mesa', puntos: mesa }])
        const cuantos = tapados.length === 0 ? 0 : Number(/en (\d+) de/.exec(tapados[0])![1])
        expect(cuantos / mesa.length, donde).toBeLessThan(0.15)
      }
    }
  })

  it('el control: en la columna, a 55°, nacía fuera de la mirada', () => {
    expect(gradosDelFrente(delEspacioDelJugador(XR_UI.panel))).toBeGreaterThan(GRADOS_DEL_MENU)
  })
})

describe('dónde se planta la columna: el final y el aviso de salir', () => {
  it('entera fuera de la mesa y lejos de donde anda el mazo, ni una esquina encima', () => {
    // Estaba a un metro y colgando sobre el tablero; ahora queda al lado de la mesa, y su borde
    // de abajo puede bajar de la altura del tablero sin tocarlo.
    const pose = { position: delEspacioDelJugador(XR_UI.panel), rotation: XR_UI_ROTATION.panel }
    const w = (MENU_PANEL.width * ESCALA_DE_LA_COLUMNA) / 2
    const h = (MENU_PANEL.height * ESCALA_DE_LA_COLUMNA) / 2
    for (const [u, v] of [[-w, -h], [w, -h], [-w, h], [w, h]]) {
      expect(pointOnPanel(pose, u, v).x, `esquina ${u}, ${v}`).toBeLessThan(-HALF_WIDTH - 0.3)
    }
  })

  it('la regla del salón: a 1,4–1,6 m de los ojos, entre 50° y 65° a la izquierda, a su altura', () => {
    const [x, y, z] = delEspacioDelJugador(XR_UI.panel)
    const ojos = eyesAt(REFERENCE_EYE_HEIGHT)
    const azimut = (Math.atan2(-x, -z) * 180) / Math.PI
    expect(distanciaDelJugador(XR_UI.panel)).toBeGreaterThanOrEqual(1.4)
    expect(distanciaDelJugador(XR_UI.panel)).toBeLessThanOrEqual(1.6)
    expect(azimut).toBeGreaterThanOrEqual(50)
    expect(azimut).toBeLessThanOrEqual(65)
    expect(COLUMNA.azimut).toBeCloseTo(azimut, 9)
    expect(y).toBeCloseTo(ojos.y, 9)
    // Fuera del rectángulo de la mesa, y lejos de donde anda el mazo.
    expect(x).toBeLessThan(-HALF_WIDTH - 0.4)
  })

  it('de cara a quien juega: girada hacia los ojos, no de frente a la mesa', () => {
    expect(XR_UI_ROTATION.panel).toEqual(panelRotation(delEspacioDelJugador(XR_UI.panel), eyesAt(REFERENCE_EYE_HEIGHT)))
    // Un giro de verdad: con la columna a 55° a la izquierda, el panel mira hacia la derecha.
    expect(Math.abs(XR_UI_ROTATION.panel[1])).toBeGreaterThan(0.8)
  })

  it('el botón que la abre está del mismo lado y en su sitio: se pulsa y se abre ahí', () => {
    expect(XR_QUIT).toEqual(XR_UI.panel)
    expect(XR_UI_ROTATION.quit).toEqual(XR_UI_ROTATION.panel)
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
  const MEDIDAS = { width: MENU_PANEL.width * ESCALA_DE_LA_COLUMNA, height: MENU_PANEL.height * ESCALA_DE_LA_COLUMNA }

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

  it('ni asomándose a un lado de la mesa o echándose atrás: se juega desde el extremo, no se rodea', () => {
    // En air hockey no se da la vuelta a la mesa —el mazo no pasa de medio campo—, pero sí se
    // mueve uno delante de su portería. Desde ahí tampoco puede caer la columna sobre la mesa.
    const pose = { position: delEspacioDelJugador(XR_UI.panel), rotation: XR_UI_ROTATION.panel }
    for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) {
      for (const z of [-0.1, 0.2, 0.5]) {
        for (const alto of EYE_HEIGHTS) {
          const ojos = { x, y: alto, z }
          expect(whatThePanelHides(pose, MEDIDAS, ojos, loQueHayDetras(0)), `ojos en ${x}, ${alto}, ${z}`).toEqual([])
        }
      }
    }
  })

  it('el control: centrado sobre la mesa y a la altura de los ojos, tapaba los tres', () => {
    // La demostración ya no está de frente —va a un lado del cartel (`sitioDelTutorial`)— y aun
    // así un menú centrado le pisaba el canto; cuando estaba de frente, la tapaba entera.
    const comoEstaba = delEspacioDelJugador([0, 0.62, 0.2])
    const ojos = eyesAt(REFERENCE_EYE_HEIGHT)
    expect(
      whatThePanelHides(
        { position: comoEstaba, rotation: panelRotation(comoEstaba, ojos) },
        { width: MENU_PANEL.width, height: MENU_PANEL.height },
        ojos,
        loQueHayDetras(0),
      ),
    ).toEqual([
      'el panel tapa la mesa en 116 de 196 puntos',
      'el panel tapa el marcador en 49 de 49 puntos',
      'el panel tapa la demostración del gesto en 10 de 49 puntos',
    ])
  })
})
