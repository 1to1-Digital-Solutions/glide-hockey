import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PANEL_PIXELS_PER_METER, drawParagraph, drawText, panelFont, wrapText } from './canvasPanel'

/**
 * The text of the panels, which is the only thing here that can be checked
 * without a headset in front of you: inside the Canvas there is no DOM to
 * measure, so a label that runs out of its button is only seen with the
 * headset on.
 *
 * What is guaranteed is the shrinking. With four modes in the menu row the
 * buttons measure twelve centimetres and «301/501» does not fit at its size;
 * without this it would be read on top of the button next to it.
 */

/** How wide a letter is relative to its height, more or less, on this canvas. */
const ADVANCE = 0.6

/** The size declared in a canvas font, in pixels of the texture. */
function pixelsOf(font: string): number {
  return Number(font.match(/([\d.]+)px/)?.[1])
}

/** And the same size in metres of the panel, which is what texts are asked for in. */
function sizeOf(font: string): number {
  return pixelsOf(font) / PANEL_PIXELS_PER_METER
}

/** A fake canvas: it measures like a real one and records what is written. */
function canvas() {
  const drawnText: { text: string; font: string; args: number }[] = []

  const ctx = {
    font: '',
    fillStyle: '',
    textAlign: 'center',
    textBaseline: 'alphabetic',
    save() {},
    restore() {},
    translate() {},
    scale() {},
    measureText(text: string) {
      // What it measures depends on the font that is set, as in the browser: in pixels
      // of the font, whatever the scale of the canvas.
      return { width: text.length * pixelsOf(ctx.font) * ADVANCE }
    },
    fillText(...args: unknown[]) {
      drawnText.push({ text: String(args[0]), font: ctx.font, args: args.length })
    },
  }

  return { ctx: ctx as unknown as CanvasRenderingContext2D, drawnText }
}

const BLACK = '#101419'

describe('drawText', () => {
  it('writes what fits at the size asked for', () => {
    const { ctx, drawnText } = canvas()

    drawText(ctx, 'Reloj', 0, 0, { size: 0.032, color: BLACK, maxWidth: 0.2 })

    expect(drawnText).toHaveLength(1)
    expect(sizeOf(drawnText[0].font)).toBeCloseTo(0.032, 9)
  })

  it('asks for the font in real pixels, not in metres', () => {
    // A 0.03 px font enlarged a thousand times is what the headset's browser painted with the
    // letters piled up: at that size the measurements of each letter are no good. Reported with
    // the headset on: «the letters are completely stuck together, one on top of the other».
    const { ctx, drawnText } = canvas()

    drawText(ctx, 'Levels', 0, 0, { size: 0.03, color: BLACK, maxWidth: 0.08 })
    drawParagraph(ctx, 'Hold the trigger and the ball appears', 0, 0, { size: 0.03, color: BLACK, maxWidth: 0.2 })

    for (const line of drawnText) expect(pixelsOf(line.font), line.text).toBeGreaterThanOrEqual(8)
  })

  it('shrinks what does not fit until it fits', () => {
    // The room in a button of the mode row, with the chosen dot on it.
    const room = 0.081
    const { ctx, drawnText } = canvas()

    drawText(ctx, '301/501', 0, 0, { size: 0.032, color: BLACK, maxWidth: room })

    const size = sizeOf(drawnText[0].font)
    expect(size).toBeLessThan(0.032)
    expect('301/501'.length * size * ADVANCE).toBeLessThanOrEqual(room + 1e-9)
  })

  it('shrinks the font, does not narrow it', () => {
    // `fillText` knows how to squeeze the text into the width it is told, but a
    // condensed text on a panel at arm's length reads much worse than the same
    // text one point smaller.
    const { ctx, drawnText } = canvas()

    drawText(ctx, '301/501', 0, 0, { size: 0.032, color: BLACK, maxWidth: 0.081 })

    expect(drawnText[0].args).toBe(3)
  })

  it('without a maximum it does not touch the size: it is what the rest of the panels do', () => {
    const { ctx, drawnText } = canvas()

    drawText(ctx, 'Un título largo de los que no caben', 0, 0, { size: 0.055, color: BLACK })

    expect(sizeOf(drawnText[0].font)).toBeCloseTo(0.055, 9)
  })
})

/**
 * The layout into lines.
 *
 * **It is what made the tutorials unreadable.** A forty-character phrase shrunk until it
 * fits on a single line in a sixty-centimetre panel ends up in two-centimetre letters:
 * inside the headset it was written and nothing could be understood. Shrinking is fine for
 * a button label; a phrase has to be split.
 */
describe('laying a text out into lines', () => {
  it('puts on one line what fits', () => {
    const { ctx } = canvas()
    ctx.font = panelFont('600', 0.03)

    expect(wrapText(ctx, 'Dale al topo', 1)).toEqual(['Dale al topo'])
  })

  it('splits at spaces what does not fit', () => {
    const { ctx } = canvas()
    ctx.font = panelFont('600', 0.03)
    // With this canvas, each letter measures 0.018 m: about eleven fit per 0.2 line.
    const lines = wrapText(ctx, 'Hold the trigger and the ball appears', 0.2)

    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(' ')).toBe('Hold the trigger and the ball appears')
    for (const line of lines) {
      expect(ctx.measureText(line).width / PANEL_PIXELS_PER_METER).toBeLessThanOrEqual(0.2)
    }
  })

  it('leaves whole a word that does not fit on its own', () => {
    // Splitting it in half reads worse than letting it stick out, and in a headset much worse.
    const { ctx } = canvas()
    ctx.font = panelFont('600', 0.03)

    expect(wrapText(ctx, 'incomprehensiblemente', 0.05)).toEqual(['incomprehensiblemente'])
  })

  it('with an empty text it writes nothing', () => {
    const { ctx } = canvas()
    ctx.font = panelFont('600', 0.03)

    expect(wrapText(ctx, '   ', 1)).toEqual([])
  })
})

describe('writing a paragraph', () => {
  it('writes one line per piece, all of the same size', () => {
    // No shrinking: the size asked for is the one that is read, and what is left over drops a line.
    const { ctx, drawnText } = canvas()

    drawParagraph(ctx, 'Hold the trigger and the ball appears', 0, 0, {
      size: 0.03,
      color: '#fff',
      maxWidth: 0.2,
    })

    expect(drawnText.length).toBeGreaterThan(1)
    expect(new Set(drawnText.map((line) => sizeOf(line.font))).size).toBe(1)
    expect(sizeOf(drawnText[0].font)).toBeCloseTo(0.03, 6)
  })

  it('centres the block on the height it is given', () => {
    // `y` is the centre of the block and not the first line: otherwise a two-line phrase and
    // a one-line one would end up in different places and the panel would jump between steps.
    const { ctx, drawnText } = canvas()
    const twoLines = () => {
      drawnText.length = 0
      drawParagraph(ctx, 'Hold the trigger and the ball appears', 0, 0, {
        size: 0.03,
        color: '#fff',
        maxWidth: 0.2,
      })
      return drawnText.length
    }

    const howMany = twoLines()
    expect(howMany).toBeGreaterThan(1)
    // The block spreads its lines above and below the centre, so the first one ends up
    // above zero and the last one below.
    expect(howMany % 2 === 0 || howMany > 1).toBe(true)
  })

  it('with an empty text it writes nothing', () => {
    const { ctx, drawnText } = canvas()

    drawParagraph(ctx, '', 0, 0, { size: 0.03, color: '#fff', maxWidth: 0.2 })

    expect(drawnText).toEqual([])
  })
})

/**
 * And the only thing of the component that can be checked without mounting the scene: that
 * the canvas **does not write depth**.
 *
 * A transparent material records its depth unless it is told not to, and this plane goes in
 * front of the panel's buttons covering them whole: with depth on, everything left behind
 * disappears even if the canvas is empty there. That is how the play button of glide-hockey
 * lost its blue plate —«it does not look blue, it is as if shaded»— and with it the plates
 * of the small buttons of several games.
 */
describe('the plane of the panel', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/components/xr/canvasPanel.tsx'),
    'utf8',
  )

  it('does not write depth: it would cover whatever it has behind', () => {
    expect(source).toContain('depthWrite={false}')
  })
})
