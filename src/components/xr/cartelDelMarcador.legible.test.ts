import { describe, expect, it } from 'vitest'
import {
  DRAW_DISTANCE,
  SIGN_PANEL,
  drawSign,
  signScale,
  signAspect,
} from './GoalSign'
import { SCOREBOARD_SIZE, filaDeLosGoles } from './XRHud'
import { LINE_HEIGHT } from './canvasPanel'
import { MIN_ANGLE, recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import { SITIO_DEL_CARTEL } from '../game/CartelDelMarcador'
import { XR_UI, delEspacioDelJugador, vistasDelPanel } from '../game/GameWorld'
import {
  MARCADOR_DEL_FONDO,
  NEONES_DEL_FONDO,
  conElAvisoDeQueCuenta,
  partidaDelCartel,
  sitioDelCartel,
  type LoQueSeJuega,
} from '../../lib/cartelDelMarcador'
import { TABLE_CENTER_Z } from '../../lib/gameConfig'
import { GAME_MODE_ORDER } from '../../lib/gameMode'
import { goalSign, type Goal, type GoalSignView } from '../../lib/goal'
import { hiddenByPanel, panelPoints, tablePoints, whatThePanelHides } from '../../lib/panelOcclusion'
import { EYE_HEIGHTS, eyesAt, letterAngle, pointOnPanel, type PanelPose, type Point } from '../../lib/panelReading'
import { traductorSuave } from '../../lib/textos'
import { REFERENCE_EYE_HEIGHT, uiRiseOverWorld, worldRise } from '../../lib/uiHeight'

/**
 * El cartel de encima del marcador, medido donde cuelga de verdad.
 *
 * `cartel.legible.test.ts` mide las frases comunes a todos los juegos; aquí van las del air hockey
 * —la misión del reto, la ronda con lo que vale el próximo gol, el nombre de cada modo— con los
 * listones de miles de este juego, y lo que solo se sabe con la mesa delante: cuántos grados ocupa
 * cada letra desde donde se juega, si queda dentro de lo que se ve sin girar la cabeza y si tapa
 * la mesa o el marcador.
 */

const IDIOMAS = ['en', 'es'] as const

/** Los listones del air hockey en el salón, con un récord de seis cifras. */
const OBJETIVO: Goal = {
  medals: { bronze: 1500, silver: 8000, gold: 20000 },
  better: 'higher',
  unit: 'points in the challenge',
  record: 104250,
  mode: 'challenge',
}

/** Las partidas que se miden: de la primera cuenta atrás a un reto de dos vueltas. */
const MOMENTOS: Partial<LoQueSeJuega>[] = [
  { gameState: 'countdown' },
  { gameState: 'playing' },
  { round: 2, points: 340, goles: 5, streak: 2 },
  { round: 5, points: 1650, goles: 20, streak: 4 },
  { round: 9, points: 9875, goles: 50, streak: 8 },
  { round: 12, points: 19850, goles: 70, streak: 11 },
  { round: 15, points: 31200, goles: 90, streak: 12 },
  { round: 28, points: 123450, goles: 180, streak: 12 },
  { gameState: 'finished', round: 1, points: 0, goles: 3 },
  { gameState: 'finished', round: 4, points: 1650, goles: 20 },
  { gameState: 'finished', round: 10, points: 12340, goles: 60 },
  { gameState: 'finished', round: 16, points: 31200, goles: 95 },
  { gameState: 'finished', round: 30, points: 123450, goles: 190 },
]

/** Todo lo que el cartel llega a decir en este juego, en ese idioma. */
function vistas(lang: (typeof IDIOMAS)[number]): GoalSignView[] {
  const t = traductorSuave(lang)
  const todas: GoalSignView[] = []
  const base: LoQueSeJuega = { gameMode: 'challenge', gameState: 'playing', round: 1, goles: 0, points: 0, streak: 0, record: 104250 }
  for (const objetivo of [OBJETIVO, { ...OBJETIVO, record: null }, null]) {
    for (const momento of MOMENTOS) {
      todas.push(goalSign(partidaDelCartel({ ...base, objetivo, ...momento }, t)!, t))
    }
  }
  // Al cerrar el tutorial, el aviso de que ya cuenta, con lo que diga debajo en la cuenta atrás.
  for (const objetivo of [OBJETIVO, null]) {
    const vista = goalSign(partidaDelCartel({ ...base, objetivo, gameState: 'countdown' }, t)!, t)
    todas.push(conElAvisoDeQueCuenta(vista, 'challenge', true, t)!)
  }
  for (const gameMode of GAME_MODE_ORDER) {
    if (gameMode === 'challenge') continue
    todas.push(goalSign(partidaDelCartel({ ...base, objetivo: OBJETIVO, gameMode }, t)!, t))
  }
  return todas
}

function medir(vista: GoalSignView): DrawnText[] {
  const { ctx, drawnTexts: escritos } = recordingCanvas()
  drawSign(ctx, vista)
  return escritos
}

/** Lo escrito, llevado al tamaño al que cuelga: el cartel se agranda con la distancia. */
function colgados(escritos: readonly DrawnText[]): DrawnText[] {
  const k = signScale(SITIO_DEL_CARTEL.distancia)
  return escritos.map((e) => ({ ...e, x: e.x * k, y: e.y * k, width: e.width * k, height: e.height * k }))
}

/** Desde dónde se lee: a tres alturas de ojos, con el mundo de pie o a la altura de ellos. */
const VISTAS = vistasDelPanel(SITIO_DEL_CARTEL.position, SITIO_DEL_CARTEL.rotation)

/** Los grados que ocupa cada letra del cartel colgado, vista desde esos ojos. */
function grados(escritos: readonly DrawnText[], pose: PanelPose, ojos: Point): number[] {
  return colgados(escritos).map((e) => letterAngle(pose, ojos, e.x, e.y, e.height / LINE_HEIGHT))
}

/** Lo que mide el cartel donde cuelga, en metros. */
const MEDIDAS = {
  width: signAspect().width * SITIO_DEL_CARTEL.distancia,
  height: signAspect().height * SITIO_DEL_CARTEL.distancia,
}

describe('el cartel de encima del marcador se lee', () => {
  it('todo lo que dice cabe y no se pisa, en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      for (const vista of vistas(lang)) {
        const escritos = medir(vista)
        expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
        expect(
          legibilityProblems(escritos, { panel: SIGN_PANEL, distance: DRAW_DISTANCE }),
          `${lang}: ${vista.title} / ${vista.detail}`,
        ).toEqual([])
      }
    }
  })

  it('desde donde se juega, a cualquier altura de ojos, cada letra pasa de lo que se lee', () => {
    for (const lang of IDIOMAS) {
      for (const vista of vistas(lang)) {
        const escritos = medir(vista)
        for (const { donde, pose, ojos } of VISTAS) {
          grados(escritos, pose, ojos).forEach((angulo, i) => {
            expect(angulo, `${lang}: «${escritos[i].text}», ${donde}`).toBeGreaterThan(MIN_ANGLE)
          })
        }
      }
    }
  })

  it('la misión se lee de un vistazo en la cuenta atrás: más de 1,2° en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      const t = traductorSuave(lang)
      const partida = partidaDelCartel(
        { objetivo: OBJETIVO, gameMode: 'challenge', gameState: 'countdown', round: 1, goles: 0, points: 0, streak: 0, record: 0 },
        t,
      )
      const escritos = medir(goalSign(partida!, t))
      const [mision] = grados(escritos, VISTAS[2].pose, VISTAS[2].ojos)

      expect(escritos[0].text).toBe(lang === 'es' ? 'Gana partidos hasta perder uno' : 'Win games until you lose one')
      expect(mision, lang).toBeGreaterThan(1.2)
    }
  })

  it('lo que se mira mientras se juega —el listón y lo que queda— pasa de un grado camino del oro', () => {
    for (const lang of IDIOMAS) {
      const t = traductorSuave(lang)
      for (const momento of MOMENTOS.filter((m) => m.gameState == null)) {
        const partida = partidaDelCartel(
          { objetivo: OBJETIVO, gameMode: 'challenge', gameState: 'playing', round: 1, goles: 0, points: 0, streak: 0, record: 0, ...momento },
          t,
        )
        const escritos = medir(goalSign(partida!, t))
        // Con el oro en la mano la frase común pasa a llevar el récord y lo que se lleva, dos
        // cifras de seis: es la más larga que el cartel llega a decir y la que más encoge.
        // Con los miles separados y desde los ojos más bajos se queda en 0,84° («Gold · your record
        // 104,250 · you have 31,200»), por encima del mínimo (0,75°); antes del oro («Silver at
        // 8,000 · you have 1,650»), en 1,16°.
        const conElOro = (momento.points ?? 0) >= OBJETIVO.medals.gold
        for (const { donde, pose, ojos } of VISTAS) {
          const [liston, queda] = grados(escritos, pose, ojos)
          expect(liston, `${lang}: «${escritos[0].text}», ${donde}`).toBeGreaterThan(conElOro ? 0.8 : 1.15)
          expect(queda, `${lang}: «${escritos[1].text}», ${donde}`).toBeGreaterThan(1)
        }
      }
    }
    // Y con lo de casi toda la partida —cuatro cifras—, a su tamaño entero.
    const t = traductorSuave('es')
    const partida = partidaDelCartel(
      { objetivo: OBJETIVO, gameMode: 'challenge', gameState: 'playing', round: 5, goles: 20, points: 1650, streak: 4, record: 0 },
      t,
    )
    const escritos = medir(goalSign(partida!, t))
    expect(escritos.map((e) => e.text)).toEqual(['Plata a 8000 · llevas 1650', 'Ronda 5 · a 5 goles · gol +270'])
    const [liston, queda] = grados(escritos, VISTAS[2].pose, VISTAS[2].ojos)
    // Cuatro cifras en español van sin punto, como en la chapa del salón: la línea no encoge de su 1,4°.
    expect(liston).toBeGreaterThan(1.39)
    expect(queda).toBeGreaterThan(1.15)
  })
})

describe('dónde queda el cartel para quien juega', () => {
  /** Hacia dónde cae un punto visto desde esos ojos: a un lado y hacia arriba, en grados. */
  function direccion(punto: Point, ojos: Point): { azimut: number; elevacion: number } {
    const suelo = Math.hypot(punto.x - ojos.x, punto.z - ojos.z)
    return {
      azimut: (Math.atan2(punto.x - ojos.x, -(punto.z - ojos.z)) * 180) / Math.PI,
      elevacion: (Math.atan2(punto.y - ojos.y, suelo) * 180) / Math.PI,
    }
  }

  /** Las cuatro esquinas del cartel colgado. */
  function esquinas(pose: PanelPose): Point[] {
    return [-1, 1].flatMap((x) => [-1, 1].map((y) => pointOnPanel(pose, (x * MEDIDAS.width) / 2, (y * MEDIDAS.height) / 2)))
  }

  it('cuelga con las medidas del cartel de verdad, encima del marcador', () => {
    expect(SITIO_DEL_CARTEL).toEqual(sitioDelCartel(signAspect()))
    expect(XR_UI.scoreboard).toBe(MARCADOR_DEL_FONDO.centro)
    expect(SCOREBOARD_SIZE).toEqual({ width: MARCADOR_DEL_FONDO.ancho, height: MARCADOR_DEL_FONDO.alto })
    // Por encima del marcador entero, y sin pasar de un metro de ancho.
    const techo = delEspacioDelJugador(XR_UI.scoreboard)[1] + SCOREBOARD_SIZE.height / 2
    const pose = { position: delEspacioDelJugador(SITIO_DEL_CARTEL.position), rotation: SITIO_DEL_CARTEL.rotation }
    for (const esquina of esquinas(pose)) expect(esquina.y).toBeGreaterThan(techo)
    expect(MEDIDAS.width).toBeLessThan(1)
  })

  it('se ve sin girar ni levantar la cabeza: de frente, a la altura de la vista, a cualquier estatura', () => {
    for (const { donde, pose, ojos } of VISTAS) {
      for (const esquina of esquinas(pose)) {
        const { azimut, elevacion } = direccion(esquina, ojos)
        expect(Math.abs(azimut), donde).toBeLessThan(13)
        expect(elevacion, donde).toBeGreaterThan(-1)
        expect(elevacion, donde).toBeLessThan(6)
      }
    }
  })

  /** Cada vista con lo que se ha movido el mundo bajo la interfaz, que no sube con ella. */
  const VISTAS_CON_MUNDO = EYE_HEIGHTS.flatMap((alto) =>
    [false, true].map((aLaAlturaDeLosOjos) => {
      const mundo = worldRise(alto, aLaAlturaDeLosOjos)
      const sube = mundo + uiRiseOverWorld(alto, aLaAlturaDeLosOjos)
      const [x, y, z] = delEspacioDelJugador(SITIO_DEL_CARTEL.position)
      return {
        donde: `ojos a ${alto} m${aLaAlturaDeLosOjos ? ', mundo a su altura' : ''}`,
        pose: { position: [x, y + sube, z] as const, rotation: SITIO_DEL_CARTEL.rotation },
        ojos: eyesAt(alto),
        mundo,
        sube,
      }
    }),
  )

  /** Lo que no puede tapar: la mesa entera —el disco y las dos porterías— y el marcador. */
  function loQueHayDetras(mundo: number, sube: number) {
    const marcador = delEspacioDelJugador(XR_UI.scoreboard)
    return [
      { que: 'la mesa', puntos: tablePoints(13).map((p) => ({ ...p, y: p.y + mundo })) },
      // El disco y los mazos levantan un palmo del tablero.
      { que: 'el disco y los mazos', puntos: tablePoints(13).map((p) => ({ ...p, y: p.y + mundo + 0.12 })) },
      { que: 'el marcador', puntos: panelPoints([marcador[0], marcador[1] + sube, marcador[2]], SCOREBOARD_SIZE, 6) },
    ]
  }

  it('no tapa la mesa, ni el disco, ni la portería de la máquina, ni el marcador, desde ninguna altura', () => {
    for (const { donde, pose, ojos, mundo, sube } of VISTAS_CON_MUNDO) {
      expect(whatThePanelHides(pose, MEDIDAS, ojos, loQueHayDetras(mundo, sube)), donde).toEqual([])
    }
  })

  it('ni moviéndose delante de su portería, que es por donde anda quien juega', () => {
    const pose = { position: delEspacioDelJugador(SITIO_DEL_CARTEL.position), rotation: SITIO_DEL_CARTEL.rotation }
    for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) {
      for (const z of [-0.1, 0.2, 0.5]) {
        const ojos = { x, y: REFERENCE_EYE_HEIGHT, z }
        expect(whatThePanelHides(pose, MEDIDAS, ojos, loQueHayDetras(0, 0)), `ojos en ${x}, ${z}`).toEqual([])
      }
    }
  })

  it('y el marcador no lo tapa a él: queda entero por encima', () => {
    const marcador = delEspacioDelJugador(XR_UI.scoreboard)
    for (const { donde, pose, ojos, sube } of VISTAS_CON_MUNDO) {
      const delante = {
        position: [marcador[0], marcador[1] + sube, marcador[2]] as const,
        rotation: [MARCADOR_DEL_FONDO.inclinacion, 0, 0] as const,
      }
      const tapados = panelPoints(pose.position, MEDIDAS, 8).filter((punto) => hiddenByPanel(delante, SCOREBOARD_SIZE, ojos, punto))
      expect(tapados, donde).toEqual([])
    }
  })

  it('el control: a la altura del marcador y delante de él, lo tapaba', () => {
    const marcador = delEspacioDelJugador(XR_UI.scoreboard)
    const delante = { position: [marcador[0], marcador[1], marcador[2] + 0.3] as const }
    expect(
      whatThePanelHides(delante, MEDIDAS, eyesAt(REFERENCE_EYE_HEIGHT), loQueHayDetras(0, 0)).some((frase) => frase.includes('el marcador')),
    ).toBe(true)
  })
})

describe('las tiras de neón de la pared del fondo, detrás del cartel', () => {
  /** La pared del fondo de la sala (`ROOM_DEPTH` de `Room.tsx`, diez metros centrados en la mesa). */
  const PARED = TABLE_CENTER_Z - 10 / 2 + 0.03

  /** Las dos tiras, punto a punto, con lo que se haya movido el mundo: la sala no sube con la interfaz. */
  function tiras(mundo: number, baja = 0): Point[] {
    return NEONES_DEL_FONDO.tiras.flatMap((tira) =>
      panelPoints([0, tira.y - baja + mundo, PARED], { width: tira.ancho, height: NEONES_DEL_FONDO.grueso }, 40),
    )
  }

  /** Los ojos de referencia de la tanda (1,4–1,9 m), de pie y con el mundo a su altura. */
  const OJOS = [1.4, 1.5, 1.6, 1.7, 1.8, 1.9].flatMap((alto) =>
    [false, true].map((aLaAlturaDeLosOjos) => {
      const mundo = worldRise(alto, aLaAlturaDeLosOjos)
      const [x, y, z] = delEspacioDelJugador(SITIO_DEL_CARTEL.position)
      return {
        donde: `ojos a ${alto} m${aLaAlturaDeLosOjos ? ', mundo a su altura' : ''}`,
        pose: { position: [x, y + mundo + uiRiseOverWorld(alto, aLaAlturaDeLosOjos), z] as const, rotation: SITIO_DEL_CARTEL.rotation },
        ojos: eyesAt(alto),
        mundo,
      }
    }),
  )

  it('el cartel no las pisa desde ninguna altura de ojos: quedan por encima', () => {
    for (const { donde, pose, ojos, mundo } of OJOS) {
      expect(tiras(mundo).filter((punto) => hiddenByPanel(pose, MEDIDAS, ojos, punto)), donde).toEqual([])
    }
  })

  it('con 0,4° de aire en el peor caso: de pie y con los ojos a 1,9 m', () => {
    const elevacion = (y: number, z: number, ojos: Point) => (Math.atan2(y - ojos.y, -(z - ojos.z)) * 180) / Math.PI
    const aires = OJOS.map(({ pose, ojos, mundo }) => {
      const techo = pointOnPanel(pose, 0, MEDIDAS.height / 2)
      const tira = Math.min(...NEONES_DEL_FONDO.tiras.map((t) => t.y)) - NEONES_DEL_FONDO.grueso / 2 + mundo
      return elevacion(tira, PARED, ojos) - elevacion(techo.y, techo.z, ojos)
    })
    expect(Math.min(...aires)).toBeGreaterThan(0.35)
    expect(aires.indexOf(Math.min(...aires))).toBe(OJOS.findIndex((o) => o.donde === 'ojos a 1.9 m'))
  })

  it('el control: quince centímetros más abajo, donde estaban, a 1,9 m la de abajo quedaba detrás', () => {
    const { pose, ojos, mundo } = OJOS.find((o) => o.donde === 'ojos a 1.9 m')!
    expect(tiras(mundo, 0.15).filter((punto) => hiddenByPanel(pose, MEDIDAS, ojos, punto)).length).toBeGreaterThan(0)
    // Y desde 1,6 m no: por eso no se vio al colocarlo.
    const referencia = OJOS.find((o) => o.donde === 'ojos a 1.6 m')!
    expect(tiras(0, 0.15).filter((punto) => hiddenByPanel(referencia.pose, MEDIDAS, referencia.ojos, punto))).toEqual([])
  })
})

describe('el marcador, con el cartel encima', () => {
  it('los goles van en su fila, y en medio cuando el cartel ya dice los puntos y la ronda', () => {
    expect(filaDeLosGoles({ puntos: false, ronda: false })).toBeGreaterThan(0)
    expect(filaDeLosGoles({ puntos: true, ronda: true })).toBe(0)
    // Al acabar vuelve la ronda, y los goles a su fila de arriba para dejarle sitio.
    expect(filaDeLosGoles({ puntos: true, ronda: false })).toBe(filaDeLosGoles({ puntos: false, ronda: false }))
  })
})
