import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MUTED,
  MUTED_KEY,
  getMuted,
  getServerMuted,
  parseMuted,
  saveMuted,
} from './muted'

describe('parseMuted', () => {
  it('solo un valor significa silencio', () => {
    expect(parseMuted('1')).toBe(true)
  })

  it('cualquier otra cosa deja el juego como se entra', () => {
    // Lo escrito por el juego, lo que no hay todavía y lo que puede haber
    // dejado ahí quien edite el almacenamiento a mano.
    for (const raw of [null, '', '0', 'true', 'sí', '11']) {
      expect(parseMuted(raw)).toBe(DEFAULT_MUTED)
    }
  })
})

describe('saveMuted', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('se entra con el juego sonando, también al prerenderizar', () => {
    expect(getMuted()).toBe(DEFAULT_MUTED)
    expect(getServerMuted()).toBe(DEFAULT_MUTED)
  })

  it('recuerda el silencio entre visitas', () => {
    saveMuted(true)

    expect(window.localStorage.getItem(MUTED_KEY)).toBe('1')
    expect(getMuted()).toBe(true)
  })

  it('recuerda también haberlo vuelto a encender', () => {
    saveMuted(true)
    saveMuted(false)

    expect(window.localStorage.getItem(MUTED_KEY)).toBe('0')
    expect(getMuted()).toBe(false)
  })
})
