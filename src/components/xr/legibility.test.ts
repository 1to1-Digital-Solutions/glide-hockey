import { describe, expect, it } from 'vitest'
import { drawParagraph, drawText } from './canvasPanel'
import { TYPICAL_DISTANCE, minTextHeight, recordingCanvas, legibilityProblems } from './legibility'

/**
 * The instrument used to check that a panel can be read.
 *
 * It tests itself before being used on any panel: a ruler that does not measure
 * well is worse than having no ruler, because it passes what is not right.
 *
 * The game's panels are each measured in their `*.legible.test.ts`, from where the game is played.
 */

const PANEL = { width: 0.7, height: 0.4 }

describe('the recording canvas', () => {
  it('records what is written where it was written, with y pointing up', () => {
    const { ctx, drawnTexts: texts } = recordingCanvas()
    drawText(ctx, 'Salir', 0.1, 0.12, { size: 0.04, color: '#fff' })

    expect(texts).toHaveLength(1)
    expect(texts[0].text).toBe('Salir')
    expect(texts[0].x).toBeCloseTo(0.1, 6)
    expect(texts[0].y).toBeCloseTo(0.12, 6)
  })

  it('sees the shrinking of a label that does not fit in its button', () => {
    const { ctx, drawnTexts: texts } = recordingCanvas()
    drawText(ctx, 'Seguir jugando', 0, 0, { size: 0.04, color: '#fff', maxWidth: 0.1 })
    expect(texts[0].width).toBeLessThanOrEqual(0.1 + 1e-9)
  })

  it('lays a paragraph out into its lines, each one in its place', () => {
    const { ctx, drawnTexts: texts } = recordingCanvas()
    drawParagraph(ctx, 'una frase larga que no cabe de una sola línea aquí', 0, 0, {
      size: 0.03,
      color: '#fff',
      maxWidth: 0.3,
    })
    expect(texts.length).toBeGreaterThan(1)
    // From top to bottom and without repeating a height.
    const heights = texts.map((e) => e.y)
    expect([...heights].sort((a, b) => b - a)).toEqual(heights)
  })

  it('restoring the transform leaves what comes next in the coordinates of the panel', () => {
    const { ctx, drawnTexts: texts } = recordingCanvas()
    // A piece of the panel is painted shifted —the drawn controller, a scoreboard— and
    // then it comes back. What is written afterwards cannot drag that shift along.
    ctx.translate(0.3, 0.2)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    drawText(ctx, 'Salir', 0, 0, { size: 0.04, color: '#fff' })
    expect(texts[0].x).toBeCloseTo(0, 6)
    expect(texts[0].y).toBeCloseTo(0, 6)
  })

  it('places according to the alignment: on the left it starts where it is told', () => {
    const { ctx, drawnTexts: texts } = recordingCanvas()
    drawText(ctx, 'Modo', -0.3, 0, { size: 0.03, color: '#fff', align: 'left' })
    expect(texts[0].x - texts[0].width / 2).toBeCloseTo(-0.3, 6)
  })
})

describe('what counts as unreadable', () => {
  it('two texts on top of each other are called out by name', () => {
    const { ctx, drawnTexts: texts } = recordingCanvas()
    drawText(ctx, 'Modo', 0, 0.02, { size: 0.04, color: '#fff' })
    drawText(ctx, 'Récord', 0, 0.005, { size: 0.04, color: '#fff' })

    const problems = legibilityProblems(texts, { panel: PANEL })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('«Modo» overlaps «Récord»')
  })

  it('two consecutive lines with their gap do not overlap', () => {
    const { ctx, drawnTexts: texts } = recordingCanvas()
    drawText(ctx, 'Modo', 0, 0.05, { size: 0.04, color: '#fff' })
    drawText(ctx, 'Récord', 0, 0, { size: 0.04, color: '#fff' })
    expect(legibilityProblems(texts, { panel: PANEL })).toEqual([])
  })

  it('what runs off the panel is called out', () => {
    const { ctx, drawnTexts: texts } = recordingCanvas()
    drawText(ctx, 'una etiqueta larguísima que se sale por el lado', 0, 0, { size: 0.04, color: '#fff' })
    expect(legibilityProblems(texts, { panel: PANEL }).join(' ')).toContain('runs off the panel')
  })

  it('and the font too small to read, as well', () => {
    const { ctx, drawnTexts: texts } = recordingCanvas()
    drawText(ctx, 'tres', 0, 0, { size: minTextHeight(TYPICAL_DISTANCE) / 2, color: '#fff' })
    expect(legibilityProblems(texts, { panel: PANEL }).join(' ')).toContain('below')
  })

  it('and what can be read depends on how far away the panel is', () => {
    // The same font: a smudge on a panel a metre and a half away, and plenty on one a span away.
    const { ctx, drawnTexts: texts } = recordingCanvas()
    drawText(ctx, 'tres', 0, 0, { size: 0.012, color: '#fff' })
    expect(legibilityProblems(texts, { panel: PANEL }).join(' ')).toContain('below')
    expect(legibilityProblems(texts, { panel: PANEL, distance: 0.5 })).toEqual([])
  })

  it('a well laid out panel gives no problems', () => {
    const { ctx, drawnTexts: texts } = recordingCanvas()
    drawText(ctx, 'Dejar la partida', 0, 0.1, { size: 0.04, color: '#fff' })
    drawText(ctx, 'Salir', -0.15, -0.1, { size: 0.03, color: '#fff' })
    drawText(ctx, 'Seguir', 0.15, -0.1, { size: 0.03, color: '#fff' })
    expect(legibilityProblems(texts, { panel: PANEL })).toEqual([])
  })
})
