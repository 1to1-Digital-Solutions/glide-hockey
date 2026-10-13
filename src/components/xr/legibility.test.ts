import { describe, expect, it } from 'vitest'
import { drawParagraph, drawText } from './canvasPanel'
import { TYPICAL_DISTANCE, minTextHeight, recordingCanvas, legibilityProblems } from './legibility'

/**
 * El instrumento con el que se comprueba que un panel se lee.
 *
 * Se prueba a sí mismo antes de usarse en ningún panel: una regla que no mide
 * bien es peor que no tener regla, porque da por bueno lo que no lo está.
 *
 * Los paneles del juego se miden cada uno en su `*.legible.test.ts`, desde donde se juega.
 */

const PANEL = { width: 0.7, height: 0.4 }

describe('el lienzo que apunta', () => {
  it('apunta lo escrito donde se escribió, con la y hacia arriba', () => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    drawText(ctx, 'Salir', 0.1, 0.12, { size: 0.04, color: '#fff' })

    expect(escritos).toHaveLength(1)
    expect(escritos[0].text).toBe('Salir')
    expect(escritos[0].x).toBeCloseTo(0.1, 6)
    expect(escritos[0].y).toBeCloseTo(0.12, 6)
  })

  it('ve el encogido de una etiqueta que no cabe en su botón', () => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    drawText(ctx, 'Seguir jugando', 0, 0, { size: 0.04, color: '#fff', maxWidth: 0.1 })
    expect(escritos[0].width).toBeLessThanOrEqual(0.1 + 1e-9)
  })

  it('reparte un párrafo en sus líneas, cada una en su sitio', () => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    drawParagraph(ctx, 'una frase larga que no cabe de una sola línea aquí', 0, 0, {
      size: 0.03,
      color: '#fff',
      maxWidth: 0.3,
    })
    expect(escritos.length).toBeGreaterThan(1)
    // De arriba abajo y sin repetirse de altura.
    const alturas = escritos.map((e) => e.y)
    expect([...alturas].sort((a, b) => b - a)).toEqual(alturas)
  })

  it('devolver la transformación deja lo siguiente en las coordenadas del panel', () => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    // Un trozo del panel se pinta desplazado —el mando dibujado, un marcador— y
    // luego se vuelve. Lo que se escriba después no puede arrastrar ese desplazamiento.
    ctx.translate(0.3, 0.2)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    drawText(ctx, 'Salir', 0, 0, { size: 0.04, color: '#fff' })
    expect(escritos[0].x).toBeCloseTo(0, 6)
    expect(escritos[0].y).toBeCloseTo(0, 6)
  })

  it('coloca según la alineación: a la izquierda empieza donde se le dice', () => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    drawText(ctx, 'Modo', -0.3, 0, { size: 0.03, color: '#fff', align: 'left' })
    expect(escritos[0].x - escritos[0].width / 2).toBeCloseTo(-0.3, 6)
  })
})

describe('qué se da por ilegible', () => {
  it('dos textos encima se dicen por su nombre', () => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    drawText(ctx, 'Modo', 0, 0.02, { size: 0.04, color: '#fff' })
    drawText(ctx, 'Récord', 0, 0.005, { size: 0.04, color: '#fff' })

    const problemas = legibilityProblems(escritos, { panel: PANEL })
    expect(problemas).toHaveLength(1)
    expect(problemas[0]).toContain('«Modo» overlaps «Récord»')
  })

  it('dos renglones seguidos con su aire no se pisan', () => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    drawText(ctx, 'Modo', 0, 0.05, { size: 0.04, color: '#fff' })
    drawText(ctx, 'Récord', 0, 0, { size: 0.04, color: '#fff' })
    expect(legibilityProblems(escritos, { panel: PANEL })).toEqual([])
  })

  it('lo que se sale del panel se canta', () => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    drawText(ctx, 'una etiqueta larguísima que se sale por el lado', 0, 0, { size: 0.04, color: '#fff' })
    expect(legibilityProblems(escritos, { panel: PANEL }).join(' ')).toContain('runs off the panel')
  })

  it('y la letra que no se lee de pequeña, también', () => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    drawText(ctx, 'tres', 0, 0, { size: minTextHeight(TYPICAL_DISTANCE) / 2, color: '#fff' })
    expect(legibilityProblems(escritos, { panel: PANEL }).join(' ')).toContain('below')
  })

  it('y lo que se lee depende de a qué distancia esté el panel', () => {
    // La misma letra: una mancha en un panel a metro y medio, y de sobra en uno a un palmo.
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    drawText(ctx, 'tres', 0, 0, { size: 0.012, color: '#fff' })
    expect(legibilityProblems(escritos, { panel: PANEL }).join(' ')).toContain('below')
    expect(legibilityProblems(escritos, { panel: PANEL, distance: 0.5 })).toEqual([])
  })

  it('un panel bien puesto no da problemas', () => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    drawText(ctx, 'Dejar la partida', 0, 0.1, { size: 0.04, color: '#fff' })
    drawText(ctx, 'Salir', -0.15, -0.1, { size: 0.03, color: '#fff' })
    drawText(ctx, 'Seguir', 0.15, -0.1, { size: 0.03, color: '#fff' })
    expect(legibilityProblems(escritos, { panel: PANEL })).toEqual([])
  })
})
