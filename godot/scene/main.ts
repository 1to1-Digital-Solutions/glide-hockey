/**
 * Glide Hockey en Godot: la mesa, el disco, los dos mazos, la entrada y el sonido.
 *
 * **Todo lo que decide algo viene de `glide-hockey/src/lib`**, el mismo código que la web y con
 * sus mismos tests: la física del disco y el paso fijo (`matchLoop.ts`, `puckPhysics.ts`), la
 * máquina y su semilla (`opponent.ts`), los puntos, los modos, la escalera del reto y los niveles.
 * La física de Godot no se usa para nada: la mesa avanza con `advanceTable` a pasos de 1/60 s
 * exactos, sea cual sea el ritmo de fotogramas, y la escena solo coloca lo que sale. La sesión
 * —qué se ha elegido, en qué fase se está, el marcador— es `interfaz/partida.ts`, el `gameStore`
 * de la web sin React.
 *
 * Tres formas de mover el mazo, y las tres acaban en el mismo `pointer` de `advanceTable`:
 * - **con visor, cogido con la mano**: la gramática XR del kit (`@kit/runtime/xr/jugador`) planta
 *   la mesa donde la presta el salón, la baja a los ojos de quien juega sentado, la gira con el
 *   stick de la mano libre, y deja coger el mazo con el puño (o un pellizco) de cualquier mano,
 *   con la buena por delante. Cogido, el mazo va donde el puño sobrevuela la mesa (`inHand`) y
 *   golpea con la velocidad de la mano. Vibra con las recetas de `tactos.ts`;
 * - **en plano, con el ratón** sobre la mesa: el mazo persigue al puntero con su tope de
 *   velocidad, como en la web;
 * - **con `-- --autoplay`**, el jugador automático (`bot.ts`): juega una partida entera contra la
 *   máquina hasta el final, que es lo que usan los tests y la medida del coste por fotograma.
 *
 * Suena con los efectos de la web, renderizados de su `audioEngine.ts` por
 * `xrcade/godot-kit/render-sfx.mjs`, con el roce del disco en bucle siguiendo a su velocidad, y con
 * su música y su fundido. El gol en contra es además un
 * golpe que recibe el cuerpo (`golpe.ts`), como en la web.
 *
 * **El reto del salón** (`semilla.ts`): la escena lo lee de `-- --reto=<semilla>` o del salón si lo
 * presta (`retoDelSalon`), y al acabar cada partida cuenta el resultado (`contarAlSalon`); el hub
 * nativo pasa la semilla del reto del día y apunta el resultado.
 */
import {
  AudioServer,
  BaseMaterial3D,
  Basis,
  BoxMesh,
  Callable,
  Camera3D,
  Color,
  CylinderMesh,
  DirectionalLight3D,
  DisplayServer,
  Environment,
  InputEvent,
  InputEventKey,
  Key,
  MeshInstance3D,
  Node,
  Node3D,
  OmniLight3D,
  StandardMaterial3D,
  Time,
  Transform3D,
  Vector2,
  Vector3,
  WorldEnvironment,
  XRServer,
  print,
} from 'godot'

import { triangulosDeArco } from '@kit/lib/ui/iconos'
import type { Punto2 } from '@kit/lib/ui/salida'
import type { Mano } from '@kit/lib/xr/manos'
import { IDENTIDAD } from '@kit/lib/xr/pose'
import { gameStorage } from '@kit/motor/almacen-godot'
import { aislarElGuardado, argumento, hayBandera } from '@kit/runtime/argumentos'
import { Music, Sfx, type Loop } from '@kit/runtime/sfx'
import { figura } from '@kit/runtime/ui/malla'
import { XRPlayer, type Agarrable } from '@kit/runtime/xr/jugador'
import { simularMandos, type Simulacion } from '@kit/runtime/xr/simulado'

import * as agarre from '@/lib/agarre'
import {
  GOAL_WIDTH,
  MALLET_RADIUS,
  OPPONENT_SKILLS,
  PUCK_RADIUS,
  RAIL_HEIGHT,
  TABLE_CENTER_Z,
  TABLE_HEIGHT,
  TABLE_LENGTH,
  TABLE_WIDTH,
} from '@/lib/gameConfig'
import type { GameMode } from '@/lib/gameMode'
import type { Difficulty } from '@/lib/gameConfig'
import { FUERZA_DEL_GOL_EN_CONTRA, direccionDelGolEnContra } from '@/lib/golEnContra'
import { getBestPoints } from '@/lib/highScore'
import * as hostAnchor from '@/lib/hostAnchor'
import { ALCANCE_DE_AGARRE } from '@/lib/malletGrab'
import { advanceTable, startTable, type TableState } from '@/lib/matchLoop'
import { MUSIC_VOLUME } from '@/lib/music'
import { MUSIC_FADE_MS, fadeVolume } from '@/lib/musicFade'
import { playerStart } from '@/lib/opponent'
import { PALETTE } from '@/lib/palette'
import * as pellizco from '@/lib/pellizco'
import { puckGlow } from '@/lib/puckGlow'
import { HALF_LENGTH, HALF_WIDTH, constrainMallet, type Vec2 } from '@/lib/puckPhysics'
import type { Resultado, Reto } from '@/lib/semilla'
import { SLIDE_SMOOTHING } from '@/lib/slideSound'
import * as uiHeight from '@/lib/uiHeight'

import { acercar, destinoDelBot } from './juego/bot'
import { GolpeRecibido } from './juego/golpe'
import { confort, niveles } from './interfaz/ajustes'
import { InterfazDelJuego } from './interfaz/interfaz'
import { Partida } from './interfaz/partida'
import { efectoDelChoque, impactStrength, pulsosDelSuceso, roceDelDisco, sucesosDelFotograma, type SucesoEnLaMano } from './juego/sucesos'

/**
 * Todos los efectos renderizados (`godot-kit.json`, `sfx.sounds`): el golpe y el rebote a tres
 * fuerzas, el gol y los tres cierres. El roce del disco va aparte: es un bucle (`sfx.loops`) que
 * suena mientras el disco se mueve.
 */
export const SOUNDS = [
  'strike-suave',
  'strike-medio',
  'strike-fuerte',
  'bounce-suave',
  'bounce-medio',
  'bounce-fuerte',
  'goal',
  'win',
  'loss',
  'record',
] as const
const SFX_DIR = 'res://games/glide-hockey/sfx'
const BUS_DEL_JUEGO = 'GlideHockey'
const MUSIC_PATH = 'res://games/glide-hockey/music/sala.mp3'

/** Medidas del mobiliario que en la web están en los componentes (`Table.tsx`, `Mallet.tsx`, `Puck.tsx`). */
const TOP_THICKNESS = 0.05
const RAIL_THICKNESS = 0.04
const PUCK_HEIGHT = 0.022
const MALLET_BASE = 0.028
const MALLET_KNOB = 0.045
const MARKING_COLOR = '#9db4cc'
const GOAL_MOUTH_COLOR = '#050a12'
const LEG_COLOR = '#0d1626'
const CARPET_COLOR = '#141d33'
const CEILING_COLOR = '#070b14'

/**
 * La cámara en plano, la de la web (`GameCanvas.tsx`): asomada sobre la mesa desde su borde, más
 * alta que de pie y un poco atrás, que es desde donde se ven las dos porterías a la vez, mirando
 * al centro de la mesa, con 46° de campo vertical.
 */
const CAMARA_EN_PLANO = { position: new Vector3(0, 2.65, 1.5), mira: new Vector3(0, TABLE_HEIGHT, TABLE_CENTER_Z), fov: 46 }

/**
 * La partida del jugador automático: la práctica contra la máquina más fuerte, a siete goles. Contra
 * las demás el jugador automático gana sin encajar, y un gol en contra es lo que hace que el test
 * pase también por el golpe recibido.
 */
const PARTIDA_DEL_BOT: { modo: GameMode; goles: number; dificultad: Difficulty } = { modo: 'practice', goles: 7, dificultad: 'impossible' }

/** A qué altura sobre la mesa lleva el puño el jugador automático con visor. */
const ALTURA_DEL_PUNO = 0.06
/** En qué fotograma empuja el jugador automático el stick de la mano libre, para girar. */
const FOTOGRAMA_DEL_GIRO = 60

type Driver = 'xr' | 'mouse' | 'bot'

/** Un rectángulo centrado en el origen, en dos triángulos: las rayas de la mesa. */
function raya(ancho: number, alto: number): Punto2[] {
  const x = ancho / 2
  const y = alto / 2
  return [[-x, -y], [x, -y], [x, y], [-x, -y], [x, y], [-x, y]]
}

/**
 * El reto que presta el salón, si lo hay. Primero la línea de órdenes (`-- --reto=<semilla>`), que
 * es como se prueba; luego el salón, si su autoload `XRcade` lleva el metadato `challenge_seed`
 * (lo pone el hub nativo al entrar por el reto del día; contrato en `xrcade/docs/anadir-un-juego.md`
 * §3, el mismo que la web: `Reto` de `semilla.ts`).
 */
export function retoDelSalon(nodo: Node): Reto | null {
  const linea = argumento('reto')
  if (linea != null && linea.trim() !== '' && Number.isFinite(Number(linea))) return { semilla: Number(linea) >>> 0 }
  const xrcade = nodo.get_node_or_null('/root/XRcade')
  if (xrcade != null && xrcade.has_meta('challenge_seed')) return { semilla: Number(xrcade.get_meta('challenge_seed')) >>> 0 }
  return null
}

/**
 * Le cuenta al salón cómo ha acabado una partida con puntuación (`Resultado` de `semilla.ts`): si el
 * autoload tiene `report_result`, se le llama con el resultado en JSON; y siempre queda en el log.
 * Como `retoDelSalon`, es el enganche para cuando el hub nativo los recoja.
 */
export function contarAlSalon(nodo: Node, resultado: Resultado): void {
  const texto = JSON.stringify(resultado)
  print(`GH-RESULTADO ${texto}`)
  const xrcade = nodo.get_node_or_null('/root/XRcade')
  if (xrcade != null && xrcade.has_method('report_result')) (xrcade as unknown as { call(m: string, a: string): unknown }).call('report_result', texto)
}

export default class GlideHockey extends Node3D {
  private partida!: Partida
  private interfaz!: InterfazDelJuego
  private driver: Driver = 'mouse'
  private table: TableState | null = null
  /** El `runId` de la partida con la que se puso la mesa: al cambiar, se pone otra. */
  private mesaDe = -1
  private pointer: Vec2 = playerStart()
  private enLaMano = false

  /** Donde cuelga el decorado: el mundo del jugador con visor, o la propia escena. */
  private escena!: Node3D
  /** El espacio de la mesa: su centro, a la altura del tablero. */
  private mesa!: Node3D
  /** Lo que se sacude con el golpe recibido: la sala, no la mesa. */
  private sala!: Node3D
  private camera: Camera3D | null = null
  private puck!: Node3D
  private puckMaterial!: StandardMaterial3D
  private playerMallet!: Node3D
  private playerMalletMaterial!: StandardMaterial3D
  private opponentMallet!: Node3D
  private goalLight!: OmniLight3D

  private player: XRPlayer | null = null
  /** Lo que coge la mano: un punto invisible sobre el mazo, que la gramática XR lleva al puño. */
  private asa: Node3D | null = null
  private agarreDelMazo: Agarrable | null = null
  private sim: Simulacion | null = null
  private framesXr = 0
  /** Dónde lleva la mano el jugador automático con visor, en la mesa. */
  private manoDelBot: Vec2 = playerStart()
  private manosQueLoLlevaron = new Set<Mano>()

  private sfx!: Sfx
  private music!: Music
  /** El roce del disco: el bucle, y la velocidad del disco que se pinta, que es la que suena. */
  private roce!: Loop
  private velocidadDelDisco = 0
  private golpe!: GolpeRecibido
  private terminada = -1
  private tiempo = 0

  private frames = 0
  private logicUsecTotal = 0
  private logicUsecMax = 0
  private logicUsecMaxEnJuego = 0
  private startedMs = 0
  private goles: ('player' | 'opponent')[] = []
  private resultados: Resultado[] = []
  private shotPath: string | null = null
  private shotMenuPath: string | null = null
  private shotFinalPath: string | null = null
  private framesEnFase = 0
  /** Lo pone una escena de test (metadato `harness`): juega sola y deja el resultado en `result`. */
  private harness = false
  /** La escena de test del menú (`tests/menu_raton.gd`): empieza en el menú y no cierra al salir. */
  private harnessMenu = false

  _ready(): void {
    this.harnessMenu = this.has_meta('harness_menu')
    this.harness = this.has_meta('harness') || this.harnessMenu
    // Una escena de test o una captura guarda aparte y empieza de cero: si no, la marca del jugador
    // automático acabaría como récord de quien tenga el juego, y cada pasada dependería de la anterior.
    aislarElGuardado(this.harness)
    const autoplay = hayBandera('autoplay') || (this.harness && !this.harnessMenu)
    this.shotPath = argumento('shot')
    this.shotMenuPath = argumento('shot-menu')
    this.shotFinalPath = argumento('shot-final')
    const simulado = this.harness && this.has_meta('xr_simulado')
    this.driver = simulado ? 'xr' : autoplay ? 'bot' : this.startXr() ? 'xr' : 'mouse'

    this.escena = this
    if (this.driver === 'xr') this.buildXrPlayer(simulado)
    this.buildWorld()
    this.buildTable()
    this.buildPieces()
    if (this.player == null) this.buildCamera()
    this.buildSound()

    this.partida = new Partida({ reto: retoDelSalon(this), alTerminar: (r) => this.alTerminar(r) })
    this.partida.immersive = this.driver === 'xr'
    this.interfaz = new InterfazDelJuego(
      this.partida,
      { salir: () => this.exit() },
      {
        mesa: this.mesa,
        camara: this.camera,
        punteros: this.player?.punteros() ?? [],
        visor: this.driver === 'xr',
        lang: argumento('lang'),
        tutorial: hayBandera('tutorial'),
      },
    )
    this.golpe = new GolpeRecibido({
      reloj: () => this.tiempo,
      sacudido: this.sala,
      camara: this.player?.camara ?? this.camera,
      confort,
      vibrar: this.player == null ? undefined : (pulsos) => this.player!.vibrar(pulsos),
      bus: BUS_DEL_JUEGO,
    })
    // El jugador automático no pasa por el menú: juega siempre la misma partida (`PARTIDA_DEL_BOT`).
    if ((this.driver === 'bot' || this.sim != null) && !this.partida.running) {
      this.partida.setGameMode(PARTIDA_DEL_BOT.modo)
      this.partida.setGoalTarget(Number(argumento('goles') ?? PARTIDA_DEL_BOT.goles))
      const dificultad = argumento('dificultad') ?? (this.has_meta('dificultad') ? String(this.get_meta('dificultad')) : null)
      this.partida.setDifficulty(dificultad != null && dificultad in OPPONENT_SKILLS ? (dificultad as Difficulty) : PARTIDA_DEL_BOT.dificultad)
      this.partida.startGame()
    }
    this.startedMs = Time.get_ticks_msec()
  }

  /** El mismo arranque que el hub: si no hay runtime de OpenXR, sigue en plano. */
  private startXr(): boolean {
    const xr = XRServer.find_interface('OpenXR')
    if (xr == null) return false
    if (!xr.is_initialized() && !xr.initialize()) return false
    DisplayServer.window_set_vsync_mode(DisplayServer.VSyncMode.VSYNC_DISABLED)
    this.get_viewport()!.use_xr = true
    return true
  }

  /**
   * El bus del juego: todo lo que suena pasa por él, y es donde el golpe recibido pone su paso bajo
   * sin tocar el maestro, que es del salón. Desemboca en el maestro, o en el bus silenciado de la
   * escena de test (metadato `sfx_bus`), que cuenta igual y no suena. Se quita al salir.
   */
  private busDelJuego(): string {
    let indice = AudioServer.get_bus_index(BUS_DEL_JUEGO)
    if (indice < 0) {
      AudioServer.add_bus()
      indice = AudioServer.bus_count - 1
      AudioServer.set_bus_name(indice, BUS_DEL_JUEGO)
    }
    AudioServer.set_bus_send(indice, this.has_meta('sfx_bus') ? String(this.get_meta('sfx_bus')) : 'Master')
    return BUS_DEL_JUEGO
  }

  _exit_tree(): void {
    this.roce?.stop()
    const indice = AudioServer.get_bus_index(BUS_DEL_JUEGO)
    if (indice > 0) AudioServer.remove_bus(indice)
  }

  private buildSound(): void {
    const bus = this.busDelJuego()
    this.sfx = new Sfx(this, { dir: SFX_DIR, names: SOUNDS, bus, levels: niveles })
    this.roce = this.sfx.loop('slide', { smoothing: SLIDE_SMOOTHING })
    this.music = new Music(this, { path: MUSIC_PATH, volume: MUSIC_VOLUME, fade: fadeVolume, fadeMs: MUSIC_FADE_MS, bus, levels: niveles })
    this.music.start()
  }

  private material(color: string, rugosidad = 0.6): StandardMaterial3D {
    const m = new StandardMaterial3D()
    m.albedo_color = Color.html(color)
    m.roughness = rugosidad
    return m
  }

  private box(size: Vector3, color: string, rugosidad?: number): MeshInstance3D {
    const mesh = new BoxMesh()
    mesh.size = size
    const node = new MeshInstance3D()
    node.mesh = mesh
    node.material_override = this.material(color, rugosidad)
    return node
  }

  private cylinder(top: number, bottom: number, height: number, material: StandardMaterial3D): MeshInstance3D {
    const mesh = new CylinderMesh()
    mesh.top_radius = top
    mesh.bottom_radius = bottom
    mesh.height = height
    mesh.radial_segments = 32
    const node = new MeshInstance3D()
    node.mesh = mesh
    node.material_override = material
    return node
  }

  /**
   * Una pieza plana tumbada sobre el tablero: las marcas y los umbrales. La forma es la de las
   * figuras del kit, pero **opaca**: con el material translúcido de la interfaz, su orden de
   * pintado la ponía por delante de los paneles de la columna, que también son translúcidos.
   */
  private sobreLaMesa(triangulos: readonly Punto2[], color: string, z: number): void {
    const nodo = figura(triangulos, color)
    const m = new StandardMaterial3D()
    m.shading_mode = BaseMaterial3D.ShadingMode.SHADING_MODE_UNSHADED
    m.cull_mode = BaseMaterial3D.CullMode.CULL_DISABLED
    m.albedo_color = Color.html(color)
    nodo.material_override = m
    nodo.rotation = new Vector3(-Math.PI / 2, 0, 0)
    nodo.position = new Vector3(0, 0.001, z)
    this.mesa.add_child(nodo)
  }

  private buildWorld(): void {
    const environment = new Environment()
    environment.background_mode = Environment.BGMode.BG_COLOR
    environment.background_color = Color.html(CEILING_COLOR)
    environment.ambient_light_source = Environment.AmbientSource.AMBIENT_SOURCE_COLOR
    environment.ambient_light_color = Color.html('#5a6b8c')
    const world = new WorldEnvironment()
    world.environment = environment
    this.add_child(world)

    // La luz de la sala: una cenital que hace de foco sobre la mesa (`GameWorld.tsx`).
    const sun = new DirectionalLight3D()
    sun.rotation = new Vector3(-1.05, 0.5, 0)
    sun.light_energy = 1.1
    sun.shadow_enabled = true
    this.add_child(sun)

    this.sala = new Node3D()
    this.sala.set_name('Sala')
    this.escena.add_child(this.sala)
    const floor = this.box(new Vector3(9, 0.02, 10), CARPET_COLOR, 0.95)
    floor.position = new Vector3(0, -0.01, TABLE_CENTER_Z)
    this.sala.add_child(floor)
  }

  /** La mesa de `Table.tsx`: tablero, marcas, bandas partidas por las porterías y patas. */
  private buildTable(): void {
    this.mesa = new Node3D()
    this.mesa.set_name('Mesa')
    this.mesa.position = new Vector3(0, TABLE_HEIGHT, TABLE_CENTER_Z)
    this.escena.add_child(this.mesa)

    const top = this.box(new Vector3(TABLE_WIDTH, TOP_THICKNESS, TABLE_LENGTH), PALETTE.table, 0.18)
    top.position = new Vector3(0, -TOP_THICKNESS / 2, 0)
    this.mesa.add_child(top)

    // Las marcas: la línea de medio campo, el círculo del saque y el área de cada portería.
    this.sobreLaMesa(raya(TABLE_WIDTH, 0.012), MARKING_COLOR, 0)
    this.sobreLaMesa(triangulosDeArco(0.16, 0.172, 0, Math.PI * 2, 48), MARKING_COLOR, 0)
    for (const end of [-1, 1]) {
      // Tumbada, la `y` de la figura es el `−Z` de la mesa: cada área se abre hacia el centro.
      const [desde, hasta] = end === 1 ? [0, Math.PI] : [Math.PI, Math.PI * 2]
      this.sobreLaMesa(triangulosDeArco(0.24, 0.252, desde, hasta, 32), MARKING_COLOR, end * (HALF_LENGTH - 0.001))
    }

    const sideX = HALF_WIDTH + RAIL_THICKNESS / 2
    for (const side of [-1, 1]) {
      const rail = this.box(new Vector3(RAIL_THICKNESS, RAIL_HEIGHT, TABLE_LENGTH + RAIL_THICKNESS * 2), PALETTE.rail, 0.5)
      rail.position = new Vector3(side * sideX, RAIL_HEIGHT / 2, 0)
      this.mesa.add_child(rail)
    }
    const endRail = (TABLE_WIDTH - GOAL_WIDTH) / 2
    const endZ = HALF_LENGTH + RAIL_THICKNESS / 2
    for (const end of [-1, 1]) {
      for (const side of [-1, 1]) {
        const rail = this.box(new Vector3(endRail, RAIL_HEIGHT, RAIL_THICKNESS), PALETTE.rail, 0.5)
        rail.position = new Vector3(side * (GOAL_WIDTH / 2 + endRail / 2), RAIL_HEIGHT / 2, end * endZ)
        this.mesa.add_child(rail)
      }
      // La boca de la portería y su umbral encendido, del color de quien la defiende.
      const mouth = this.box(new Vector3(GOAL_WIDTH, RAIL_HEIGHT, RAIL_THICKNESS), GOAL_MOUTH_COLOR, 0.9)
      mouth.position = new Vector3(0, RAIL_HEIGHT / 2, end * endZ)
      this.mesa.add_child(mouth)
      this.sobreLaMesa(raya(GOAL_WIDTH, 0.04), end === 1 ? PALETTE.primary : PALETTE.rival, end * (HALF_LENGTH - 0.02))
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = this.box(new Vector3(0.06, TABLE_HEIGHT, 0.06), LEG_COLOR, 0.8)
        leg.position = new Vector3(sx * (HALF_WIDTH - 0.08), -TOP_THICKNESS - TABLE_HEIGHT / 2, sz * (HALF_LENGTH - 0.12))
        this.mesa.add_child(leg)
      }
    }

    // La portería del gol se enciende mientras se celebra: se ve dónde ha entrado sin buscar el marcador.
    this.goalLight = new OmniLight3D()
    this.goalLight.omni_range = 1.2
    this.goalLight.light_energy = 0
    this.goalLight.position = new Vector3(0, RAIL_HEIGHT + 0.12, HALF_LENGTH)
    this.mesa.add_child(this.goalLight)
  }

  /** Un mazo de `Mallet.tsx`: la base ancha y el pomo. */
  private mallet(material: StandardMaterial3D): Node3D {
    const node = new Node3D()
    const base = this.cylinder(MALLET_RADIUS, MALLET_RADIUS, MALLET_BASE, material)
    base.position = new Vector3(0, MALLET_BASE / 2, 0)
    node.add_child(base)
    const knob = this.cylinder(MALLET_RADIUS * 0.45, MALLET_RADIUS * 0.55, MALLET_KNOB, material)
    knob.position = new Vector3(0, MALLET_BASE + MALLET_KNOB / 2, 0)
    node.add_child(knob)
    node.visible = false
    this.mesa.add_child(node)
    return node
  }

  private buildPieces(): void {
    this.puckMaterial = this.material(PALETTE.puck, 0.35)
    this.puckMaterial.emission_enabled = true
    this.puckMaterial.emission = Color.html(PALETTE.puck)
    this.puck = new Node3D()
    const body = this.cylinder(PUCK_RADIUS, PUCK_RADIUS, PUCK_HEIGHT, this.puckMaterial)
    body.position = new Vector3(0, PUCK_HEIGHT / 2, 0)
    this.puck.add_child(body)
    this.puck.visible = false
    this.mesa.add_child(this.puck)

    this.playerMalletMaterial = this.material(PALETTE.primary, 0.4)
    this.playerMalletMaterial.emission_enabled = true
    this.playerMalletMaterial.emission = Color.html(PALETTE.primary)
    this.playerMalletMaterial.emission_energy_multiplier = 0
    this.playerMallet = this.mallet(this.playerMalletMaterial)
    this.opponentMallet = this.mallet(this.material(PALETTE.rival, 0.4))

    if (this.player == null) return
    // Lo que se coge: un punto invisible a media altura del pomo. La gramática XR lo lleva al puño
    // cuando se coge; la escena lo devuelve encima del mazo cada fotograma que no va en la mano.
    this.asa = new Node3D()
    this.asa.set_name('Asa')
    this.mesa.add_child(this.asa)
    this.agarreDelMazo = this.player.coger(this.asa, {
      // El mazo no cuelga del puño: va sobre la mesa, donde el puño la sobrevuela, y lo que se lee
      // es dónde queda el puño (`MalletHand.tsx` y `malletGrab.ts` en la web). Por eso la
      // empuñadura es la identidad: el asa va justo en el puño.
      empunadura: IDENTIDAD,
      alcance: ALCANCE_DE_AGARRE,
      alCoger: (mano) => this.manosQueLoLlevaron.add(mano),
    })
  }

  private buildCamera(): void {
    const camera = new Camera3D()
    camera.fov = CAMARA_EN_PLANO.fov
    camera.near = 0.05
    camera.far = 60
    camera.current = true
    this.add_child(camera)
    camera.look_at_from_position(CAMARA_EN_PLANO.position, CAMARA_EN_PLANO.mira, Vector3.UP)
    this.camera = camera
  }

  /**
   * El jugador con visor del kit, con los ficheros comunes tal cual: la altura (`uiHeight.ts`), el
   * anclaje (`hostAnchor.ts`), mantener o un toque (`agarre.ts`) y el pellizco (`pellizco.ts`).
   */
  private buildXrPlayer(simulado: boolean): void {
    if (simulado) {
      this.sim = simularMandos()
      this.applyTestSettings()
    }
    this.player = new XRPlayer(this, { comunes: { uiHeight, hostAnchor, agarre, pellizco } })
    this.escena = this.player.mundo
    for (const mano of ['left', 'right'] as const) {
      this.player.rayo[mano].button_pressed.connect(Callable.create(this, this.onButton))
    }
  }

  /** Los ajustes del salón que pide la escena de test (metadato `ajustes`), escritos en el guardado. */
  private applyTestSettings(): void {
    const storage = gameStorage()
    if (storage == null || !this.has_meta('ajustes')) return
    const ajustes = JSON.parse(String(this.get_meta('ajustes'))) as Record<string, string>
    for (const [clave, valor] of Object.entries(ajustes)) storage.setItem(clave, valor)
  }

  /** B/Y y el botón de menú hacen lo que Escape en plano. */
  private onButton(button: string): void {
    if (button === 'by_button' || button === 'menu_button') this.interfaz.escape()
  }

  /** El ratón va a la puntería de la interfaz: es su rayo. */
  _input(event: InputEvent): void {
    this.interfaz?.recibir(event)
  }

  _unhandled_input(event: InputEvent): void {
    if (event instanceof InputEventKey && event.is_pressed() && event.keycode === Key.KEY_ESCAPE) this.interfaz.escape()
  }

  private exit(): void {
    if (this.harnessMenu) {
      this.set_meta('salida', true)
      return
    }
    this.interfaz.soltar()
    const xrcade = this.get_node_or_null('/root/XRcade')
    if (xrcade != null) (xrcade as unknown as { call(method: string): unknown }).call('exit_to_hub')
    else this.get_tree().quit()
  }

  /** Una partida con puntuación ha acabado: se cuenta al salón (y lo apunta un test). */
  private alTerminar(resultado: Resultado): void {
    this.resultados.push(resultado)
    contarAlSalon(this, resultado)
  }

  _process(delta: number): void {
    const t0 = Time.get_ticks_usec()
    this.tiempo += delta
    const partida = this.partida
    const faseAntes = partida.gameState

    // La mano primero: es quien pone el mazo en la mesa.
    if (this.driver === 'mouse') this.driveMouse()
    if (this.sim != null) this.driveXrBot(delta)
    this.placeAsa()
    this.player?.update(delta)
    this.readHand()

    partida.tick(delta)
    if (partida.gameState === 'menu') {
      this.table = null
      this.mesaDe = -1
    } else {
      this.stepTable(delta)
    }
    const fase = partida.gameState
    this.framesEnFase = fase === faseAntes ? this.framesEnFase + 1 : 0
    if (fase === 'finished' && this.terminada !== partida.runId) this.alAcabar()

    this.golpe.actualizar()
    this.music.update(delta)
    this.paint()
    // Como en la web (`Rink.tsx`): el roce sigue a la velocidad del disco en juego; parado, en
    // pausa o fuera de la partida, calla.
    const roce = roceDelDisco(this.velocidadDelDisco)
    this.roce.volume = roce.volume
    this.roce.pitch = roce.pitch
    this.roce.update(delta)
    this.interfaz.actualizar(delta, { agarre: this.player?.ajustes.agarre ?? 'hold' })

    const spent = Time.get_ticks_usec() - t0
    this.frames++
    this.logicUsecTotal += spent
    this.logicUsecMax = Math.max(this.logicUsecMax, spent)
    // El pico jugando: sin el primer segundo (montar la mesa, generar las letras) ni el fotograma
    // del final, que escribe el guardado en disco y monta el panel del resultado.
    if (this.frames > 72 && fase === 'playing') this.logicUsecMaxEnJuego = Math.max(this.logicUsecMaxEnJuego, spent)

    this.capturas()
    const automatico = this.driver === 'bot' || this.sim != null
    if (automatico && fase === 'finished' && this.framesEnFase === 1 && this.shotFinalPath == null) this.reportAndQuit()
  }

  /** Avanza la mesa con el reloj (frenado por el golpe recibido) y cuenta lo que ha pasado. */
  private stepTable(delta: number): void {
    const partida = this.partida
    const skill = OPPONENT_SKILLS[partida.activeDifficulty]
    if (this.table == null || this.mesaDe !== partida.runId) {
      // Cada partida, y cada ronda del reto, estrena mesa: el disco al centro y cada mazo a su sitio.
      this.table = startTable({ skill, lastScorer: partida.lastScorer, seed: partida.seed })
      this.mesaDe = partida.runId
      if (!this.enLaMano) this.pointer = this.table.player.position
    }
    if (this.driver === 'bot') this.pointer = destinoDelBot(this.table)
    const golpesAntes = this.table.playerHits
    const frame = advanceTable(this.table, {
      delta: delta * this.golpe.escalaDelReloj(),
      pointer: this.pointer,
      inHand: this.enLaMano,
      skill,
      // Con la pregunta de salir delante el disco se queda quieto: decidir no puede costar goles.
      playing: partida.gameState === 'playing' && partida.prompt === null,
    })
    this.table = frame.table
    for (const goal of frame.goals) {
      this.goles.push(goal)
      if (goal === 'player') partida.scorePlayer()
      else partida.scoreOpponent()
    }
    if (frame.table.playerHits > 0) partida.apuntarHito('hit')
    if (frame.struck) this.sfx.play(efectoDelChoque('strike', impactStrength(frame.impact.strike)))
    if (frame.bounced) this.sfx.play(efectoDelChoque('bounce', impactStrength(frame.impact.bounce)))
    if (frame.goals.length > 0) this.sfx.play('goal')
    for (const suceso of sucesosDelFotograma(golpesAntes, frame)) this.sentir(suceso)
    // El gol en contra, como golpe que recibe el cuerpo, después de la vibración del gol.
    if (frame.goals.includes('opponent')) this.golpeDelGolEnContra()
  }

  /** Lo que se siente, en la mano que lleva el mazo; sin visor o sin mazo en la mano, nada. */
  private sentir(suceso: SucesoEnLaMano): void {
    if (this.player == null) return
    this.player.vibrar(pulsosDelSuceso(suceso, this.agarreDelMazo?.mano ?? null))
  }

  /** El golpe recibido, hacia la portería propia desde los ojos, llevado al espacio global. */
  private golpeDelGolEnContra(): void {
    const camara = this.player?.camara ?? this.camera
    if (camara == null) {
      this.golpe.golpe(FUERZA_DEL_GOL_EN_CONTRA, null)
      return
    }
    const ojos = this.mesa.to_local(camara.global_position)
    const hacia = direccionDelGolEnContra({ x: ojos.x, y: ojos.y, z: ojos.z })
    const global = Basis.MULTIPLY(this.mesa.global_basis, new Vector3(hacia.x, hacia.y, hacia.z))
    this.golpe.golpe(FUERZA_DEL_GOL_EN_CONTRA, { x: global.x, y: global.y, z: global.z })
  }

  /** El partido se ha acabado: el cierre que suena (y el récord encima) y el pulso final. */
  private alAcabar(): void {
    const partida = this.partida
    this.terminada = partida.runId
    this.sfx.play(partida.totalPlayerGoals > partida.totalOpponentGoals ? 'win' : 'loss')
    this.sentir({ tipo: 'final' })
    if (partida.isRecord) this.sfx.play('record')
  }

  /** El ratón apunta a la mesa: el mazo persigue ese punto con su tope de velocidad. */
  private driveMouse(): void {
    const camera = this.camera
    if (camera == null) return
    const mouse: Vector2 = this.get_viewport()!.get_mouse_position()
    const origen = camera.project_ray_origin(mouse)
    const from = this.mesa.to_local(origen)
    const towards = this.mesa.to_local(Vector3.ADD(origen, camera.project_ray_normal(mouse)))
    const dy = towards.y - from.y
    if (Math.abs(dy) < 1e-6) return
    const k = -from.y / dy
    if (k <= 0) return
    this.pointer = constrainMallet({ x: from.x + (towards.x - from.x) * k, z: from.z + (towards.z - from.z) * k }, 'player')
  }

  /** Devuelve el asa encima del mazo cuando no va en la mano; en el menú, fuera de alcance. */
  private placeAsa(): void {
    if (this.asa == null || this.agarreDelMazo?.mano != null) return
    const m = this.table?.player.position
    this.asa.transform = new Transform3D(Basis.IDENTITY, m == null ? new Vector3(0, -100, 0) : new Vector3(m.x, MALLET_BASE + MALLET_KNOB / 2, m.z))
  }

  /** Con el mazo cogido, a dónde va: donde el puño sobrevuela la mesa (`MalletHand.tsx`). */
  private readHand(): void {
    if (this.agarreDelMazo == null || this.asa == null) return
    const cogido = this.agarreDelMazo.mano != null && this.partida.gameState !== 'menu'
    this.enLaMano = cogido
    this.partida.malletHeld = cogido
    if (!cogido) return
    const local = this.mesa.to_local(this.asa.global_position)
    this.pointer = constrainMallet({ x: local.x, z: local.z }, 'player')
    this.partida.apuntarHito('grab')
  }

  /**
   * El jugador automático con visor: mueve la mano buena de mentira como una de verdad. Primero
   * lleva el puño al mazo y aprieta (con «un toque», un toque); luego lo lleva por la mesa hacia
   * donde jugaría el de sin visor, a velocidad de brazo. Al principio empuja un momento el stick de
   * la otra mano, que sentado gira el decorado.
   */
  private driveXrBot(delta: number): void {
    const sim = this.sim!
    const player = this.player!
    const mano = player.manoBuena
    const otra: Mano = mano === 'left' ? 'right' : 'left'
    this.framesXr++
    const ojos = this.has_meta('ojos') ? Number(this.get_meta('ojos')) : 1.6
    sim.cabeza(new Transform3D(Basis.IDENTITY, new Vector3(0, ojos, 0)))
    sim.manos[otra].stick(this.framesXr === FOTOGRAMA_DEL_GIRO ? 1 : 0, 0)
    const toque = player.ajustes.agarre === 'toggle'
    let puno: Vector3
    if (this.agarreDelMazo?.mano == null) {
      // A por el asa, y a apretar cuando ya hay mazo en la mesa (en el menú el asa está fuera).
      puno = this.asa!.global_position
      const hayMazo = this.table != null
      sim.manos[mano].agarre(!hayMazo ? 0 : toque ? this.framesXr % 2 : 1)
      if (this.table != null) this.manoDelBot = this.table.player.position
    } else {
      if (toque) sim.manos[mano].agarre(0)
      if (this.table != null) this.manoDelBot = acercar(this.manoDelBot, destinoDelBot(this.table), delta)
      puno = this.mesa.to_global(new Vector3(this.manoDelBot.x, ALTURA_DEL_PUNO, this.manoDelBot.z))
    }
    sim.manos[mano].poner(new Transform3D(Basis.IDENTITY, puno))
  }

  /** Coloca el disco y los mazos, y enciende lo que toca. */
  private paint(): void {
    const table = this.table
    this.velocidadDelDisco = 0
    this.puck.visible = table != null
    this.playerMallet.visible = table != null
    this.opponentMallet.visible = table != null
    if (table == null) {
      this.goalLight.light_energy = 0
      return
    }
    this.puck.position = new Vector3(table.puck.position.x, 0, table.puck.position.z)
    this.playerMallet.position = new Vector3(table.player.position.x, 0, table.player.position.z)
    this.opponentMallet.position = new Vector3(table.opponent.position.x, 0, table.opponent.position.z)
    // El halo del disco con su velocidad (`puckGlow`); parado o en pausa, el de reposo.
    const moving = this.partida.gameState === 'playing' && this.partida.prompt === null
    const speed = moving ? Math.hypot(table.puck.velocity.x, table.puck.velocity.z) : 0
    this.velocidadDelDisco = speed
    this.puckMaterial.emission_energy_multiplier = puckGlow(speed).emissive
    // El mazo late mientras la cuenta atrás lo espera: es lo que dice cuál hay que coger.
    this.playerMalletMaterial.emission_energy_multiplier = this.partida.esperandoElMazo ? 0.5 + 0.5 * Math.sin(this.tiempo * 6) : 0
    this.goalLight.light_energy = table.pause > 0 ? 3 : 0
    this.goalLight.light_color = Color.html(table.pendingServe === 'player' ? PALETTE.primary : PALETTE.rival)
    this.goalLight.position = new Vector3(0, RAIL_HEIGHT + 0.12, table.pendingServe === 'player' ? -HALF_LENGTH : HALF_LENGTH)
  }

  /** Las capturas en plano: el menú, la partida en marcha o el final, y salir. */
  private capturas(): void {
    const fase = this.partida.gameState
    const guardar = (ruta: string) => {
      // La textura del viewport tiene el fotograma ya dibujado, que es el que se guarda.
      this.get_viewport()!.get_texture()!.get_image()!.save_png(ruta)
      print(`GH-SHOT ${ruta}`)
      this.shotPath = this.shotMenuPath = this.shotFinalPath = null
      this.get_tree().quit(0)
    }
    // Veinte fotogramas: las etiquetas en MSDF se generan al primer dibujo. La partida, con dos
    // goles ya en el marcador y el disco por el centro de la mesa.
    if (this.shotMenuPath != null && fase === 'menu' && this.framesEnFase > 20) guardar(this.shotMenuPath)
    else if (this.shotFinalPath != null && fase === 'finished' && this.framesEnFase > 20) guardar(this.shotFinalPath)
    else if (this.shotPath != null && fase === 'playing' && this.goles.length >= 2 && this.table != null && this.table.pause <= 0 && Math.abs(this.table.puck.position.z) < 0.5) guardar(this.shotPath)
  }

  /** En qué fase está la partida: para las escenas de test en GDScript, que no ven los objetos de JS. */
  fase(): string {
    return this.partida.prompt != null ? 'aviso' : this.partida.gameState
  }

  /** Si lo que se juega es el reto que prestó el salón. */
  en_reto(): boolean {
    return this.partida.enReto
  }

  /** A qué modo es la partida de ahora (o la última). */
  modo_de_la_partida(): string {
    return this.partida.gameMode
  }

  /** Dónde cae en la pantalla un botón de la interfaz, para que un test lo pulse con el ratón. */
  pantalla_del_boton(id: string): Vector2 {
    const boton = this.interfaz.punteria.boton(id)
    if (boton == null || this.camera == null || !boton.nodo.is_visible_in_tree()) return new Vector2(-1, -1)
    return this.camera.unproject_position(boton.nodo.global_position)
  }

  /** Lo que la escena de test con visor comprueba de la gramática XR. */
  private xrReport() {
    const player = this.player
    if (player == null) return null
    const decorado = player.estadoDelDecorado
    const mundo = player.mundo.global_transform
    return {
      mano: player.manoBuena,
      llevaron: [...this.manosQueLoLlevaron],
      subida: player.subida,
      colocacion: decorado.colocacion,
      giro: decorado.giro.yaw,
      mundo: { x: mundo.origin.x, y: mundo.origin.y, z: mundo.origin.z },
      vibraciones: player.vibraciones.length,
      manosQueVibraron: [...new Set(player.vibraciones.map((v) => v.mano))],
    }
  }

  private reportAndQuit(): void {
    const partida = this.partida
    const result = {
      mode: partida.gameMode,
      outcome: partida.outcome,
      playerGoals: partida.totalPlayerGoals,
      opponentGoals: partida.totalOpponentGoals,
      goals: this.goles.length,
      points: partida.points,
      bestStreak: partida.bestStreak,
      playerHits: this.table?.playerHits ?? 0,
      seed: partida.seed,
      frames: this.frames,
      logicUsecAvg: Math.round(this.logicUsecTotal / this.frames),
      logicUsecMax: this.logicUsecMax,
      logicUsecMaxEnJuego: this.logicUsecMaxEnJuego,
      wallMs: Time.get_ticks_msec() - this.startedMs,
      simSeconds: Number(this.tiempo.toFixed(2)),
      record: partida.isRecord,
      best: getBestPoints(partida.gameMode),
      resultados: this.resultados,
      golpesRecibidos: this.golpe.dados,
      sfx: this.sfx.counts,
      roce: { ...this.roce.stats, sonando: this.roce.playing },
      variants: Object.fromEntries(SOUNDS.map((name) => [name, this.sfx.variantCount(name)])),
      music: { playing: this.music.playing, volume: Number(this.music.volume.toFixed(3)) },
      levels: niveles(),
      xr: this.xrReport(),
    }
    // `print` del motor y no `console.log`: en las plantillas release GodotJS solo deja pasar los
    // avisos y errores de la consola de JS. Se llama `WAM-RESULT`, como el de Hole Patrol, porque
    // es lo que busca `xrcade/scripts/godotjs/check-templates.sh` al jugar un `.pck` en Docker.
    print(`WAM-RESULT ${JSON.stringify(result)}`)
    this.set_process(false)
    this.sim?.quitar()
    if (this.harness) {
      this.set_meta('result', JSON.stringify(result))
      return
    }
    if (this.get_node_or_null('/root/XRcade') != null) this.exit()
    else this.get_tree().quit(result.goals > 0 ? 0 : 1)
  }
}
