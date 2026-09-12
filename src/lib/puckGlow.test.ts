import { describe, expect, it } from 'vitest'
import { MAX_PUCK_SPEED } from './gameConfig'
import { puckGlow } from './puckGlow'

/**
 * Que el disco se encienda con la velocidad, que es lo que deja seguirlo con el rabillo del
 * ojo mientras cruza la mesa en medio segundo.
 *
 * Llevaba además un anillo que se ensanchaba, y con el visor puesto no se leía como un disco
 * rápido sino como un foco. Se quitó; el brillo hace el mismo trabajo sin parecer otra cosa.
 */

describe('el brillo del disco', () => {
  it('en reposo apenas brilla', () => {
    const quieto = puckGlow(0)
    expect(quieto.emissive).toBeGreaterThan(0)
    expect(quieto.emissive).toBeLessThan(0.3)
  })

  it('cuanto más rápido, más brilla, hasta la velocidad máxima', () => {
    const lento = puckGlow(1)
    const rapido = puckGlow(4)
    const tope = puckGlow(MAX_PUCK_SPEED)
    expect(rapido.emissive).toBeGreaterThan(lento.emissive)
    expect(tope.emissive).toBeGreaterThan(rapido.emissive)
    expect(puckGlow(MAX_PUCK_SPEED * 2)).toEqual(tope)
  })

  it('y no lleva nada alrededor', () => {
    // El control de lo que se quitó: si vuelve un anillo, este test lo dice.
    expect(Object.keys(puckGlow(3))).toEqual(['emissive'])
  })

  it('una velocidad imposible cuenta como reposo', () => {
    expect(puckGlow(Number.NaN)).toEqual(puckGlow(0))
    expect(puckGlow(-3)).toEqual(puckGlow(0))
  })
})
