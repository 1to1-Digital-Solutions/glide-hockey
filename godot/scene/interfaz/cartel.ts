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

import { placa } from '@kit/runtime/ui/malla'
import { Panel } from '@kit/runtime/ui/panel'
import { ORDEN } from '@kit/runtime/ui/texto3d'

import type { SitioDelCartel } from '@/lib/cartelDelMarcador'
import { SEGUNDOS_DE_FESTEJO, listonCruzado, pulsoDelFestejo, type Medalla, type VistaDelCartel } from '@/lib/objetivo'
import { PALETA } from '@/lib/paleta'

import { CARTEL } from './reparto'

export class Cartel {
  readonly panel: Panel
  readonly nodo: Node3D
  private readonly barra = new Node3D()
  private pintado = ''
  private escala = 1
  /** La medalla que tenía quien juega en el fotograma anterior: `undefined` hasta el primero. */
  private medalla: Medalla | null | undefined = undefined
  /** El listón que se está celebrando y desde cuándo, en segundos. */
  private festejo: { medalla: Medalla; lleva: number } | null = null

  constructor() {
    this.panel = new Panel({ ancho: CARTEL.ancho, alto: CARTEL.alto, fondo: PALETA.fondo, opacidad: 0.88 })
    this.nodo = this.panel.nodo
    this.nodo.set_name('CartelDeObjetivo')
    this.nodo.add_child(this.barra)
    this.nodo.visible = false
  }

  /** Lo cuelga donde dice `sitioDelCartel`, del tamaño que pide su distancia. */
  colocar(sitio: SitioDelCartel): void {
    const [x, y, z] = sitio.position
    this.nodo.position = new Vector3(x, y, z)
    // `Node3D` gira en orden YXZ, el mismo que las rotaciones de la web (`panelRotation`).
    this.nodo.rotation = new Vector3(sitio.rotation[0], sitio.rotation[1], sitio.rotation[2])
    this.escala = sitio.distancia / CARTEL.distancia
    this.nodo.scale = new Vector3(this.escala, this.escala, this.escala)
  }

  /** La medalla cuyo listón se celebra ahora mismo, o `null`. */
  get celebrando(): Medalla | null {
    return this.festejo?.medalla ?? null
  }

  /**
   * Pinta lo que dice (`dibujarElCartel`) y lleva la celebración. Sin vista, se esconde.
   *
   * @returns La medalla cuyo listón se acaba de cruzar en este fotograma, para que la escena la
   *   haga sonar y sentir; `null` casi siempre.
   */
  actualizar(vista: VistaDelCartel | null, medalla: Medalla | null, idioma: string, delta: number): Medalla | null {
    // Recién montado no hay nada que celebrar: no se ha visto cruzar el listón.
    const cruzada = this.medalla === undefined ? null : listonCruzado(this.medalla, medalla)
    if (cruzada != null) this.festejo = { medalla: cruzada, lleva: 0 }
    else if (medalla == null || (this.festejo != null && this.festejo.lleva >= SEGUNDOS_DE_FESTEJO)) this.festejo = null
    this.medalla = medalla

    this.nodo.visible = vista != null
    const pulso = this.festejo == null ? 1 : pulsoDelFestejo(this.festejo.lleva)
    this.nodo.scale = new Vector3(this.escala * pulso, this.escala * pulso, this.escala * pulso)
    if (this.festejo != null) this.festejo.lleva += delta
    if (vista != null) this.pintar(vista, idioma, this.celebrando)
    return cruzada
  }

  private pintar(vista: VistaDelCartel, idioma: string, festejo: Medalla | null): void {
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
    const pie = vista.pie ?? null
    const letra = pie == null ? CARTEL : CARTEL.conPie
    const filas = [
      letra.titulo,
      ...(vista.detalle == null ? [] : [letra.detalle]),
      ...(pie == null ? [] : [letra.detalle]),
      ...(vista.barra == null ? [] : [CARTEL.barra]),
    ]
    let y = (filas.reduce((suma, fila) => suma + fila, 0) + letra.aire * (filas.length - 1)) / 2

    // Mientras se celebra, el título dice la medalla: el color solo no se entiende.
    panel.escribir(festejo != null && vista.vitor != null ? vista.vitor : vista.titulo, 0, y - letra.titulo / 2, {
      alto: letra.titulo,
      color: festejo != null ? PALETA[festejo] : vista.discreto ? PALETA.textoSuave : PALETA.texto,
      anchoMax: CARTEL.anchoUtil,
    })
    y -= letra.titulo + letra.aire

    for (const linea of [vista.detalle, pie]) {
      if (linea == null) continue
      panel.escribir(linea, 0, y - letra.detalle / 2, { alto: letra.detalle, color: PALETA.textoSuave, anchoMax: CARTEL.anchoUtil })
      y -= letra.detalle + letra.aire
    }

    if (vista.barra != null) {
      const centro = y - CARTEL.barra / 2
      this.anadir(placa(CARTEL.anchoUtil, CARTEL.barra, PALETA.borde, 1, ORDEN.placa), 0, centro)
      const lleno = CARTEL.anchoUtil * vista.barra
      const acento = festejo ?? vista.medalla
      if (lleno > 0) {
        this.anadir(placa(lleno, CARTEL.barra, acento == null ? PALETA.acento : PALETA[acento], 1, ORDEN.dibujo), -CARTEL.anchoUtil / 2 + lleno / 2, centro)
      }
    }
  }

  private anadir(nodo: MeshInstance3D, x: number, y: number): void {
    nodo.position = new Vector3(x, y, 0)
    this.barra.add_child(nodo)
  }
}
