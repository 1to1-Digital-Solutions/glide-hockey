/**
 * The goal sign in Godot: above the back scoreboard, over the machine's goal
 * (`components/xr/GoalSign.tsx` and `components/game/ScoreboardSign.tsx`).
 *
 * **It says the same as the web's** because both read from `lib/goal.ts` —the mission and the
 * thresholds in the first countdown, the threshold still missing with its bar and what is left
 * while playing, and what was missing at the end— and **it hangs in the same place**, which comes
 * from `lib/scoreboardSign.ts`. It is painted to be read at `DRAW_DISTANCE` and is enlarged with
 * the real distance, so it takes up in the eye the same degrees as the web's.
 *
 * The celebration of a threshold is its own: the title says the medal («¡Bronce!»), it turns its
 * colour along with the bar and the sign grows and comes back (`celebrationPulse`). The short sound
 * and the pulse in the hand are put by the scene, with the medal that `update` returns.
 */
import { Node3D, Vector3, type MeshInstance3D } from 'godot'

import { plate } from '@kit/runtime/ui/mesh'
import { Panel } from '@kit/runtime/ui/panel'
import { RENDER_ORDER } from '@kit/runtime/ui/text3d'

import type { SignPlacement } from '@/lib/scoreboardSign'
import { CELEBRATION_SECONDS, thresholdCrossed, celebrationPulse, type Medal, type GoalSignView } from '@/lib/goal'
import { COMMON_PALETTE } from '@/lib/commonPalette'

import { SIGN } from './layout'

export class SignPanel {
  readonly panel: Panel
  readonly node: Node3D
  private readonly bar = new Node3D()
  private painted = ''
  private scale = 1
  /** The medal whoever plays had in the previous frame: `undefined` until the first. */
  private medal: Medal | null | undefined = undefined
  /** The threshold being celebrated and since when, in seconds. */
  private celebration: { medal: Medal; elapsed: number } | null = null

  constructor() {
    this.panel = new Panel({ ancho: SIGN.width, alto: SIGN.height, fondo: COMMON_PALETTE.background, opacidad: 0.88 })
    this.node = this.panel.nodo
    this.node.set_name('GoalSign')
    this.node.add_child(this.bar)
    this.node.visible = false
  }

  /** Hangs it where `signPlacement` says, at the size its distance asks for. */
  place(placement: SignPlacement): void {
    const [x, y, z] = placement.position
    this.node.position = new Vector3(x, y, z)
    // `Node3D` rotates in YXZ order, the same as the web's rotations (`panelRotation`).
    this.node.rotation = new Vector3(placement.rotation[0], placement.rotation[1], placement.rotation[2])
    this.scale = placement.distance / SIGN.distance
    this.node.scale = new Vector3(this.scale, this.scale, this.scale)
  }

  /** The medal whose threshold is being celebrated right now, or `null`. */
  get celebrating(): Medal | null {
    return this.celebration?.medal ?? null
  }

  /**
   * Paints what it says (`drawSign`) and carries the celebration. Without a view, it hides.
   *
   * @returns The medal whose threshold has just been crossed in this frame, for the scene to make
   *   it sound and be felt; `null` almost always.
   */
  update(view: GoalSignView | null, medal: Medal | null, lang: string, delta: number): Medal | null {
    // Just mounted there is nothing to celebrate: the threshold has not been seen being crossed.
    const crossed = this.medal === undefined ? null : thresholdCrossed(this.medal, medal)
    if (crossed != null) this.celebration = { medal: crossed, elapsed: 0 }
    else if (medal == null || (this.celebration != null && this.celebration.elapsed >= CELEBRATION_SECONDS)) this.celebration = null
    this.medal = medal

    this.node.visible = view != null
    const pulse = this.celebration == null ? 1 : celebrationPulse(this.celebration.elapsed)
    this.node.scale = new Vector3(this.scale * pulse, this.scale * pulse, this.scale * pulse)
    if (this.celebration != null) this.celebration.elapsed += delta
    if (view != null) this.paint(view, lang, this.celebrating)
    return crossed
  }

  private paint(view: GoalSignView, lang: string, celebrated: Medal | null): void {
    const key = `${lang}|${celebrated}|${JSON.stringify(view)}`
    if (key === this.painted) return
    this.painted = key
    const { panel } = this
    panel.borrarTextos()
    for (let i = this.bar.get_child_count() - 1; i >= 0; i--) {
      const child = this.bar.get_child(i)!
      this.bar.remove_child(child)
      child.queue_free()
    }

    // What there is is laid out centred: a single line stays in the middle, not hanging from the top.
    // With the footer of the end there are three lines, with a slightly smaller font (`SIGN_FONT_WITH_FOOTER` on the web).
    const footer = view.footer ?? null
    const font = footer == null ? SIGN : SIGN.withFooter
    const rows = [
      font.title,
      ...(view.detail == null ? [] : [font.detail]),
      ...(footer == null ? [] : [font.detail]),
      ...(view.bar == null ? [] : [SIGN.bar]),
    ]
    let y = (rows.reduce((sum, row) => sum + row, 0) + font.gap * (rows.length - 1)) / 2

    // While it is celebrated, the title says the medal: the colour alone is not understood.
    panel.escribir(celebrated != null && view.cheer != null ? view.cheer : view.title, 0, y - font.title / 2, {
      alto: font.title,
      color: celebrated != null ? COMMON_PALETTE[celebrated] : view.subdued ? COMMON_PALETTE.mutedText : COMMON_PALETTE.text,
      anchoMax: SIGN.usableWidth,
    })
    y -= font.title + font.gap

    for (const line of [view.detail, footer]) {
      if (line == null) continue
      panel.escribir(line, 0, y - font.detail / 2, { alto: font.detail, color: COMMON_PALETTE.mutedText, anchoMax: SIGN.usableWidth })
      y -= font.detail + font.gap
    }

    if (view.bar != null) {
      const center = y - SIGN.bar / 2
      this.add(plate(SIGN.usableWidth, SIGN.bar, COMMON_PALETTE.border, 1, RENDER_ORDER.placa), 0, center)
      const filled = SIGN.usableWidth * view.bar
      const accent = celebrated ?? view.medal
      if (filled > 0) {
        this.add(plate(filled, SIGN.bar, accent == null ? COMMON_PALETTE.accent : COMMON_PALETTE[accent], 1, RENDER_ORDER.dibujo), -SIGN.usableWidth / 2 + filled / 2, center)
      }
    }
  }

  private add(node: MeshInstance3D, x: number, y: number): void {
    node.position = new Vector3(x, y, 0)
    this.bar.add_child(node)
  }
}
