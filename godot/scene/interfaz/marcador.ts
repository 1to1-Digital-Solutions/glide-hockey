/**
 * El marcador y la cuenta atrás de Glide Hockey en Godot: `XRScoreboard` y `XRCountdown` de la web
 * (`components/xr/XRHud.tsx`), con sus medidas.
 *
 * **El marcador va al fondo, sobre la portería de la máquina**: es donde se mira jugando, así que
 * se lee sin apartar la vista del disco. Tres filas: los goles de cada uno en su color (el cian del
 * jugador, el rojo de la máquina), los puntos en el naranja del disco y, en el reto, la ronda —en
 * los niveles, el nivel—. Pasada la primera vuelta a la escalera del reto sale además un aspa y el
 * número de vuelta, en el color de los puntos: lo que dice es que **lo que se meta ahora vale más**.
 *
 * **La cuenta atrás flota sobre el punto de saque**, y en su último segundo, si el mazo no está en
 * la mano, se para y dice por qué (`esperandoElMazo`): sin eso, desde dentro del visor parecía que
 * el juego se había colgado en el 1.
 */
import { Node3D, Vector3 } from 'godot'

import type { Punto2 } from '@kit/lib/ui/salida'
import { figura } from '@kit/runtime/ui/malla'
import { Panel } from '@kit/runtime/ui/panel'

import type { Lang } from '@/lib/ajustes'
import { PALETTE } from '@/lib/palette'
import { traductor, type TextKey } from '@/lib/textos'

import { Cifras } from './cifras'
import { DIM } from './menu'
import { AVISO_DEL_MAZO, CIFRAS_DEL_MARCADOR, CIFRA_DE_LA_CUENTA, FILAS_DEL_MARCADOR, LETRA_DEL_AVISO, MARCADOR } from './reparto'

/** Lo que cuenta el marcador. */
export interface EstadoDelMarcador {
  jugador: number
  maquina: number
  puntos: number
  /** La ronda del reto o el nivel, o `null` en la práctica. */
  fila: number | null
  /** La vuelta a la escalera del reto, solo pasada la primera. */
  vuelta: number | null
}

/** Un cuadrado de `lado` metros centrado en `(x, y)`. */
function cuadrado(x: number, y: number, ancho: number, alto = ancho): Punto2[] {
  return [
    [x - ancho / 2, y - alto / 2], [x + ancho / 2, y - alto / 2], [x + ancho / 2, y + alto / 2],
    [x - ancho / 2, y - alto / 2], [x + ancho / 2, y + alto / 2], [x - ancho / 2, y + alto / 2],
  ]
}

/** Un aspa: dos rayas cruzadas, que aquí no hay letra en el marcador, hay segmentos. */
function triangulosDelAspa(largo: number, grueso: number): Punto2[] {
  const puntos: Punto2[] = []
  for (const giro of [1, -1]) {
    const a = (giro * Math.PI) / 4
    const c = Math.cos(a)
    const s = Math.sin(a)
    for (const [x, y] of cuadrado(0, 0, largo, grueso)) puntos.push([x * c - y * s, x * s + y * c])
  }
  return puntos
}

export class Marcador {
  readonly panel: Panel
  readonly nodo: Node3D
  readonly jugador = new Cifras(CIFRAS_DEL_MARCADOR.goals, PALETTE.primary)
  readonly maquina = new Cifras(CIFRAS_DEL_MARCADOR.goals, PALETTE.rival)
  readonly puntos = new Cifras(CIFRAS_DEL_MARCADOR.points, PALETTE.puck)
  readonly fila = new Cifras(CIFRAS_DEL_MARCADOR.round, DIM)
  readonly vuelta = new Cifras(CIFRAS_DEL_MARCADOR.round, PALETTE.puck)
  private readonly nodoDeLaVuelta = new Node3D()
  private pintado = ''

  constructor() {
    this.panel = new Panel({ ancho: MARCADOR.width, alto: MARCADOR.height, fondo: PALETTE.background, opacidad: 0.7 })
    this.nodo = this.panel.nodo
    const colgar = (nodo: Node3D, x: number, y: number, padre: Node3D = this.nodo) => {
      nodo.position = new Vector3(x, y, 0.004)
      padre.add_child(nodo)
    }
    colgar(this.jugador.nodo, -0.12, FILAS_DEL_MARCADOR.goals)
    colgar(this.maquina.nodo, 0.12, FILAS_DEL_MARCADOR.goals)
    // Los dos puntos entre los goles: es lo que se lee como «a».
    colgar(figura([...cuadrado(0, -0.03, 0.016), ...cuadrado(0, 0.03, 0.016)], DIM), 0, FILAS_DEL_MARCADOR.goals)
    colgar(this.puntos.nodo, 0, FILAS_DEL_MARCADOR.points)
    colgar(this.fila.nodo, 0, FILAS_DEL_MARCADOR.round)
    colgar(this.nodoDeLaVuelta, 0.05, FILAS_DEL_MARCADOR.round)
    colgar(figura(triangulosDelAspa(0.026, 0.005), PALETTE.puck), -0.028, 0, this.nodoDeLaVuelta)
    colgar(this.vuelta.nodo, 0.008, 0, this.nodoDeLaVuelta)
  }

  pintar(estado: EstadoDelMarcador): void {
    const clave = JSON.stringify(estado)
    if (clave === this.pintado) return
    this.pintado = clave
    this.jugador.pintar(estado.jugador)
    this.maquina.pintar(estado.maquina)
    this.puntos.pintar(estado.puntos)
    this.fila.nodo.visible = estado.fila != null
    if (estado.fila != null) this.fila.pintar(estado.fila)
    // Con vuelta, la ronda se corre a la izquierda para dejarle sitio.
    this.fila.nodo.position = new Vector3(estado.vuelta != null ? -0.05 : 0, FILAS_DEL_MARCADOR.round, 0.004)
    this.nodoDeLaVuelta.visible = estado.vuelta != null
    if (estado.vuelta != null) this.vuelta.pintar(estado.vuelta)
  }
}

/** Lo que dice el aviso del mazo, con un toque o manteniendo (`dibujarElAvisoDelMazo`). */
export function fraseDelMazo(conUnToque: boolean): TextKey {
  return conUnToque ? 'Press the grip button on the mallet to pick it up' : 'Close your hand on the mallet to pick it up'
}

/** La cuenta atrás, o el aviso de coger el mazo en su lugar. */
export class CuentaAtras {
  readonly nodo = new Node3D()
  readonly cifra = new Cifras(CIFRA_DE_LA_CUENTA, PALETTE.primaryBright)
  readonly aviso: Panel
  private pintado = ''

  constructor() {
    this.nodo.add_child(this.cifra.nodo)
    this.aviso = new Panel({ ancho: AVISO_DEL_MAZO[0], alto: AVISO_DEL_MAZO[1], fondo: PALETTE.background, opacidad: 0.86 })
    this.nodo.add_child(this.aviso.nodo)
  }

  /** `null` la esconde; si no, la cifra, o el aviso si se está esperando el mazo. */
  pintar(estado: { cuenta: number; esperandoElMazo: boolean; conUnToque: boolean; lang: Lang } | null): void {
    this.nodo.visible = estado != null
    if (estado == null) return
    this.cifra.nodo.visible = !estado.esperandoElMazo
    this.aviso.nodo.visible = estado.esperandoElMazo
    if (!estado.esperandoElMazo) {
      this.cifra.pintar(estado.cuenta)
      return
    }
    const clave = `${estado.lang}:${estado.conUnToque}`
    if (clave === this.pintado) return
    this.pintado = clave
    this.aviso.borrarTextos()
    this.aviso.parrafo(traductor(estado.lang)(fraseDelMazo(estado.conUnToque)), 0, 0, {
      alto: LETRA_DEL_AVISO.phrase,
      color: PALETTE.foreground,
      anchoMax: AVISO_DEL_MAZO[0] - 0.06,
    })
  }
}
