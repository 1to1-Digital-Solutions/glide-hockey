/**
 * Where each piece of Glide Hockey's interface goes in Godot, and what it measures.
 *
 * **They are the web's dimensions, not new ones.** The menu's are in `lib/xrMenuLayout.ts` and are
 * imported as they are; these others live on the web inside React components
 * (`components/game/GameWorld.tsx` and `components/xr/XRHud.tsx`), which the engine cannot load,
 * and that is why they are copied here with the same numbers and the same name on the web next to
 * each one. If one changes there, the same one has to change here; the engine tests
 * (`ui.engine.test.ts`) measure the panels with these dimensions and with the web's instrument, so
 * a dimension that drifts and stops being readable comes out red.
 *
 * Everything in metres and in the table's space (its centre, at the height of the board), which is
 * where the interface hangs from on the web.
 */
import { BACK_SCOREBOARD, signPlacement, tutorialPlacement } from '@/lib/scoreboardSign'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from '@/lib/gameConfig'
import { EYE_HEIGHTS, eyesAt, panelRotation, type PanelPose, type Point } from '@/lib/panelReading'
import { REFERENCE_EYE_HEIGHT, uiRiseOverWorld, worldRise } from '@/lib/uiHeight'
import { menuPlacement } from '@/lib/xrMenuLayout'

export type Triple = [number, number, number]

/**
 * The column of the menu, of the end and of the exit notice: a metre and a half away and 55° to the
 * left of whoever plays, off the table (`COLUMN` of `GameWorld.tsx`).
 */
export const COLUMN = { distance: 1.5, azimuth: 55 } as const

/** How much the column is enlarged to be read at that distance (`COLUMN_SCALE`). */
export const COLUMN_SCALE = 1.4

/** And the stop button, which is looked at out of the corner of the eye (`BUTTON_SCALE`). */
export const BUTTON_SCALE = 2.6

const AZIMUTH = (COLUMN.azimuth * Math.PI) / 180

/** Each piece of the headset's interface, in table coordinates (`XR_UI`). */
export const XR_UI = {
  /** The scoreboard, at the back, over the machine's goal. */
  scoreboard: BACK_SCOREBOARD.center as Triple,
  /** The column, taken from the space of whoever plays to the table's. */
  panel: [-COLUMN.distance * Math.sin(AZIMUTH), REFERENCE_EYE_HEIGHT - TABLE_HEIGHT, -COLUMN.distance * Math.cos(AZIMUTH) - TABLE_CENTER_Z] as Triple,
  /** The menu, almost head-on: `lib/xrMenuLayout.ts` works it out for the web and for here. */
  menu: menuPlacement() as Triple,
  /** The countdown, floating over the serve spot. */
  countdown: [0, 0.34, 0] as Triple,
  /** The tutorial, at eye level and to one side of the sign, so that it does not hide it (`tutorialPlacement`). */
  tutorial: tutorialPlacement() as Triple,
}

/** And flat, head-on over the table: there is no head to turn, and to one side it leaves the window. */
export const FLAT_TUTORIAL = tutorialPlacement(0) as Triple

/** The stop button goes where the column is: while playing, the column is empty (`XR_QUIT`). */
export const XR_QUIT = XR_UI.panel

/** How much the scoreboard tilts towards whoever plays (`rotation={[-0.18, 0, 0]}` in `GameWorld`). */
export const SCOREBOARD_TILT = BACK_SCOREBOARD.tilt

/** From the table's space to that of whoever plays: the feet at the origin and `−Z` ahead. */
export function fromPlayerSpace(piece: readonly [number, number, number]): Triple {
  return [piece[0], piece[1] + TABLE_HEIGHT, piece[2] + TABLE_CENTER_Z]
}

/** How each piece is turned to face the reference eyes (`XR_UI_ROTATION`). */
export const XR_UI_ROTATION = {
  panel: panelRotation(fromPlayerSpace(XR_UI.panel), eyesAt(REFERENCE_EYE_HEIGHT)),
  menu: panelRotation(fromPlayerSpace(XR_UI.menu), eyesAt(REFERENCE_EYE_HEIGHT)),
  quit: panelRotation(fromPlayerSpace(XR_QUIT), eyesAt(REFERENCE_EYE_HEIGHT)),
  tutorial: panelRotation(fromPlayerSpace(XR_UI.tutorial), eyesAt(REFERENCE_EYE_HEIGHT)),
  flatTutorial: panelRotation(fromPlayerSpace(FLAT_TUTORIAL), eyesAt(REFERENCE_EYE_HEIGHT)),
}

/**
 * Where a panel is read from: at each eye height and with the world standing or at their height,
 * with what the world rises and what the interface rises over it (`panelViews`).
 */
export function panelViews(
  piece: readonly [number, number, number],
  rotation: PanelPose['rotation'],
): { where: string; pose: PanelPose; eyes: Point }[] {
  const [x, y, z] = fromPlayerSpace(piece)
  return EYE_HEIGHTS.flatMap((eyeHeight) =>
    [false, true].map((atEyeHeight) => ({
      where: `eyes at ${eyeHeight} m${atEyeHeight ? ', world at their height' : ''}`,
      pose: { position: [x, y + worldRise(eyeHeight, atEyeHeight) + uiRiseOverWorld(eyeHeight, atEyeHeight), z] as const, rotation },
      eyes: eyesAt(eyeHeight),
    })),
  )
}

/** What is written in the column, taken to the scale it is painted at (`atColumnScale`). */
export function atColumnScale<T extends { x: number; y: number; ancho: number; alto: number }>(texts: readonly T[], k = COLUMN_SCALE): T[] {
  return texts.map((e) => ({ ...e, x: e.x * k, y: e.y * k, ancho: e.ancho * k, alto: e.alto * k }))
}

/** A press box: centre and measures in the plane of the panel (`hitBox` of `XRHud.tsx`). */
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

const box = (x: number, y: number, [width, height]: readonly [number, number]): Box => ({ x, y, width, height })

/**
 * The font and the buttons of the tutorial (`TUTORIAL_TEXT` and `BUTTON` of `XRTutorial.tsx`). Here it
 * goes over the table, 1.2 m from the eyes: the web raised counter and buttons to 36 mm because at 30
 * and 32 they stayed at 1°, and widened the buttons so that «Saltar tutorial» still fits at that
 * size. The kit's panel receives them as they are; the rest (the panel, the phrase) is the same as in
 * Hole Patrol.
 */
export const TUTORIAL_SIZES = {
  letra: { counter: 0.036, phrase: 0.042, button: 0.036 },
  boton: { width: 0.37, x: 0.195 },
} as const

/** The scoreboard (`SCOREBOARD_SIZE` and `ROW` of `XRHud.tsx`). */
export const SCOREBOARD_SIZE = { width: BACK_SCOREBOARD.width, height: BACK_SCOREBOARD.height } as const
export const SCOREBOARD_ROWS = { goals: 0.06, points: -0.065, round: -0.135 } as const

/**
 * At what height the goals go: in their top row, or in the middle when the sign above already says
 * the points and the round and nothing is left below (`goalsRow` of `XRHud.tsx`).
 */
export function goalsRow(omitted: { points: boolean; round: boolean }): number {
  return omitted.points && omitted.round ? 0 : SCOREBOARD_ROWS.goals
}

/** What those degrees of visual angle measure at that distance (`degrees` of `GoalSign.tsx`, with the `minTextHeight` of `legibility.ts`). */
function degrees(angle: number, distance: number): number {
  return (2 * distance * Math.tan((0.75 * Math.PI) / 180 / 2) * angle) / 0.75
}

/**
 * The goal sign (`GoalSign.tsx`): painted to be read at two metres (`DRAW_DISTANCE`), 24° wide by
 * 4.5° tall (`SIGN_PANEL`), with the font of the title at 1.4° and that of the detail at 1.2°
 * (`SIGN_FONT`), and its margin, its gap and its bar.
 */
export const SIGN = {
  distance: 2,
  width: degrees(24, 2),
  height: degrees(4.5, 2),
  title: degrees(1.4, 2),
  detail: degrees(1.2, 2),
  gap: degrees(0.35, 2),
  bar: degrees(0.35, 2),
  usableWidth: degrees(24, 2) - 2 * degrees(0.5, 2),
  /** With three lines (the end with its `footer`), the font of `SIGN_FONT_WITH_FOOTER`. */
  withFooter: { title: degrees(1.2, 2), detail: degrees(1.0, 2), gap: degrees(0.25, 2) },
} as const

/** What the sign measures for each metre of reading distance (`signAspect`). */
export const SIGN_PROPORTION = { width: SIGN.width / SIGN.distance, height: SIGN.height / SIGN.distance } as const

/** Where it hangs: above the back scoreboard, facing whoever plays (the web's `SIGN_PLACEMENT`). */
export const SIGN_PLACEMENT = signPlacement(SIGN_PROPORTION)
/** At what height the scoreboard's digits go: goals, points and round. */
export const SCOREBOARD_DIGITS = { goals: 0.13, points: 0.055, round: 0.04 } as const

/** The notice to pick up the mallet, which replaces the last second of the countdown (`MALLET_NOTICE`). */
export const MALLET_NOTICE: [number, number] = [0.62, 0.2]
export const MALLET_TEXT = { phrase: 0.036 } as const
/** The digits of the countdown. */
export const COUNTDOWN_DIGIT = 0.26

/** The end of the match (`XRGameOver`): panel, band of the result, points and three buttons. */
export const GAME_OVER_SIZE = { width: 0.6, height: 0.42 } as const
export const ACTION_BUTTON: [number, number] = [0.24, 0.11]
export const SMALL_BUTTON: [number, number] = [0.1, 0.1]
export const GAME_OVER_BOXES = {
  again: box(-0.12, -0.13, ACTION_BUTTON),
  menu: box(0.11, -0.13, SMALL_BUTTON),
  exit: box(0.24, -0.13, SMALL_BUTTON),
} as const
export const GAME_OVER_DIGIT = 0.11

/** The notice of leaving the match (`CONFIRM_SIZE`, `CONFIRM_BOXES`, `CONFIRM_TEXT`). */
export const CONFIRM_SIZE: [number, number] = [0.72, 0.42]
export const CONFIRM_BOXES = {
  stay: box(0, -0.04, [0.44, 0.1]),
  menu: box(-0.155, -0.16, [0.37, 0.1]),
  leave: box(0.2, -0.16, [0.26, 0.1]),
} as const
export const CONFIRM_TEXT = { title: 0.05, body: 0.034, button: 0.034 } as const

/** The stop button and, in the endless match, the one to end it, to its right (`XRQuitButton`). */
export const STOP_BOXES = {
  quit: box(0, 0, SMALL_BUTTON),
  end: box(0.13, 0, SMALL_BUTTON),
} as const
