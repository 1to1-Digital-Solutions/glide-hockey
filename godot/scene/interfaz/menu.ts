/**
 * El menú de Glide Hockey en Godot: el panel del visor de la web (`components/xr/XRMenu.tsx`), con
 * las cajas de `lib/xrMenuLayout.ts` sin tocar una cota y los botones del kit.
 *
 * **Primero el modo, y solo pregunta lo que el modo necesita**, como en la web: en la práctica, el
 * nivel de la máquina y a cuántos goles (o sin fin); en los niveles, qué nivel, con sus estrellas;
 * en el reto, nada más que jugar. Lo que no toca no se pinta; lo que toca pero no se puede
 * (bajar del nivel 1, tu habitación sin realidad aumentada) se apaga en vez de esconderse. Arriba
 * del todo, el confort del golpe recibido; abajo, jugar en medio y **salir en la esquina de abajo a
 * la derecha**, la de todas las cabinas (`exitCorner.ts`).
 *
 * **El decorado** (la sala o tu habitación) es el escenario del salón (`xrcade:scenery`): el botón lo
 * alterna para todas las cabinas y se apaga si el visor no da realidad aumentada, que sin ella no hay
 * habitación que enseñar. Su icono es la ventana de `XRSceneryIcon`: cerrada, la sala; abierta, tu
 * habitación.
 *
 * **Los modos, con el icono de la web** (`ModeIcon`): un disco la práctica, tres estrellas los
 * niveles, una escalera el reto y dos discos el duelo. Llevaron su nombre escrito mientras
 * fueron tres; con el duelo son cuatro en la fila, y «Challenge» no cabe en 15 cm a la letra que
 * se lee. Lo que es cada uno lo dice la línea de abajo, y **si cuenta para medalla**, la frase de
 * la línea del rótulo «Modo»; el que la da —el reto— lleva además un disco dorado en la esquina. Las cifras —goles, nivel, récord— son de
 * siete segmentos, como en la web.
 */
import { Node3D, Vector3 } from 'godot'

import { desplazar, triangulosDeArco, triangulosDeTrazo } from '@kit/lib/ui/iconos'
import type { Punto2 } from '@kit/lib/ui/salida'
import { Boton } from '@kit/runtime/ui/boton'
import { barra, botonDeSalir, iconoDeJugar, iconoDeSigno } from '@kit/runtime/ui/iconos'
import { figura, pintar } from '@kit/runtime/ui/malla'
import { Panel } from '@kit/runtime/ui/panel'
import type { Punteria } from '@kit/runtime/ui/punteria'

import type { Lang, Scenery } from '@/lib/ajustes'
import { daMedalla, fraseDeLaMedalla } from '@/lib/cartelDelMarcador'
import { DIFFICULTY_ORDER, MAX_GOALS, MIN_GOALS, type Difficulty } from '@/lib/gameConfig'
import { GAME_MODE_HINTS, GAME_MODE_LABELS, GAME_MODE_ORDER, type GameMode } from '@/lib/gameMode'
import { CONFORTS, type Confort } from '@/lib/golpeRecibido'
import { LEVEL_COUNT, type Stars } from '@/lib/levels'
import type { Objetivo } from '@/lib/objetivo'
import { PALETA } from '@/lib/paleta'
import { DIFFICULTY_COLORS, PALETTE } from '@/lib/palette'
import { SCENERY_LABELS } from '@/lib/scenery'
import { traductor, type TextKey } from '@/lib/textos'
import {
  LEVEL_BAR_BOTTOM,
  MENU_BOXES,
  MENU_BUTTON,
  MENU_HINT_Y,
  MENU_MEDAL_WIDTH,
  MENU_PANEL,
  MENU_RECORD_X,
  MENU_ROW,
  MENU_ROW_LABEL_RISE,
  MENU_ROW_LABEL_SIZE,
  MENU_TEXT,
  MENU_MODE_ICON_RISE,
  MENU_MODE_LABEL_DROP,
  levelBarHeight,
  type MenuBox,
} from '@/lib/xrMenuLayout'

import { Cifras } from './cifras'
import type { Caja } from './reparto'

/** Lo apagado o secundario: el neutro suave del salón (`DIM_COLOR` de `XRUi.tsx`). */
export const DIM = PALETA.textoSuave

/** El nombre de la fila del confort (`CONFORT_LEGEND` de `lib/confort.ts`, que es de React). */
export const LEYENDA_DEL_CONFORT: TextKey = 'When hit'

/** El radio de la marca del modo que da medalla (`MARCA_DE_MEDALLA` de `XRMenu.tsx`). */
export const MARCA_DE_MEDALLA = 0.011

/** Las cifras del panel, a su alto de la web: goles, nivel y su total, y el récord. */
export const CIFRAS_DEL_MENU = { goles: 0.11, nivel: 0.1, total: 0.04, record: 0.04 } as const

/** La caja de un botón de la web en la forma de las del kit. */
export function cajaDe(box: MenuBox): Caja {
  return { x: box.position[0], y: box.position[1], width: box.size[0], height: box.size[1] }
}

/**
 * La ventana del decorado (`XRSceneryIcon` de la web, a 5 cm): el marco siempre, y dentro el cristal
 * entero (la sala, cerrada) o solo el travesaño (tu habitación, abierta).
 */
export function triangulosDeLaVentana(habitacion: boolean, lado = 0.05): { marco: Punto2[]; dentro: Punto2[] } {
  const g = lado * 0.12
  const rect = (x: number, y: number, ancho: number, alto: number): Punto2[] => {
    const a = ancho / 2
    const b = alto / 2
    return [[x - a, y - b], [x + a, y - b], [x + a, y + b], [x - a, y - b], [x + a, y + b], [x - a, y + b]]
  }
  const marco = [
    ...rect(0, lado * 0.34, lado * 0.8, g),
    ...rect(0, -lado * 0.34, lado * 0.8, g),
    ...rect(-lado * 0.34, 0, g, lado * 0.8),
    ...rect(lado * 0.34, 0, g, lado * 0.8),
  ]
  return { marco, dentro: habitacion ? rect(0, 0, lado * 0.68, g) : rect(0, 0, lado * 0.56, lado * 0.56) }
}

/** Tres rombos, las estrellas de un nivel (`StarsRow`): una punta de dos milímetros no se ve. */
export function triangulosDeRombo(lado: number): Punto2[] {
  const r = lado * 0.71
  return [[0, -r], [r, 0], [0, r], [0, -r], [0, r], [-r, 0]]
}

/** Un rectángulo de `ancho × alto` centrado en `(x, y)`. */
function rectangulo(x: number, y: number, ancho: number, alto: number): Punto2[] {
  const a = ancho / 2
  const b = alto / 2
  return [[x - a, y - b], [x + a, y - b], [x + a, y + b], [x - a, y - b], [x + a, y + b], [x - a, y + b]]
}

/** Un círculo lleno de `radio`, centrado en `(x, y)`. */
function circulo(radio: number, x = 0, y = 0, lados = 24): Punto2[] {
  return desplazar(triangulosDeArco(0, radio, 0, Math.PI * 2, lados), x, y)
}

/**
 * La silueta de cada modo (`ModeIcon` de la web, con sus medidas): un disco la práctica, tres
 * estrellas los niveles, una escalera el reto y dos discos el duelo —el dibujo del duelo de
 * table-tennis—.
 */
export function triangulosDelModo(modo: GameMode): Punto2[] {
  if (modo === 'practice') return circulo(0.032)
  if (modo === 'levels') return [0, 1, 2].flatMap((i) => desplazar(triangulosDeRombo(0.02), (i - 1) * 0.02 * 1.9, 0))
  if (modo === 'duel') return [...circulo(0.022, -0.03, 0, 20), ...circulo(0.022, 0.03, 0, 20)]
  return [0, 1, 2].flatMap((paso) => rectangulo((paso - 1) * 0.03, -0.024 + paso * 0.016, 0.024, 0.016 + paso * 0.032))
}

/** El icono de cada confort (`ConfortIcon`): tachado, una onda o dos. */
export function triangulosDelConfort(confort: Confort): Punto2[] {
  if (confort === 'off') {
    const d = 0.035 / Math.SQRT2
    return [...triangulosDeArco(0.024, 0.032), ...triangulosDeTrazo([[-d, -d], [d, d]], 0.008)]
  }
  const ondas = confort === 'gentle' ? 1 : 2
  const puntos = triangulosDeArco(0, 0.01, 0, Math.PI * 2, 16)
  for (let i = 0; i < ondas; i++) puntos.push(...triangulosDeArco(0.02 + i * 0.014, 0.026 + i * 0.014))
  return puntos
}

/** Lo que enseña el menú: lo elegido y lo guardado. */
export interface EstadoDelMenu {
  lang: Lang
  modo: GameMode
  dificultad: Difficulty
  goles: number
  sinFin: boolean
  /** El nivel que se jugaría, y hasta cuál está abierto. */
  nivel: number
  abierto: number
  estrellas: readonly Stars[]
  /** El récord del modo elegido; cero si no hay ninguno que batir. */
  record: number
  confort: Confort
  /** Si el visor da realidad aumentada: sin ella no hay habitación y el botón se apaga. */
  habitacion: boolean
  /** El escenario que tiene elegido el salón: la sala o tu habitación. */
  escenario: Scenery
  /** Lo que pasó el salón, o `null`: de él sale qué modo da medalla. */
  objetivo: Objetivo | null
}

export interface AccionesDelMenu {
  elegirModo(modo: GameMode): void
  elegirDificultad(dificultad: Difficulty): void
  elegirConfort(confort: Confort): void
  /** −1 o +1: un gol en la práctica, un nivel en los niveles. */
  mover(signo: -1 | 1): void
  sinFin(): void
  /** La sala o tu habitación: cambia el escenario del salón. */
  alternarEscenario(): void
  jugar(): void
  salir(): void
}

export class MenuDelJuego {
  readonly panel: Panel
  readonly nodo: Node3D
  readonly botones = new Map<string, Boton>()
  private readonly barras = new Map<Difficulty, ReturnType<typeof barra>>()
  private readonly iconosDelConfort = new Map<Confort, ReturnType<typeof figura>>()
  private readonly iconosDelModo = new Map<GameMode, ReturnType<typeof figura>>()
  /** La marca del modo que da medalla: un disco dorado en la esquina de su botón. */
  private readonly marcasDeMedalla = new Map<GameMode, ReturnType<typeof figura>>()
  private readonly aroDelSinFin: ReturnType<typeof figura>
  private readonly aroDeLosGoles: ReturnType<typeof figura>
  private readonly estrellas: ReturnType<typeof figura>[] = []
  /** La ventana del decorado: el marco y los dos interiores, la sala y tu habitación. */
  private readonly ventana: { marco: ReturnType<typeof figura>; place: ReturnType<typeof figura>; room: ReturnType<typeof figura> }
  readonly goles = new Cifras(CIFRAS_DEL_MENU.goles, PALETTE.foreground)
  readonly nivel = new Cifras(CIFRAS_DEL_MENU.nivel, PALETTE.foreground)
  readonly total = new Cifras(CIFRAS_DEL_MENU.total, DIM)
  readonly record = new Cifras(CIFRAS_DEL_MENU.record, DIM)

  constructor(acciones: AccionesDelMenu, punteria: Punteria) {
    this.panel = new Panel({ ancho: MENU_PANEL.width, alto: MENU_PANEL.height, fondo: PALETTE.background, opacidad: 0.86 })
    this.nodo = this.panel.nodo

    for (const confort of CONFORTS) {
      const b = this.anadir(`confort ${confort}`, PALETTE.rail, 0.7, () => acciones.elegirConfort(confort))
      this.iconosDelConfort.set(confort, b.dibujo(figura(triangulosDelConfort(confort), DIM), DIM))
    }
    for (const modo of GAME_MODE_ORDER) {
      const b = this.anadir(`modo ${modo}`, PALETTE.rail, 0.7, () => acciones.elegirModo(modo))
      // El icono, subido para dejarle al nombre la franja de abajo del botón (`MENU_MODE_ICON_RISE`).
      this.iconosDelModo.set(modo, b.dibujo(figura(desplazar(triangulosDelModo(modo), 0, MENU_MODE_ICON_RISE), DIM), DIM))
      const esquina = [MENU_BUTTON.mode[0] / 2 - MARCA_DE_MEDALLA * 1.6, MENU_BUTTON.mode[1] / 2 - MARCA_DE_MEDALLA * 1.6] as const
      this.marcasDeMedalla.set(modo, b.dibujo(figura(circulo(MARCA_DE_MEDALLA, esquina[0], esquina[1], 20), PALETA.oro), PALETA.oro))
    }
    DIFFICULTY_ORDER.forEach((nivel, i) => {
      const b = this.anadir(`nivel ${nivel}`, PALETTE.rail, 0.85, () => acciones.elegirDificultad(nivel))
      const alto = levelBarHeight(i, DIFFICULTY_ORDER.length)
      this.barras.set(nivel, b.dibujo(barra(0.05, alto, LEVEL_BAR_BOTTOM, DIM), DIM))
    })
    this.anadir('menos', PALETTE.rail, 0.8, () => acciones.mover(-1)).dibujo(iconoDeSigno('menos', 0.04, PALETTE.foreground), PALETTE.foreground)
    this.anadir('mas', PALETTE.rail, 0.8, () => acciones.mover(1)).dibujo(iconoDeSigno('mas', 0.04, PALETTE.foreground), PALETTE.foreground)
    const sinFin = this.anadir('sin fin', PALETTE.rail, 0.8, () => acciones.sinFin())
    this.aroDelSinFin = sinFin.dibujo(figura(triangulosDeArco(0.018, 0.028), DIM), DIM)
    // El decorado: la sala o tu habitación. Sin realidad aumentada se ve apagado con lo que está
    // puesto al lado, como en la web.
    const escenario = this.anadir('escenario', PALETTE.rail, 0.8, () => acciones.alternarEscenario())
    const cerrada = triangulosDeLaVentana(false)
    this.ventana = {
      marco: escenario.dibujo(figura(cerrada.marco, DIM), DIM),
      place: escenario.dibujo(figura(cerrada.dentro, DIM), DIM),
      room: escenario.dibujo(figura(triangulosDeLaVentana(true).dentro, DIM), DIM),
    }
    escenario.apagado = true
    this.anadir('jugar', PALETTE.primary, 1, () => acciones.jugar()).dibujo(iconoDeJugar(0.045, PALETTE.primaryInk), PALETTE.primaryInk)
    const salir = botonDeSalir({
      caja: cajaDe(MENU_BOXES.salir),
      color: PALETTE.rail,
      opacidad: 0.8,
      flecha: PALETTE.foreground,
      id: 'salir',
      alPulsar: () => acciones.salir(),
    })
    this.panel.boton(salir)
    this.botones.set('salir', salir)

    // Lo que no es botón: las cifras, el aro del sin fin en el sitio de los goles y las estrellas.
    const colgar = (nodo: Node3D, x: number, y: number) => {
      nodo.position = new Vector3(x, y, 0.004)
      this.nodo.add_child(nodo)
    }
    colgar(this.goles.nodo, 0, MENU_ROW.goals)
    colgar(this.nivel.nodo, -0.03, MENU_ROW.goals + 0.01)
    colgar(this.total.nodo, 0.07, MENU_ROW.goals + 0.01)
    colgar(this.record.nodo, MENU_RECORD_X, MENU_ROW.record)
    this.aroDeLosGoles = figura(triangulosDeArco(0.03, 0.045, 0, Math.PI * 2, 32), PALETTE.foreground)
    colgar(this.aroDeLosGoles, 0, MENU_ROW.goals)
    const lado = 0.016
    for (let i = 0; i < 3; i++) {
      const rombo = figura(triangulosDeRombo(lado), DIM)
      colgar(rombo, (i - 1) * lado * 1.9, MENU_ROW.goals - 0.07)
      this.estrellas.push(rombo)
    }

    punteria.anadir(...this.botones.values())
  }

  private anadir(id: string, color: string, opacidad: number, alPulsar: () => void): Boton {
    const boton = new Boton({ id, caja: cajaDe(MENU_BOXES[id]), color, opacidad, alPulsar })
    this.panel.boton(boton)
    this.botones.set(id, boton)
    return boton
  }

  boton(id: string): Boton {
    return this.botones.get(id)!
  }

  /** Pinta un estado: qué filas, qué está elegido, qué se apaga y qué se escribe. */
  pintar(estado: EstadoDelMenu): void {
    const t = traductor(estado.lang)
    const practica = estado.modo === 'practice'
    const niveles = estado.modo === 'levels'

    for (const confort of CONFORTS) {
      const elegido = confort === estado.confort
      this.boton(`confort ${confort}`).colorear(elegido ? PALETTE.primaryDeep : PALETTE.rail, elegido ? 0.95 : 0.7)
      this.boton(`confort ${confort}`).colorDelDibujo(this.iconosDelConfort.get(confort)!, elegido ? PALETTE.foreground : DIM)
    }
    for (const modo of GAME_MODE_ORDER) {
      const elegido = modo === estado.modo
      this.boton(`modo ${modo}`).colorear(elegido ? PALETTE.primaryDeep : PALETTE.rail, elegido ? 0.95 : 0.7)
      this.boton(`modo ${modo}`).colorDelDibujo(this.iconosDelModo.get(modo)!, elegido ? PALETTE.primary : DIM)
      this.marcasDeMedalla.get(modo)!.visible = daMedalla(estado.objetivo, modo)
    }
    // La escalera de nivel: la barra crece y el color va del verde al rojo, así que se lee por
    // forma y por color, no solo por color.
    for (const nivel of DIFFICULTY_ORDER) {
      const b = this.boton(`nivel ${nivel}`)
      b.nodo.visible = practica
      const elegido = nivel === estado.dificultad
      b.colorear(elegido ? DIFFICULTY_COLORS[nivel] : PALETTE.rail, 0.85)
      b.colorDelDibujo(this.barras.get(nivel)!, elegido ? PALETTE.foreground : DIM)
    }
    const filaDeGoles = practica || niveles
    const menos = this.boton('menos')
    const mas = this.boton('mas')
    menos.nodo.visible = filaDeGoles
    mas.nodo.visible = filaDeGoles
    menos.apagado = niveles ? estado.nivel <= 1 : estado.sinFin || estado.goles <= MIN_GOALS
    mas.apagado = niveles ? estado.nivel >= estado.abierto : estado.sinFin || estado.goles >= MAX_GOALS
    const sinFin = this.boton('sin fin')
    sinFin.nodo.visible = practica
    sinFin.colorear(estado.sinFin ? PALETTE.primaryDeep : PALETTE.rail, estado.sinFin ? 0.95 : 0.8)
    sinFin.colorDelDibujo(this.aroDelSinFin, estado.sinFin ? PALETTE.foreground : DIM)

    this.goles.nodo.visible = practica && !estado.sinFin
    this.aroDeLosGoles.visible = practica && estado.sinFin
    this.goles.pintar(estado.goles)
    this.nivel.nodo.visible = niveles
    this.total.nodo.visible = niveles
    this.nivel.pintar(estado.nivel)
    this.total.pintar(LEVEL_COUNT)
    for (const [i, rombo] of this.estrellas.entries()) {
      rombo.visible = niveles
      const ganada = i < (estado.estrellas[estado.nivel - 1] ?? 0)
      pintar(rombo, ganada ? PALETA.oro : DIM, ganada ? 1 : 0.35)
    }
    this.record.nodo.visible = estado.record > 0 && !niveles
    this.record.pintar(estado.record)

    const escenario = this.boton('escenario')
    escenario.apagado = !estado.habitacion
    const tinta = estado.habitacion ? PALETTE.foreground : DIM
    for (const pieza of [this.ventana.marco, this.ventana.place, this.ventana.room]) escenario.colorDelDibujo(pieza, tinta)
    this.ventana.place.visible = estado.escenario !== 'room'
    this.ventana.room.visible = estado.escenario === 'room'

    // Lo escrito se rehace entero: son una docena de etiquetas y cambian con el idioma y el modo.
    const { panel } = this
    panel.borrarTextos()
    const izquierda = -MENU_PANEL.width / 2 + 0.05
    panel.escribir(t(LEYENDA_DEL_CONFORT), izquierda, MENU_ROW.comfort, {
      alto: MENU_TEXT.comfort,
      color: DIM,
      alinear: 'left',
      anchoMax: MENU_BOXES['confort off'].position[0] - MENU_BUTTON.small[0] / 2 - 0.02 - izquierda,
    })
    const filas: (readonly [number, TextKey])[] = [
      [MENU_ROW.mode, 'Mode'],
      ...(practica ? [[MENU_ROW.level, 'Level'] as const] : []),
      ...(filaDeGoles ? [[MENU_ROW.goals, niveles ? 'Stage' : 'Goals'] as const] : []),
    ]
    for (const [y, nombre] of filas) {
      panel.escribir(t(nombre), izquierda, y + MENU_ROW_LABEL_RISE, {
        alto: MENU_ROW_LABEL_SIZE,
        color: DIM,
        alinear: 'left',
        anchoMax: MENU_PANEL.width / 2,
      })
    }
    // El nombre de cada modo, debajo de su icono y dentro de su botón (`MENU_MODE_LABEL_DROP`).
    for (const modo of GAME_MODE_ORDER) {
      const [x, y] = MENU_BOXES[`modo ${modo}`].position
      panel.escribir(t(GAME_MODE_LABELS[modo]), x, y + MENU_MODE_LABEL_DROP, {
        alto: MENU_TEXT.mode,
        color: modo === estado.modo ? PALETTE.foreground : DIM,
        anchoMax: MENU_BUTTON.mode[0] - 0.004,
      })
    }
    // Si el modo elegido cuenta para medalla, en la línea del rótulo «Modo» y a su derecha.
    panel.escribir(t(fraseDeLaMedalla(estado.objetivo, estado.modo)), MENU_PANEL.width / 2 - 0.05, MENU_ROW.mode + MENU_ROW_LABEL_RISE, {
      alto: MENU_TEXT.medal,
      color: daMedalla(estado.objetivo, estado.modo) ? PALETA.oro : DIM,
      alinear: 'right',
      anchoMax: MENU_MEDAL_WIDTH,
    })
    const desde = MENU_BOXES.escenario.position[0] + MENU_BUTTON.small[0] / 2 + 0.02
    panel.escribir(t(SCENERY_LABELS[estado.escenario]), desde, MENU_ROW.record, {
      alto: MENU_TEXT.scenery,
      color: DIM,
      alinear: 'left',
      anchoMax: MENU_RECORD_X - 0.07 - desde,
    })
    panel.parrafo(t(GAME_MODE_HINTS[estado.modo]), 0, MENU_HINT_Y, {
      alto: MENU_TEXT.hint,
      color: DIM,
      anchoMax: MENU_PANEL.width - 0.1,
      ancla: 'top',
    })
  }
}
