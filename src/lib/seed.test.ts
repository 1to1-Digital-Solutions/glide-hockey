import { describe, expect, it } from 'vitest'

import { randomFrom, randomSeed, deriveSeed } from './seed'

const firstOnes = (random: () => number, n: number) => Array.from({ length: n }, random)

describe('randomFrom', () => {
  it('gives the same series with the same seed, which is the whole challenge', () => {
    expect(firstOnes(randomFrom(20260925), 50)).toEqual(firstOnes(randomFrom(20260925), 50))
  })

  it('gives different series with different seeds', () => {
    expect(firstOnes(randomFrom(1), 5)).not.toEqual(firstOnes(randomFrom(2), 5))
  })

  it('stays in [0, 1) and spreads: each tenth gets its share', () => {
    const random = randomFrom(7)
    const boxes = new Array<number>(10).fill(0)
    for (let i = 0; i < 10000; i++) {
      const x = random()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
      boxes[Math.floor(x * 10)]++
    }
    for (const box of boxes) expect(box).toBeGreaterThan(850)
  })

  it('treats a negative seed or one with decimals the same as its 32-bit integer', () => {
    expect(randomFrom(-1)()).toBe(randomFrom(4294967295)())
  })

  it('is the usual mulberry32: the first number of seed 1 does not change', () => {
    expect(randomFrom(1)()).toBeCloseTo(0.6270739405881613, 12)
  })
})

describe('deriveSeed', () => {
  it('is stable and depends on each part', () => {
    expect(deriveSeed(42, 3)).toBe(deriveSeed(42, 3))
    expect(deriveSeed(42, 3)).not.toBe(deriveSeed(42, 4))
    expect(deriveSeed(42, 3)).not.toBe(deriveSeed(43, 3))
    expect(deriveSeed(42, 1, 2)).not.toBe(deriveSeed(42, 2, 1))
  })

  it('returns an unsigned 32-bit integer', () => {
    for (const s of [0, 1, 42, 4294967295]) {
      const derived = deriveSeed(s, 9)
      expect(Number.isInteger(derived)).toBe(true)
      expect(derived).toBeGreaterThanOrEqual(0)
      expect(derived).toBeLessThan(4294967296)
    }
  })

  it('still mixes the seed with no parts', () => {
    expect(deriveSeed(5)).not.toBe(5)
  })
})

describe('randomSeed', () => {
  it('gives an unsigned 32-bit integer', () => {
    const s = randomSeed()
    expect(Number.isInteger(s)).toBe(true)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThan(4294967296)
  })
})
