import { describe, expect, it } from 'vitest'

import { MUSIC_FADE_MS, fadeVolume } from './musicFade'

/**
 * El fundido de la música.
 *
 * Se prueba aquí porque es aritmética; que no se oiga el corte ya es de escucharlo. Lo que
 * esto vigila es que la rampa empiece donde estaba, acabe donde se pidió y no se salga por
 * el camino: un volumen por encima de lo elegido es la música tapando el juego.
 */
describe('la rampa del fundido', () => {
  it('empieza donde estaba y acaba donde se pidió', () => {
    expect(fadeVolume(0, 0.22, 0)).toBe(0)
    expect(fadeVolume(0, 0.22, 1)).toBe(0.22)
  })

  it('un reloj que se pasa no sube la música por encima de lo elegido', () => {
    expect(fadeVolume(0, 0.22, 4)).toBe(0.22)
    expect(fadeVolume(0.22, 0, -1)).toBe(0.22)
  })

  it('arranca y termina suave, que es lo que hace que no se note', () => {
    // Una rampa recta valdría 0,11 a la mitad y se oiría el arranque y el frenazo.
    expect(fadeVolume(0, 0.22, 0.1)).toBeLessThan(0.022)
    expect(fadeVolume(0, 0.22, 0.9)).toBeGreaterThan(0.198)
  })

  it('a la mitad va por la mitad', () => {
    expect(fadeVolume(0, 0.22, 0.5)).toBeCloseTo(0.11, 6)
  })

  it('vale para los dos sentidos', () => {
    expect(fadeVolume(0.22, 0, 0.5)).toBeCloseTo(0.11, 6)
  })

  it('un reloj roto deja el volumen donde está', () => {
    expect(fadeVolume(0.22, 0, Number.NaN)).toBe(0.22)
  })

  it('dura lo bastante para no oírse y lo bastante poco para no estorbar', () => {
    expect(MUSIC_FADE_MS).toBeGreaterThan(300)
    expect(MUSIC_FADE_MS).toBeLessThan(1500)
  })
})
