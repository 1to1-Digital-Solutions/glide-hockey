/**
 * Checking that a headset panel **can be read**.
 *
 * It is the answer to what comes up most in the headset feedback: «the text
 * overlaps», «the letters are too close together», «nothing can be understood». It has happened
 * in the exit notice, in the settings menus, in the scoreboard and in the tutorials,
 * and it has always been discovered the same way: with the goggles on. From a screen it
 * cannot be seen, because the panel is painted on a canvas that nobody looks at at the size at
 * which it is read.
 *
 * So here there is not a reminder, there is an instrument: a fake canvas
 * that **measures like a real one and records what is written**, and a review of
 * what was recorded. Each panel has its test, and the test fails if two texts overlap,
 * if one runs off the panel or if one is smaller than what can be read at the
 * distance it is at.
 *
 * Everything in metres, which is how the measurements of the panels are written.
 */

import { LINE_HEIGHT } from './canvasPanel'

/**
 * How wide a letter is relative to its height, in the system typeface.
 *
 * On the wide side on purpose. The real measurement depends on the letter —an «i» does not take
 * what an «M» does— and here there is no typeface to ask. Falling short, the rule would pass
 * a panel that overlaps in the headset, which is exactly what has been happening; overshooting,
 * at most it forces leaving a finger more of air.
 */
const GLYPH_ADVANCE = 0.62

/**
 * The smallest a letter can be seen, in **degrees** of visual angle.
 *
 * **It used to be a measurement in metres, and in metres it cannot be read.** What decides whether
 * a letter reads is not what it measures, it is what it takes up in the eye: the same four
 * millimetres are a smudge on a panel a metre and a half away and read easily on one a hand span
 * away. The floor was set at 4 mm —0.23° at one metre, which is what a healthy eye
 * **distinguishes**, standing still and in good light, not what someone reads at a glance while
 * playing—, so the instrument passed what inside the headset is a smudge. Reported like this:
 * «most of the texts inside the games overlap and are not legible».
 *
 * Three quarters of a degree is the height of a letter that is comfortable to read without moving
 * closer. The menu buttons are painted at 25 mm and the panels are a metre and a bit away —1.2°,
 * plenty—, so this does not squeeze what is fine: it catches what `drawText` **shrinks so that it
 * fits** in a button that is too narrow, which is where 8 mm letters were coming out.
 */
export const MIN_ANGLE = 0.75

/**
 * At what distance a panel is looked at when whoever measures it says nothing else, in metres.
 *
 * It is where almost everyone's panels are: in front, a metre and a bit away. The table games
 * —the tower of tower-tumble— have them much closer and say so when measuring.
 */
export const TYPICAL_DISTANCE = 1.2

/** The smallest a letter can come out on a panel at that distance, in metres. */
export function minTextHeight(distance: number): number {
  return 2 * distance * Math.tan((MIN_ANGLE * Math.PI) / 180 / 2)
}

/**
 * The smallest font that can be requested from the canvas, in pixels.
 *
 * It is not what can be read —`minTextHeight` says that, in metres—, it is what the browser knows
 * how to place: below a few pixels it works out the position of each letter with measurements that
 * are no good, and the headset's piles them up. The panels requested the font in metres on a
 * scaled canvas, at 0.03 px, and this is how they looked: «the letters are completely stuck
 * together, one on top of the other».
 */
export const MIN_FONT_PX = 8

/** A text that has been written on the panel: what, where and what box it takes up. */
export interface DrawnText {
  readonly text: string
  /** The centre of its box, in panel coordinates. */
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** The size of the font it was requested with, in canvas pixels. */
  readonly fontPx?: number
}

/** Whether two boxes overlap. */
function overlap(a: DrawnText, b: DrawnText): boolean {
  return (
    Math.abs(a.x - b.x) * 2 < a.width + b.width &&
    Math.abs(a.y - b.y) * 2 < a.height + b.height
  )
}

/**
 * A fake canvas: it measures like a real one and records what is written.
 *
 * It keeps track of the transform —the panels write with `translate` and
 * a `scale(1, -1)` to undo the `y` pointing down—, so what is recorded is
 * already in panel coordinates and not in those of the canvas.
 */
export function recordingCanvas(): { ctx: CanvasRenderingContext2D; drawnTexts: DrawnText[] } {
  const drawnTexts: DrawnText[] = []
  // `scale` is how much one unit of the canvas measures in panel coordinates. The panels draw
  // in metres and write the text at its size in pixels (`panelFont`), so inside
  // `drawText` one unit is one pixel of the texture and what is recorded is turned into metres with it.
  let state = { x: 0, y: 0, scale: 1, scaleY: 1, font: '' }
  const stack: (typeof state)[] = []

  /** The size declared in the font, in canvas units (pixels for the text). */
  const fontSize = (): number => {
    const match = /([\d.]+)px/.exec(state.font)
    return match == null ? 0 : Number(match[1])
  }

  const ctx = {
    get font() {
      return state.font
    },
    set font(value: string) {
      state.font = value
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    save: () => {
      stack.push({ ...state })
    },
    restore: () => {
      state = stack.pop() ?? state
    },
    translate: (x: number, y: number) => {
      state = { ...state, x: state.x + x * state.scale, y: state.y + y * state.scaleY }
    },
    scale: (x: number, y: number) => {
      state = { ...state, scale: state.scale * Math.abs(x), scaleY: state.scaleY * y }
    },
    measureText: (text: string) => ({ width: text.length * fontSize() * GLYPH_ADVANCE }),
    // The `y` that arrives is always 0: the panels set it with `translate` before
    // writing, which is what this canvas keeps recorded.
    fillText: (text: string, x: number) => {
      const height = fontSize() * state.scale
      const width = text.length * height * GLYPH_ADVANCE
      const origin = state.x + x * state.scale
      const center =
        ctx.textAlign === 'left'
          ? origin + width / 2
          : ctx.textAlign === 'right'
            ? origin - width / 2
            : origin
      drawnTexts.push({ text, x: center, y: state.y, width, height: height * LINE_HEIGHT, fontPx: fontSize() })
    },
    // Returning the transform to the starting one is the only thing that is followed of
    // the shapes: what is written afterwards goes in the coordinates of the canvas, not in those
    // of the piece that was being painted.
    setTransform: () => {
      state = { ...state, x: 0, y: 0, scale: 1, scaleY: 1 }
    },
    // The rest of what draws shapes is not recorded: here the text is reviewed. Even so **all** of
    // the ones that trace are here, and not only the ones today's panel uses: one that is missing
    // does not give a legibility warning but a «is not a function» halfway through the drawing,
    // and the test falls over without getting to measure anything —the panel is left unreviewed
    // right when someone had just changed it—. It was discovered by a hand drawn with `ellipse`
    // and `quadraticCurveTo`.
    //
    // What **is** missing on purpose is what would move the text without this finding out:
    // `rotate` and `transform`. There the «is not a function» is the right answer, because what
    // is recorded would no longer be where it is painted and the problems would come out elsewhere.
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arcTo: () => {},
    arc: () => {},
    ellipse: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    rect: () => {},
    roundRect: () => {},
    fill: () => {},
    stroke: () => {},
    clip: () => {},
    setLineDash: () => {},
    getLineDash: () => [],
    drawImage: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => null,
  }

  return { ctx: ctx as unknown as CanvasRenderingContext2D, drawnTexts }
}

/** A panel, to know whether something runs off it. */
export interface Panel {
  readonly width: number
  readonly height: number
}

/**
 * What is wrong in what was written. An empty list means it can be read.
 *
 * It returns sentences and not a `false` because a test that says «the panel cannot be read» is
 * of no use: you have to know **which** word overlaps with which.
 */
export function legibilityProblems(
  drawnTexts: readonly DrawnText[],
  {
    panel,
    distance = TYPICAL_DISTANCE,
    minHeight = minTextHeight(distance),
  }: { panel: Panel; distance?: number; minHeight?: number },
): string[] {
  const problems: string[] = []

  for (const drawn of drawnTexts) {
    if (drawn.fontPx != null && drawn.fontPx < MIN_FONT_PX) {
      problems.push(
        `«${drawn.text}» is requested at ${drawn.fontPx.toFixed(2)} px: below ${MIN_FONT_PX} the headset's browser piles the letters up`,
      )
    }
    if (drawn.height / LINE_HEIGHT < minHeight) {
      problems.push(
        `«${drawn.text}» comes out at ${((drawn.height / LINE_HEIGHT) * 1000).toFixed(1)} mm, below ${(minHeight * 1000).toFixed(1)} mm at ${distance} m`,
      )
    }
    const outside =
      Math.abs(drawn.x) + drawn.width / 2 > panel.width / 2 + 1e-6 ||
      Math.abs(drawn.y) + drawn.height / 2 > panel.height / 2 + 1e-6
    if (outside) problems.push(`«${drawn.text}» runs off the panel`)
  }

  for (let i = 0; i < drawnTexts.length; i++) {
    for (let j = i + 1; j < drawnTexts.length; j++) {
      if (overlap(drawnTexts[i], drawnTexts[j])) {
        problems.push(`«${drawnTexts[i].text}» overlaps «${drawnTexts[j].text}»`)
      }
    }
  }

  return problems
}
