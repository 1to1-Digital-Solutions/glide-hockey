import { describe, expect, it } from 'vitest'

import { PINCH_CLOSE, PINCH_OPEN, isPinching } from './pinch'

/**
 * Agarrar con la mano desnuda.
 *
 * Se prueba aquí porque es un umbral, y los umbrales sin histéresis se notan tarde: con uno
 * solo, una mano temblando justo en él suelta y coge el objeto varias veces por segundo.
 */
describe('el pellizco', () => {
  it('con las yemas juntas, agarra', () => {
    expect(isPinching(0.01, false)).toBe(true)
  })

  it('con la mano abierta, no', () => {
    expect(isPinching(0.09, false)).toBe(false)
  })

  it('aguanta el pulso: soltar cuesta más que agarrar', () => {
    // Justo entre los dos umbrales: si ya agarraba, sigue agarrando; si no, no empieza.
    const entre = (PINCH_CLOSE + PINCH_OPEN) / 2

    expect(isPinching(entre, true)).toBe(true)
    expect(isPinching(entre, false)).toBe(false)
  })

  it('separar del todo suelta', () => {
    expect(isPinching(PINCH_OPEN + 0.01, true)).toBe(false)
  })

  it('sin articulaciones no agarra: eso es un mando, y lo dice su botón', () => {
    expect(isPinching(null, false)).toBe(false)
    expect(isPinching(null, true)).toBe(false)
    expect(isPinching(Number.NaN, true)).toBe(false)
  })
})
