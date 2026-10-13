/**
 * The interface of Glide Hockey in Godot, whole: the menu almost head-on, the end and the exit notice
 * in the column;
 * the scoreboard at the back of the table and, above it, the goal sign; the countdown over the
 * serve; the stop button; the tutorial; and the aim that makes them pressable.
 *
 * **Where each thing goes is the web's** (`layout.ts`): with the headset, the menu a metre and a half
 * away and almost head-on (at 30° or less, the common template), and the column at the same distance
 * and 55° to the left, enlarged and facing the eyes, off the table; the scoreboard over the
 * machine's goal; the stop button where the column is, which while playing is empty. **Flat**
 * —where the web puts its menu in the DOM— the column goes to the left of the table, facing the
 * camera, and the stop button next to the scoreboard: the flat camera does not see what is at 55°.
 *
 * **Everything hangs from the root** (`root`): the table's space raised with the eyes of whoever
 * plays, like the web's `XRUiHeight`, which the scene moves; the table does not rise with it.
 *
 * **Never two full panels at once in the column**: the menu, the end and the notice take turns, and
 * the phase is decided by the match (`match.ts`), not by the interface.
 */
import { Node3D, Transform3D, Vector3, type Camera3D, type InputEvent } from 'godot'

import type { Pointer } from '@kit/lib/ui/pointer'
import { PointerAim } from '@kit/runtime/ui/pointerAim'
import { MousePointer } from '@kit/runtime/ui/mouse'
import type { MandoEnLaMano } from '@kit/runtime/ui/tutorial'

import type { GrabMode, Lang, Scenery } from '@/lib/settings'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from '@/lib/gameConfig'
import { getDuelTally } from '@/lib/duelTally'
import { isEndless } from '@/lib/gameMode'
import type { Medal } from '@/lib/goal'

import { onLangChange, currentLang } from '@kit/runtime/settings'
import { currentComfort, chooseComfort } from './comfort'
import { ExitNotice, StopButtons } from './notice'
import { SignPanel } from './sign'
import { GameOverPanel } from './gameOver'
import { Countdown, Scoreboard } from './scoreboard'
import { GameMenu, type MenuState } from './menu'
import type { Match } from './match'
import {
  BUTTON_SCALE,
  COLUMN_SCALE,
  SCOREBOARD_TILT,
  SIGN_PLACEMENT,
  goalsRow,
  XR_QUIT,
  FLAT_TUTORIAL,
  XR_UI,
  XR_UI_ROTATION,
  type Triple,
} from './layout'
import { GameTutorial } from './tutorial'

/** What the interface asks of the scene, besides what it asks of the match. */
export interface GameSceneHost {
  /** Go back to the hall, or close the game. */
  exit(): void
}

/** The hall's scenery, seen from the menu: what is chosen, whether it can be changed and how. */
export interface MenuScenery {
  readonly elegido: Scenery
  /** Whether there is a room to show (augmented reality): without it, the button is dimmed. */
  readonly hayHabitacion: boolean
  alternar(): void
}

export interface UiOptions {
  /**
   * What everything hangs from: the table's space (its centre, at the height of the board), raised
   * with the eyes of whoever plays (the web's `XRUiHeight`). Flat, the table's as it is.
   */
  root: Node3D
  /** The flat camera, which the mouse's ray comes from. With a headset, `null`. */
  camera: Camera3D | null
  /** The headset's pointers (`XRPlayer.punteros()`), besides the mouse. */
  pointers?: readonly Pointer[]
  headset: boolean
  /** Language forced from the command line (`--lang=es`), to look without touching what is stored. */
  lang?: string | null
  /** Show the tutorial flat as well (`--tutorial`). */
  tutorial?: boolean
  /** The real controller of each hand, for the tutorial (the kit's `RealController`). */
  hands?: readonly MandoEnLaMano[]
  /** The hall's scenery; without it, the room and the button dimmed. */
  scenery?: MenuScenery
}

/**
 * Where the column goes when flat, in the table's space: to the left of the table and over the
 * room's dark floor. Above the table, the white board showed through the panels, which are
 * translucent as in the headset, and the white digits could not be read.
 */
export const FLAT_COLUMN: Triple = [-1.05, 0.5, 0.35]
/** And the stop button when flat: to the left of the scoreboard, which is where one looks while playing. */
export const FLAT_STOP: Triple = [-0.48, XR_UI.scoreboard[1], XR_UI.scoreboard[2]]

function place(node: Node3D, where: readonly [number, number, number], rotation: readonly [number, number, number, string] | null, scale = 1): void {
  node.position = new Vector3(where[0], where[1], where[2])
  // `Node3D` rotates in YXZ order, the same as the web's rotations (`panelRotation`).
  if (rotation != null) node.rotation = new Vector3(rotation[0], rotation[1], rotation[2])
  node.scale = new Vector3(scale, scale, scale)
}

export class GameUi {
  readonly aim: PointerAim
  readonly mouse: MousePointer | null
  readonly column = new Node3D()
  /** Where the menu is born with the headset: almost head-on, at the column's distance. */
  readonly menuAnchor = new Node3D()
  readonly menu: GameMenu
  readonly gameOver: GameOverPanel
  readonly exitNotice: ExitNotice
  readonly stopButtons: StopButtons
  readonly scoreboard: Scoreboard
  /** The goal sign, above the scoreboard. */
  readonly sign: SignPanel
  /**
   * The medal threshold that was crossed in the last frame, or `null`: the scene makes it sound
   * and be felt, since the colour and the pulse already belong to the sign.
   */
  threshold: Medal | null = null
  readonly countdown: Countdown
  readonly tutorial: GameTutorial
  private painted = ''
  /** «Más opciones», unfolded or not: the interface's own, it folds every time the menu is returned to. */
  private moreOptions = false
  private previousPhase: string | null = null
  private readonly forcedLang: string | null
  private readonly flatTutorial: boolean
  private readonly headset: boolean
  private readonly scenery: MenuScenery | null
  private readonly stopListening: () => void

  constructor(
    private readonly match: Match,
    private readonly scene: GameSceneHost,
    options: UiOptions,
  ) {
    this.headset = options.headset
    this.forcedLang = options.lang ?? null
    this.flatTutorial = options.tutorial ?? false
    this.scenery = options.scenery ?? null
    this.mouse = options.camera == null ? null : new MousePointer(options.camera)
    this.aim = new PointerAim([...(this.mouse == null ? [] : [this.mouse]), ...(options.pointers ?? [])])
    const root = options.root

    this.column.set_name('Column')
    root.add_child(this.column)
    if (this.headset) place(this.column, XR_UI.panel, XR_UI_ROTATION.panel, COLUMN_SCALE)
    else {
      // Parallel to the screen: turned towards the camera like a headset panel (`panelRotation`),
      // to one side of the picture it looked crooked, because the flat camera looks down.
      const camera = options.camera!
      this.column.global_transform = new Transform3D(camera.global_basis, root.to_global(new Vector3(...FLAT_COLUMN)))
    }

    this.menu = new GameMenu(
      {
        chooseMode: (mode) => match.setGameMode(mode),
        chooseDifficulty: (d) => match.setDifficulty(d),
        chooseComfort: (c) => chooseComfort(c),
        step: (sign) => (match.levels ? match.setLevel(match.activeLevel + sign) : match.setGoalTarget(match.goalTarget + sign)),
        endless: () => match.setEndless(!match.endless),
        toggleScenery: () => this.scenery?.alternar(),
        moreOptions: () => (this.moreOptions = !this.moreOptions),
        play: () => match.startGame(),
        exit: () => scene.exit(),
      },
      this.aim,
    )
    // With the headset, the menu is born almost head-on (`XR_UI.menu`, the common template) and moves
    // away on starting; flat it goes in the column, which the camera already sees head-on.
    if (this.headset) {
      this.menuAnchor.set_name('Menu')
      place(this.menuAnchor, XR_UI.menu, XR_UI_ROTATION.menu, COLUMN_SCALE)
      root.add_child(this.menuAnchor)
      this.menuAnchor.add_child(this.menu.node)
    } else this.column.add_child(this.menu.node)

    this.gameOver = new GameOverPanel({ again: () => match.startGame(), menu: () => match.resetGame(), exit: () => scene.exit() }, this.aim)
    this.column.add_child(this.gameOver.node)

    // In front of everything in the column: it comes up over the stopped match.
    this.exitNotice = new ExitNotice({ stay: () => match.keepPlaying(), menu: () => match.resetGame(), leave: () => scene.exit() }, this.aim)
    this.exitNotice.node.position = new Vector3(0, 0, 0.03)
    this.column.add_child(this.exitNotice.node)

    this.stopButtons = new StopButtons({ stop: () => match.askToQuit(), end: () => match.endRun() }, this.aim)
    if (this.headset) place(this.stopButtons.node, XR_QUIT, XR_UI_ROTATION.quit, BUTTON_SCALE)
    else place(this.stopButtons.node, FLAT_STOP, [SCOREBOARD_TILT, 0, 0, 'YXZ'], COLUMN_SCALE)
    root.add_child(this.stopButtons.node)

    this.scoreboard = new Scoreboard()
    place(this.scoreboard.node, XR_UI.scoreboard, [SCOREBOARD_TILT, 0, 0, 'YXZ'])
    root.add_child(this.scoreboard.node)

    // What has to be beaten, head-on: above the scoreboard, which is where one already looks. It
    // hangs from the same root, so it rises with the eyes just like it does.
    this.sign = new SignPanel()
    this.sign.place(SIGN_PLACEMENT)
    root.add_child(this.sign.node)

    this.countdown = new Countdown()
    place(this.countdown.node, XR_UI.countdown, null)
    root.add_child(this.countdown.node)

    this.tutorial = new GameTutorial(this.aim, options.hands)
    if (this.flatTutorial) this.tutorial.force()
    if (this.headset) place(this.tutorial.view.nodo, XR_UI.tutorial, XR_UI_ROTATION.tutorial)
    else place(this.tutorial.view.nodo, FLAT_TUTORIAL, XR_UI_ROTATION.flatTutorial)
    root.add_child(this.tutorial.view.nodo)

    // If the hall changes the language with the game open, it is repainted on the next frame.
    this.stopListening = onLangChange(() => (this.painted = ''))
    this.paintPhase()
  }

  get lang(): Lang {
    return currentLang(this.forcedLang)
  }

  /**
   * Escape when flat, or B/Y and the menu button with a headset: in the menu it leaves the game; in
   * the match it asks (or stops asking); at the end it goes back to the menu.
   */
  escape(): void {
    const phase = this.match.gameState
    if (phase === 'menu') this.scene.exit()
    else if (phase === 'finished') this.match.resetGame()
    else if (this.match.prompt != null) this.match.keepPlaying()
    else this.match.askToQuit()
  }

  /** An input event: the mouse is carried by the aim. */
  receive(event: InputEvent): boolean {
    return this.mouse?.recibir(event) ?? false
  }

  /** Whether any pointer is over a button. */
  pointsAtButton(): boolean {
    return this.aim.punteros.some((p) => this.aim.apuntando(p.id) != null)
  }

  /** What the menu shows right now. */
  menuState(): MenuState {
    const p = this.match
    return {
      lang: this.lang,
      mode: p.gameMode,
      difficulty: p.difficulty,
      goals: p.goalTarget,
      endless: p.endless,
      level: p.activeLevel,
      unlocked: p.unlockedLevel,
      stars: p.levelStars,
      record: p.bestPoints,
      goal: p.goal,
      comfort: currentComfort(),
      hasRoom: this.scenery?.hayHabitacion ?? false,
      scenery: this.scenery?.elegido ?? 'place',
      moreOptions: this.moreOptions,
    }
  }

  /** A frame: the aim (which may change the phase) and then painting what applies. */
  update(delta: number, { grab = 'hold' as GrabMode } = {}): void {
    this.aim.actualizar()
    this.paintPhase()
    const p = this.match
    const phase = p.gameState
    const lang = this.lang
    if (phase === 'menu') {
      const state = this.menuState()
      const key = JSON.stringify(state)
      if (key !== this.painted) {
        this.menu.paint(state)
        this.painted = key
      }
    } else this.painted = ''
    if (phase !== 'menu') {
      // Without what the sign above already says: in the challenge, the points and —while playing— the round.
      const omitted = p.omitted
      this.scoreboard.paint({
        player: p.playerGoals,
        opponent: p.opponentGoals,
        points: omitted.points ? null : p.points,
        // In the duel, the number of whoever has the controller: without letters, it is what says whose the cyan is.
        rowNumber: omitted.round ? null : (p.round ?? (p.levels ? p.activeLevel : p.duelView != null ? p.duelView.player + 1 : null)),
        lap: !omitted.round && p.lap != null && p.lap > 1 ? p.lap : null,
        goalsRow: goalsRow(omitted),
      })
    }
    this.threshold = this.sign.update(p.sign(lang), p.medal, lang, delta)
    this.countdown.paint(phase === 'countdown' ? { count: p.count, waitingForMallet: p.waitingForMallet, withOneTap: grab === 'toggle', lang } : null)
    if (phase === 'finished') {
      const level = p.levelResult
      const duel = p.duelView
      this.gameOver.paint({
        lang,
        outcome: p.outcome!,
        points: p.points,
        isRecord: p.isRecord,
        level: level == null ? null : { level: p.activeLevel, stars: level.stars, passed: level.passed },
        duel: duel == null ? null : { view: duel, score: { scored: p.playerGoals, conceded: p.opponentGoals }, tally: getDuelTally() },
      })
    }
    if (p.prompt != null) this.exitNotice.write(lang)
    // Neither in the hall's challenge nor in the duel: they have to be the same match for everyone.
    const tutorial = phase === 'playing' && (this.headset || this.flatTutorial) && !p.inChallenge && !p.duel
    const { teaching, closed } = this.tutorial.update(tutorial, p.milestones, lang, grab, delta)
    p.learning = teaching
    if (closed) p.finishLesson()
  }

  /** Shows the panels of the phase, now: a button that appears has to be pressable straight away. */
  private paintPhase(): void {
    const p = this.match
    const phase = p.gameState
    const inMatch = phase === 'countdown' || phase === 'playing'
    // What is unfolded is not stored: on going back to the menu, «Más opciones» is folded again.
    if (phase === 'menu' && this.previousPhase !== 'menu') this.moreOptions = false
    this.previousPhase = phase
    this.menu.node.visible = phase === 'menu'
    this.gameOver.node.visible = phase === 'finished'
    this.exitNotice.node.visible = inMatch && p.prompt != null
    this.scoreboard.node.visible = phase !== 'menu'
    this.stopButtons.show(inMatch && p.prompt == null, isEndless(p.activeGoalTarget) && phase === 'playing')
  }

  /** Stops listening to what is stored: on leaving the scene. */
  release(): void {
    this.stopListening()
  }
}

/** Where the table is in the space of whoever plays: everything here hangs from there. */
export const TABLE = new Vector3(0, TABLE_HEIGHT, TABLE_CENTER_Z)
