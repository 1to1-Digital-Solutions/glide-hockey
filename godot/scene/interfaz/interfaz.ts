/**
 * La interfaz de Glide Hockey en Godot, entera: el menú, el final y el aviso de salir en la columna;
 * el marcador al fondo de la mesa; la cuenta atrás sobre el saque; el botón de parar; el tutorial;
 * y la puntería que los hace pulsables.
 *
 * **Dónde va cada cosa es lo de la web** (`reparto.ts`): con el visor, la columna a metro y medio y
 * 55° a la izquierda, agrandada y mirando a los ojos, fuera de la mesa; el marcador sobre la
 * portería de la máquina; el botón de parar donde la columna, que mientras se juega está vacía. **En
 * plano** —donde la web pone su menú en DOM— la columna va a la izquierda de la mesa, de cara a la
 * cámara, y el botón de parar junto al marcador: la cámara de plano no ve lo que hay a 55°.
 *
 * **Nunca dos paneles llenos a la vez en la columna**: el menú, el final y el aviso se turnan, y la
 * fase la decide la partida (`partida.ts`), no la interfaz.
 */
import { Node3D, Transform3D, Vector3, type Camera3D, type InputEvent } from 'godot'

import type { Puntero } from '@kit/lib/ui/puntero'
import { Punteria } from '@kit/runtime/ui/punteria'
import { PunteroDeRaton } from '@kit/runtime/ui/raton'
import type { MandoEnLaMano } from '@kit/runtime/ui/tutorial'

import type { GrabMode, Lang } from '@/lib/ajustes'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from '@/lib/gameConfig'
import { isEndless } from '@/lib/gameMode'

import { alCambiarElIdioma, confort, elegirConfort, idioma } from './ajustes'
import { AvisoDeSalir, BotonesDeParar } from './aviso'
import { FinalDeLaPartida } from './final'
import { CuentaAtras, Marcador } from './marcador'
import { MenuDelJuego, type EstadoDelMenu } from './menu'
import type { Partida } from './partida'
import {
  ESCALA_DEL_BOTON,
  ESCALA_DE_LA_COLUMNA,
  INCLINACION_DEL_MARCADOR,
  XR_QUIT,
  XR_UI,
  XR_UI_ROTATION,
  type Triple,
} from './reparto'
import { TutorialDelJuego } from './tutorial'

/** Lo que la interfaz le pide a la escena, además de lo que le pide a la partida. */
export interface EscenaDelJuego {
  /** Volver al salón, o cerrar el juego. */
  salir(): void
}

export interface OpcionesDeLaInterfaz {
  /** El espacio de la mesa: su centro, a la altura del tablero. De ahí cuelga todo, como en la web. */
  mesa: Node3D
  /** La cámara de plano, de la que sale el rayo del ratón. Con visor, `null`. */
  camara: Camera3D | null
  /** Los punteros del visor (`XRPlayer.punteros()`), además del ratón. */
  punteros?: readonly Puntero[]
  visor: boolean
  /** Idioma forzado por la línea de órdenes (`--lang=es`), para mirar sin tocar el guardado. */
  lang?: string | null
  /** Enseñar el tutorial también en plano (`--tutorial`). */
  tutorial?: boolean
  manos?: readonly MandoEnLaMano[]
}

/**
 * Dónde va la columna en plano, en el espacio de la mesa: a la izquierda de la mesa y sobre el
 * suelo oscuro de la sala. Encima de la mesa, el tablero blanco se veía a través de los paneles,
 * que son translúcidos como en el visor, y las cifras blancas no se leían.
 */
export const COLUMNA_EN_PLANO: Triple = [-1.05, 0.5, 0.35]
/** Y el botón de parar en plano: a la izquierda del marcador, que es donde se mira jugando. */
export const PARAR_EN_PLANO: Triple = [-0.48, XR_UI.scoreboard[1], XR_UI.scoreboard[2]]

function colocar(nodo: Node3D, donde: readonly [number, number, number], giro: readonly [number, number, number, string] | null, escala = 1): void {
  nodo.position = new Vector3(donde[0], donde[1], donde[2])
  // `Node3D` gira en orden YXZ, el mismo que las rotaciones de la web (`panelRotation`).
  if (giro != null) nodo.rotation = new Vector3(giro[0], giro[1], giro[2])
  nodo.scale = new Vector3(escala, escala, escala)
}

export class InterfazDelJuego {
  readonly punteria: Punteria
  readonly raton: PunteroDeRaton | null
  readonly columna = new Node3D()
  readonly menu: MenuDelJuego
  readonly final: FinalDeLaPartida
  readonly aviso: AvisoDeSalir
  readonly parar: BotonesDeParar
  readonly marcador: Marcador
  readonly cuenta: CuentaAtras
  readonly tutorial: TutorialDelJuego
  private pintado = ''
  private readonly langForzado: string | null
  private readonly tutorialEnPlano: boolean
  private readonly visor: boolean
  private readonly dejarDeEscuchar: () => void

  constructor(
    private readonly partida: Partida,
    private readonly escena: EscenaDelJuego,
    opciones: OpcionesDeLaInterfaz,
  ) {
    this.visor = opciones.visor
    this.langForzado = opciones.lang ?? null
    this.tutorialEnPlano = opciones.tutorial ?? false
    this.raton = opciones.camara == null ? null : new PunteroDeRaton(opciones.camara)
    this.punteria = new Punteria([...(this.raton == null ? [] : [this.raton]), ...(opciones.punteros ?? [])])
    const { mesa } = opciones

    this.columna.set_name('Columna')
    mesa.add_child(this.columna)
    if (this.visor) colocar(this.columna, XR_UI.panel, XR_UI_ROTATION.panel, ESCALA_DE_LA_COLUMNA)
    else {
      // Paralela a la pantalla: girada hacia la cámara como un panel del visor (`panelRotation`),
      // a un lado de la imagen se veía torcida, porque la cámara de plano mira hacia abajo.
      const camara = opciones.camara!
      this.columna.global_transform = new Transform3D(camara.global_basis, mesa.to_global(new Vector3(...COLUMNA_EN_PLANO)))
    }

    this.menu = new MenuDelJuego(
      {
        elegirModo: (modo) => partida.setGameMode(modo),
        elegirDificultad: (d) => partida.setDifficulty(d),
        elegirConfort: (c) => elegirConfort(c),
        mover: (signo) => (partida.levels ? partida.setLevel(partida.activeLevel + signo) : partida.setGoalTarget(partida.goalTarget + signo)),
        sinFin: () => partida.setEndless(!partida.endless),
        jugar: () => partida.startGame(),
        salir: () => escena.salir(),
      },
      this.punteria,
    )
    this.columna.add_child(this.menu.nodo)

    this.final = new FinalDeLaPartida({ otraVez: () => partida.startGame(), menu: () => partida.resetGame(), salir: () => escena.salir() }, this.punteria)
    this.columna.add_child(this.final.nodo)

    // Delante de todo lo de la columna: sale encima de la partida parada.
    this.aviso = new AvisoDeSalir({ seguir: () => partida.keepPlaying(), menu: () => partida.resetGame(), dejar: () => escena.salir() }, this.punteria)
    this.aviso.nodo.position = new Vector3(0, 0, 0.03)
    this.columna.add_child(this.aviso.nodo)

    this.parar = new BotonesDeParar({ parar: () => partida.askToQuit(), terminar: () => partida.endRun() }, this.punteria)
    if (this.visor) colocar(this.parar.nodo, XR_QUIT, XR_UI_ROTATION.quit, ESCALA_DEL_BOTON)
    else colocar(this.parar.nodo, PARAR_EN_PLANO, [INCLINACION_DEL_MARCADOR, 0, 0, 'YXZ'], ESCALA_DE_LA_COLUMNA)
    mesa.add_child(this.parar.nodo)

    this.marcador = new Marcador()
    colocar(this.marcador.nodo, XR_UI.scoreboard, [INCLINACION_DEL_MARCADOR, 0, 0, 'YXZ'])
    mesa.add_child(this.marcador.nodo)

    this.cuenta = new CuentaAtras()
    colocar(this.cuenta.nodo, XR_UI.countdown, null)
    mesa.add_child(this.cuenta.nodo)

    this.tutorial = new TutorialDelJuego(this.punteria, opciones.manos)
    if (this.tutorialEnPlano) this.tutorial.forzar()
    colocar(this.tutorial.vista.nodo, XR_UI.tutorial, XR_UI_ROTATION.tutorial)
    mesa.add_child(this.tutorial.vista.nodo)

    // Si el salón cambia el idioma con el juego abierto, se repinta al siguiente fotograma.
    this.dejarDeEscuchar = alCambiarElIdioma(() => (this.pintado = ''))
    this.pintarFase()
  }

  get lang(): Lang {
    return idioma(this.langForzado)
  }

  /**
   * Escape en plano, o B/Y y el botón de menú con visor: en el menú sale del juego; en la partida
   * pregunta (o deja de preguntar); en el final vuelve al menú.
   */
  escape(): void {
    const fase = this.partida.gameState
    if (fase === 'menu') this.escena.salir()
    else if (fase === 'finished') this.partida.resetGame()
    else if (this.partida.prompt != null) this.partida.keepPlaying()
    else this.partida.askToQuit()
  }

  /** Un evento de entrada: el ratón lo lleva la puntería. */
  recibir(evento: InputEvent): boolean {
    return this.raton?.recibir(evento) ?? false
  }

  /** Si algún puntero está sobre un botón. */
  apuntaAUnBoton(): boolean {
    return this.punteria.punteros.some((p) => this.punteria.apuntando(p.id) != null)
  }

  /** Lo que enseña el menú ahora mismo. */
  estadoDelMenu(): EstadoDelMenu {
    const p = this.partida
    return {
      lang: this.lang,
      modo: p.gameMode,
      dificultad: p.difficulty,
      goles: p.goalTarget,
      sinFin: p.endless,
      nivel: p.activeLevel,
      abierto: p.unlockedLevel,
      estrellas: p.levelStars,
      record: p.bestPoints,
      confort: confort(),
    }
  }

  /** Un fotograma: la puntería (que puede cambiar la fase) y luego pintar lo que toca. */
  actualizar(delta: number, { agarre = 'hold' as GrabMode } = {}): void {
    this.punteria.actualizar()
    this.pintarFase()
    const p = this.partida
    const fase = p.gameState
    const lang = this.lang
    if (fase === 'menu') {
      const estado = this.estadoDelMenu()
      const clave = JSON.stringify(estado)
      if (clave !== this.pintado) {
        this.menu.pintar(estado)
        this.pintado = clave
      }
    } else this.pintado = ''
    if (fase !== 'menu') {
      this.marcador.pintar({
        jugador: p.playerGoals,
        maquina: p.opponentGoals,
        puntos: p.points,
        fila: p.round ?? (p.levels ? p.activeLevel : null),
        vuelta: p.lap != null && p.lap > 1 ? p.lap : null,
      })
    }
    this.cuenta.pintar(fase === 'countdown' ? { cuenta: p.cuenta, esperandoElMazo: p.esperandoElMazo, conUnToque: agarre === 'toggle', lang } : null)
    if (fase === 'finished') {
      const nivel = p.levelResult
      this.final.pintar({
        lang,
        outcome: p.outcome!,
        puntos: p.points,
        esRecord: p.isRecord,
        nivel: nivel == null ? null : { nivel: p.activeLevel, stars: nivel.stars, passed: nivel.passed },
      })
    }
    if (p.prompt != null) this.aviso.escribir(lang)
    const tutorial = fase === 'playing' && (this.visor || this.tutorialEnPlano) && !p.enReto
    this.tutorial.actualizar(tutorial, p.hitos, lang, agarre, delta)
  }

  /** Enseña los paneles de la fase, ya: un botón que aparece tiene que poder pulsarse enseguida. */
  private pintarFase(): void {
    const p = this.partida
    const fase = p.gameState
    const enPartida = fase === 'countdown' || fase === 'playing'
    this.menu.nodo.visible = fase === 'menu'
    this.final.nodo.visible = fase === 'finished'
    this.aviso.nodo.visible = enPartida && p.prompt != null
    this.marcador.nodo.visible = fase !== 'menu'
    this.parar.mostrar(enPartida && p.prompt == null, isEndless(p.activeGoalTarget) && fase === 'playing')
  }

  /** Deja de escuchar el guardado: al salir de la escena. */
  soltar(): void {
    this.dejarDeEscuchar()
  }
}

/** Dónde está la mesa en el espacio de quien juega: de ahí cuelga todo lo de aquí. */
export const MESA = new Vector3(0, TABLE_HEIGHT, TABLE_CENTER_Z)
