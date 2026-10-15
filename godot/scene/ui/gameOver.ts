/**
 * The end of the match in Godot: the web's `XRGameOver` (`components/xr/XRHud.tsx`), in the column,
 * where the menu was.
 *
 * A band in the colour of how it ended (the hall's green for a hit or red for a miss), the points
 * in large —in gold if they are a record— and, in the levels, the stars earned. Below, **again** in
 * large, back to the menu and exit: playing again is what is done most, so it is the wide button,
 * and menu and exit carry different icons because they are different things.
 *
 * **What is added with respect to the web**: the band has written on it how it ended («Partida
 * ganada», «Nivel 3 superado»…). On the web it carries nothing because its canvas did not write on
 * that panel; here the font is the engine's, and we measure it with the same instrument as the rest.
 *
 * **In the duel there is no band and no points: it is written** (the web's `drawDuel`, with its
 * dimensions and its font sizes): after the first player's match, how it went and whom to pass the
 * controller to —the wide button starts the other's—; with both played, who wins, by how much and
 * how many duels the pair has.
 */
import { Node3D, Vector3 } from 'godot'

import type { Point2 } from '@kit/lib/ui/exit'
import { Button } from '@kit/runtime/ui/button'
import { exitButton, playIcon } from '@kit/runtime/ui/icons'
import { shape, paint, plate } from '@kit/runtime/ui/mesh'
import { Panel } from '@kit/runtime/ui/panel'
import type { PointerAim } from '@kit/runtime/ui/pointerAim'

import type { Lang } from '@/lib/settings'
import type { RunOutcome } from '@/lib/gameMode'
import type { Stars } from '@/lib/levels'
import { COMMON_PALETTE } from '@/lib/commonPalette'
import { PALETTE } from '@/lib/palette'
import { translator } from '@/lib/textos'

import { PLAYER_LABELS, formatMargin, margin, type Player } from '@/lib/duel'
import type { DuelTally } from '@/lib/duelTally'

import { Digits } from './digits'
import { DIM, diamondTriangles } from './menu'
import type { DuelView } from './match'
import { GAME_OVER_BOXES, GAME_OVER_DIGIT, GAME_OVER_SIZE } from './layout'

/** The font of the band: that of the menu's labels, which is already measured at this distance. */
export const GAME_OVER_TEXT = 0.034

/** The font sizes of the end of the duel: the web's (`DUEL_TEXT` of `XRHud.tsx`). */
export const DUEL_TEXT = { title: 0.05, body: 0.034 } as const

/** What the end shows. */
export interface GameOverState {
  lang: Lang
  outcome: RunOutcome
  points: number
  isRecord: boolean
  /** In the levels: which one and with how many stars. */
  level: { level: number; stars: Stars; passed: boolean } | null
  /** In the duel: how it is going, the score of the match and what the pair has. */
  duel: { view: DuelView; score: { scored: number; conceded: number }; tally: DuelTally } | null
}

/** Three stripes: the icon of going back to the menu (`XRMenuIcon`). */
export function menuIconTriangles(side = 0.05): Point2[] {
  const points: Point2[] = []
  for (const row of [-1, 0, 1]) {
    const y = row * side * 0.32
    const height = side * 0.16
    points.push(
      [-side / 2, y - height / 2], [side / 2, y - height / 2], [side / 2, y + height / 2],
      [-side / 2, y - height / 2], [side / 2, y + height / 2], [-side / 2, y + height / 2],
    )
  }
  return points
}

export class GameOverPanel {
  readonly panel: Panel
  readonly node: Node3D
  readonly again: Button
  readonly menu: Button
  readonly exit: Button
  readonly points = new Digits(GAME_OVER_DIGIT, PALETTE.foreground)
  private readonly band = plate(0.5, 0.06, COMMON_PALETTE.hit, 1)
  private readonly stars: ReturnType<typeof shape>[] = []
  private painted = ''

  constructor(actions: { again(): void; menu(): void; exit(): void }, aim: PointerAim) {
    this.panel = new Panel({ ancho: GAME_OVER_SIZE.width, alto: GAME_OVER_SIZE.height, fondo: PALETTE.background, opacidad: 0.86 })
    this.node = this.panel.nodo
    this.band.position = new Vector3(0, 0.13, -0.01)
    this.node.add_child(this.band)
    this.points.node.position = new Vector3(0, 0.02, 0.004)
    this.node.add_child(this.points.node)
    for (let i = 0; i < 3; i++) {
      const diamond = shape(diamondTriangles(0.022), DIM)
      diamond.position = new Vector3((i - 1) * 0.045, -0.055, 0.004)
      this.node.add_child(diamond)
      this.stars.push(diamond)
    }
    this.again = this.panel.boton(new Button({ id: 'final:again', caja: GAME_OVER_BOXES.again, color: PALETTE.primary, alPulsar: () => actions.again() }))
    this.again.dibujo(playIcon(0.045, PALETTE.primaryInk), PALETTE.primaryInk)
    this.menu = this.panel.boton(new Button({ id: 'final:menu', caja: GAME_OVER_BOXES.menu, color: PALETTE.rail, opacidad: 0.8, alPulsar: () => actions.menu() }))
    this.menu.dibujo(shape(menuIconTriangles(), DIM), DIM)
    this.exit = this.panel.boton(
      exitButton({ id: 'final:exit', caja: GAME_OVER_BOXES.exit, color: PALETTE.rail, opacidad: 0.8, flecha: PALETTE.foreground, alPulsar: () => actions.exit() }),
    )
    aim.anadir(this.again, this.menu, this.exit)
    this.node.visible = false
  }

  paint(state: GameOverState): void {
    const key = JSON.stringify(state)
    if (key === this.painted) return
    this.painted = key
    const t = translator(state.lang)
    const duel = state.duel
    this.band.visible = duel == null
    this.points.node.visible = duel == null
    const won = state.outcome === 'won'
    const bandColor = won ? COMMON_PALETTE.hit : COMMON_PALETTE.miss
    paint(this.band, bandColor)
    this.points.paint(state.points, state.isRecord ? COMMON_PALETTE.gold : PALETTE.foreground)
    for (const [i, diamond] of this.stars.entries()) {
      diamond.visible = state.level != null
      const earned = i < (state.level?.stars ?? 0)
      paint(diamond, earned ? COMMON_PALETTE.gold : DIM, earned ? 1 : 0.35)
    }
    const title =
      state.level != null
        ? t(state.level.passed ? 'Level {level} cleared' : 'Level {level} not cleared', { level: state.level.level })
        : state.isRecord
          ? t('New record!')
          : t(won ? 'Game won' : 'Game lost')
    this.panel.borrarTextos()
    if (duel != null) {
      this.writeDuel(state.lang, duel)
      return
    }
    this.panel.escribir(title, 0, 0.13, { alto: GAME_OVER_TEXT, color: PALETTE.background, anchoMax: 0.46 })
  }

  /** What is written when a match of the duel ends (the web's `drawDuel`). */
  private writeDuel(lang: Lang, { view, score, tally }: NonNullable<GameOverState['duel']>): void {
    const t = translator(lang)
    const { panel } = this
    const name = (player: Player) => t(PLAYER_LABELS[player])
    const width = GAME_OVER_SIZE.width - 0.08
    const title = view.over
      ? view.winner != null
        ? t('{player} wins', { player: name(view.winner) })
        : t('Tie')
      : t('{player}: {scored}–{conceded}', { player: name(view.player), ...score })
    panel.escribir(title, 0, 0.15, { alto: DUEL_TEXT.title, color: PALETTE.foreground, anchoMax: width })
    if (view.next != null) {
      panel.parrafo(t('Pass the controller to {player}.', { player: name(view.next) }), 0, 0.05, {
        alto: DUEL_TEXT.body,
        color: PALETTE.foreground,
        anchoMax: width,
      })
      return
    }
    for (const player of [0, 1] as const) {
      const match = view.matches[player]
      if (match == null) continue
      panel.escribir(
        t('{player}: {scored}–{conceded} ({margin})', {
          player: name(player),
          scored: match.scored,
          conceded: match.conceded,
          margin: formatMargin(margin(match)),
        }),
        0,
        0.09 - player * 0.05,
        { alto: DUEL_TEXT.body, color: view.winner === player ? PALETTE.primary : DIM, anchoMax: width },
      )
    }
    panel.parrafo(t('Duels won: {one}–{two} · tied: {ties}', { one: tally.wins[0], two: tally.wins[1], ties: tally.ties }), 0, 0.015, {
      alto: DUEL_TEXT.body,
      color: DIM,
      anchoMax: width,
      ancla: 'top',
    })
  }
}
