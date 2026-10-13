'use client'

import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { NO_RAYCAST } from '../raycast'

/**
 * A UI panel painted on a 2D canvas.
 *
 * It is the only way to put text inside the three Canvas in this project:
 * drei's `<Text>` downloads the font from a CDN and the hall's CSP
 * (`connect-src 'self'`) blocks it, so the run would be left without a
 * scoreboard right where it is needed most, inside the headset. `fillText` uses the
 * fonts the system already has and asks for nothing over the network.
 *
 * The drawing works in METRES and with `y` pointing up —the same
 * coordinates with which the boxes that pick up the press are placed—, so
 * that what is painted and what is pressed cannot drift apart.
 */

/**
 * Paints the panel **before** it is seen, not after.
 *
 * The canvas is wiped whole and painted again on every change, and the panel's material is
 * transparent —the corners of the rounded rectangle ask for it—. With a normal effect,
 * between the wipe and the repaint there is room for a frame with the canvas blank: the panel is
 * seen **transparent**, and in augmented reality that is not black, it is the room of whoever
 * is playing. Reported with the headset on: «when I press a button it is as if the button
 * disappears and I see my living room». A layout effect runs before the browser paints, so that
 * gap does not exist.
 *
 * On the server there is nothing to paint and `useLayoutEffect` would warn on the console; the
 * xrcade hall prerenders the page that contains the Canvas, so there the other one is used.
 */
const usePaintBeforeSeen = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** How many texture pixels per metre of panel. At arm's length it reads. */
export const PANEL_PIXELS_PER_METER = 1024

/**
 * The font of a text of `size` metres, **requested in real pixels**.
 *
 * The panel is drawn in metres on a scaled canvas, and the font used to be requested the same
 * way: a 0.03 px letter enlarged a thousand times. At that size the browser works out where each
 * letter goes with measurements that are no good —desktop Chromium spreads them too far apart and
 * the headset's piles them on top of each other—, and what was measured so that it would fit was
 * not what was painted either. Reported with the headset on: «the letters are completely stuck
 * together, one on top of the other… nothing in the settings can be read». That is why the text
 * is written without the scale to metres, with the font at its size in pixels of the texture.
 */
export function panelFont(weight: string, size: number): string {
  return `${weight} ${size * PANEL_PIXELS_PER_METER}px system-ui, sans-serif`
}

/** How wide a text measures with the font that is set, in metres. */
function measureMeters(ctx: CanvasRenderingContext2D, text: string): number {
  return ctx.measureText(text).width / PANEL_PIXELS_PER_METER
}

/** The canvas where the panel is painted, of the size those measurements call for. */
function usePanelCanvas(width: number, height: number): HTMLCanvasElement | null {
  return useMemo(() => {
    // R3F's Canvas only mounts in the browser, but the xrcade hall
    // prerenders the page that contains it.
    if (typeof document === 'undefined') return null

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * PANEL_PIXELS_PER_METER)
    canvas.height = Math.round(height * PANEL_PIXELS_PER_METER)
    return canvas.getContext('2d') == null ? null : canvas
  }, [width, height])
}

/**
 * Writes a straight line in a drawing with `y` pointing up.
 *
 * Text is always painted with `y` pointing down, so the inversion has to be
 * undone right here and only here; otherwise everything would come out upside down.
 */
/**
 * How tall the box of a line is, as a fraction of the requested size.
 *
 * It is not the whole size: between the capitals of one line and the tails of the
 * letters of the one below there is air, and counting it whole would take as overlapping two
 * lines that read perfectly. It is used by whoever places —to know how far down the next thing
 * goes— and it is used by the instrument that measures (`legibility.ts`), which reads this very
 * one and not a copy: two copies would end up measuring something different from what is painted.
 */
export const LINE_HEIGHT = 0.8

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  {
    size,
    color,
    align = 'center',
    weight = '600',
    maxWidth,
  }: {
    size: number
    color: string
    align?: CanvasTextAlign
    weight?: string
    /**
     * How wide it may be, in metres. What does not fit is written
     * smaller: here there is no way to check by eye whether a label fits in its
     * button, and the one that sticks out is read on top of the one next to it.
     */
    maxWidth?: number
  },
): void {
  ctx.save()
  ctx.translate(x, y)
  // From metres with `y` pointing up to pixels with `y` pointing down: the text is written at
  // its real size in the texture (see `panelFont`).
  ctx.scale(1 / PANEL_PIXELS_PER_METER, -1 / PANEL_PIXELS_PER_METER)
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.font = panelFont(weight, size)

  // The font is shrunk instead of narrowed —which is what `fillText` does with
  // its own maximum—: a condensed text on a panel at arm's length
  // reads much worse than the same text one point smaller.
  if (maxWidth != null) {
    const width = measureMeters(ctx, text)
    if (width > maxWidth) ctx.font = panelFont(weight, (size * maxWidth) / width)
  }

  ctx.fillText(text, 0, 0)
  ctx.restore()
}

/**
 * Splits a text into the lines that fit in that width.
 *
 * **Shrinking will not do for a sentence.** A button label that does not fit reads fine one point
 * smaller; a whole sentence shrunk until it fits on a single line ends up in two-centimetre
 * letters inside the headset, which is where it was discovered: the tutorials were written and
 * none of them could be understood.
 *
 * It breaks at spaces, and a word that does not fit on its own still stays on its line:
 * splitting it down the middle reads worse than letting it stick out.
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  // It measures with whatever font the canvas has set, which has to be one from `panelFont`.
  const words = text.split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return []

  const lines: string[] = []
  let current = words[0]
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`
    if (measureMeters(ctx, candidate) <= maxWidth) current = candidate
    else {
      lines.push(current)
      current = word
    }
  }
  lines.push(current)
  return lines
}

/**
 * Writes a text on several lines, centred on `y`.
 *
 * `y` is the centre of the block and not the first line: that way a two-line sentence and a
 * one-line one end up in the same place, and the panel does not jump when the tutorial changes section.
 */
export function drawParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  {
    size,
    color,
    weight = '600',
    maxWidth,
    lineHeight = 1.35,
    anchor = 'middle',
  }: {
    size: number
    color: string
    weight?: string
    maxWidth: number
    lineHeight?: number
    /**
     * Where the `y` it is given falls: at the centre of the block (the usual) or at its
     * **top edge**.
     *
     * Centred, a paragraph that goes from two lines to three grows upwards and
     * runs into whatever it has above —and with the headset on that is an overlapped label
     * that nobody sees until the test session—. Anchored at the top, it grows only
     * downwards and whoever places it knows how much it takes up (`paragraphHeight`).
     */
    anchor?: 'middle' | 'top'
  },
): void {
  const lines = measureLines(ctx, text, { size, weight, maxWidth })
  const step = size * lineHeight
  const centered = y + (step * (lines.length - 1)) / 2
  const top = anchor === 'top' ? y - (size * LINE_HEIGHT) / 2 : centered
  lines.forEach((line, index) => {
    drawText(ctx, line, x, top - index * step, { size, color, weight })
  })
}

/** Into how many lines a text is split, without painting it. */
function measureLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  { size, weight, maxWidth }: { size: number; weight: string; maxWidth: number },
): string[] {
  ctx.save()
  ctx.font = panelFont(weight, size)
  const lines = wrapText(ctx, text, maxWidth)
  ctx.restore()
  return lines
}

/**
 * How tall a paragraph is, so that what goes below can be placed.
 *
 * It has to be measured and not assumed: the same text takes two lines in English and three
 * in Spanish, and what is below has to go down with it.
 */
export function paragraphHeight(
  ctx: CanvasRenderingContext2D,
  text: string,
  {
    size,
    weight = '600',
    maxWidth,
    lineHeight = 1.35,
  }: { size: number; weight?: string; maxWidth: number; lineHeight?: number },
): number {
  const lines = measureLines(ctx, text, { size, weight, maxWidth })
  return (lines.length - 1) * size * lineHeight + size * LINE_HEIGHT
}

/** A rectangle with rounded corners, which is the shape of everything here. */
export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.roundRect(x - width / 2, y - height / 2, width, height, radius)
}

/**
 * The plate of the panel: a plane with the drawing on top.
 *
 * The texture is declared as an R3F element and not created by hand because that way
 * R3F releases it on unmount: a one-megapixel texture that nobody lets go of is
 * graphics card memory that does not come back.
 *
 * `draw` has to come wrapped in `useCallback`: it is what decides when it
 * has to be painted again.
 */
export function CanvasPanel({
  width,
  height,
  draw,
  fallbackColor,
  everyFrame = false,
}: {
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D) => void
  fallbackColor: string
  /**
   * The drawing moves on its own: it is repainted every frame, without going through React.
   *
   * It is asked for by whoever animates something inside the panel. Without this the progress
   * would have to be kept in state and `setState` at ninety hertz repaints the whole tree of the
   * game ninety times per second, which is how it looked: the screen flickering and no way to
   * choose anything.
   */
  everyFrame?: boolean
}) {
  const canvas = usePanelCanvas(width, height)
  const texture = useRef<CanvasTexture>(null)

  const paint = useCallback(() => {
    const ctx = canvas?.getContext('2d')
    if (canvas == null || ctx == null) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.scale(PANEL_PIXELS_PER_METER, -PANEL_PIXELS_PER_METER)

    draw(ctx)

    // Without this the drawing stays in the canvas and does not reach the graphics card:
    // the panel would be seen with what it said the first time.
    const map = texture.current
    if (map != null) map.needsUpdate = true
  }, [canvas, draw])

  usePaintBeforeSeen(() => {
    if (everyFrame) return
    paint()
  }, [everyFrame, paint])

  // A panel that is animated is repainted **per frame and without going through React**. It is
  // what `everyFrame` exists for: the demonstration of the gesture moved its drawing by keeping
  // the progress in state, and a `setState` at ninety hertz repaints the whole tree of the game
  // ninety times per second. That is what was seen as «the screen flickers and will not let me
  // select anything».
  useFrame(() => {
    if (everyFrame) paint()
  })

  return (
    <mesh raycast={NO_RAYCAST}>
      <planeGeometry args={[width, height]} />
      {/*
        **Without writing depth.** The canvas is almost all transparent —there are only letters—
        but a transparent material **does record its depth** unless it is told
        not to, and then it covers what it has behind even though nothing painted is seen. That is
        what left glide-hockey's play button without its blue plate: the panel's canvas goes in
        front of the buttons, and everything that was behind disappeared. Reported with the
        headset on: «the play button is not seen in blue, it is as if shaded».
      */}
      <meshBasicMaterial
        transparent
        depthWrite={false}
        color={canvas == null ? fallbackColor : undefined}
      >
        {canvas == null ? null : (
          <canvasTexture
            ref={texture}
            attach="map"
            args={[canvas]}
            colorSpace={SRGBColorSpace}
            anisotropy={4}
          />
        )}
      </meshBasicMaterial>
    </mesh>
  )
}

/**
 * The **exit the game** arrow, drawn on the canvas.
 *
 * **A single shape for all thirteen.** Each game said «exit» in its own way: six with the
 * word «Exit», three with a cross, two with a door, one with a door and an arrow, and
 * one with a cross called door. And several also use the cross for something else —closing the
 * panel, going back to the menu—, so the same drawing meant two different things depending on
 * the game. Reported with the headset on: «it is not clear which one is the button to exit the
 * game: sometimes a square appears, other times it says "leave"… it should be unified».
 *
 * It is a backwards arrow because that is what the button does: **go back to the hall**. The
 * cross, which was the other candidate, already means «close this» in several panels.
 *
 * The proportions go in `EXIT_ARROW` so that the three-dimensional icon of the
 * games that do not paint their menu on a canvas comes out with the same shape.
 */
export const EXIT_ARROW = {
  /** The tip, to the left of the centre, measured in heights of the icon. */
  tip: -0.5,
  /** And the end of the shaft, to the right. */
  shaft: 0.42,
  /** How thick the shaft is. */
  thickness: 0.3,
  /** Where the shaft starts, which is where the wings end. */
  elbow: -0.06,
  /** How wide open the wings go: half the height of the icon. */
  wings: 0.5,
}

/** Paints the exit arrow centred on `x, y`, with that height and that colour. */
export function drawExitArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  color: string,
): void {
  const { tip, shaft, thickness, elbow, wings } = EXIT_ARROW
  ctx.beginPath()
  ctx.moveTo(x + tip * height, y)
  ctx.lineTo(x + elbow * height, y + wings * height)
  ctx.lineTo(x + elbow * height, y + (thickness / 2) * height)
  ctx.lineTo(x + shaft * height, y + (thickness / 2) * height)
  ctx.lineTo(x + shaft * height, y - (thickness / 2) * height)
  ctx.lineTo(x + elbow * height, y - (thickness / 2) * height)
  ctx.lineTo(x + elbow * height, y - wings * height)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}
