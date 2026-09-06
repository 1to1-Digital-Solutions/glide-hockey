import { describe, expect, it } from 'vitest'
import { MAX_PUCK_SPEED } from './gameConfig'
import { puckGlow } from './puckGlow'

describe('el halo del disco', () => {
  it('en reposo el disco apenas brilla y no hay anillo', () => {
    const quieto = puckGlow(0)
    expect(quieto.emissive).toBeGreaterThan(0)
    expect(quieto.emissive).toBeLessThan(0.3)
    expect(quieto.halo).toBe(0)
  })

  it('cuanto más rápido, más brilla y más anillo, hasta la velocidad máxima', () => {
    const lento = puckGlow(1)
    const rapido = puckGlow(4)
    const tope = puckGlow(MAX_PUCK_SPEED)
    expect(rapido.emissive).toBeGreaterThan(lento.emissive)
    expect(rapido.halo).toBeGreaterThan(lento.halo)
    expect(rapido.haloScale).toBeGreaterThan(lento.haloScale)
    expect(puckGlow(MAX_PUCK_SPEED * 2)).toEqual(tope)
    expect(tope.halo).toBeLessThanOrEqual(1)
  })

  it('una velocidad imposible cuenta como reposo', () => {
    expect(puckGlow(Number.NaN)).toEqual(puckGlow(0))
    expect(puckGlow(-3)).toEqual(puckGlow(0))
  })
})
