import { describe, expect, it } from 'vitest'
import { MENU_EN, MENU_ES, plural } from './palabras'
import { TEXT_KEYS, texto, type TextKey } from './textos'

/**
 * Las palabras comunes del salón, dichas igual en todos los juegos.
 *
 * Es el mismo fichero en todos: el diccionario del juego puede no usar alguna, pero la que use
 * tiene que decirla como las demás cabinas.
 */

describe('las frases comunes del menú', () => {
  it('cada una tiene su traducción, y son las de siempre', () => {
    for (const frase of Object.values(MENU_EN)) expect(MENU_ES[frase]).toBeTruthy()
    expect(MENU_ES['Another challenge']).toBe('Otro reto')
    expect(MENU_ES.Duel).toBe('Duelo')
    expect(MENU_ES['Hold B or Y to exit']).toBe('Mantén B o Y para salir')
  })

  it('el juego que usa una la dice como el salón', () => {
    const distintas = TEXT_KEYS.filter((clave) => clave in MENU_ES).flatMap((clave) => {
      const comun = MENU_ES[clave as keyof typeof MENU_ES]
      return texto('es', clave as TextKey) === comun ? [] : [`${clave}: «${texto('es', clave as TextKey)}», no «${comun}»`]
    })

    expect(distintas).toEqual([])
  })
})

describe('el plural', () => {
  it('solo el uno va en singular, en los dos idiomas', () => {
    expect(plural(1, '{n} basket', '{n} baskets')).toBe('{n} basket')
    expect(plural(2, '{n} basket', '{n} baskets')).toBe('{n} baskets')
    expect(plural(0, '{n} basket', '{n} baskets')).toBe('{n} baskets')
  })
})
