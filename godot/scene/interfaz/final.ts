/**
 * El final de la partida en Godot: `XRGameOver` de la web (`components/xr/XRHud.tsx`), en la columna,
 * donde estaba el menú.
 *
 * Una franja del color de cómo ha acabado (el verde de acierto o el rojo de fallo del salón), los
 * puntos en grande —en oro si son récord— y, en los niveles, las estrellas ganadas. Debajo, **otra
 * vez** en grande, volver al menú y salir: repetir es lo que más se hace, así que es el botón
 * ancho, y menú y salida llevan iconos distintos porque son cosas distintas.
 *
 * **Lo añadido respecto a la web**: la franja lleva escrito cómo ha acabado («Partida ganada»,
 * «Nivel 3 superado»…). En la web no lleva nada porque su lienzo no escribía en ese panel; aquí la
 * letra es del motor, y la medimos con el mismo instrumento que el resto.
 */
import { Node3D, Vector3 } from 'godot'

import type { Punto2 } from '@kit/lib/ui/salida'
import { Boton } from '@kit/runtime/ui/boton'
import { botonDeSalir, iconoDeJugar } from '@kit/runtime/ui/iconos'
import { figura, pintar, placa } from '@kit/runtime/ui/malla'
import { Panel } from '@kit/runtime/ui/panel'
import type { Punteria } from '@kit/runtime/ui/punteria'

import type { Lang } from '@/lib/ajustes'
import type { RunOutcome } from '@/lib/gameMode'
import type { Stars } from '@/lib/levels'
import { PALETA } from '@/lib/paleta'
import { PALETTE } from '@/lib/palette'
import { traductor } from '@/lib/textos'

import { Cifras } from './cifras'
import { DIM, triangulosDeRombo } from './menu'
import { CAJAS_DEL_FINAL, CIFRA_DEL_FINAL, FINAL } from './reparto'

/** La letra de la franja: la de los rótulos del menú, que ya se mide a esta distancia. */
export const LETRA_DEL_FINAL = 0.034

/** Lo que enseña el final. */
export interface EstadoDelFinal {
  lang: Lang
  outcome: RunOutcome
  puntos: number
  esRecord: boolean
  /** En los niveles: cuál y con cuántas estrellas. */
  nivel: { nivel: number; stars: Stars; passed: boolean } | null
}

/** Tres rayas: el icono de volver al menú (`XRMenuIcon`). */
export function triangulosDelMenu(lado = 0.05): Punto2[] {
  const puntos: Punto2[] = []
  for (const fila of [-1, 0, 1]) {
    const y = fila * lado * 0.32
    const alto = lado * 0.16
    puntos.push(
      [-lado / 2, y - alto / 2], [lado / 2, y - alto / 2], [lado / 2, y + alto / 2],
      [-lado / 2, y - alto / 2], [lado / 2, y + alto / 2], [-lado / 2, y + alto / 2],
    )
  }
  return puntos
}

export class FinalDeLaPartida {
  readonly panel: Panel
  readonly nodo: Node3D
  readonly otraVez: Boton
  readonly menu: Boton
  readonly salir: Boton
  readonly puntos = new Cifras(CIFRA_DEL_FINAL, PALETTE.foreground)
  private readonly franja = placa(0.5, 0.06, PALETA.acierto, 1)
  private readonly estrellas: ReturnType<typeof figura>[] = []
  private pintado = ''

  constructor(acciones: { otraVez(): void; menu(): void; salir(): void }, punteria: Punteria) {
    this.panel = new Panel({ ancho: FINAL.width, alto: FINAL.height, fondo: PALETTE.background, opacidad: 0.86 })
    this.nodo = this.panel.nodo
    this.franja.position = new Vector3(0, 0.13, -0.01)
    this.nodo.add_child(this.franja)
    this.puntos.nodo.position = new Vector3(0, 0.02, 0.004)
    this.nodo.add_child(this.puntos.nodo)
    for (let i = 0; i < 3; i++) {
      const rombo = figura(triangulosDeRombo(0.022), DIM)
      rombo.position = new Vector3((i - 1) * 0.045, -0.055, 0.004)
      this.nodo.add_child(rombo)
      this.estrellas.push(rombo)
    }
    this.otraVez = this.panel.boton(new Boton({ id: 'final:again', caja: CAJAS_DEL_FINAL.again, color: PALETTE.primary, alPulsar: () => acciones.otraVez() }))
    this.otraVez.dibujo(iconoDeJugar(0.045, PALETTE.primaryInk), PALETTE.primaryInk)
    this.menu = this.panel.boton(new Boton({ id: 'final:menu', caja: CAJAS_DEL_FINAL.menu, color: PALETTE.rail, opacidad: 0.8, alPulsar: () => acciones.menu() }))
    this.menu.dibujo(figura(triangulosDelMenu(), DIM), DIM)
    this.salir = this.panel.boton(
      botonDeSalir({ id: 'final:exit', caja: CAJAS_DEL_FINAL.exit, color: PALETTE.rail, opacidad: 0.8, flecha: PALETTE.foreground, alPulsar: () => acciones.salir() }),
    )
    punteria.anadir(this.otraVez, this.menu, this.salir)
    this.nodo.visible = false
  }

  pintar(estado: EstadoDelFinal): void {
    const clave = JSON.stringify(estado)
    if (clave === this.pintado) return
    this.pintado = clave
    const t = traductor(estado.lang)
    const gano = estado.outcome === 'won'
    const franja = gano ? PALETA.acierto : PALETA.fallo
    pintar(this.franja, franja)
    this.puntos.pintar(estado.puntos, estado.esRecord ? PALETA.oro : PALETTE.foreground)
    for (const [i, rombo] of this.estrellas.entries()) {
      rombo.visible = estado.nivel != null
      const ganada = i < (estado.nivel?.stars ?? 0)
      pintar(rombo, ganada ? PALETA.oro : DIM, ganada ? 1 : 0.35)
    }
    const titulo =
      estado.nivel != null
        ? t(estado.nivel.passed ? 'Level {level} cleared' : 'Level {level} not cleared', { level: estado.nivel.nivel })
        : estado.esRecord
          ? t('New record!')
          : t(gano ? 'Game won' : 'Game lost')
    this.panel.borrarTextos()
    this.panel.escribir(titulo, 0, 0.13, { alto: LETRA_DEL_FINAL, color: PALETTE.background, anchoMax: 0.46 })
  }
}
