// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { LEVEL_COUNT } from './levels'
import {
  UNLOCKED_LEVEL_KEY,
  getStarsList,
  getUnlockedLevel,
  levelsPassed,
  parseStarsList,
  parseUnlockedLevel,
  saveLevelResult,
  starsFromList,
} from './progress'

beforeEach(() => {
  window.localStorage.clear()
})

describe('el progreso de Niveles', () => {
  it('sin nada guardado se empieza por el primero, sin estrellas', () => {
    expect(getUnlockedLevel()).toBe(1)
    expect(parseUnlockedLevel(null)).toBe(1)
    expect(parseStarsList(null).split(',')).toHaveLength(LEVEL_COUNT)
  })

  it('lo raro del almacenamiento no abre niveles que no existen', () => {
    expect(parseUnlockedLevel('99')).toBe(LEVEL_COUNT)
    expect(parseUnlockedLevel('tres')).toBe(1)
    expect(starsFromList(parseStarsList('3,7,x'), 2)).toBe(0)
  })

  it('superar el más alto abre el siguiente y apunta las estrellas, que solo suben', () => {
    expect(saveLevelResult(1, 2)).toBe(2)
    expect(window.localStorage.getItem(UNLOCKED_LEVEL_KEY)).toBe('2')
    saveLevelResult(1, 1)
    expect(starsFromList(getStarsList(), 1)).toBe(2)
    expect(saveLevelResult(1, 0)).toBe(2)
    expect(levelsPassed(getStarsList())).toBe(1)
  })
})
