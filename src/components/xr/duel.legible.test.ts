import { describe, expect, it } from 'vitest'
import type { DuelView } from '../../lib/gameStore'
import {
  MIN_READING_DEGREES,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
} from '../../lib/panelReading'
import { translator } from '../../lib/textos'
import { COLUMN_SCALE, XR_UI, XR_UI_ROTATION, atColumnScale, panelViews } from '../game/GameWorld'
import { DUEL_TEXT, GAME_OVER_BOXES, GAME_OVER_SIZE, drawDuel } from './XRHud'
import { LINE_HEIGHT } from './canvasPanel'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'

/**
 * El final de una partida del duelo, medido en vez de mirado.
 *
 * Es texto dentro del visor, que es donde un renglón que se sale o dos que se pisan solo se
 * descubren con las gafas puestas. Se mide en los dos idiomas y en los dos momentos del duelo: el
 * traspaso —a quién pasarle el mando— y el final, con ganador y con empate. Y **desde donde se
 * juega**: en la columna (`XR_UI.panel`), a su escala, girado como ella y a tres alturas de ojos.
 */

const IDIOMAS = ['en', 'es'] as const
const VISTAS = panelViews(XR_UI.panel, XR_UI_ROTATION.panel)

const TRASPASO: DuelView = {
  player: 0,
  matches: [{ scored: 7, conceded: 5 }, null],
  next: 1,
  over: false,
  winner: null,
}

const GANADO: DuelView = {
  player: 1,
  matches: [
    { scored: 7, conceded: 5 },
    { scored: 7, conceded: 2 },
  ],
  next: null,
  over: true,
  winner: 1,
}

const EMPATE: DuelView = { ...GANADO, matches: [{ scored: 7, conceded: 5 }, { scored: 4, conceded: 2 }], winner: null }

/** Una pareja que lleva muchos: las cifras más anchas que va a ver nadie. */
const MUCHOS = { wins: [123, 99] as const, ties: 42 }

/** Lo que escribe el final del duelo en cada momento y en los dos idiomas, sin escalar. */
function todosLosFinales(): { donde: string; escritos: DrawnText[] }[] {
  const finales: { donde: string; escritos: DrawnText[] }[] = []
  for (const lang of IDIOMAS) {
    for (const [nombre, duelo] of [
      ['traspaso', TRASPASO],
      ['ganado', GANADO],
      ['empate', EMPATE],
    ] as const) {
      const { ctx, drawnTexts: escritos } = recordingCanvas()
      drawDuel(ctx, translator(lang), duelo, { scored: 7, conceded: 5 }, MUCHOS)
      finales.push({ donde: `${lang} ${nombre}`, escritos })
    }
  }
  return finales
}

describe('el final de una partida del duelo', () => {
  it('se lee en los dos idiomas, en el traspaso y al final', () => {
    const panel = { width: GAME_OVER_SIZE[0] * COLUMN_SCALE, height: GAME_OVER_SIZE[1] * COLUMN_SCALE }
    for (const { donde, escritos } of todosLosFinales()) {
      expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
      const escalados = atColumnScale(escritos)
      const distancia = Math.max(...VISTAS.map(({ pose, eyes: ojos }) => worstReadingDistance(escalados, pose, ojos, LINE_HEIGHT)))
      expect(legibilityProblems(escalados, { panel, distance: distancia }), donde).toEqual([])
    }
  })

  it('en el traspaso dice a quién le toca, y al final quién gana', () => {
    const t = translator('es')

    const traspaso = recordingCanvas()
    drawDuel(traspaso.ctx, t, TRASPASO, { scored: 7, conceded: 5 }, MUCHOS)
    const dichoEnElTraspaso = traspaso.drawnTexts.map((e) => e.text).join(' ')
    expect(dichoEnElTraspaso).toContain('Jugador 1: 7–5')
    expect(dichoEnElTraspaso).toContain('Pásale el mando a Jugador 2.')

    const final = recordingCanvas()
    drawDuel(final.ctx, t, GANADO, { scored: 7, conceded: 2 }, MUCHOS)
    const dicho = final.drawnTexts.map((e) => e.text).join(' ')
    expect(dicho).toContain('Gana Jugador 2')
    expect(dicho).toContain('Jugador 1: 7–5 (+2)')
    expect(dicho).toContain('Jugador 2: 7–2 (+5)')

    const empate = recordingCanvas()
    drawDuel(empate.ctx, t, EMPATE, { scored: 4, conceded: 2 }, MUCHOS)
    expect(empate.drawnTexts.map((e) => e.text).join(' ')).toContain('Empate')
  })
})

describe('cada letra del final del duelo se lee de un vistazo', () => {
  it(`ninguna baja de ${MIN_READING_DEGREES}°, en ningún momento ni altura de ojos`, () => {
    for (const { donde, escritos } of todosLosFinales()) {
      for (const vista of VISTAS) {
        expect(
          unreadableTexts(atColumnScale(escritos), vista.pose, vista.eyes, LINE_HEIGHT),
          `${donde}, ${vista.where}`,
        ).toEqual([])
      }
    }
  })

  it('y todas se escriben con un tamaño de la lista, sin encogerse', () => {
    for (const { donde, escritos } of todosLosFinales()) {
      expect(sizesOffList(escritos, LINE_HEIGHT, Object.values(DUEL_TEXT)), donde).toEqual([])
    }
  })

  it('y ningún renglón se mete en los botones de abajo', () => {
    const botones = Object.values(GAME_OVER_BOXES).map(({ position, size }) => ({
      x: position[0],
      y: position[1],
      width: size[0],
      height: size[1],
    }))
    for (const { donde, escritos } of todosLosFinales()) {
      expect(textsOnButtons(escritos, botones), donde).toEqual([])
    }
  })
})
