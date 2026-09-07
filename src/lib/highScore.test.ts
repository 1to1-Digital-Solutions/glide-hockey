import { beforeEach, describe, expect, it } from 'vitest'
import {
  HIGH_SCORE_KEYS,
  getBestEndlessStreak,
  getBestPoints,
  parseBestPoints,
  saveBestEndlessStreak,
  saveBestPoints,
} from './highScore'

beforeEach(() => {
  window.localStorage.clear()
})

describe('lo que se lee del navegador', () => {
  it('sin nada guardado no hay récord', () => {
    expect(parseBestPoints(null)).toBe(0)
    expect(parseBestPoints('   ')).toBe(0)
  })

  it('descarta lo que alguien haya podido escribir a mano', () => {
    expect(parseBestPoints('mucho')).toBe(0)
    expect(parseBestPoints('-40')).toBe(0)
    expect(parseBestPoints('12.5')).toBe(0)
  })

  it('acepta un entero', () => {
    expect(parseBestPoints('1200')).toBe(1200)
  })
})

describe('guardar el récord', () => {
  it('solo escribe si mejora lo que había', () => {
    saveBestPoints('practice', 500)
    saveBestPoints('practice', 300)

    expect(getBestPoints('practice')).toBe(500)
  })

  it('lleva un récord por modo', () => {
    saveBestPoints('practice', 500)

    expect(getBestPoints('challenge')).toBe(0)
    expect(window.localStorage.getItem(HIGH_SCORE_KEYS.challenge)).toBeNull()
  })

  it('no guarda una puntuación imposible', () => {
    saveBestPoints('practice', Number.NaN)

    expect(getBestPoints('practice')).toBe(0)
  })
})

describe('la racha de la partida sin fin', () => {
  it('solo se guarda si mejora la que había', () => {
    saveBestEndlessStreak(5)
    saveBestEndlessStreak(3)

    expect(getBestEndlessStreak()).toBe(5)
  })

  it('una racha imposible no se guarda', () => {
    // Llega de la partida, pero también de lo guardado, que se edita a mano.
    saveBestEndlessStreak(5)
    for (const streak of [0, -1, 2.5, Number.NaN]) saveBestEndlessStreak(streak)

    expect(getBestEndlessStreak()).toBe(5)
  })
})
