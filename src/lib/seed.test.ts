import { describe, expect, it } from 'vitest'

import { azarDesde, semillaAlAzar, semillaDe } from './semilla'

const primeros = (azar: () => number, n: number) => Array.from({ length: n }, azar)

describe('azarDesde', () => {
  it('da la misma serie con la misma semilla, que es todo el reto', () => {
    expect(primeros(azarDesde(20260925), 50)).toEqual(primeros(azarDesde(20260925), 50))
  })

  it('da series distintas con semillas distintas', () => {
    expect(primeros(azarDesde(1), 5)).not.toEqual(primeros(azarDesde(2), 5))
  })

  it('se queda en [0, 1) y reparte: cada décima recibe su parte', () => {
    const azar = azarDesde(7)
    const cajas = new Array<number>(10).fill(0)
    for (let i = 0; i < 10000; i++) {
      const x = azar()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
      cajas[Math.floor(x * 10)]++
    }
    for (const caja of cajas) expect(caja).toBeGreaterThan(850)
  })

  it('trata igual una semilla negativa o con decimales que su entero de 32 bits', () => {
    expect(azarDesde(-1)()).toBe(azarDesde(4294967295)())
  })

  it('es el mulberry32 de siempre: el primer número de la semilla 1 no cambia', () => {
    expect(azarDesde(1)()).toBeCloseTo(0.6270739405881613, 12)
  })
})

describe('semillaDe', () => {
  it('es estable y depende de cada parte', () => {
    expect(semillaDe(42, 3)).toBe(semillaDe(42, 3))
    expect(semillaDe(42, 3)).not.toBe(semillaDe(42, 4))
    expect(semillaDe(42, 3)).not.toBe(semillaDe(43, 3))
    expect(semillaDe(42, 1, 2)).not.toBe(semillaDe(42, 2, 1))
  })

  it('devuelve un entero de 32 bits sin signo', () => {
    for (const s of [0, 1, 42, 4294967295]) {
      const derivada = semillaDe(s, 9)
      expect(Number.isInteger(derivada)).toBe(true)
      expect(derivada).toBeGreaterThanOrEqual(0)
      expect(derivada).toBeLessThan(4294967296)
    }
  })

  it('sin partes sigue mezclando la semilla', () => {
    expect(semillaDe(5)).not.toBe(5)
  })
})

describe('semillaAlAzar', () => {
  it('da un entero de 32 bits sin signo', () => {
    const s = semillaAlAzar()
    expect(Number.isInteger(s)).toBe(true)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThan(4294967296)
  })
})
