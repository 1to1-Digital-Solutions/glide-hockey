import { describe, expect, it } from 'vitest'
import { PRESS_DEBOUNCE_MS, pressCounts } from './xrPress'

describe('cuándo cuenta una pulsación del visor', () => {
  it('la primera siempre cuenta', () => {
    expect(pressCounts(1000, null)).toBe(true)
  })

  it('una segunda inmediata es el otro puntero del mismo gesto', () => {
    expect(pressCounts(1000, 1000 - PRESS_DEBOUNCE_MS + 1)).toBe(false)
  })

  it('pasada la ventana vuelve a contar', () => {
    expect(pressCounts(1000, 1000 - PRESS_DEBOUNCE_MS)).toBe(true)
  })

  it('un botón apagado no responde', () => {
    expect(pressCounts(1000, null, true)).toBe(false)
  })

  it('sin reloj cuenta, que es preferible a un menú mudo', () => {
    expect(pressCounts(null, 500)).toBe(true)
  })
})
