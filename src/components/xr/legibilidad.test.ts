import { describe, expect, it } from 'vitest'
import { drawParagraph, drawText } from './canvasPanel'
import { CONFIRM_SIZE, dibujarElAviso } from './XRHud'
import { dibujarLosNombres } from './XRMenu'
import { MENU_PANEL } from '../../lib/xrMenuLayout'
import { traductor } from '../../lib/textos'
import { MIN_ALTO, lienzoQueApunta, problemasDeLegibilidad } from './legibilidad'

/**
 * El instrumento con el que se comprueba que un panel se lee.
 *
 * Se prueba a sí mismo antes de usarse en ningún panel: una regla que no mide
 * bien es peor que no tener regla, porque da por bueno lo que no lo está.
 */

const PANEL = { width: 0.7, height: 0.4 }

describe('el lienzo que apunta', () => {
  it('apunta lo escrito donde se escribió, con la y hacia arriba', () => {
    const { ctx, escritos } = lienzoQueApunta()
    drawText(ctx, 'Salir', 0.1, 0.12, { size: 0.04, color: '#fff' })

    expect(escritos).toHaveLength(1)
    expect(escritos[0].texto).toBe('Salir')
    expect(escritos[0].x).toBeCloseTo(0.1, 6)
    expect(escritos[0].y).toBeCloseTo(0.12, 6)
  })

  it('ve el encogido de una etiqueta que no cabe en su botón', () => {
    const { ctx, escritos } = lienzoQueApunta()
    drawText(ctx, 'Seguir jugando', 0, 0, { size: 0.04, color: '#fff', maxWidth: 0.1 })
    expect(escritos[0].ancho).toBeLessThanOrEqual(0.1 + 1e-9)
  })

  it('reparte un párrafo en sus líneas, cada una en su sitio', () => {
    const { ctx, escritos } = lienzoQueApunta()
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

  it('coloca según la alineación: a la izquierda empieza donde se le dice', () => {
    const { ctx, escritos } = lienzoQueApunta()
    drawText(ctx, 'Modo', -0.3, 0, { size: 0.03, color: '#fff', align: 'left' })
    expect(escritos[0].x - escritos[0].ancho / 2).toBeCloseTo(-0.3, 6)
  })
})

describe('qué se da por ilegible', () => {
  it('dos textos encima se dicen por su nombre', () => {
    const { ctx, escritos } = lienzoQueApunta()
    drawText(ctx, 'Modo', 0, 0.02, { size: 0.04, color: '#fff' })
    drawText(ctx, 'Récord', 0, 0.005, { size: 0.04, color: '#fff' })

    const problemas = problemasDeLegibilidad(escritos, { panel: PANEL })
    expect(problemas).toHaveLength(1)
    expect(problemas[0]).toContain('«Modo» se pisa con «Récord»')
  })

  it('dos renglones seguidos con su aire no se pisan', () => {
    const { ctx, escritos } = lienzoQueApunta()
    drawText(ctx, 'Modo', 0, 0.05, { size: 0.04, color: '#fff' })
    drawText(ctx, 'Récord', 0, 0, { size: 0.04, color: '#fff' })
    expect(problemasDeLegibilidad(escritos, { panel: PANEL })).toEqual([])
  })

  it('lo que se sale del panel se canta', () => {
    const { ctx, escritos } = lienzoQueApunta()
    drawText(ctx, 'una etiqueta larguísima que se sale por el lado', 0, 0, { size: 0.04, color: '#fff' })
    expect(problemasDeLegibilidad(escritos, { panel: PANEL }).join(' ')).toContain('se sale del panel')
  })

  it('y la letra que no se lee de pequeña, también', () => {
    const { ctx, escritos } = lienzoQueApunta()
    drawText(ctx, 'tres', 0, 0, { size: MIN_ALTO / 2, color: '#fff' })
    expect(problemasDeLegibilidad(escritos, { panel: PANEL }).join(' ')).toContain('por debajo de')
  })

  it('un panel bien puesto no da problemas', () => {
    const { ctx, escritos } = lienzoQueApunta()
    drawText(ctx, 'Dejar la partida', 0, 0.1, { size: 0.04, color: '#fff' })
    drawText(ctx, 'Salir', -0.15, -0.1, { size: 0.03, color: '#fff' })
    drawText(ctx, 'Seguir', 0.15, -0.1, { size: 0.03, color: '#fff' })
    expect(problemasDeLegibilidad(escritos, { panel: PANEL })).toEqual([])
  })
})

describe('los paneles de este juego se leen', () => {
  /** En los dos idiomas: el español es más largo y es donde se sale el texto. */
  const IDIOMAS = ['en', 'es'] as const

  it('el aviso de dejar la partida', () => {
    for (const lang of IDIOMAS) {
      const { ctx, escritos } = lienzoQueApunta()
      dibujarElAviso(ctx, traductor(lang))
      const panel = { width: CONFIRM_SIZE[0], height: CONFIRM_SIZE[1] }
      expect(problemasDeLegibilidad(escritos, { panel }), lang).toEqual([])
    }
  })

  it('los nombres de las filas del menú', () => {
    for (const lang of IDIOMAS) {
      for (const levels of [false, true]) {
        const { ctx, escritos } = lienzoQueApunta()
        dibujarLosNombres(ctx, traductor(lang), levels)
        expect(problemasDeLegibilidad(escritos, { panel: MENU_PANEL }), `${lang} ${levels}`).toEqual([])
      }
    }
  })
})
