import { afterEach, describe, expect, it, vi } from 'vitest'
import { setAssetsBase } from './assets'
import {
  DEFAULT_MUSIC,
  MUSIC_KEY,
  MUSIC_VOLUME,
  getMusic,
  musicUrl,
  parseMusic,
  saveMusic,
} from './music'

/**
 * La preferencia de música.
 *
 * Va aparte del silencio a propósito, y eso es lo que se prueba: que se guarda
 * en su propia clave, que se entra con música y que apagarla no toca lo demás.
 */

afterEach(() => {
  localStorage.clear()
  setAssetsBase('/')
  vi.restoreAllMocks()
})

describe('si suena la música', () => {
  it('se entra con ella puesta', () => {
    expect(DEFAULT_MUSIC).toBe(true)
    expect(parseMusic(null)).toBe(true)
    expect(getMusic()).toBe(true)
  })

  it('solo un valor la apaga; cualquier cosa rara la deja sonando', () => {
    // Lo edita quien quiera desde las herramientas del navegador: un juego que
    // se quedara mudo por un valor corrupto se lee como que está roto.
    expect(parseMusic('0')).toBe(false)
    expect(parseMusic('1')).toBe(true)
    expect(parseMusic('')).toBe(true)
    expect(parseMusic('pues no')).toBe(true)
  })

  it('se recuerda entre visitas, en su propia clave', () => {
    saveMusic(false)
    expect(localStorage.getItem(MUSIC_KEY)).toBe('0')
    expect(getMusic()).toBe(false)

    saveMusic(true)
    expect(getMusic()).toBe(true)
  })

  it('no comparte clave con el silencio: son dos decisiones', () => {
    saveMusic(false)
    expect(localStorage.getItem('air-hockey:muted')).toBeNull()
  })
})

describe('de dónde sale la música', () => {
  it('cuelga de la raíz cuando el juego se sirve solo', () => {
    expect(musicUrl()).toBe('/audio/sala.mp3')
  })

  it('y de donde diga quien lo monte dentro de otra web', () => {
    setAssetsBase('/juegos/air-hockey')
    expect(musicUrl()).toBe('/juegos/air-hockey/audio/sala.mp3')
  })

  it('suena de fondo, no por encima de la partida', () => {
    expect(MUSIC_VOLUME).toBeGreaterThan(0)
    expect(MUSIC_VOLUME).toBeLessThan(0.4)
  })
})
