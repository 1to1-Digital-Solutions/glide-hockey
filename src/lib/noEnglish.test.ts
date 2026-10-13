import { describe, expect, it } from 'vitest'
import { SOLO_INGLES, frasesEnIngles } from './sinIngles'
import { TEXT_KEYS, texto } from './textos'

/**
 * Nada en inglés en la versión española.
 *
 * Es el mismo fichero en todos los juegos: prueba el detector y repasa el diccionario del juego
 * entero. Lo que se escribe a mano en un componente sin pasar por `t()` no está en el diccionario,
 * y eso lo caza el test de cada juego que pinta su portada, su marcador y su resumen en español
 * (`sinIngles.es.test.tsx`), con este mismo detector.
 */

describe('el detector', () => {
  it('caza las palabras sueltas que solo son inglés, como se escribieron', () => {
    expect(frasesEnIngles('Reto · Fácil · round 1')).toEqual(['round'])
    expect(frasesEnIngles('6 of 9 · Racha ×4')).toEqual(['of'])
    expect(frasesEnIngles('Streak ×4')).toEqual(['Streak'])
    expect(frasesEnIngles('Te has quedado sin vidas')).toEqual([])
  })

  it('caza una frase entera del diccionario, antes que sus palabras', () => {
    const claves = [
      ['Out of lives', 'Sin vidas'],
      ['Batting Cage', 'Batting Cage'],
    ] as const

    expect(frasesEnIngles('Out of lives · 3 / 13', claves)).toEqual(['Out of lives', 'of', 'Out', 'lives'])
    // El nombre propio se queda igual en los dos idiomas: no es una frase sin traducir.
    expect(frasesEnIngles('Batting Cage', claves)).toEqual([])
  })

  it('no confunde un trozo de palabra ni lo que lleva tilde con el inglés', () => {
    expect(frasesEnIngles('Volver al menú · tu récord · éxito · Ofertas')).toEqual([])
    expect(frasesEnIngles('Récord: 12', [['Hit', 'Bateada']])).toEqual([])
    expect(frasesEnIngles('Hit!', [['Hit', 'Bateada']])).toEqual(['Hit'])
  })

  it('las frases con huecos solo se miran por lo que dicen, no por el nombre del hueco', () => {
    expect(frasesEnIngles('Tu récord {record} · llevas {score}')).toEqual([])
    expect(frasesEnIngles('{n} of {total}', [['{n} of {total}', '{n} de {total}']])).toEqual(['of'])
  })

  it('cada palabra de la lista es inglés y nada más: en minúsculas y sin repetir', () => {
    expect(new Set(SOLO_INGLES).size).toBe(SOLO_INGLES.length)
    for (const palabra of SOLO_INGLES) expect(palabra).toMatch(/^[a-z]+$/)
  })
})

describe('el diccionario del juego', () => {
  it('ninguna frase en español lleva una palabra que solo es inglés', () => {
    const conIngles = TEXT_KEYS.flatMap((clave) => {
      const halladas = frasesEnIngles(texto('es', clave))
      return halladas.length === 0 ? [] : [`${clave} → ${texto('es', clave)}: ${halladas.join(', ')}`]
    })

    expect(conIngles).toEqual([])
  })
})
