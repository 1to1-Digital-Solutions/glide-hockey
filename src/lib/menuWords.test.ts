import { describe, expect, it } from 'vitest'
import { MENU_EN, MENU_ES, plural } from './menuWords'
import { TEXT_KEYS, texto, type TextKey } from './textos'

/**
 * The hall's common words, said the same way in every game.
 *
 * It is the same file in all of them: the game's dictionary may not use some of them, but the one
 * it does use has to say it like the other cabinets.
 */

describe('the common phrases of the menu', () => {
  it('each one has its translation, and they are the usual ones', () => {
    for (const phrase of Object.values(MENU_EN)) expect(MENU_ES[phrase]).toBeTruthy()
    expect(MENU_ES['Another challenge']).toBe('Otro reto')
    expect(MENU_ES.Duel).toBe('Duelo')
    expect(MENU_ES['Hold B or Y to exit']).toBe('Mantén B o Y para salir')
  })

  it('the game that uses one says it like the hall', () => {
    const different = TEXT_KEYS.filter((key) => key in MENU_ES).flatMap((key) => {
      const common = MENU_ES[key as keyof typeof MENU_ES]
      return texto('es', key as TextKey) === common ? [] : [`${key}: «${texto('es', key as TextKey)}», not «${common}»`]
    })

    expect(different).toEqual([])
  })
})

describe('the plural', () => {
  it('only one is singular, in both languages', () => {
    expect(plural(1, '{n} basket', '{n} baskets')).toBe('{n} basket')
    expect(plural(2, '{n} basket', '{n} baskets')).toBe('{n} baskets')
    expect(plural(0, '{n} basket', '{n} baskets')).toBe('{n} baskets')
  })
})
