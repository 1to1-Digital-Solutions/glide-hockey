/**
 * The scoreboard and the countdown of Glide Hockey in Godot: the web's `XRScoreboard` and
 * `XRCountdown` (`components/xr/XRHud.tsx`), with their measures.
 *
 * **The scoreboard goes at the back, over the machine's goal**: it is where one looks while
 * playing, so it is read without taking the eyes off the puck. Three rows: each one's goals in
 * their colour (the player's cyan, the machine's red), the points in the puck's orange and, in the
 * challenge, the round —in the levels, the level—. **Minus what the sign above it already says**
 * (`sign.ts`): in the challenge the points and the round are read there, in letters, and here the
 * goals are left, in the middle. Past the first lap of the challenge's ladder there is also a cross
 * and the lap number, in the colour of the points: what it says is that **what is scored now is
 * worth more**.
 *
 * **The countdown floats over the serve spot**, and in its last second, if the mallet is not in
 * the hand, it stops and says why (`waitingForMallet`): without that, from inside the headset it
 * looked as if the game had hung on the 1.
 */
import { Node3D, Vector3 } from 'godot'

import type { Point2 } from '@kit/lib/ui/exit'
import { shape } from '@kit/runtime/ui/mesh'
import { Panel } from '@kit/runtime/ui/panel'

import type { Lang } from '@/lib/settings'
import { PALETTE } from '@/lib/palette'
import { translator, type TextKey } from '@/lib/textos'

import { Digits } from './digits'
import { DIM } from './menu'
import { MALLET_NOTICE, SCOREBOARD_DIGITS, COUNTDOWN_DIGIT, SCOREBOARD_ROWS, MALLET_TEXT, SCOREBOARD_SIZE } from './layout'

/** What the scoreboard tells. */
export interface ScoreboardState {
  player: number
  opponent: number
  /** The points, or `null` if the sign above already says them. */
  points: number | null
  /** The round of the challenge, the level or the player of the duel who has the controller; `null` in practice. */
  rowNumber: number | null
  /** The lap of the challenge's ladder, only past the first. */
  lap: number | null
  /** At what height the goals go (`goalsRow`): in their row, or in the middle if nothing is left below. */
  goalsRow: number
}

/** A square of `width` metres centred on `(x, y)`. */
function square(x: number, y: number, width: number, height = width): Point2[] {
  return [
    [x - width / 2, y - height / 2], [x + width / 2, y - height / 2], [x + width / 2, y + height / 2],
    [x - width / 2, y - height / 2], [x + width / 2, y + height / 2], [x - width / 2, y + height / 2],
  ]
}

/** A cross: two crossed strokes, since here there is no font on the scoreboard, there are segments. */
function crossTriangles(length: number, thickness: number): Point2[] {
  const points: Point2[] = []
  for (const turn of [1, -1]) {
    const a = (turn * Math.PI) / 4
    const c = Math.cos(a)
    const s = Math.sin(a)
    for (const [x, y] of square(0, 0, length, thickness)) points.push([x * c - y * s, x * s + y * c])
  }
  return points
}

export class Scoreboard {
  readonly panel: Panel
  readonly node: Node3D
  readonly player = new Digits(SCOREBOARD_DIGITS.goals, PALETTE.primary)
  readonly opponent = new Digits(SCOREBOARD_DIGITS.goals, PALETTE.rival)
  readonly points = new Digits(SCOREBOARD_DIGITS.points, PALETTE.puck)
  readonly rowNumber = new Digits(SCOREBOARD_DIGITS.round, DIM)
  readonly lap = new Digits(SCOREBOARD_DIGITS.round, PALETTE.puck)
  private readonly lapNode = new Node3D()
  private readonly colon = shape([...square(0, -0.03, 0.016), ...square(0, 0.03, 0.016)], DIM)
  private painted = ''

  constructor() {
    this.panel = new Panel({ ancho: SCOREBOARD_SIZE.width, alto: SCOREBOARD_SIZE.height, fondo: PALETTE.background, opacidad: 0.7 })
    this.node = this.panel.nodo
    const hang = (node: Node3D, x: number, y: number, parent: Node3D = this.node) => {
      node.position = new Vector3(x, y, 0.004)
      parent.add_child(node)
    }
    hang(this.player.node, -0.12, SCOREBOARD_ROWS.goals)
    hang(this.opponent.node, 0.12, SCOREBOARD_ROWS.goals)
    // The colon between the goals: it is what is read as «a».
    hang(this.colon, 0, SCOREBOARD_ROWS.goals)
    hang(this.points.node, 0, SCOREBOARD_ROWS.points)
    hang(this.rowNumber.node, 0, SCOREBOARD_ROWS.round)
    hang(this.lapNode, 0.05, SCOREBOARD_ROWS.round)
    hang(shape(crossTriangles(0.026, 0.005), PALETTE.puck), -0.028, 0, this.lapNode)
    hang(this.lap.node, 0.008, 0, this.lapNode)
  }

  paint(state: ScoreboardState): void {
    const key = JSON.stringify(state)
    if (key === this.painted) return
    this.painted = key
    this.player.paint(state.player)
    this.opponent.paint(state.opponent)
    for (const [node, x] of [[this.player.node, -0.12], [this.opponent.node, 0.12], [this.colon, 0]] as const) {
      node.position = new Vector3(x, state.goalsRow, 0.004)
    }
    this.points.node.visible = state.points != null
    if (state.points != null) this.points.paint(state.points)
    this.rowNumber.node.visible = state.rowNumber != null
    if (state.rowNumber != null) this.rowNumber.paint(state.rowNumber)
    // With a lap, the round moves to the left to make room for it.
    this.rowNumber.node.position = new Vector3(state.lap != null ? -0.05 : 0, SCOREBOARD_ROWS.round, 0.004)
    this.lapNode.visible = state.lap != null
    if (state.lap != null) this.lap.paint(state.lap)
  }
}

/** What the mallet notice says, with one tap or holding (`drawMalletNotice`). */
export function malletPhrase(withOneTap: boolean): TextKey {
  return withOneTap ? 'Press the grip button on the mallet to pick it up' : 'Close your hand on the mallet to pick it up'
}

/** The countdown, or the notice to pick up the mallet in its place. */
export class Countdown {
  readonly node = new Node3D()
  readonly digit = new Digits(COUNTDOWN_DIGIT, PALETTE.primaryBright)
  readonly notice: Panel
  private painted = ''

  constructor() {
    this.node.add_child(this.digit.node)
    this.notice = new Panel({ ancho: MALLET_NOTICE[0], alto: MALLET_NOTICE[1], fondo: PALETTE.background, opacidad: 0.86 })
    this.node.add_child(this.notice.nodo)
  }

  /** `null` hides it; otherwise, the digit, or the notice if the mallet is being waited for. */
  paint(state: { count: number; waitingForMallet: boolean; withOneTap: boolean; lang: Lang } | null): void {
    this.node.visible = state != null
    if (state == null) return
    this.digit.node.visible = !state.waitingForMallet
    this.notice.nodo.visible = state.waitingForMallet
    if (!state.waitingForMallet) {
      this.digit.paint(state.count)
      return
    }
    const key = `${state.lang}:${state.withOneTap}`
    if (key === this.painted) return
    this.painted = key
    this.notice.borrarTextos()
    this.notice.parrafo(translator(state.lang)(malletPhrase(state.withOneTap)), 0, 0, {
      alto: MALLET_TEXT.phrase,
      color: PALETTE.foreground,
      anchoMax: MALLET_NOTICE[0] - 0.06,
    })
  }
}
