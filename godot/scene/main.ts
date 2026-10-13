/**
 * Glide Hockey in Godot: the table, the puck, the two mallets, the input and the sound.
 *
 * **Everything that decides something comes from `glide-hockey/src/lib`**, the same code as the
 * web and with its same tests: the puck's physics and the fixed step (`matchLoop.ts`,
 * `puckPhysics.ts`), the machine and its seed (`opponent.ts`), the points, the modes, the
 * challenge's ladder and the levels. Godot's physics is not used for anything: the table advances
 * with `advanceTable` in steps of exactly 1/60 s, whatever the frame rate, and the scene only
 * places what comes out. The session —what has been chosen, which phase it is in, the scoreboard—
 * is `ui/match.ts`, the web's `gameStore` without React.
 *
 * Three ways of moving the mallet, and all three end up in the same `pointer` of `advanceTable`:
 * - **with a headset, grabbed with the hand**: the kit's XR grammar (`@kit/runtime/xr/player`)
 *   plants the table where the hall lends it, lowers it to the eyes of whoever plays seated, turns
 *   it with the free hand's stick, and lets the mallet be grabbed with the fist (or a pinch) of
 *   either hand, with the dominant one first. Grabbed, the mallet goes where the fist hovers over
 *   the table (`inHand`) and hits with the speed of the hand. It vibrates with the recipes of
 *   `hapticFeedback.ts`;
 * - **on the flat screen, with the mouse** over the table: the mallet chases the pointer with its
 *   speed cap, as on the web;
 * - **with `-- --autoplay`**, the automatic player (`bot.ts`): it plays a whole match against the
 *   machine to the end, which is what the tests and the measurement of the cost per frame use.
 *   With `--duel` it plays the whole duel: the first one's match, the handover and the second
 *   one's.
 *
 * **Around it, the web's arcade room** (`world/room.ts`), or your own room if the hall asks for it
 * and the headset has camera passthrough (the kit's `SceneryRig`). With a headset, the web's
 * **hints** (`world/hints.ts`) show the gesture without letters, the interface **rises with the
 * eyes** of whoever plays (`XRUiHeight`), and the countdown that waits for the mallet and the
 * tutorial light the button in question **on the real controller** of each hand.
 *
 * It sounds with the web's effects, rendered from its `audioEngine.ts` by
 * `xrcade/godot-kit/render-sfx.mjs`, with the puck's slide in a loop following its speed, and with
 * its music and its fade. The goal against is also a hit the body takes (`hitFeedback.ts`), as on
 * the web.
 *
 * **The hall's challenge** (`seed.ts`): the scene reads it from `-- --reto=<seed>` or from the
 * hall if it lends it (`hallChallenge`), and at the end of each match it reports the result
 * (`reportToHall`); the native hub passes the seed of the challenge of the day and records the
 * result.
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
  type XRPositionalTracker,
  print,
} from 'godot'

import { arcTriangles } from '@kit/lib/ui/icons'
import { DEFAULT_PROFILE } from '@kit/lib/ui/controller'
import type { Point2 } from '@kit/lib/ui/exit'
import { gameNameFrom, goalFrom } from '@kit/lib/gameBase'
import type { HandSide } from '@kit/lib/xr/hands'
import { IDENTIDAD } from '@kit/lib/xr/pose'
import { gameStorage } from '@kit/engine/godot-storage'
import { isolateSave, arg, headsetArgs, hasFlag } from '@kit/runtime/args'
import { basisOf, deCuaternion, giroSobre, multiplicar } from '@kit/runtime/scene/matrices'
import { SceneryRig, headsetView } from '@kit/runtime/scene/scenery'
import { Music, Sfx, type Loop } from '@kit/runtime/sfx'
import { shape } from '@kit/runtime/ui/mesh'
import { RealController } from '@kit/runtime/ui/controller'
import { SharedController } from '@kit/runtime/ui/controllerTurn'
import { XRPlayer, type Grabbable } from '@kit/runtime/xr/player'
import { simulateControllers, viewWithSimulatedHead, type Simulation } from '@kit/runtime/xr/simulated'

import * as grab from '@/lib/grab'
import { readHand } from '@/lib/settings'
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
import { THRESHOLD_SOUND } from '@/lib/scoreboardSign'
import { endSoundsLikeWin, type MatchScore } from '@/lib/duel'
import { getDuelTally } from '@/lib/duelTally'
import { GAME_MODE_ORDER, type GameMode } from '@/lib/gameMode'
import type { Difficulty } from '@/lib/gameConfig'
import { GOAL_AGAINST_STRENGTH, goalAgainstDirection } from '@/lib/goalAgainst'
import { getBestPoints } from '@/lib/highScore'
import * as hostAnchor from '@/lib/hostAnchor'
import { GRAB_REACH } from '@/lib/malletGrab'
import { advanceTable, startTable, type TableState } from '@/lib/matchLoop'
import { MUSIC_VOLUME } from '@/lib/music'
import { MUSIC_FADE_MS, fadeVolume } from '@/lib/musicFade'
import type { Goal } from '@/lib/goal'
import { setGameName } from '@/lib/menuTemplate'
import { playerStart } from '@/lib/opponent'
import { PALETTE } from '@/lib/palette'
import * as pinch from '@/lib/pinch'
import { puckGlow } from '@/lib/puckGlow'
import { HALF_LENGTH, HALF_WIDTH, constrainMallet, type Vec2 } from '@/lib/puckPhysics'
import type { GameResult, Challenge } from '@/lib/seed'
import { SLIDE_SMOOTHING } from '@/lib/slideSound'
import * as uiHeight from '@/lib/uiHeight'

import { approach, botTarget } from './game/bot'
import { HitFeedback } from './game/hitFeedback'
import { volumeLevels } from '@kit/runtime/settings'
import { currentComfort } from './ui/comfort'
import { GameUi } from './ui/ui'
import { Match } from './ui/match'
import { GameHints, besideMallet } from './world/hints'
import { ROOM_BACKDROP, Room } from './world/room'
import { collisionSound, impactStrength, eventPulses, puckSlide, frameEvents, type HandEvent } from './game/events'

/**
 * All the rendered effects (`godot-kit.json`, `sfx.sounds`): the strike and the bounce at three
 * strengths, the goal, the three endings and the three medal thresholds. The puck's slide goes
 * apart: it is a loop (`sfx.loops`) that sounds while the puck moves.
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
  'medal-bronze',
  'medal-silver',
  'medal-gold',
] as const
const SFX_DIR = 'res://games/glide-hockey/sfx'
const GAME_BUS = 'GlideHockey'
const MUSIC_PATH = 'res://games/glide-hockey/music/sala.mp3'

/**
 * Measurements of the furniture that on the web live in the components (`Table.tsx`, `Mallet.tsx`,
 * `Puck.tsx`).
 */
const TOP_THICKNESS = 0.05
const RAIL_THICKNESS = 0.04
const PUCK_HEIGHT = 0.022
const MALLET_BASE = 0.028
const MALLET_KNOB = 0.045
const MARKING_COLOR = '#9db4cc'
const GOAL_MOUTH_COLOR = '#050a12'
const LEG_COLOR = '#0d1626'

/** The controller models, copied from `public/webxr-profiles/` (`npm run godot:controllers`). */
const CONTROLLERS_DIR = 'res://games/glide-hockey/mandos'

/**
 * Every how many frames the headset is asked again whether it gives augmented reality (half a
 * second).
 */
const SCENERY_REREAD_FRAMES = 36

/**
 * Who lights the real controller of each hand, in order: the countdown stopped waiting for the
 * mallet (the web's `XRCountdown`, with the grip) and the tutorial with the button of its step.
 * They do not coincide —the tutorial comes up while playing—, but the controller is one and one
 * uses it at a time.
 */
type ControllerUser = 'countdown' | 'tutorial'
const CONTROLLER_TURN_ORDER: readonly ControllerUser[] = ['countdown', 'tutorial']

/** The OpenXR interaction profile of the Quest controllers: the one given to the fake ones. */
const OPENXR_PROFILE = '/interaction_profiles/oculus/touch_controller'

/** At which second of the match the hints screenshot is taken: fully lit. */
const HINTS_SHOT_SECOND = 2.5

/**
 * The flat-screen camera, the web's (`GameCanvas.tsx`): leaning over the table from its edge,
 * higher than standing and a little back, which is from where both goals are seen at once,
 * looking at the centre of the table, with 46° of vertical field.
 */
const FLAT_CAMERA = { position: new Vector3(0, 2.65, 1.5), target: new Vector3(0, TABLE_HEIGHT, TABLE_CENTER_Z), fov: 46 }

/**
 * The automatic player's match: practice against the strongest machine, up to seven goals. Against
 * the others the automatic player wins without conceding, and a goal against is what makes the
 * test go through the hit taken as well.
 */
const BOT_MATCH: { mode: GameMode; goals: number; difficulty: Difficulty } = { mode: 'practice', goals: 7, difficulty: 'impossible' }

/**
 * How many frames the duel's automatic player stays at the handover before pressing play for the
 * second one's match: half a second with the panel in view, like someone reading whose turn it is.
 */
const HANDOVER_FRAMES = 36

/** At what height above the table the automatic player with a headset carries the fist. */
const FIST_HEIGHT = 0.06
/**
 * Where the fake hands wait in the hints screenshot with the simulated headset, in the space of
 * whoever plays: at the height of the table and to the sides, grabbing nothing, like someone who
 * has just come in.
 */
const IDLE_HANDS = { x: 0.25, y: 1.0, z: -0.35 } as const

/** On which frame the automatic player pushes the free hand's stick, to turn. */
const TURN_FRAME = 60

type Driver = 'xr' | 'mouse' | 'bot'

/** A rectangle centred on the origin, in two triangles: the table's lines. */
function stripe(width: number, height: number): Point2[] {
  const x = width / 2
  const y = height / 2
  return [[-x, -y], [x, -y], [x, y], [-x, -y], [x, y], [-x, y]]
}

/**
 * The challenge the hall lends, if there is one. First the command line (`-- --reto=<seed>`),
 * which is how it is tested; then the hall, if its `XRcade` autoload carries the `challenge_seed`
 * metadata (the native hub sets it when entering through the challenge of the day; contract in
 * `xrcade/docs/anadir-un-juego.md` §3, the same as the web: `Challenge` of `seed.ts`).
 */
export function hallChallenge(node: Node): Challenge | null {
  const line = arg('reto')
  if (line != null && line.trim() !== '' && Number.isFinite(Number(line))) return { seed: Number(line) >>> 0 }
  const xrcade = node.get_node_or_null('/root/XRcade')
  if (xrcade != null && xrcade.has_meta('challenge_seed')) return { seed: Number(xrcade.get_meta('challenge_seed')) >>> 0 }
  return null
}

/**
 * The cabinet's goal that the hall lends: the medal thresholds, the best record and the mode in
 * which it counts, from the `goal` metadata of its `XRcade` autoload —the same that the kit's
 * `base.objetivo()` reads, with its same reader (`goalFrom`), and what the web receives in the
 * `goal` prop—. `null` with the game on its own, or if the hall gives it no medals: the sign
 * stays on the mission.
 */
export function hallGoal(node: Node): Goal | null {
  const xrcade = node.get_node_or_null('/root/XRcade')
  return goalFrom(xrcade != null && xrcade.has_meta('goal') ? xrcade.get_meta('goal') : null)
}

/**
 * The cabinet's name in the hall: the `game_name` metadata of its `XRcade` autoload (the `name` of
 * the manifest), or `null` with the game on its own, which is then named after its `package.json`.
 */
export function hallName(node: Node): string | null {
  const xrcade = node.get_node_or_null('/root/XRcade')
  return gameNameFrom(xrcade != null && xrcade.has_meta('game_name') ? xrcade.get_meta('game_name') : null)
}

/**
 * Tells the hall how a scored match has ended (`GameResult` of `seed.ts`, with the feats earned
 * for the first time): if the autoload has `report_result`, it is called with the result in JSON;
 * and it always stays in the log. Like `hallChallenge`, it is the hook for when the native hub
 * collects them.
 */
export function reportToHall(node: Node, result: GameResult): void {
  const text = JSON.stringify(result)
  print(`GH-RESULTADO ${text}`)
  const xrcade = node.get_node_or_null('/root/XRcade')
  if (xrcade != null && xrcade.has_method('report_result')) (xrcade as unknown as { call(m: string, a: string): unknown }).call('report_result', text)
}

export default class GlideHockey extends Node3D {
  private match!: Match
  private ui!: GameUi
  private driver: Driver = 'mouse'
  private table: TableState | null = null
  /** The `runId` of the match the table was set up with: when it changes, another one is set up. */
  private tableOf = -1
  private pointer: Vec2 = playerStart()
  private inHand = false

  /** Where the scenery hangs: the world of the player with a headset, or the scene itself. */
  private scene!: Node3D
  /** The table's space: its centre, at the height of the top. */
  private tableSpace!: Node3D
  /**
   * The arcade room around: what shakes with the hit taken (not the table) and what your own room
   * removes.
   */
  private room!: Room
  private scenery!: SceneryRig
  /** Where the interface hangs from: the table's space, raised with the eyes (`XRUiHeight`). */
  private floating!: Node3D
  private hints!: GameHints
  /** The hints on the flat screen too (`-- --ayudas`), to look at them without a headset. */
  private flatHints = false
  /** The real controller in each fist, which the countdown and the tutorial light. */
  private handControllers: SharedController<ControllerUser>[] = []
  /** What has actually been seen with a headset, for the test scene. */
  private readonly hintsSeen = new Set<string>()
  private tutorialSeen = false
  private readonly controllersSeen: Record<ControllerUser, Set<HandSide>> = { countdown: new Set(), tutorial: new Set() }
  private camera: Camera3D | null = null
  private puck!: Node3D
  private puckMaterial!: StandardMaterial3D
  private playerMallet!: Node3D
  private playerMalletMaterial!: StandardMaterial3D
  private opponentMallet!: Node3D
  private goalLight!: OmniLight3D

  private player: XRPlayer | null = null
  /**
   * What the hand grabs: an invisible point on the mallet, which the XR grammar takes to the fist.
   */
  private handle: Node3D | null = null
  private malletGrab: Grabbable | null = null
  private sim: Simulation | null = null
  private framesXr = 0
  /**
   * Which way the fake head looks with `-- --visor-simulado`: the turn (`--mirar=<degrees>`) and
   * the pitch (`--pitch=<degrees>`, negative downward), to take the screenshot from where the web
   * takes it (`e2e/hints.spec.ts`, at −50°).
   */
  private lookToward = 0
  private pitch = 0
  /** Where the automatic player with a headset carries the hand, on the table. */
  private botHand: Vec2 = playerStart()
  private handsThatCarried = new Set<HandSide>()

  private sfx!: Sfx
  private music!: Music
  /**
   * The puck's slide: the loop, and the speed of the puck that is painted, which is the one that
   * sounds.
   */
  private slide!: Loop
  private puckSpeed = 0
  private hitFeedback!: HitFeedback
  private finishedRun = -1
  private time = 0

  private frames = 0
  private logicUsecTotal = 0
  private logicUsecMax = 0
  private logicUsecMaxInPlay = 0
  private startedMs = 0
  private goals: ('player' | 'opponent')[] = []
  private results: GameResult[] = []
  /**
   * The feats the table has given (`FrameResult.feats`), so that a test compares them with the ones
   * reported.
   */
  private tableFeats: string[] = []
  /** The automatic player plays the duel (`--duel`, or the `duel` metadata of a test scene). */
  private duel = false
  /** Each match of the duel when it ends: which seed the machine played with and how it ended. */
  private duelMatches: (MatchScore & { seed: number })[] = []
  /** The endings that have sounded, in order: `win` or `loss` per ending. */
  private endings: string[] = []
  /** The medal thresholds crossed, in order: what the goal sign celebrated. */
  private thresholds: string[] = []
  private shotPath: string | null = null
  private shotMenuPath: string | null = null
  private shotFinalPath: string | null = null
  /** The match just started on the flat screen with the hints lit (`-- --shot-hints=<path>`). */
  private shotHintsPath: string | null = null
  private framesInPhase = 0
  /**
   * Set by a test scene (`harness` metadata): it plays by itself and leaves the result in `result`.
   */
  private harness = false
  /**
   * The menu's test scene (`tests/menu_mouse.gd`): it starts at the menu and does not close on
   * exit.
   */
  private harnessMenu = false

  _ready(): void {
    this.harnessMenu = this.has_meta('harness_menu')
    this.harness = this.has_meta('harness') || this.harnessMenu
    // A test scene or a screenshot saves apart and starts from scratch: otherwise, the automatic
    // player's score would end up as the record of whoever has the game, and each run would depend
    // on the previous one.
    isolateSave(this.harness)
    // And in that fresh save, the hall settings the test scene asks for (the language, the hand).
    if (this.harness) this.applyTestSettings()
    const autoplay = hasFlag('autoplay') || (this.harness && !this.harnessMenu)
    this.duel = hasFlag('duel') || (this.harness && this.has_meta('duel'))
    this.shotPath = arg('shot')
    this.shotMenuPath = arg('shot-menu')
    this.shotFinalPath = arg('shot-final')
    this.shotHintsPath = arg('shot-hints')
    this.flatHints = hasFlag('ayudas') || this.shotHintsPath != null
    // The simulated headset: the test scene's, or `-- --visor-simulado` to look on the flat screen
    // at what is seen with the headset (the camera is the fake head).
    const headset = headsetArgs(this.harness && this.has_meta('xr_simulated'))
    const simulated = headset.simulado
    this.lookToward = headset.mirar
    this.pitch = (Number(arg('pitch') ?? 0) * Math.PI) / 180
    this.driver = simulated ? 'xr' : autoplay ? 'bot' : this.startXr() ? 'xr' : 'mouse'

    this.scene = this
    if (this.driver === 'xr') this.buildXrPlayer(simulated)
    this.buildWorld(hasFlag('habitacion'))
    this.buildTable()
    this.buildPieces()
    if (this.player == null) this.buildCamera()
    this.buildSound()
    this.buildHints()

    // The cabinet's name, before painting the menu (`menuTemplate.ts`): the one the hall passes
    // in `game_name`, or the one in `package.json`.
    setGameName(hallName(this))
    this.match = new Match({ challenge: hallChallenge(this), goal: hallGoal(this), onFinish: (r) => this.onFinish(r) })
    this.match.immersive = this.driver === 'xr'
    this.ui = new GameUi(
      this.match,
      { exit: () => this.exit() },
      {
        root: this.floating,
        camera: this.camera,
        pointers: this.player?.punteros() ?? [],
        headset: this.driver === 'xr',
        lang: arg('lang'),
        tutorial: hasFlag('tutorial'),
        hands: this.handControllers.map((m) => m.delTutorial),
        scenery: this.scenery,
      },
    )
    this.hitFeedback = new HitFeedback({
      clock: () => this.time,
      shaken: this.room.node,
      camera: this.player?.camara ?? this.camera,
      comfort: currentComfort,
      vibrate: this.player == null ? undefined : (pulses) => this.player!.vibrar(pulses),
      bus: GAME_BUS,
    })
    // The automatic player does not go through the menu: it always plays the same match
    // (`BOT_MATCH`).
    if ((this.driver === 'bot' || this.sim != null) && !this.match.running) {
      this.match.setGameMode(this.duel ? 'duel' : BOT_MATCH.mode)
      this.match.setGoalTarget(Number(arg('goals') ?? BOT_MATCH.goals))
      const difficulty = arg('difficulty') ?? (this.has_meta('difficulty') ? String(this.get_meta('difficulty')) : null)
      this.match.setDifficulty(difficulty != null && difficulty in OPPONENT_SKILLS ? (difficulty as Difficulty) : BOT_MATCH.difficulty)
      this.match.startGame()
    } else if (this.shotHintsPath != null) {
      // The hints screenshot goes into the match with no player: it is what is seen on starting.
      this.match.startGame()
    } else {
      // `--mode=duel` (or whichever) leaves that mode chosen in the menu: it is for capturing it.
      const mode = arg('mode')
      if (mode != null && (GAME_MODE_ORDER as string[]).includes(mode)) this.match.setGameMode(mode as GameMode)
    }
    this.startedMs = Time.get_ticks_msec()
  }

  /**
   * The same start-up as the hub: if there is no OpenXR runtime, it carries on on the flat screen.
   */
  private startXr(): boolean {
    const xr = XRServer.find_interface('OpenXR')
    if (xr == null) return false
    if (!xr.is_initialized() && !xr.initialize()) return false
    DisplayServer.window_set_vsync_mode(DisplayServer.VSyncMode.VSYNC_DISABLED)
    this.get_viewport()!.use_xr = true
    return true
  }

  /**
   * The game's bus: everything that sounds goes through it, and it is where the hit taken puts its
   * low-pass without touching the master, which is the hall's. It flows into the master, or into
   * the muted bus of the test scene (`sfx_bus` metadata), which counts the same and does not
   * sound. It is removed on exit.
   */
  private gameBus(): string {
    let index = AudioServer.get_bus_index(GAME_BUS)
    if (index < 0) {
      AudioServer.add_bus()
      index = AudioServer.bus_count - 1
      AudioServer.set_bus_name(index, GAME_BUS)
    }
    AudioServer.set_bus_send(index, this.has_meta('sfx_bus') ? String(this.get_meta('sfx_bus')) : 'Master')
    return GAME_BUS
  }

  _exit_tree(): void {
    this.slide?.stop()
    const index = AudioServer.get_bus_index(GAME_BUS)
    if (index > 0) AudioServer.remove_bus(index)
  }

  private buildSound(): void {
    const bus = this.gameBus()
    this.sfx = new Sfx(this, { dir: SFX_DIR, names: SOUNDS, bus, levels: volumeLevels })
    this.slide = this.sfx.loop('slide', { smoothing: SLIDE_SMOOTHING })
    this.music = new Music(this, { path: MUSIC_PATH, volume: MUSIC_VOLUME, fade: fadeVolume, fadeMs: MUSIC_FADE_MS, bus, levels: volumeLevels })
    this.music.start()
  }

  private material(color: string, roughness = 0.6): StandardMaterial3D {
    const m = new StandardMaterial3D()
    m.albedo_color = Color.html(color)
    m.roughness = roughness
    return m
  }

  private box(size: Vector3, color: string, roughness?: number): MeshInstance3D {
    const mesh = new BoxMesh()
    mesh.size = size
    const node = new MeshInstance3D()
    node.mesh = mesh
    node.material_override = this.material(color, roughness)
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
   * A flat piece lying on the top: the markings and the goal lines. The shape is that of the
   * kit's figures, but **opaque**: with the interface's translucent material, its paint order put
   * it in front of the column's panels, which are translucent too.
   */
  private onTheTable(triangles: readonly Point2[], color: string, z: number): void {
    const node = shape(triangles, color)
    const m = new StandardMaterial3D()
    m.shading_mode = BaseMaterial3D.ShadingMode.SHADING_MODE_UNSHADED
    m.cull_mode = BaseMaterial3D.CullMode.CULL_DISABLED
    m.albedo_color = Color.html(color)
    node.material_override = m
    node.rotation = new Vector3(-Math.PI / 2, 0, 0)
    node.position = new Vector3(0, 0.001, z)
    this.tableSpace.add_child(node)
  }

  /**
   * The environment, the light and the arcade room —or your own room, if the hall asks for it and
   * the headset gives augmented reality—. `forceRoom` forces it on the flat screen
   * (`-- --habitacion`), to see what is removed without a headset and without touching the save.
   */
  private buildWorld(forceRoom: boolean): void {
    const environment = new Environment()
    environment.background_mode = Environment.BGMode.BG_COLOR
    environment.background_color = Color.html(ROOM_BACKDROP)
    environment.ambient_light_source = Environment.AmbientSource.AMBIENT_SOURCE_COLOR
    environment.ambient_light_color = Color.html('#5a6b8c')
    const world = new WorldEnvironment()
    world.environment = environment
    this.add_child(world)

    // The room's light: an overhead one that acts as a spotlight on the table (`GameWorld.tsx`).
    const sun = new DirectionalLight3D()
    sun.rotation = new Vector3(-1.05, 0.5, 0)
    sun.light_energy = 1.1
    sun.shadow_enabled = true
    this.add_child(sun)

    this.room = new Room(environment)
    this.scene.add_child(this.room.node)
    this.scenery = new SceneryRig({
      mostrar: (withRoom) => this.room.show(withRoom),
      vista: headsetView(this.get_viewport()!),
      forzado: forceRoom ? 'room' : null,
    })
    this.scenery.actualizar()
  }

  /** The table of `Table.tsx`: top, markings, rails split by the goals and legs. */
  private buildTable(): void {
    this.tableSpace = new Node3D()
    this.tableSpace.set_name('Table')
    this.tableSpace.position = new Vector3(0, TABLE_HEIGHT, TABLE_CENTER_Z)
    this.scene.add_child(this.tableSpace)
    this.floating = new Node3D()
    this.floating.set_name('Floating')
    this.tableSpace.add_child(this.floating)

    const top = this.box(new Vector3(TABLE_WIDTH, TOP_THICKNESS, TABLE_LENGTH), PALETTE.table, 0.18)
    top.position = new Vector3(0, -TOP_THICKNESS / 2, 0)
    this.tableSpace.add_child(top)

    // The markings: the halfway line, the serve circle and the area of each goal.
    this.onTheTable(stripe(TABLE_WIDTH, 0.012), MARKING_COLOR, 0)
    this.onTheTable(arcTriangles(0.16, 0.172, 0, Math.PI * 2, 48), MARKING_COLOR, 0)
    for (const end of [-1, 1]) {
      // Lying flat, the figure's `y` is the table's `−Z`: each area opens toward the centre.
      const [from, to] = end === 1 ? [0, Math.PI] : [Math.PI, Math.PI * 2]
      this.onTheTable(arcTriangles(0.24, 0.252, from, to, 32), MARKING_COLOR, end * (HALF_LENGTH - 0.001))
    }

    const sideX = HALF_WIDTH + RAIL_THICKNESS / 2
    for (const side of [-1, 1]) {
      const rail = this.box(new Vector3(RAIL_THICKNESS, RAIL_HEIGHT, TABLE_LENGTH + RAIL_THICKNESS * 2), PALETTE.rail, 0.5)
      rail.position = new Vector3(side * sideX, RAIL_HEIGHT / 2, 0)
      this.tableSpace.add_child(rail)
    }
    const endRail = (TABLE_WIDTH - GOAL_WIDTH) / 2
    const endZ = HALF_LENGTH + RAIL_THICKNESS / 2
    for (const end of [-1, 1]) {
      for (const side of [-1, 1]) {
        const rail = this.box(new Vector3(endRail, RAIL_HEIGHT, RAIL_THICKNESS), PALETTE.rail, 0.5)
        rail.position = new Vector3(side * (GOAL_WIDTH / 2 + endRail / 2), RAIL_HEIGHT / 2, end * endZ)
        this.tableSpace.add_child(rail)
      }
      // The goal mouth and its lit goal line, in the colour of whoever defends it.
      const mouth = this.box(new Vector3(GOAL_WIDTH, RAIL_HEIGHT, RAIL_THICKNESS), GOAL_MOUTH_COLOR, 0.9)
      mouth.position = new Vector3(0, RAIL_HEIGHT / 2, end * endZ)
      this.tableSpace.add_child(mouth)
      this.onTheTable(stripe(GOAL_WIDTH, 0.04), end === 1 ? PALETTE.primary : PALETTE.rival, end * (HALF_LENGTH - 0.02))
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = this.box(new Vector3(0.06, TABLE_HEIGHT, 0.06), LEG_COLOR, 0.8)
        leg.position = new Vector3(sx * (HALF_WIDTH - 0.08), -TOP_THICKNESS - TABLE_HEIGHT / 2, sz * (HALF_LENGTH - 0.12))
        this.tableSpace.add_child(leg)
      }
    }

    // The goal that was scored in lights up while it is celebrated: you see where it went in
    // without looking for the scoreboard.
    this.goalLight = new OmniLight3D()
    this.goalLight.omni_range = 1.2
    this.goalLight.light_energy = 0
    this.goalLight.position = new Vector3(0, RAIL_HEIGHT + 0.12, HALF_LENGTH)
    this.tableSpace.add_child(this.goalLight)
  }

  /** A mallet of `Mallet.tsx`: the wide base and the knob. */
  private mallet(material: StandardMaterial3D): Node3D {
    const node = new Node3D()
    const base = this.cylinder(MALLET_RADIUS, MALLET_RADIUS, MALLET_BASE, material)
    base.position = new Vector3(0, MALLET_BASE / 2, 0)
    node.add_child(base)
    const knob = this.cylinder(MALLET_RADIUS * 0.45, MALLET_RADIUS * 0.55, MALLET_KNOB, material)
    knob.position = new Vector3(0, MALLET_BASE + MALLET_KNOB / 2, 0)
    node.add_child(knob)
    node.visible = false
    this.tableSpace.add_child(node)
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
    this.tableSpace.add_child(this.puck)

    this.playerMalletMaterial = this.material(PALETTE.primary, 0.4)
    this.playerMalletMaterial.emission_enabled = true
    this.playerMalletMaterial.emission = Color.html(PALETTE.primary)
    this.playerMalletMaterial.emission_energy_multiplier = 0
    this.playerMallet = this.mallet(this.playerMalletMaterial)
    this.opponentMallet = this.mallet(this.material(PALETTE.rival, 0.4))

    if (this.player == null) return
    // What is grabbed: an invisible point halfway up the knob. The XR grammar takes it to the fist
    // when it is grabbed; the scene puts it back on the mallet every frame it is not in the hand.
    this.handle = new Node3D()
    this.handle.set_name('Handle')
    this.tableSpace.add_child(this.handle)
    this.malletGrab = this.player.coger(this.handle, {
      // The mallet does not hang from the fist: it goes on the table, where the fist hovers over
      // it, and what is read is where the fist ends up (`MalletHand.tsx` and `malletGrab.ts` on
      // the web). That is why the grip is the identity: the handle goes right at the fist.
      empunadura: IDENTIDAD,
      alcance: GRAB_REACH,
      alCoger: (hand) => this.handsThatCarried.add(hand),
    })
  }

  /**
   * The hints, with the real controller beside the ghost mallet: that of the hall's dominant hand,
   * on its side of the mallet, with the headset's profile, or the Quest 3's on the flat screen.
   * And with a headset, the real controller in each fist for the countdown and the tutorial: in
   * both, since the mallet is grabbed with either.
   */
  private buildHints(): void {
    const player = this.player
    const hand = player?.manoBuena ?? readHand(gameStorage())
    const beside = new RealController({
      mano: hand,
      dir: CONTROLLERS_DIR,
      junto: besideMallet(hand),
      ...(player == null ? { perfil: () => DEFAULT_PROFILE } : {}),
    })
    this.hints = new GameHints(this.scene, this.tableSpace, beside)
    if (player == null) return
    for (const m of ['left', 'right'] as const) {
      const handController = new RealController({ mano: m, dir: CONTROLLERS_DIR })
      player.puno[m].add_child(handController.nodo)
      this.handControllers.push(new SharedController(handController, CONTROLLER_TURN_ORDER))
    }
  }

  private buildCamera(): void {
    const camera = new Camera3D()
    camera.fov = FLAT_CAMERA.fov
    camera.near = 0.05
    camera.far = 60
    camera.current = true
    this.add_child(camera)
    camera.look_at_from_position(FLAT_CAMERA.position, FLAT_CAMERA.target, Vector3.UP)
    this.camera = camera
  }

  /**
   * The kit's player with a headset, with the shared files as they are: the height
   * (`uiHeight.ts`), the anchor (`hostAnchor.ts`), hold or one tap (`grab.ts`) and the pinch
   * (`pinch.ts`).
   */
  private buildXrPlayer(simulated: boolean): void {
    if (simulated) {
      this.sim = simulateControllers()
    }
    this.player = new XRPlayer(this, { common: { uiHeight, hostAnchor, grab, pinch } })
    this.scene = this.player.mundo
    if (simulated && !this.harness) {
      viewWithSimulatedHead(this.player.camara)
      // The fake controllers arrive without a profile: that of the Quest ones, like the headset, to
      // see their models.
      for (const name of ['left_hand', 'right_hand']) {
        const tracker = XRServer.get_tracker(name) as XRPositionalTracker | null
        if (tracker != null) tracker.profile = OPENXR_PROFILE
      }
    }
    for (const hand of ['left', 'right'] as const) {
      this.player.rayo[hand].button_pressed.connect(Callable.create(this, this.onButton))
    }
  }

  /** The hall settings the test scene asks for (`ajustes` metadata), written into the save. */
  private applyTestSettings(): void {
    const storage = gameStorage()
    if (storage == null || !this.has_meta('ajustes')) return
    const settings = JSON.parse(String(this.get_meta('ajustes'))) as Record<string, string>
    for (const [key, value] of Object.entries(settings)) storage.setItem(key, value)
  }

  /** B/Y and the menu button do what Escape does on the flat screen. */
  private onButton(button: string): void {
    if (button === 'by_button' || button === 'menu_button') this.ui.escape()
  }

  /** The mouse goes to the interface's aim: it is its ray. */
  _input(event: InputEvent): void {
    this.ui?.receive(event)
  }

  _unhandled_input(event: InputEvent): void {
    if (event instanceof InputEventKey && event.is_pressed() && event.keycode === Key.KEY_ESCAPE) this.ui.escape()
  }

  private exit(): void {
    if (this.harnessMenu) {
      this.set_meta('salida', true)
      return
    }
    this.ui.release()
    const xrcade = this.get_node_or_null('/root/XRcade')
    if (xrcade != null) (xrcade as unknown as { call(method: string): unknown }).call('exit_to_hub')
    else this.get_tree().quit()
  }

  /** A scored match has ended: it is reported to the hall (and a test records it). */
  private onFinish(result: GameResult): void {
    this.results.push(result)
    reportToHall(this, result)
  }

  _process(delta: number): void {
    const t0 = Time.get_ticks_usec()
    this.time += delta
    const match = this.match
    const phaseBefore = match.gameState

    // The hand first: it is what puts the mallet on the table.
    if (this.driver === 'mouse') this.driveMouse()
    if (this.sim != null) this.driveXrBot(delta)
    this.placeHandle()
    this.player?.update(delta)
    this.setUiHeight()
    this.readHand()

    match.tick(delta)
    if (match.gameState === 'menu') {
      this.table = null
      this.tableOf = -1
    } else {
      this.stepTable(delta)
    }
    const phase = match.gameState
    this.framesInPhase = phase === phaseBefore ? this.framesInPhase + 1 : 0
    if (phase === 'finished' && this.finishedRun !== match.runId) this.onMatchEnd()

    this.hitFeedback.update()
    this.music.update(delta)
    this.paint()
    // As on the web (`Rink.tsx`): the slide follows the speed of the puck in play; stopped,
    // paused or outside the match, it is silent.
    const slide = puckSlide(this.puckSpeed)
    this.slide.volume = slide.volume
    this.slide.pitch = slide.pitch
    this.slide.update(delta)
    this.ui.update(delta, { grab: this.player?.ajustes.agarre ?? 'hold' })
    // The medal threshold crossed: the colour and the pulse are the sign's; here, the short sound
    // and the hit in the mallet's hand, as on the web (`GameWorld.tsx`).
    const threshold = this.ui.threshold
    if (threshold != null) {
      this.thresholds.push(threshold)
      this.sfx.play(THRESHOLD_SOUND[threshold])
      this.feel({ type: 'threshold', medal: threshold })
    }
    // The countdown stopped on its last second shows the grip on the real controller
    // (`XRCountdown`): the tutorial's grab step is passed during the countdown, before its panel
    // ever comes up.
    const waitingForMallet = phase === 'countdown' && match.waitingForMallet
    for (const m of this.handControllers) {
      if (waitingForMallet) m.pedir('countdown', 'agarre')
      else m.soltar('countdown')
      m.actualizar(delta)
    }
    // Whether the headset gives augmented reality is asked again every half second, not every frame.
    if (this.frames % SCENERY_REREAD_FRAMES === 0) this.scenery.releer()
    this.scenery.actualizar()
    const milestones = match.milestones
    this.hints.update(delta, {
      showing: this.driver === 'xr' || this.flatHints,
      facts: { round: phase !== 'menu', grab: milestones.grab, hit: milestones.hit, goal: milestones.goal },
    })
    if (this.player != null) this.recordWhatIsSeen()

    const spent = Time.get_ticks_usec() - t0
    this.frames++
    this.logicUsecTotal += spent
    this.logicUsecMax = Math.max(this.logicUsecMax, spent)
    // The peak while playing: without the first second (mounting the table, generating the
    // letters) or the frame of the ending, which writes the save to disk and mounts the result panel.
    if (this.frames > 72 && phase === 'playing') this.logicUsecMaxInPlay = Math.max(this.logicUsecMaxInPlay, spent)

    this.screenshots()
    const automatic = this.driver === 'bot' || this.sim != null
    if (automatic && phase === 'finished' && this.shotFinalPath == null) {
      // In the duel, with the first one's match over, the controller is handed over: the second
      // one's.
      const handover = match.duelView != null && !match.duelView.over
      if (handover && this.framesInPhase === HANDOVER_FRAMES) match.startGame()
      else if (!handover && this.framesInPhase === 1) this.reportAndQuit()
    }
  }

  /**
   * The interface rises with the eyes of whoever plays (the web's `XRUiHeight`); the table does
   * not.
   */
  private setUiHeight(): void {
    const player = this.player
    if (player == null) return
    const rise = uiHeight.uiRiseOverWorld(player.estadoDelDecorado.altura.held, player.ajustes.altura === 'eyes')
    if (rise !== this.floating.position.y) this.floating.position = new Vector3(0, rise, 0)
  }

  /**
   * What has actually been seen with a headset: the hints, the tutorial and the real controller of
   * each hand.
   */
  private recordWhatIsSeen(): void {
    for (const hint of this.hints.visibleHints()) this.hintsSeen.add(hint)
    if (this.ui.tutorial.view.visible) this.tutorialSeen = true
    for (const m of this.handControllers) {
      const controller = m.mando as RealController
      if (m.quien != null && controller.visible) this.controllersSeen[m.quien].add(controller.mano)
    }
  }

  /** Advances the table with the clock (slowed by the hit taken) and reports what has happened. */
  private stepTable(delta: number): void {
    const match = this.match
    const skill = OPPONENT_SKILLS[match.activeDifficulty]
    if (this.table == null || this.tableOf !== match.runId) {
      // Each match, and each round of the challenge, gets a fresh table: the puck at the centre and
      // each mallet in its place.
      this.table = startTable({ skill, lastScorer: match.lastScorer, seed: match.seed })
      this.tableOf = match.runId
      if (!this.inHand) this.pointer = this.table.player.position
    }
    if (this.driver === 'bot') this.pointer = botTarget(this.table)
    const hitsBefore = this.table.playerHits
    const frame = advanceTable(this.table, {
      delta: delta * this.hitFeedback.timeScale(),
      pointer: this.pointer,
      inHand: this.inHand,
      skill,
      // With the exit question in front the puck stays still: deciding cannot cost goals.
      playing: match.gameState === 'playing' && match.prompt === null,
    })
    this.table = frame.table
    // The feats before the goals that bring them: the last goal ends the match on the spot.
    for (const feat of frame.feats) {
      this.tableFeats.push(feat)
      match.recordFeat(feat)
    }
    for (const goal of frame.goals) {
      this.goals.push(goal)
      if (goal === 'player') match.scorePlayer()
      else match.scoreOpponent()
    }
    if (frame.table.playerHits > 0) match.recordMilestone('hit')
    if (frame.struck) this.sfx.play(collisionSound('strike', impactStrength(frame.impact.strike)))
    if (frame.bounced) this.sfx.play(collisionSound('bounce', impactStrength(frame.impact.bounce)))
    if (frame.goals.length > 0) this.sfx.play('goal')
    for (const event of frameEvents(hitsBefore, frame)) this.feel(event)
    // The goal against, as a hit the body takes, after the goal's vibration.
    if (frame.goals.includes('opponent')) this.goalAgainstHit()
  }

  /**
   * What is felt, in the hand that carries the mallet; with no headset or no mallet in the hand,
   * nothing.
   */
  private feel(event: HandEvent): void {
    if (this.player == null) return
    this.player.vibrar(eventPulses(event, this.malletGrab?.mano ?? null))
  }

  /** The hit taken, toward the player's own goal from the eyes, taken to global space. */
  private goalAgainstHit(): void {
    const camera = this.player?.camara ?? this.camera
    if (camera == null) {
      this.hitFeedback.hit(GOAL_AGAINST_STRENGTH, null)
      return
    }
    const eyes = this.tableSpace.to_local(camera.global_position)
    const toward = goalAgainstDirection({ x: eyes.x, y: eyes.y, z: eyes.z })
    const global = Basis.MULTIPLY(this.tableSpace.global_basis, new Vector3(toward.x, toward.y, toward.z))
    this.hitFeedback.hit(GOAL_AGAINST_STRENGTH, { x: global.x, y: global.y, z: global.z })
  }

  /** The match is over: the ending that sounds (and the record on top) and the final pulse. */
  private onMatchEnd(): void {
    const match = this.match
    this.finishedRun = match.runId
    const score = { scored: match.totalPlayerGoals, conceded: match.totalOpponentGoals }
    if (match.duelView != null) this.duelMatches.push({ ...score, seed: match.seed })
    // The end of the duel sounds like a win: one of the two who are there wins it (`duel.ts`).
    const ending = endSoundsLikeWin(match.duelView?.over ?? false, score) ? 'win' : 'loss'
    this.endings.push(ending)
    this.sfx.play(ending)
    this.feel({ type: 'end' })
    if (match.isRecord) this.sfx.play('record')
  }

  /** The mouse points at the table: the mallet chases that point with its speed cap. */
  private driveMouse(): void {
    const camera = this.camera
    if (camera == null) return
    const mouse: Vector2 = this.get_viewport()!.get_mouse_position()
    const origin = camera.project_ray_origin(mouse)
    const from = this.tableSpace.to_local(origin)
    const towards = this.tableSpace.to_local(Vector3.ADD(origin, camera.project_ray_normal(mouse)))
    const dy = towards.y - from.y
    if (Math.abs(dy) < 1e-6) return
    const k = -from.y / dy
    if (k <= 0) return
    this.pointer = constrainMallet({ x: from.x + (towards.x - from.x) * k, z: from.z + (towards.z - from.z) * k }, 'player')
  }

  /** Puts the handle back on the mallet when it is not in the hand; in the menu, out of reach. */
  private placeHandle(): void {
    if (this.handle == null || this.malletGrab?.mano != null) return
    const m = this.table?.player.position
    this.handle.transform = new Transform3D(Basis.IDENTITY, m == null ? new Vector3(0, -100, 0) : new Vector3(m.x, MALLET_BASE + MALLET_KNOB / 2, m.z))
  }

  /**
   * With the mallet grabbed, where it goes: where the fist hovers over the table
   * (`MalletHand.tsx`).
   */
  private readHand(): void {
    if (this.malletGrab == null || this.handle == null) return
    const held = this.malletGrab.mano != null && this.match.gameState !== 'menu'
    this.inHand = held
    this.match.malletHeld = held
    if (!held) return
    const local = this.tableSpace.to_local(this.handle.global_position)
    this.pointer = constrainMallet({ x: local.x, z: local.z }, 'player')
    this.match.recordMilestone('grab')
  }

  /**
   * The automatic player with a headset: it moves the fake dominant hand like a real one. First it
   * takes the fist to the mallet and squeezes (with «one tap», a tap); then it takes it over the
   * table toward where the one without a headset would play, at arm speed. At the start it pushes
   * the other hand's stick for a moment, which when seated turns the scenery.
   */
  private driveXrBot(delta: number): void {
    const sim = this.sim!
    const player = this.player!
    const hand = player.manoBuena
    const other: HandSide = hand === 'left' ? 'right' : 'left'
    this.framesXr++
    const eyes = this.has_meta('eyes') ? Number(this.get_meta('eyes')) : 1.6
    // The turn, after a few frames: the scenery is planted toward where you look on entering.
    const yaw = this.framesXr > 5 ? this.lookToward : 0
    const rotation = multiplicar(deCuaternion(giroSobre({ x: 0, y: 1, z: 0 }, yaw)), deCuaternion(giroSobre({ x: 1, y: 0, z: 0 }, this.pitch)))
    sim.cabeza(new Transform3D(basisOf(rotation), new Vector3(0, eyes, 0)))
    if (this.shotHintsPath != null) {
      // The hints screenshot: nobody grabs anything or turns, the hands wait at the sides of the
      // table.
      for (const m of ['left', 'right'] as const) {
        sim.manos[m].agarre(0)
        const side = m === 'left' ? -1 : 1
        sim.manos[m].poner(new Transform3D(Basis.IDENTITY, this.scene.to_global(new Vector3(side * IDLE_HANDS.x, IDLE_HANDS.y, IDLE_HANDS.z))))
      }
      return
    }
    sim.manos[other].stick(this.framesXr === TURN_FRAME ? 1 : 0, 0)
    const oneTap = player.ajustes.agarre === 'toggle'
    let fist: Vector3
    if (this.malletGrab?.mano == null) {
      // Go for the handle, and squeeze once there is a mallet on the table (in the menu the handle
      // is out).
      fist = this.handle!.global_position
      // With the `grabs_late` metadata it waits for the countdown to stop asking for the mallet,
      // like someone who takes a while to find it: it is what shows the grip on the real controller.
      const late = this.has_meta('grabs_late') && this.match.gameState === 'countdown' && !this.match.waitingForMallet
      const malletOnTable = this.table != null && !late
      sim.manos[hand].agarre(!malletOnTable ? 0 : oneTap ? this.framesXr % 2 : 1)
      if (this.table != null) this.botHand = this.table.player.position
    } else {
      if (oneTap) sim.manos[hand].agarre(0)
      if (this.table != null) this.botHand = approach(this.botHand, botTarget(this.table), delta)
      fist = this.tableSpace.to_global(new Vector3(this.botHand.x, FIST_HEIGHT, this.botHand.z))
    }
    sim.manos[hand].poner(new Transform3D(Basis.IDENTITY, fist))
  }

  /** Places the puck and the mallets, and lights what is due. */
  private paint(): void {
    const table = this.table
    this.puckSpeed = 0
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
    // The puck's halo with its speed (`puckGlow`); stopped or paused, the resting one.
    const moving = this.match.gameState === 'playing' && this.match.prompt === null
    const speed = moving ? Math.hypot(table.puck.velocity.x, table.puck.velocity.z) : 0
    this.puckSpeed = speed
    this.puckMaterial.emission_energy_multiplier = puckGlow(speed).emissive
    // The mallet throbs while the countdown waits for it: it is what says which one to grab.
    this.playerMalletMaterial.emission_energy_multiplier = this.match.waitingForMallet ? 0.5 + 0.5 * Math.sin(this.time * 6) : 0
    this.goalLight.light_energy = table.pause > 0 ? 3 : 0
    this.goalLight.light_color = Color.html(table.pendingServe === 'player' ? PALETTE.primary : PALETTE.rival)
    this.goalLight.position = new Vector3(0, RAIL_HEIGHT + 0.12, table.pendingServe === 'player' ? -HALF_LENGTH : HALF_LENGTH)
  }

  /** The flat-screen screenshots: the menu, the match under way or the ending, and quit. */
  private screenshots(): void {
    const phase = this.match.gameState
    const save = (path: string) => {
      // The viewport's texture has the frame already drawn, which is the one that is saved.
      this.get_viewport()!.get_texture()!.get_image()!.save_png(path)
      print(`GH-SHOT ${path}`)
      this.shotPath = this.shotMenuPath = this.shotFinalPath = this.shotHintsPath = null
      this.get_tree().quit(0)
    }
    // Twenty frames: the MSDF labels are generated on the first draw. The match, with two goals
    // already on the scoreboard and the puck around the centre of the table.
    if (this.shotHintsPath != null && phase !== 'menu' && this.hints.seconds > HINTS_SHOT_SECOND) save(this.shotHintsPath)
    else if (this.shotMenuPath != null && phase === 'menu' && this.framesInPhase > 20) save(this.shotMenuPath)
    else if (this.shotFinalPath != null && phase === 'finished' && this.framesInPhase > 20) save(this.shotFinalPath)
    else if (this.shotPath != null && phase === 'playing' && this.goals.length >= 2 && this.table != null && this.table.pause <= 0 && Math.abs(this.table.puck.position.z) < 0.5) save(this.shotPath)
  }

  /**
   * Which phase the match is in: for the test scenes in GDScript, which do not see the JS objects.
   */
  phase(): string {
    return this.match.prompt != null ? 'prompt' : this.match.gameState
  }

  /** Whether what is being played is the challenge the hall lent. */
  in_challenge(): boolean {
    return this.match.inChallenge
  }

  /**
   * Which mode the current match (or the last one) is in, which is also the one chosen in the menu.
   */
  match_mode(): string {
    return this.match.gameMode
  }

  /** What the goal sign says right now, its lines in one; empty if it is not hung. */
  goal_sign(): string {
    const view = this.match.sign(this.ui.lang)
    return view == null ? '' : [view.title, view.detail ?? '', ...(view.footer == null ? [] : [view.footer])].join(' | ')
  }

  /** Whether the goal sign is visible. */
  sign_visible(): boolean {
    return this.ui.sign.node.visible
  }

  /** Where on the screen an interface button lands, so that a test presses it with the mouse. */
  button_on_screen(id: string): Vector2 {
    const button = this.ui.aim.boton(id)
    if (button == null || this.camera == null || !button.nodo.is_visible_in_tree()) return new Vector2(-1, -1)
    return this.camera.unproject_position(button.nodo.global_position)
  }

  /** What the test scene with a headset checks of the XR grammar. */
  private xrReport() {
    const player = this.player
    if (player == null) return null
    const sceneryState = player.estadoDelDecorado
    const world = player.mundo.global_transform
    return {
      hand: player.manoBuena,
      carried: [...this.handsThatCarried],
      rise: player.subida,
      ui: this.floating.position.y,
      placement: sceneryState.colocacion,
      turn: sceneryState.giro.yaw,
      world: { x: world.origin.x, y: world.origin.y, z: world.origin.z },
      vibrations: player.vibraciones.length,
      handsThatVibrated: [...new Set(player.vibraciones.map((v) => v.mano))],
      hintsSeen: [...this.hintsSeen],
      hintsAtTheEnd: this.hints.visibleHints(),
      controllerBeside: { hand: this.hints.controller?.mano ?? null, x: this.hints.controller?.nodo.position.x ?? 0 },
      tutorial: this.tutorialSeen,
      tutorialControllers: [...this.controllersSeen.tutorial],
      countdownControllers: [...this.controllersSeen.countdown],
      withRoom: this.scenery.conSitio,
    }
  }

  private reportAndQuit(): void {
    const match = this.match
    const result = {
      mode: match.gameMode,
      outcome: match.outcome,
      playerGoals: match.totalPlayerGoals,
      opponentGoals: match.totalOpponentGoals,
      goals: this.goals.length,
      points: match.points,
      bestStreak: match.bestStreak,
      playerHits: this.table?.playerHits ?? 0,
      seed: match.seed,
      frames: this.frames,
      logicUsecAvg: Math.round(this.logicUsecTotal / this.frames),
      logicUsecMax: this.logicUsecMax,
      logicUsecMaxInPlay: this.logicUsecMaxInPlay,
      wallMs: Time.get_ticks_msec() - this.startedMs,
      simSeconds: Number(this.time.toFixed(2)),
      record: match.isRecord,
      best: getBestPoints(match.gameMode),
      results: this.results,
      tableFeats: this.tableFeats,
      hitsTaken: this.hitFeedback.dealt,
      sfx: this.sfx.counts,
      slide: { ...this.slide.stats, sounding: this.slide.playing },
      variants: Object.fromEntries(SOUNDS.map((name) => [name, this.sfx.variantCount(name)])),
      music: { playing: this.music.playing, volume: Number(this.music.volume.toFixed(3)) },
      levels: volumeLevels(),
      duel: match.duelView == null ? null : { ...match.duelView, playedMatches: this.duelMatches, tally: getDuelTally() },
      endings: this.endings,
      thresholds: this.thresholds,
      xr: this.xrReport(),
    }
    // The engine's `print` and not `console.log`: in the release templates GodotJS only lets
    // through the warnings and errors of the JS console. It is called `WAM-RESULT`, like Hole
    // Patrol's, because it is what `xrcade/scripts/godotjs/check-templates.sh` looks for when
    // playing a `.pck` in Docker.
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
