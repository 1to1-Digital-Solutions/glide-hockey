import { DIFFICULTY_ORDER, TABLE_CENTER_Z, TABLE_HEIGHT } from './gameConfig'
import { MENU_MODE_ORDER } from './gameMode'
import { COMFORT_LEVELS } from './hitFeedback'
import { MENU_DEGREES } from './menuTemplate'
import { REFERENCE_EYE_HEIGHT } from './uiHeight'

/**
 * The measurements of the immersive menu that can be checked without a headset.
 *
 * There is only arithmetic here: how much a bar measures and whether it fits in its button. It
 * matters because a bar that sticks out of the button is left floating in the air in front of
 * the panel, and that **cannot be seen on any screen**: one has to put the headset on to notice
 * it. The geometry lives in `components/xr/XRMenu.tsx` and reads from here.
 */

/** What the button of a level measures, in metres. */
export const LEVEL_BUTTON: [number, number] = [0.12, 0.11]

/** Where the bar rests inside its button, and how much gap is left above it. */
export const LEVEL_BAR_BOTTOM = -0.02
const LEVEL_BAR_MARGIN = 0.008

/**
 * How tall the bar of level `index` is, in metres.
 *
 * It comes from the button and not from a loose number: it was `0.026 + index * 0.014`, and the
 * fifth bar measured 8.2 cm inside an 11 cm button, so it stuck out at the top. Here the tallest
 * takes up what there is between its floor and the edge of the button minus a margin, and the
 * ones in between share out the rest: one more level shrinks the step instead of overflowing.
 */
export function levelBarHeight(index: number, total: number = DIFFICULTY_ORDER.length): number {
  const tallest = LEVEL_BUTTON[1] / 2 - LEVEL_BAR_BOTTOM - LEVEL_BAR_MARGIN
  const shortest = tallest / 3
  if (total <= 1) return tallest
  return shortest + (index / (total - 1)) * (tallest - shortest)
}

/**
 * What the line that explains the chosen mode takes up.
 *
 * The panel grows at the bottom instead of squeezing the rows: squeezing them would
 * make them overlap, and that is only seen with the headset on. What is above stays
 * where it was, so whoever already knew where to press still finds it in the same place.
 */
export const MENU_HINT_BAND = 0.18

/**
 * What the row of the hit feedback comfort takes up, at the very top.
 *
 * It goes at the top and not among the others because among them there is not a centimetre
 * left (see `MENU_ROW`), and the panel grows towards both sides in equal parts: all the rows
 * drop half a band, so at the bottom the same margin as before is left and at the top the gap
 * appears.
 */
export const MENU_COMFORT_BAND = 0.17

/**
 * What the «Más opciones» band takes up, at the very top, above the comfort.
 *
 * The common template folds what does not belong to the mode behind that button, and in this
 * panel there was nowhere to put it: the rows do not leave a centimetre between them and the
 * comfort takes up its line from end to end. The panel grows by what the band measures (like
 * table-tennis), and the rows drop only a quarter of a band: dropping half, the explanation of
 * the mode, at the very bottom, was left at 1.37° for whoever plays with the eyes at 1.2 m. At
 * the bottom 2.5 cm more of margin is left.
 */
export const MENU_TITLE_BAND = 0.1

/** The menu panel, in metres. */
export const MENU_PANEL = { width: 0.78, height: 1.0 + MENU_HINT_BAND + MENU_COMFORT_BAND + MENU_TITLE_BAND }

/** Where the mode line starts, by its top edge. */
export const MENU_HINT_Y = -0.37 - MENU_COMFORT_BAND / 2 - MENU_TITLE_BAND / 4

/**
 * At what size each thing on the menu panel is written, in metres of letter height.
 *
 * **A single list for whoever draws and for whoever measures.** `drawRowNames` writes with these
 * sizes and `menu.legible.test.ts` checks that everything the canvas notes down is in it: a
 * letter written by hand, or shrunk to fit, does not get through unseen.
 *
 * With the labels at 30 mm and the scenery and the explanation at 24, with the panel at 1.45 m
 * and measured row by row with the foreshortening, they were left between 0.79° and 1.15°: below
 * what is read at a glance (`MIN_READING_DEGREES`). That is why the letter grows and the panel
 * comes closer (`XR_UI.panel`). The name of the comfort, a little more: it goes in the very top
 * row, the furthest and the most foreshortened for whoever plays with the eyes low, and at 34 mm
 * it was left at 1.38°.
 */
export const MENU_TEXT = {
  label: 0.034,
  scenery: 0.034,
  hint: 0.034,
  comfort: 0.038,
  medal: 0.034,
  mode: 0.029,
  /** The name of the cabinet, top left, at the letter size of the table-tennis one. */
  title: 0.042,
  /**
   * «Más opciones» / «Menos opciones», in the top band: like the comfort, somewhat bigger than the
   * labels, because it is the furthest line and the most foreshortened; at 36 mm, with the eyes at
   * 1.2 m, it was left at 1.37°.
   */
  toggle: 0.038,
} as const

/**
 * How wide the phrase about whether the mode counts for a medal can be, which goes on the line of
 * the «Modo» label, against the right edge: the panel minus its margins and what the label takes up.
 */
export const MENU_MEDAL_WIDTH = 0.55

/** What each kind of menu button measures. */
export const MENU_BUTTON = {
  /** Four in the row since there is a duel: at 22 cm they did not fit in the panel's 78. */
  mode: [0.17, 0.13] as [number, number],
  /** «Más opciones» / «Menos opciones»: wide enough for the longer one, at its letter size. */
  toggle: [0.36, 0.08] as [number, number],
  level: LEVEL_BUTTON,
  small: [0.11, 0.11] as [number, number],
  play: [0.28, 0.12] as [number, number],
}

/**
 * At what height each row of the menu goes, in metres from the centre of the panel.
 *
 * **It grew.** The rows were so close together that the name of one ran into the one above: the
 * «Modo» label reached 0.355 and the record band started at 0.335, so the word was drawn on
 * top of the scenery button. With the headset on that looks like what it is, overlapping
 * letters, and leaves the menu impossible to read.
 */
const DROP = MENU_HINT_BAND / 2 - MENU_COMFORT_BAND / 2 - MENU_TITLE_BAND / 4
export const MENU_ROW = {
  /** The name of the cabinet and «Más opciones», in the top band (`MENU_TITLE_BAND`). */
  title: MENU_PANEL.height / 2 - MENU_TITLE_BAND / 2,
  comfort: 0.58 + DROP,
  record: 0.44 + DROP,
  mode: 0.245 + DROP,
  level: 0.02 + DROP,
  goals: -0.2 + DROP,
  actions: -0.38 + DROP,
} as const

/**
 * How far the name of a row rises above its buttons, in metres.
 *
 * The rows are icons and bars, and an icon says **what happens** but not **what the row is
 * about**: five bars in a line do not read as «nivel» until someone says so.
 */
export const MENU_ROW_LABEL_RISE = 0.1

/** How tall the name of a row is written. */
export const MENU_ROW_LABEL_SIZE = MENU_TEXT.label

/** The height of the buttons of each row, so as to be able to measure whether something overlaps. */
export const MENU_ROW_HEIGHT: Record<keyof typeof MENU_ROW, number> = {
  title: MENU_BUTTON.toggle[1],
  comfort: MENU_BUTTON.small[1],
  record: MENU_BUTTON.small[1],
  mode: MENU_BUTTON.mode[1],
  level: MENU_BUTTON.level[1],
  goals: MENU_BUTTON.small[1],
  actions: MENU_BUTTON.play[1],
}

/**
 * Where the digits of the record go, in the top row.
 *
 * With the record in the middle of the row, «Tu habitación» at the letter size that can be read
 * reaches under its digits. It goes on the right, since it is a piece of data and is not pressed.
 */
export const MENU_RECORD_X = 0.26

/**
 * Where each comfort button goes, from left to right: off, gentle and full. Against the right
 * edge, to leave the name of the row all the width that is left on its left.
 */
export const MENU_COMFORT_X = [0.08, 0.2, 0.32] as const

/**
 * The name of each mode, **inside its button and below the icon**.
 *
 * With the headset, the modes were four drawings and a single label, «Modo»: a puck, some
 * diamonds, a ladder and two pucks do not say «Práctica», «Niveles», «Reto» and «Duelo» to whoever
 * has never seen them. Below the button it does not fit —the label of the next row is there—, so
 * the icon rises (`MENU_MODE_ICON_RISE`) and the name goes in the bottom strip of the button, at
 * `MENU_TEXT.mode`: the smallest letter that can still be read from where one plays and with which
 * «Challenge», the longest, fits in the button without shrinking. `menu.legible.test.ts` measures
 * it, in both languages.
 */
export const MENU_MODE_ICON_RISE = 0.016

/** At what height the name of the mode goes, from the centre of its button. */
export const MENU_MODE_LABEL_DROP = -0.044

/** From centre to centre between two mode buttons: two centimetres of gap between them. */
const MODE_STEP = 0.19

/** A press box of the menu: centre and measurements, in panel coordinates. */
export interface MenuBox {
  readonly position: [number, number, number]
  readonly size: [number, number, number]
}

function box(x: number, y: number, [width, height]: readonly [number, number]): MenuBox {
  return { position: [x, y, 0], size: [width, height, 0.04] }
}

/**
 * All the press boxes of the menu, with their names.
 *
 * The component uses them from here, so there cannot be one the tests do not see: the boxes are
 * invisible, and a label that runs into one is not called out by anybody else (`menu.legible.test.ts`).
 */
export const MENU_BOXES = {
  // The modes, spread around the centre: they walk the list, so a new mode has its button
  // without anybody remembering to add it here.
  ...Object.fromEntries(
    MENU_MODE_ORDER.map((mode, index) => [
      `mode ${mode}`,
      box((index - (MENU_MODE_ORDER.length - 1) / 2) * MODE_STEP, MENU_ROW.mode, MENU_BUTTON.mode),
    ]),
  ),
  ...Object.fromEntries(
    DIFFICULTY_ORDER.map((level, index) => [`level ${level}`, box((index - 2) * 0.135, MENU_ROW.level, LEVEL_BUTTON)]),
  ),
  minus: box(-0.19, MENU_ROW.goals, MENU_BUTTON.small),
  plus: box(0.19, MENU_ROW.goals, MENU_BUTTON.small),
  endless: box(0.32, MENU_ROW.goals, MENU_BUTTON.small),
  scenery: box(-0.28, MENU_ROW.record, MENU_BUTTON.small),
  play: box(0, MENU_ROW.actions, MENU_BUTTON.play),
  // Against the right edge of the top band: on its left there is room left for the name.
  'more options': box(MENU_PANEL.width / 2 - 0.02 - MENU_BUTTON.toggle[0] / 2, MENU_ROW.title, MENU_BUTTON.toggle),
  exit: box(0.28, MENU_ROW.actions, MENU_BUTTON.small),
  // The three comfort options, to the right of its name, which goes on the same line: above
  // there is no room, as that is the edge of the panel.
  ...Object.fromEntries(
    COMFORT_LEVELS.map((comfort, index) => [`comfort ${comfort}`, box(MENU_COMFORT_X[index], MENU_ROW.comfort, MENU_BUTTON.small)]),
  ),
} as Record<string, MenuBox>

/**
 * Where the headset menu is born: at the distance of the column (`COLUMN` of `GameWorld.tsx`, a
 * metre and a half) but almost head-on, `azimuth` degrees to the left, below `MENU_DEGREES`
 * (the common template): whoever enters the cabinet finds it where they look. At the same
 * distance, the letter takes up the same in the eye as on the column.
 *
 * It moves aside on starting: the game over and the exit notice stay on the column, at 55°, out
 * of where one plays. TO BE CALIBRATED WITH THE HEADSET: `azimuth`.
 */
export const HEADSET_MENU = { distance: 1.5, azimuth: MENU_DEGREES - 1 } as const

/**
 * The place of the headset menu in the menu phase, in table coordinates (its centre, at the height
 * of the board), which is where the interface hangs from: the centre, at the reference eye height.
 * The web (`GameWorld.tsx`) and the Godot port (`layout.ts`) read it.
 */
export function menuPlacement(): [number, number, number] {
  const azimuth = (HEADSET_MENU.azimuth * Math.PI) / 180
  return [
    -HEADSET_MENU.distance * Math.sin(azimuth),
    REFERENCE_EYE_HEIGHT - TABLE_HEIGHT,
    -HEADSET_MENU.distance * Math.cos(azimuth) - TABLE_CENTER_Z,
  ]
}
