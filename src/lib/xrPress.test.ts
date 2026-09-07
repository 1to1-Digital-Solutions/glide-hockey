import { describe, expect, it, vi } from 'vitest'
import { PRESS_DEBOUNCE_MS, pressCounts, pressTime } from './xrPress'

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

describe('cuándo se ha pulsado', () => {
  it('en el navegador, el reloj de precisión', () => {
    expect(pressTime()).toBeCloseTo(performance.now(), -2)
  })

  it('sin reloj del que fiarse, no se sabe, y entonces la pulsación cuenta', () => {
    // Ante la duda un botón responde: un menú entero que no reacciona no deja
    // ni rastro en consola que lo explique.
    vi.stubGlobal('performance', undefined)
    expect(pressTime()).toBeNull()
    expect(pressCounts(pressTime(), 0, false)).toBe(true)
    vi.unstubAllGlobals()
  })
})
