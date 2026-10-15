/**
 * The menu of Glide Hockey in Godot: the web's headset panel (`components/xr/XRMenu.tsx`), with
 * the boxes of `lib/xrMenuLayout.ts` without touching a dimension and the kit's buttons.
 *
 * **The mode first, and it only asks what the mode needs**, as on the web: in practice, the
 * machine's level and to how many goals (or endless); in the levels, which level, with its stars;
 * in the challenge, nothing but playing. What does not belong to the mode —the options of practice,
 * the scenery and the comfort— goes behind «Más opciones», in the top band, folded (`modeRows`).
 * What does not apply is not painted; what applies but cannot be done (going below level 1, your
 * room without augmented reality) is dimmed instead of hidden. At the very top, the comfort of the
 * hit taken; at the bottom, play in the middle and **exit in the bottom right corner**, that of
 * every cabinet (`exitCorner.ts`).
 *
 * **The scenery** (the room or your room) is the hall's scenery (`xrcade:scenery`): the button
 * toggles it for every cabinet and is dimmed if the headset gives no augmented reality, since without
 * it there is no room to show. Its icon is the window of `XRSceneryIcon`: closed, the room; open,
 * your room.
 *
 * **The modes, with the web's icon** (`ModeIcon`): a puck for practice, three stars for the
 * levels, a ladder for the challenge and two pucks for the duel. They carried their name written
 * while they were three; with the duel there are four in the row, and «Challenge» does not fit in
 * 15 cm at the size that can be read. What each one is, the line below says, and **whether it counts
 * for a medal**, the phrase on the line of the «Modo» label; the one that gives it —the challenge—
 * also carries a golden disc in the corner. The digits —goals, level, record— are
 * seven-segment, as on the web.
 */
import { Node3D, Vector3 } from 'godot'

import { offset, arcTriangles, strokeTriangles } from '@kit/lib/ui/icons'
import type { Point2 } from '@kit/lib/ui/exit'
import { Button } from '@kit/runtime/ui/button'
import { barra, exitButton, playIcon, plusMinusIcon } from '@kit/runtime/ui/icons'
import { shape, paint } from '@kit/runtime/ui/mesh'
import { Panel } from '@kit/runtime/ui/panel'
import type { PointerAim } from '@kit/runtime/ui/pointerAim'

import type { Lang, Scenery } from '@/lib/settings'
import { givesMedal, medalPhrase } from '@/lib/scoreboardSign'
import { DIFFICULTY_ORDER, MAX_GOALS, MIN_GOALS, type Difficulty } from '@/lib/gameConfig'
import { GAME_MODE_HINTS, GAME_MODE_LABELS, MENU_MODE_ORDER, modeRows, type GameMode } from '@/lib/gameMode'
import { COMFORT_LEVELS, type Comfort } from '@/lib/hitFeedback'
import { LEVEL_COUNT, type Stars } from '@/lib/levels'
import type { Goal } from '@/lib/goal'
import { MENU_EN } from '@/lib/menuWords'
import { gameName } from '@/lib/menuTemplate'
import { COMMON_PALETTE } from '@/lib/commonPalette'
import { DIFFICULTY_COLORS, PALETTE } from '@/lib/palette'
import { SCENERY_LABELS } from '@/lib/scenery'
import { translator, type TextKey } from '@/lib/textos'
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

import { Digits } from './digits'
import type { Box } from './layout'

/** What is dimmed or secondary: the hall's soft neutral (`DIM_COLOR` of `XRUi.tsx`). */
export const DIM = COMMON_PALETTE.mutedText

/** The name of the comfort row (`COMFORT_LEGEND` of `lib/comfort.ts`, which is React's). */
export const COMFORT_LEGEND: TextKey = 'When hit'

/** The radius of the mark of the mode that gives a medal (`MEDAL_MARK` of `XRMenu.tsx`). */
export const MEDAL_MARK = 0.011

/** The digits of the panel, at their height on the web: goals, level and its total, and the record. */
export const MENU_DIGITS = { goals: 0.11, level: 0.1, total: 0.04, record: 0.04 } as const

/** The box of one of the web's buttons in the shape of the kit's. */
export function boxOf(box: MenuBox): Box {
  return { x: box.position[0], y: box.position[1], width: box.size[0], height: box.size[1] }
}

/**
 * The window of the scenery (the web's `XRSceneryIcon`, at 5 cm): the frame always, and inside the
 * whole pane (the room, closed) or only the crossbar (your room, open).
 */
export function windowTriangles(room: boolean, side = 0.05): { frame: Point2[]; inside: Point2[] } {
  const g = side * 0.12
  const rect = (x: number, y: number, width: number, height: number): Point2[] => {
    const a = width / 2
    const b = height / 2
    return [[x - a, y - b], [x + a, y - b], [x + a, y + b], [x - a, y - b], [x + a, y + b], [x - a, y + b]]
  }
  const frame = [
    ...rect(0, side * 0.34, side * 0.8, g),
    ...rect(0, -side * 0.34, side * 0.8, g),
    ...rect(-side * 0.34, 0, g, side * 0.8),
    ...rect(side * 0.34, 0, g, side * 0.8),
  ]
  return { frame, inside: room ? rect(0, 0, side * 0.68, g) : rect(0, 0, side * 0.56, side * 0.56) }
}

/** Three diamonds, the stars of a level (`StarsRow`): a two-millimetre point cannot be seen. */
export function diamondTriangles(side: number): Point2[] {
  const r = side * 0.71
  return [[0, -r], [r, 0], [0, r], [0, -r], [0, r], [-r, 0]]
}

/** A rectangle of `width × height` centred on `(x, y)`. */
function rectangle(x: number, y: number, width: number, height: number): Point2[] {
  const a = width / 2
  const b = height / 2
  return [[x - a, y - b], [x + a, y - b], [x + a, y + b], [x - a, y - b], [x + a, y + b], [x - a, y + b]]
}

/** A filled circle of `radius`, centred on `(x, y)`. */
function circle(radius: number, x = 0, y = 0, sides = 24): Point2[] {
  return offset(arcTriangles(0, radius, 0, Math.PI * 2, sides), x, y)
}

/**
 * The silhouette of each mode (the web's `ModeIcon`, with its measures): a puck for practice, three
 * stars for the levels, a ladder for the challenge and two pucks for the duel —the drawing of
 * table-tennis's duel—.
 */
export function modeTriangles(mode: GameMode): Point2[] {
  if (mode === 'practice') return circle(0.032)
  if (mode === 'levels') return [0, 1, 2].flatMap((i) => offset(diamondTriangles(0.02), (i - 1) * 0.02 * 1.9, 0))
  if (mode === 'duel') return [...circle(0.022, -0.03, 0, 20), ...circle(0.022, 0.03, 0, 20)]
  return [0, 1, 2].flatMap((step) => rectangle((step - 1) * 0.03, -0.024 + step * 0.016, 0.024, 0.016 + step * 0.032))
}

/** The icon of each comfort (`ComfortIcon`): crossed out, one wave or two. */
export function comfortTriangles(comfort: Comfort): Point2[] {
  if (comfort === 'off') {
    const d = 0.035 / Math.SQRT2
    return [...arcTriangles(0.024, 0.032), ...strokeTriangles([[-d, -d], [d, d]], 0.008)]
  }
  const waves = comfort === 'gentle' ? 1 : 2
  const points = arcTriangles(0, 0.01, 0, Math.PI * 2, 16)
  for (let i = 0; i < waves; i++) points.push(...arcTriangles(0.02 + i * 0.014, 0.026 + i * 0.014))
  return points
}

/** What the menu shows: what is chosen and what is stored. */
export interface MenuState {
  lang: Lang
  mode: GameMode
  difficulty: Difficulty
  goals: number
  endless: boolean
  /** The level that would be played, and up to which one is unlocked. */
  level: number
  unlocked: number
  stars: readonly Stars[]
  /** The record of the chosen mode; zero if there is none to beat. */
  record: number
  comfort: Comfort
  /** Whether the headset gives augmented reality: without it there is no room and the button is dimmed. */
  hasRoom: boolean
  /** The scenery the hall has chosen: the room or your room. */
  scenery: Scenery
  /** What the hall passed, or `null`: which mode gives a medal comes from it. */
  goal: Goal | null
  /** Whether «Más opciones» is unfolded: it belongs to the interface, and it folds on going back to the menu. */
  moreOptions: boolean
}

export interface MenuActions {
  chooseMode(mode: GameMode): void
  chooseDifficulty(difficulty: Difficulty): void
  chooseComfort(comfort: Comfort): void
  /** −1 or +1: one goal in practice, one level in the levels. */
  step(sign: -1 | 1): void
  endless(): void
  /** The room or your room: it changes the hall's scenery. */
  toggleScenery(): void
  /** Unfolds or folds what is under «Más opciones». */
  moreOptions(): void
  play(): void
  exit(): void
}

export class GameMenu {
  readonly panel: Panel
  readonly node: Node3D
  readonly buttons = new Map<string, Button>()
  private readonly bars = new Map<Difficulty, ReturnType<typeof barra>>()
  private readonly comfortIcons = new Map<Comfort, ReturnType<typeof shape>>()
  private readonly modeIcons = new Map<GameMode, ReturnType<typeof shape>>()
  /** The mark of the mode that gives a medal: a golden disc in the corner of its button. */
  private readonly medalMarks = new Map<GameMode, ReturnType<typeof shape>>()
  private readonly endlessRing: ReturnType<typeof shape>
  private readonly goalsRing: ReturnType<typeof shape>
  private readonly stars: ReturnType<typeof shape>[] = []
  /** The window of the scenery: the frame and the two insides, the room and your room. */
  private readonly windowIcon: { frame: ReturnType<typeof shape>; place: ReturnType<typeof shape>; room: ReturnType<typeof shape> }
  readonly goals = new Digits(MENU_DIGITS.goals, PALETTE.foreground)
  readonly level = new Digits(MENU_DIGITS.level, PALETTE.foreground)
  readonly total = new Digits(MENU_DIGITS.total, DIM)
  readonly record = new Digits(MENU_DIGITS.record, DIM)

  constructor(actions: MenuActions, aim: PointerAim) {
    this.panel = new Panel({ ancho: MENU_PANEL.width, alto: MENU_PANEL.height, fondo: PALETTE.background, opacidad: 0.86 })
    this.node = this.panel.nodo

    for (const comfort of COMFORT_LEVELS) {
      const b = this.add(`comfort ${comfort}`, PALETTE.rail, 0.7, () => actions.chooseComfort(comfort))
      this.comfortIcons.set(comfort, b.dibujo(shape(comfortTriangles(comfort), DIM), DIM))
    }
    for (const mode of MENU_MODE_ORDER) {
      const b = this.add(`mode ${mode}`, PALETTE.rail, 0.7, () => actions.chooseMode(mode))
      // The icon, raised to leave the name the bottom band of the button (`MENU_MODE_ICON_RISE`).
      this.modeIcons.set(mode, b.dibujo(shape(offset(modeTriangles(mode), 0, MENU_MODE_ICON_RISE), DIM), DIM))
      const corner = [MENU_BUTTON.mode[0] / 2 - MEDAL_MARK * 1.6, MENU_BUTTON.mode[1] / 2 - MEDAL_MARK * 1.6] as const
      this.medalMarks.set(mode, b.dibujo(shape(circle(MEDAL_MARK, corner[0], corner[1], 20), COMMON_PALETTE.gold), COMMON_PALETTE.gold))
    }
    DIFFICULTY_ORDER.forEach((level, i) => {
      const b = this.add(`level ${level}`, PALETTE.rail, 0.85, () => actions.chooseDifficulty(level))
      const height = levelBarHeight(i, DIFFICULTY_ORDER.length)
      this.bars.set(level, b.dibujo(barra(0.05, height, LEVEL_BAR_BOTTOM, DIM), DIM))
    })
    this.add('minus', PALETTE.rail, 0.8, () => actions.step(-1)).dibujo(plusMinusIcon('menos', 0.04, PALETTE.foreground), PALETTE.foreground)
    this.add('plus', PALETTE.rail, 0.8, () => actions.step(1)).dibujo(plusMinusIcon('mas', 0.04, PALETTE.foreground), PALETTE.foreground)
    const endless = this.add('endless', PALETTE.rail, 0.8, () => actions.endless())
    this.endlessRing = endless.dibujo(shape(arcTriangles(0.018, 0.028), DIM), DIM)
    // The scenery: the room or your room. Without augmented reality it looks dimmed with what is
    // set beside it, as on the web.
    const scenery = this.add('scenery', PALETTE.rail, 0.8, () => actions.toggleScenery())
    const closed = windowTriangles(false)
    this.windowIcon = {
      frame: scenery.dibujo(shape(closed.frame, DIM), DIM),
      place: scenery.dibujo(shape(closed.inside, DIM), DIM),
      room: scenery.dibujo(shape(windowTriangles(true).inside, DIM), DIM),
    }
    scenery.apagado = true
    // «Más opciones»: what is written goes on the panel, like the labels.
    this.add('more options', PALETTE.rail, 0.8, () => actions.moreOptions())
    this.add('play', PALETTE.primary, 1, () => actions.play()).dibujo(playIcon(0.045, PALETTE.primaryInk), PALETTE.primaryInk)
    const exit = exitButton({
      caja: boxOf(MENU_BOXES.exit),
      color: PALETTE.rail,
      opacidad: 0.8,
      flecha: PALETTE.foreground,
      id: 'exit',
      alPulsar: () => actions.exit(),
    })
    this.panel.boton(exit)
    this.buttons.set('exit', exit)

    // What is not a button: the digits, the ring of endless in the place of the goals and the stars.
    const hang = (node: Node3D, x: number, y: number) => {
      node.position = new Vector3(x, y, 0.004)
      this.node.add_child(node)
    }
    hang(this.goals.node, 0, MENU_ROW.goals)
    hang(this.level.node, -0.03, MENU_ROW.goals + 0.01)
    hang(this.total.node, 0.07, MENU_ROW.goals + 0.01)
    hang(this.record.node, MENU_RECORD_X, MENU_ROW.record)
    this.goalsRing = shape(arcTriangles(0.03, 0.045, 0, Math.PI * 2, 32), PALETTE.foreground)
    hang(this.goalsRing, 0, MENU_ROW.goals)
    const side = 0.016
    for (let i = 0; i < 3; i++) {
      const diamond = shape(diamondTriangles(side), DIM)
      hang(diamond, (i - 1) * side * 1.9, MENU_ROW.goals - 0.07)
      this.stars.push(diamond)
    }

    aim.anadir(...this.buttons.values())
  }

  private add(id: string, color: string, opacity: number, onPress: () => void): Button {
    const button = new Button({ id, caja: boxOf(MENU_BOXES[id]), color, opacidad: opacity, alPulsar: onPress })
    this.panel.boton(button)
    this.buttons.set(id, button)
    return button
  }

  button(id: string): Button {
    return this.buttons.get(id)!
  }

  /** Paints a state: which rows, what is chosen, what is dimmed and what is written. */
  paint(state: MenuState): void {
    const t = translator(state.lang)
    const { rows, foldable } = modeRows(state.mode, state.moreOptions)
    const practice = rows.has('machine')
    const levels = state.mode === 'levels'
    const settings = rows.has('settings')

    const moreOptions = this.button('more options')
    moreOptions.nodo.visible = foldable
    moreOptions.colorear(state.moreOptions ? PALETTE.primaryDeep : PALETTE.rail, state.moreOptions ? 0.95 : 0.8)

    for (const comfort of COMFORT_LEVELS) {
      this.button(`comfort ${comfort}`).nodo.visible = settings
      const chosen = comfort === state.comfort
      this.button(`comfort ${comfort}`).colorear(chosen ? PALETTE.primaryDeep : PALETTE.rail, chosen ? 0.95 : 0.7)
      this.button(`comfort ${comfort}`).colorDelDibujo(this.comfortIcons.get(comfort)!, chosen ? PALETTE.foreground : DIM)
    }
    for (const mode of MENU_MODE_ORDER) {
      const chosen = mode === state.mode
      this.button(`mode ${mode}`).colorear(chosen ? PALETTE.primaryDeep : PALETTE.rail, chosen ? 0.95 : 0.7)
      this.button(`mode ${mode}`).colorDelDibujo(this.modeIcons.get(mode)!, chosen ? PALETTE.primary : DIM)
      this.medalMarks.get(mode)!.visible = givesMedal(state.goal, mode)
    }
    // The level ladder: the bar grows and the colour goes from green to red, so it is read by
    // shape and by colour, not only by colour.
    for (const level of DIFFICULTY_ORDER) {
      const b = this.button(`level ${level}`)
      b.nodo.visible = practice
      const chosen = level === state.difficulty
      b.colorear(chosen ? DIFFICULTY_COLORS[level] : PALETTE.rail, 0.85)
      b.colorDelDibujo(this.bars.get(level)!, chosen ? PALETTE.foreground : DIM)
    }
    const goalsRow = rows.has('goals')
    const minus = this.button('minus')
    const plus = this.button('plus')
    minus.nodo.visible = goalsRow
    plus.nodo.visible = goalsRow
    minus.apagado = levels ? state.level <= 1 : state.endless || state.goals <= MIN_GOALS
    plus.apagado = levels ? state.level >= state.unlocked : state.endless || state.goals >= MAX_GOALS
    const endless = this.button('endless')
    endless.nodo.visible = practice
    endless.colorear(state.endless ? PALETTE.primaryDeep : PALETTE.rail, state.endless ? 0.95 : 0.8)
    endless.colorDelDibujo(this.endlessRing, state.endless ? PALETTE.foreground : DIM)

    this.goals.node.visible = practice && !state.endless
    this.goalsRing.visible = practice && state.endless
    this.goals.paint(state.goals)
    this.level.node.visible = levels
    this.total.node.visible = levels
    this.level.paint(state.level)
    this.total.paint(LEVEL_COUNT)
    for (const [i, diamond] of this.stars.entries()) {
      diamond.visible = levels
      const earned = i < (state.stars[state.level - 1] ?? 0)
      paint(diamond, earned ? COMMON_PALETTE.gold : DIM, earned ? 1 : 0.35)
    }
    this.record.node.visible = state.record > 0 && !levels
    this.record.paint(state.record)

    const scenery = this.button('scenery')
    scenery.nodo.visible = settings
    scenery.apagado = !state.hasRoom
    const ink = state.hasRoom ? PALETTE.foreground : DIM
    for (const piece of [this.windowIcon.frame, this.windowIcon.place, this.windowIcon.room]) scenery.colorDelDibujo(piece, ink)
    this.windowIcon.place.visible = state.scenery !== 'room'
    this.windowIcon.room.visible = state.scenery === 'room'

    // What is written is rebuilt whole: it is a dozen labels and they change with the language and the mode.
    const { panel } = this
    panel.borrarTextos()
    const left = -MENU_PANEL.width / 2 + 0.05
    // The name of the cabinet, top left, up to the «Más opciones» button: a proper
    // name, untranslated (`XRMenu.tsx`).
    const moreBox = MENU_BOXES['more options']
    panel.escribir(gameName(), left, MENU_ROW.title, {
      alto: MENU_TEXT.title,
      color: PALETTE.foreground,
      alinear: 'left',
      anchoMax: moreBox.position[0] - moreBox.size[0] / 2 - 0.02 - left,
    })
    // «Más opciones» —or «Menos», unfolded— over its button, if there is something folded in this mode.
    if (foldable) {
      const { position, size } = moreBox
      panel.escribir(t(state.moreOptions ? MENU_EN.fewerOptions : MENU_EN.moreOptions), position[0], MENU_ROW.title, {
        alto: MENU_TEXT.toggle,
        color: PALETTE.foreground,
        anchoMax: size[0] - 0.01,
      })
    }
    if (settings) {
      panel.escribir(t(COMFORT_LEGEND), left, MENU_ROW.comfort, {
        alto: MENU_TEXT.comfort,
        color: DIM,
        alinear: 'left',
        anchoMax: MENU_BOXES['comfort off'].position[0] - MENU_BUTTON.small[0] / 2 - 0.02 - left,
      })
    }
    const rowLabels: (readonly [number, TextKey])[] = [
      [MENU_ROW.mode, MENU_EN.mode],
      ...(practice ? [[MENU_ROW.level, 'Level'] as const] : []),
      ...(goalsRow ? [[MENU_ROW.goals, levels ? 'Stage' : 'Goals'] as const] : []),
    ]
    for (const [y, name] of rowLabels) {
      panel.escribir(t(name), left, y + MENU_ROW_LABEL_RISE, {
        alto: MENU_ROW_LABEL_SIZE,
        color: DIM,
        alinear: 'left',
        anchoMax: MENU_PANEL.width / 2,
      })
    }
    // The name of each mode, below its icon and inside its button (`MENU_MODE_LABEL_DROP`).
    for (const mode of MENU_MODE_ORDER) {
      const [x, y] = MENU_BOXES[`mode ${mode}`].position
      panel.escribir(t(GAME_MODE_LABELS[mode]), x, y + MENU_MODE_LABEL_DROP, {
        alto: MENU_TEXT.mode,
        color: mode === state.mode ? PALETTE.foreground : DIM,
        anchoMax: MENU_BUTTON.mode[0] - 0.004,
      })
    }
    // If the chosen mode counts for a medal, on the line of the «Modo» label and to its right.
    panel.escribir(t(medalPhrase(state.goal, state.mode)), MENU_PANEL.width / 2 - 0.05, MENU_ROW.mode + MENU_ROW_LABEL_RISE, {
      alto: MENU_TEXT.medal,
      color: givesMedal(state.goal, state.mode) ? COMMON_PALETTE.gold : DIM,
      alinear: 'right',
      anchoMax: MENU_MEDAL_WIDTH,
    })
    if (settings) {
      const from = MENU_BOXES.scenery.position[0] + MENU_BUTTON.small[0] / 2 + 0.02
      panel.escribir(t(SCENERY_LABELS[state.scenery]), from, MENU_ROW.record, {
        alto: MENU_TEXT.scenery,
        color: DIM,
        alinear: 'left',
        anchoMax: MENU_RECORD_X - 0.07 - from,
      })
    }
    panel.parrafo(t(GAME_MODE_HINTS[state.mode]), 0, MENU_HINT_Y, {
      alto: MENU_TEXT.hint,
      color: DIM,
      anchoMax: MENU_PANEL.width - 0.1,
      ancla: 'top',
    })
  }
}
