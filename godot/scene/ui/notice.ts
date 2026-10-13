/**
 * Leaving the match halfway: the stop button, the one to end the endless match, and the notice that
 * asks first (`XRQuitButton` and `XRQuitConfirm` of `components/xr/XRHud.tsx`), with their dimensions.
 *
 * - **The button goes in the column**, which while playing is empty, and enlarged: it is looked at
 *   out of the corner of the eye from a metre and a half. In the game's blue and opaque: the grey
 *   got lost against the room.
 * - **There is no leaving at once**: the button gets pressed by accident and leaving loses the
 *   goals. The table stops and it asks; while it asks the puck does not run. Keep playing goes on
 *   top and bigger, since it is the answer that loses nothing; below, back to the menu and leaving
 *   the game, which are different things and each carries its name.
 * - **The endless match** has its end button beside it (a square, the stop symbol): it is its only
 *   way out with a summary.
 */
import { Node3D } from 'godot'

import { Button } from '@kit/runtime/ui/button'
import { shape, plate } from '@kit/runtime/ui/mesh'
import { Panel } from '@kit/runtime/ui/panel'
import type { PointerAim } from '@kit/runtime/ui/pointerAim'

import type { Lang } from '@/lib/settings'
import { PALETTE } from '@/lib/palette'
import { translator } from '@/lib/textos'

import { DIM } from './menu'
import { menuIconTriangles } from './gameOver'
import { CONFIRM_SIZE, CONFIRM_BOXES, STOP_BOXES, CONFIRM_TEXT } from './layout'

export class StopButtons {
  readonly node = new Node3D()
  readonly stop: Button
  readonly end: Button

  constructor(actions: { stop(): void; end(): void }, aim: PointerAim) {
    this.stop = new Button({ id: 'quit', caja: STOP_BOXES.quit, z: 0, color: PALETTE.primaryDeep, opacidad: 0.95, alPulsar: () => actions.stop() })
    this.stop.dibujo(shape(menuIconTriangles(), PALETTE.foreground), PALETTE.foreground)
    this.end = new Button({ id: 'end', caja: STOP_BOXES.end, z: 0, color: PALETTE.primaryDeep, opacidad: 0.9, alPulsar: () => actions.end() })
    this.end.dibujo(plate(0.036, 0.036, PALETTE.foreground, 1, 1), PALETTE.foreground)
    this.node.add_child(this.stop.nodo)
    this.node.add_child(this.end.nodo)
    aim.anadir(this.stop, this.end)
  }

  /** What is shown: nothing, only stop, or stop and end (the endless match, already in play). */
  show(stop: boolean, end: boolean): void {
    this.node.visible = stop
    this.stop.nodo.visible = stop
    this.end.nodo.visible = stop && end
  }
}

export class ExitNotice {
  readonly panel: Panel
  readonly node: Node3D
  readonly stay: Button
  readonly menu: Button
  readonly leave: Button
  private painted: Lang | null = null

  constructor(actions: { stay(): void; menu(): void; leave(): void }, aim: PointerAim) {
    this.panel = new Panel({ ancho: CONFIRM_SIZE[0], alto: CONFIRM_SIZE[1], fondo: PALETTE.background, opacidad: 0.96 })
    this.node = this.panel.nodo
    this.menu = this.panel.boton(new Button({ id: 'confirm:menu', caja: CONFIRM_BOXES.menu, color: PALETTE.rail, opacidad: 0.9, alPulsar: () => actions.menu() }))
    this.leave = this.panel.boton(new Button({ id: 'confirm:leave', caja: CONFIRM_BOXES.leave, color: PALETTE.rail, opacidad: 0.9, alPulsar: () => actions.leave() }))
    this.stay = this.panel.boton(new Button({ id: 'confirm:stay', caja: CONFIRM_BOXES.stay, color: PALETTE.primary, alPulsar: () => actions.stay() }))
    aim.anadir(this.stay, this.menu, this.leave)
    this.node.visible = false
  }

  /** Writes it in a language: the web's `drawExitNotice`. */
  write(lang: Lang): void {
    if (this.painted === lang) return
    this.painted = lang
    const t = translator(lang)
    const { panel } = this
    const width = CONFIRM_SIZE[0] - 0.08
    panel.borrarTextos()
    panel.parrafo(t('Leave the game?'), 0, 0.15, { alto: CONFIRM_TEXT.title, color: PALETTE.foreground, anchoMax: width })
    panel.parrafo(t('You lose the goals you have scored.'), 0, 0.075, { alto: CONFIRM_TEXT.body, color: DIM, anchoMax: width })
    const label = (b: Button, text: string, color: string) =>
      panel.escribir(text, b.caja.x, b.caja.y, { alto: CONFIRM_TEXT.button, color, anchoMax: b.caja.width - 0.03, en: b })
    label(this.stay, t('Keep playing'), PALETTE.background)
    label(this.menu, t('Back to the menu'), PALETTE.foreground)
    label(this.leave, t('Leave'), PALETTE.foreground)
  }
}
