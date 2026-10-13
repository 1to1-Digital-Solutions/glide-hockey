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
 *
 * **En el duelo no hay franja ni puntos: va escrito** (`dibujarElDuelo` de la web, con sus cotas y
 * sus letras): tras la partida del primero, cómo le fue y a quién pasarle el mando —el botón ancho
 * empieza la del otro—; con las dos jugadas, quién gana, por cuánto y cuántos duelos lleva la pareja.
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

import { Cifras } from './digits'
import { DIM, triangulosDeRombo } from './menu'
import type { VistaDelDuelo } from './match'
import { CAJAS_DEL_FINAL, CIFRA_DEL_FINAL, FINAL } from './layout'

/** La letra de la franja: la de los rótulos del menú, que ya se mide a esta distancia. */
export const LETRA_DEL_FINAL = 0.034

/** Las letras del final del duelo: las de la web (`DUEL_TEXT` de `XRHud.tsx`). */
export const LETRA_DEL_DUELO = { title: 0.05, body: 0.034 } as const

/** Lo que enseña el final. */
export interface EstadoDelFinal {
  lang: Lang
  outcome: RunOutcome
  puntos: number
  esRecord: boolean
  /** En los niveles: cuál y con cuántas estrellas. */
  nivel: { nivel: number; stars: Stars; passed: boolean } | null
  /** En el duelo: cómo va, el marcador de la partida y lo que lleva la pareja. */
  duelo: { vista: VistaDelDuelo; marcador: { scored: number; conceded: number }; pareja: DuelTally } | null
}

/** Tres rayas: el icono de volver al menú (`XRMenuIcon`). */
export function triangulosDelMenu(lado = 0.05): Point2[] {
  const puntos: Point2[] = []
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
  readonly otraVez: Button
  readonly menu: Button
  readonly salir: Button
  readonly puntos = new Cifras(CIFRA_DEL_FINAL, PALETTE.foreground)
  private readonly franja = plate(0.5, 0.06, COMMON_PALETTE.hit, 1)
  private readonly estrellas: ReturnType<typeof shape>[] = []
  private pintado = ''

  constructor(acciones: { otraVez(): void; menu(): void; salir(): void }, punteria: PointerAim) {
    this.panel = new Panel({ ancho: FINAL.width, alto: FINAL.height, fondo: PALETTE.background, opacidad: 0.86 })
    this.nodo = this.panel.nodo
    this.franja.position = new Vector3(0, 0.13, -0.01)
    this.nodo.add_child(this.franja)
    this.puntos.nodo.position = new Vector3(0, 0.02, 0.004)
    this.nodo.add_child(this.puntos.nodo)
    for (let i = 0; i < 3; i++) {
      const rombo = shape(triangulosDeRombo(0.022), DIM)
      rombo.position = new Vector3((i - 1) * 0.045, -0.055, 0.004)
      this.nodo.add_child(rombo)
      this.estrellas.push(rombo)
    }
    this.otraVez = this.panel.boton(new Button({ id: 'final:again', caja: CAJAS_DEL_FINAL.again, color: PALETTE.primary, alPulsar: () => acciones.otraVez() }))
    this.otraVez.dibujo(playIcon(0.045, PALETTE.primaryInk), PALETTE.primaryInk)
    this.menu = this.panel.boton(new Button({ id: 'final:menu', caja: CAJAS_DEL_FINAL.menu, color: PALETTE.rail, opacidad: 0.8, alPulsar: () => acciones.menu() }))
    this.menu.dibujo(shape(triangulosDelMenu(), DIM), DIM)
    this.salir = this.panel.boton(
      exitButton({ id: 'final:exit', caja: CAJAS_DEL_FINAL.exit, color: PALETTE.rail, opacidad: 0.8, flecha: PALETTE.foreground, alPulsar: () => acciones.salir() }),
    )
    punteria.anadir(this.otraVez, this.menu, this.salir)
    this.nodo.visible = false
  }

  pintar(estado: EstadoDelFinal): void {
    const clave = JSON.stringify(estado)
    if (clave === this.pintado) return
    this.pintado = clave
    const t = translator(estado.lang)
    const duelo = estado.duelo
    this.franja.visible = duelo == null
    this.puntos.nodo.visible = duelo == null
    const gano = estado.outcome === 'won'
    const franja = gano ? COMMON_PALETTE.hit : COMMON_PALETTE.miss
    paint(this.franja, franja)
    this.puntos.pintar(estado.puntos, estado.esRecord ? COMMON_PALETTE.gold : PALETTE.foreground)
    for (const [i, rombo] of this.estrellas.entries()) {
      rombo.visible = estado.nivel != null
      const ganada = i < (estado.nivel?.stars ?? 0)
      paint(rombo, ganada ? COMMON_PALETTE.gold : DIM, ganada ? 1 : 0.35)
    }
    const titulo =
      estado.nivel != null
        ? t(estado.nivel.passed ? 'Level {level} cleared' : 'Level {level} not cleared', { level: estado.nivel.nivel })
        : estado.esRecord
          ? t('New record!')
          : t(gano ? 'Game won' : 'Game lost')
    this.panel.borrarTextos()
    if (duelo != null) {
      this.escribirElDuelo(estado.lang, duelo)
      return
    }
    this.panel.escribir(titulo, 0, 0.13, { alto: LETRA_DEL_FINAL, color: PALETTE.background, anchoMax: 0.46 })
  }

  /** Lo que se escribe al acabar una partida del duelo (`dibujarElDuelo` de la web). */
  private escribirElDuelo(lang: Lang, { vista, marcador, pareja }: NonNullable<EstadoDelFinal['duelo']>): void {
    const t = translator(lang)
    const { panel } = this
    const nombre = (jugador: Player) => t(PLAYER_LABELS[jugador])
    const ancho = FINAL.width - 0.08
    const titulo = vista.over
      ? vista.winner != null
        ? t('{player} wins', { player: nombre(vista.winner) })
        : t('Tie')
      : t('{player}: {scored}–{conceded}', { player: nombre(vista.player), ...marcador })
    panel.escribir(titulo, 0, 0.15, { alto: LETRA_DEL_DUELO.title, color: PALETTE.foreground, anchoMax: ancho })
    if (vista.next != null) {
      panel.parrafo(t('Pass the controller to {player}.', { player: nombre(vista.next) }), 0, 0.05, {
        alto: LETRA_DEL_DUELO.body,
        color: PALETTE.foreground,
        anchoMax: ancho,
      })
      return
    }
    for (const jugador of [0, 1] as const) {
      const partida = vista.matches[jugador]
      if (partida == null) continue
      panel.escribir(
        t('{player}: {scored}–{conceded} ({margin})', {
          player: nombre(jugador),
          scored: partida.scored,
          conceded: partida.conceded,
          margin: formatMargin(margin(partida)),
        }),
        0,
        0.09 - jugador * 0.05,
        { alto: LETRA_DEL_DUELO.body, color: vista.winner === jugador ? PALETTE.primary : DIM, anchoMax: ancho },
      )
    }
    panel.parrafo(t('Duels won: {one}–{two} · tied: {ties}', { one: pareja.wins[0], two: pareja.wins[1], ties: pareja.ties }), 0, 0.015, {
      alto: LETRA_DEL_DUELO.body,
      color: DIM,
      anchoMax: ancho,
      ancla: 'top',
    })
  }
}
