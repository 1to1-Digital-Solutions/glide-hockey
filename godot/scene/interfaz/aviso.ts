/**
 * Dejar la partida a medias: el botón de parar, el de terminar la partida sin fin, y el aviso que
 * pregunta antes (`XRQuitButton` y `XRQuitConfirm` de `components/xr/XRHud.tsx`), con sus cotas.
 *
 * - **El botón va en la columna**, que mientras se juega está vacía, y agrandado: se mira de reojo
 *   a metro y medio. Del azul del juego y opaco: el gris se perdía contra la sala.
 * - **No se sale de golpe**: el botón se pulsa sin querer y salir pierde los goles. Se para la
 *   mesa y se pregunta; mientras se pregunta el disco no corre. Seguir jugando va arriba y más
 *   grande, que es la respuesta que no pierde nada; debajo, volver al menú y salir del juego, que
 *   son cosas distintas y llevan cada una su nombre.
 * - **La partida sin fin** tiene al lado su botón de terminar (un cuadrado, el símbolo de parar):
 *   es su única salida con resumen.
 */
import { Node3D } from 'godot'

import { Boton } from '@kit/runtime/ui/boton'
import { figura, placa } from '@kit/runtime/ui/malla'
import { Panel } from '@kit/runtime/ui/panel'
import type { Punteria } from '@kit/runtime/ui/punteria'

import type { Lang } from '@/lib/ajustes'
import { PALETTE } from '@/lib/palette'
import { traductor } from '@/lib/textos'

import { DIM } from './menu'
import { triangulosDelMenu } from './final'
import { AVISO, CAJAS_DEL_AVISO, CAJAS_DE_PARAR, LETRA_DEL_AVISO_DE_SALIR } from './reparto'

export class BotonesDeParar {
  readonly nodo = new Node3D()
  readonly parar: Boton
  readonly terminar: Boton

  constructor(acciones: { parar(): void; terminar(): void }, punteria: Punteria) {
    this.parar = new Boton({ id: 'quit', caja: CAJAS_DE_PARAR.quit, z: 0, color: PALETTE.primaryDeep, opacidad: 0.95, alPulsar: () => acciones.parar() })
    this.parar.dibujo(figura(triangulosDelMenu(), PALETTE.foreground), PALETTE.foreground)
    this.terminar = new Boton({ id: 'end', caja: CAJAS_DE_PARAR.end, z: 0, color: PALETTE.primaryDeep, opacidad: 0.9, alPulsar: () => acciones.terminar() })
    this.terminar.dibujo(placa(0.036, 0.036, PALETTE.foreground, 1, 1), PALETTE.foreground)
    this.nodo.add_child(this.parar.nodo)
    this.nodo.add_child(this.terminar.nodo)
    punteria.anadir(this.parar, this.terminar)
  }

  /** Qué se enseña: nada, solo parar, o parar y terminar (la partida sin fin, ya en juego). */
  mostrar(parar: boolean, terminar: boolean): void {
    this.nodo.visible = parar
    this.parar.nodo.visible = parar
    this.terminar.nodo.visible = parar && terminar
  }
}

export class AvisoDeSalir {
  readonly panel: Panel
  readonly nodo: Node3D
  readonly seguir: Boton
  readonly menu: Boton
  readonly dejar: Boton
  private pintado: Lang | null = null

  constructor(acciones: { seguir(): void; menu(): void; dejar(): void }, punteria: Punteria) {
    this.panel = new Panel({ ancho: AVISO[0], alto: AVISO[1], fondo: PALETTE.background, opacidad: 0.96 })
    this.nodo = this.panel.nodo
    this.menu = this.panel.boton(new Boton({ id: 'confirm:menu', caja: CAJAS_DEL_AVISO.menu, color: PALETTE.rail, opacidad: 0.9, alPulsar: () => acciones.menu() }))
    this.dejar = this.panel.boton(new Boton({ id: 'confirm:leave', caja: CAJAS_DEL_AVISO.leave, color: PALETTE.rail, opacidad: 0.9, alPulsar: () => acciones.dejar() }))
    this.seguir = this.panel.boton(new Boton({ id: 'confirm:stay', caja: CAJAS_DEL_AVISO.stay, color: PALETTE.primary, alPulsar: () => acciones.seguir() }))
    punteria.anadir(this.seguir, this.menu, this.dejar)
    this.nodo.visible = false
  }

  /** Lo escribe en un idioma: el `dibujarElAviso` de la web. */
  escribir(lang: Lang): void {
    if (this.pintado === lang) return
    this.pintado = lang
    const t = traductor(lang)
    const { panel } = this
    const ancho = AVISO[0] - 0.08
    panel.borrarTextos()
    panel.parrafo(t('Leave the game?'), 0, 0.15, { alto: LETRA_DEL_AVISO_DE_SALIR.title, color: PALETTE.foreground, anchoMax: ancho })
    panel.parrafo(t('You lose the goals you have scored.'), 0, 0.075, { alto: LETRA_DEL_AVISO_DE_SALIR.body, color: DIM, anchoMax: ancho })
    const rotulo = (b: Boton, texto: string, color: string) =>
      panel.escribir(texto, b.caja.x, b.caja.y, { alto: LETRA_DEL_AVISO_DE_SALIR.button, color, anchoMax: b.caja.width - 0.03, en: b })
    rotulo(this.seguir, t('Keep playing'), PALETTE.background)
    rotulo(this.menu, t('Back to the menu'), PALETTE.foreground)
    rotulo(this.dejar, t('Leave'), PALETTE.foreground)
  }
}
