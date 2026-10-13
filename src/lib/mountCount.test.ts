import { afterEach, describe, expect, it } from 'vitest'
import { apuntarProgramas, contarMontaje, isMontajesRequested } from './montajes'

afterEach(() => {
  delete window.__montajes
  delete window.__programas
})

describe('contar montajes', () => {
  it('no cuenta nada si nadie lo ha pedido', () => {
    expect(isMontajesRequested()).toBe(false)
    contarMontaje('mundo')
    expect(window.__montajes).toBeUndefined()
  })

  it('y cuenta cada vez, por separado, si se pide', () => {
    window.__montajes = {}
    expect(isMontajesRequested()).toBe(true)

    contarMontaje('mundo')
    contarMontaje('mundo')
    contarMontaje('escena')

    expect(window.__montajes).toEqual({ mundo: 2, escena: 1 })
  })
})

describe('apuntar los programas compilados', () => {
  it('tampoco apunta nada si nadie lo ha pedido', () => {
    apuntarProgramas(21)
    expect(window.__programas).toBeUndefined()
  })

  it('y apunta el último número si se pide', () => {
    window.__montajes = {}
    apuntarProgramas(18)
    apuntarProgramas(21)
    expect(window.__programas).toBe(21)
  })
})
