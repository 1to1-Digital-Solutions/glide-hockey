import { describe, expect, it } from 'vitest'
import { DIGIT_SEGMENTS, digitsOf } from './xrDigits'

describe('las cifras de un número', () => {
  it('separa un número de varias cifras en orden', () => {
    expect(digitsOf(1250)).toEqual([1, 2, 5, 0])
  })

  it('el cero es una sola cifra', () => {
    expect(digitsOf(0)).toEqual([0])
  })

  it('recorta los decimales en vez de intentar dibujarlos', () => {
    expect(digitsOf(7.9)).toEqual([7])
  })

  it('trata lo que no se puede dibujar como un cero', () => {
    expect(digitsOf(-30)).toEqual([0])
    expect(digitsOf(Number.NaN)).toEqual([0])
    expect(digitsOf(Number.POSITIVE_INFINITY)).toEqual([0])
  })

  it('sabe dibujar las diez cifras', () => {
    expect(DIGIT_SEGMENTS).toHaveLength(10)
    for (const segments of DIGIT_SEGMENTS) {
      expect(segments.length).toBeGreaterThan(0)
    }
  })
})
