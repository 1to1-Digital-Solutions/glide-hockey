/**
 * El cartel del objetivo en Godot: encima del marcador del fondo, sobre la portería de la máquina
 * (`components/xr/CartelDeObjetivo.tsx` y `components/game/CartelDelMarcador.tsx`).
 *
 * **Dice lo mismo que el de la web** porque los dos leen de `lib/objetivo.ts` —la misión y los
 * listones en la primera cuenta atrás, el listón que falta con su barra y lo que queda mientras se
 * juega, y lo que faltó al acabar— y **cuelga en el mismo sitio**, que sale de
 * `lib/cartelDelMarcador.ts`. Está pintado para leerse a `DISTANCIA_DE_DIBUJO` y se agranda con la
 * distancia de verdad, así que ocupa en el ojo los mismos grados que el de la web.
 *
 * La celebración de un listón es suya: el título dice la medalla («¡Bronce!»), se pone de su color
 * con la barra y el cartel crece y vuelve (`pulsoDelFestejo`). El sonido corto y el pulso en la mano los pone la
 * escena, con la medalla que devuelve `actualizar`.
 */
import { Node3D, Vector3, type MeshInstance3D } from 'godot'

import { plate } from '@kit/runtime/ui/mesh'
import { Panel } from '@kit/runtime/ui/panel'
import { RENDER_ORDER } from '@kit/runtime/ui/text3d'

import type { SignPlacement } from '@/lib/scoreboardSign'
import { CELEBRATION_SECONDS, thresholdCrossed, celebrationPulse, type Medal, type GoalSignView } from '@/lib/goal'
import { COMMON_PALETTE } from '@/lib/commonPalette'

import { CARTEL } from './layout'

export class Cartel {
  readonly panel: Panel
  readonly nodo: Node3D
  private readonly barra = new Node3D()
  private pintado = ''
  private escala = 1
  /** La medalla que tenía quien juega en el fotograma anterior: `undefined` hasta el primero. */
  private medalla: Medal | null | undefined = undefined
  /** El listón que se está celebrando y desde cuándo, en segundos. */
  private festejo: { medalla: Medal; lleva: number } | null = null

  constructor() {
    this.panel = new Panel({ ancho: CARTEL.ancho, alto: CARTEL.alto, fondo: COMMON_PALETTE.background, opacidad: 0.88 })
    this.nodo = this.panel.nodo
    this.nodo.set_name('CartelDeObjetivo')
    this.nodo.add_child(this.barra)
    this.nodo.visible = false
  }

  /** Lo cuelga donde dice `sitioDelCartel`, del tamaño que pide su distancia. */
  colocar(sitio: SignPlacement): void {
    const [x, y, z] = sitio.position
    this.nodo.position = new Vector3(x, y, z)
    // `Node3D` gira en orden YXZ, el mismo que las rotaciones de la web (`panelRotation`).
    this.nodo.rotation = new Vector3(sitio.rotation[0], sitio.rotation[1], sitio.rotation[2])
    this.escala = sitio.distance / CARTEL.distancia
    this.nodo.scale = new Vector3(this.escala, this.escala, this.escala)
  }

  /** La medalla cuyo listón se celebra ahora mismo, o `null`. */
  get celebrando(): Medal | null {
    return this.festejo?.medalla ?? null
  }

  /**
   * Pinta lo que dice (`dibujarElCartel`) y lleva la celebración. Sin vista, se esconde.
   *
   * @returns La medalla cuyo listón se acaba de cruzar en este fotograma, para que la escena la
   *   haga sonar y sentir; `null` casi siempre.
   */
  actualizar(vista: GoalSignView | null, medalla: Medal | null, idioma: string, delta: number): Medal | null {
    // Recién montado no hay nada que celebrar: no se ha visto cruzar el listón.
    const cruzada = this.medalla === undefined ? null : thresholdCrossed(this.medalla, medalla)
    if (cruzada != null) this.festejo = { medalla: cruzada, lleva: 0 }
    else if (medalla == null || (this.festejo != null && this.festejo.lleva >= CELEBRATION_SECONDS)) this.festejo = null
    this.medalla = medalla

    this.nodo.visible = vista != null
    const pulso = this.festejo == null ? 1 : celebrationPulse(this.festejo.lleva)
    this.nodo.scale = new Vector3(this.escala * pulso, this.escala * pulso, this.escala * pulso)
    if (this.festejo != null) this.festejo.lleva += delta
    if (vista != null) this.pintar(vista, idioma, this.celebrando)
    return cruzada
  }

  private pintar(vista: GoalSignView, idioma: string, festejo: Medal | null): void {
    const clave = `${idioma}|${festejo}|${JSON.stringify(vista)}`
    if (clave === this.pintado) return
    this.pintado = clave
    const { panel } = this
    panel.borrarTextos()
    for (let i = this.barra.get_child_count() - 1; i >= 0; i--) {
      const hijo = this.barra.get_child(i)!
      this.barra.remove_child(hijo)
      hijo.queue_free()
    }

    // Lo que hay se reparte centrado: una línea sola queda en medio, no colgada de arriba. Con el
    // pie del final son tres líneas, con la letra un poco más baja (`LETRA_CON_PIE` en la web).
    const pie = vista.footer ?? null
    const letra = pie == null ? CARTEL : CARTEL.conPie
    const filas = [
      letra.titulo,
      ...(vista.detail == null ? [] : [letra.detalle]),
      ...(pie == null ? [] : [letra.detalle]),
      ...(vista.bar == null ? [] : [CARTEL.barra]),
    ]
    let y = (filas.reduce((suma, fila) => suma + fila, 0) + letra.aire * (filas.length - 1)) / 2

    // Mientras se celebra, el título dice la medalla: el color solo no se entiende.
    panel.escribir(festejo != null && vista.cheer != null ? vista.cheer : vista.title, 0, y - letra.titulo / 2, {
      alto: letra.titulo,
      color: festejo != null ? COMMON_PALETTE[festejo] : vista.subdued ? COMMON_PALETTE.mutedText : COMMON_PALETTE.text,
      anchoMax: CARTEL.anchoUtil,
    })
    y -= letra.titulo + letra.aire

    for (const linea of [vista.detail, pie]) {
      if (linea == null) continue
      panel.escribir(linea, 0, y - letra.detalle / 2, { alto: letra.detalle, color: COMMON_PALETTE.mutedText, anchoMax: CARTEL.anchoUtil })
      y -= letra.detalle + letra.aire
    }

    if (vista.bar != null) {
      const centro = y - CARTEL.barra / 2
      this.anadir(plate(CARTEL.anchoUtil, CARTEL.barra, COMMON_PALETTE.border, 1, RENDER_ORDER.placa), 0, centro)
      const lleno = CARTEL.anchoUtil * vista.bar
      const acento = festejo ?? vista.medal
      if (lleno > 0) {
        this.anadir(plate(lleno, CARTEL.barra, acento == null ? COMMON_PALETTE.accent : COMMON_PALETTE[acento], 1, RENDER_ORDER.dibujo), -CARTEL.anchoUtil / 2 + lleno / 2, centro)
      }
    }
  }

  private anadir(nodo: MeshInstance3D, x: number, y: number): void {
    nodo.position = new Vector3(x, y, 0)
    this.barra.add_child(nodo)
  }
}
