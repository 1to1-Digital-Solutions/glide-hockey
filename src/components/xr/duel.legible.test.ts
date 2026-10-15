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
 * The end of a match of the duel, measured instead of looked at.
 *
 * It is text inside the headset, which is where a line that runs off or two that overlap are only
 * discovered with the goggles on. It is measured in both languages and at both moments of the
 * duel: the handover —who to pass the controller to— and the end, with a winner and with a tie.
 * And **from where the game is played**: on the column (`XR_UI.panel`), at its scale, rotated
 * like it and at three eye heights.
 */

const LANGUAGES = ['en', 'es'] as const
const VIEWS = panelViews(XR_UI.panel, XR_UI_ROTATION.panel)

const HANDOVER: DuelView = {
  player: 0,
  matches: [{ scored: 7, conceded: 5 }, null],
  next: 1,
  over: false,
  winner: null,
}

const WON: DuelView = {
  player: 1,
  matches: [
    { scored: 7, conceded: 5 },
    { scored: 7, conceded: 2 },
  ],
  next: null,
  over: true,
  winner: 1,
}

const TIE: DuelView = { ...WON, matches: [{ scored: 7, conceded: 5 }, { scored: 4, conceded: 2 }], winner: null }

/** A pair with many played: the widest figures anyone is going to see. */
const MANY = { wins: [123, 99] as const, ties: 42 }

/** What the end of the duel writes at each moment and in both languages, unscaled. */
function allEndings(): { where: string; texts: DrawnText[] }[] {
  const endings: { where: string; texts: DrawnText[] }[] = []
  for (const lang of LANGUAGES) {
    for (const [name, duel] of [
      ['handover', HANDOVER],
      ['won', WON],
      ['tie', TIE],
    ] as const) {
      const { ctx, drawnTexts: texts } = recordingCanvas()
      drawDuel(ctx, translator(lang), duel, { scored: 7, conceded: 5 }, MANY)
      endings.push({ where: `${lang} ${name}`, texts })
    }
  }
  return endings
}

describe('the end of a match of the duel', () => {
  it('reads in both languages, at the handover and at the end', () => {
    const panel = { width: GAME_OVER_SIZE[0] * COLUMN_SCALE, height: GAME_OVER_SIZE[1] * COLUMN_SCALE }
    for (const { where, texts } of allEndings()) {
      expect(texts.length, 'nothing was measured').toBeGreaterThan(0)
      const scaled = atColumnScale(texts)
      const readingDistance = Math.max(...VIEWS.map(({ pose, eyes: eyePoint }) => worstReadingDistance(scaled, pose, eyePoint, LINE_HEIGHT)))
      expect(legibilityProblems(scaled, { panel, distance: readingDistance }), where).toEqual([])
    }
  })

  it('at the handover it says whose turn it is, and at the end who wins', () => {
    const t = translator('es')

    const handover = recordingCanvas()
    drawDuel(handover.ctx, t, HANDOVER, { scored: 7, conceded: 5 }, MANY)
    const saidAtHandover = handover.drawnTexts.map((e) => e.text).join(' ')
    expect(saidAtHandover).toContain('Jugador 1: 7–5')
    expect(saidAtHandover).toContain('Pásale el mando a Jugador 2.')

    const ending = recordingCanvas()
    drawDuel(ending.ctx, t, WON, { scored: 7, conceded: 2 }, MANY)
    const said = ending.drawnTexts.map((e) => e.text).join(' ')
    expect(said).toContain('Gana Jugador 2')
    expect(said).toContain('Jugador 1: 7–5 (+2)')
    expect(said).toContain('Jugador 2: 7–2 (+5)')

    const tie = recordingCanvas()
    drawDuel(tie.ctx, t, TIE, { scored: 4, conceded: 2 }, MANY)
    expect(tie.drawnTexts.map((e) => e.text).join(' ')).toContain('Empate')
  })
})

describe('every letter of the end of the duel reads at a glance', () => {
  it(`none drops below ${MIN_READING_DEGREES}°, at any moment or eye height`, () => {
    for (const { where, texts } of allEndings()) {
      for (const view of VIEWS) {
        expect(
          unreadableTexts(atColumnScale(texts), view.pose, view.eyes, LINE_HEIGHT),
          `${where}, ${view.where}`,
        ).toEqual([])
      }
    }
  })

  it('and all of them are written at a size from the list, without shrinking', () => {
    for (const { where, texts } of allEndings()) {
      expect(sizesOffList(texts, LINE_HEIGHT, Object.values(DUEL_TEXT)), where).toEqual([])
    }
  })

  it('and no line gets into the buttons below', () => {
    const buttons = Object.values(GAME_OVER_BOXES).map(({ position, size }) => ({
      x: position[0],
      y: position[1],
      width: size[0],
      height: size[1],
    }))
    for (const { where, texts } of allEndings()) {
      expect(textsOnButtons(texts, buttons), where).toEqual([])
    }
  })
})
