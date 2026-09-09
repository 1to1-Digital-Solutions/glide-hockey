import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DIFFICULTY_LABELS } from './gameConfig'
import { GAME_MODE_HINTS, GAME_MODE_LABELS } from './gameMode'
import { SCENERY_HINTS, SCENERY_LABELS } from './scenery'
import { TEXT_KEYS, formatea, texto, traductor } from './textos'

/**
 * El diccionario del juego.
 *
 * Que las claves existan lo comprueba TypeScript —salen del propio objeto—, así que aquí
 * se mira lo que el tipo no ve: que en inglés se devuelva el original sin guardarlo dos
 * veces, que las etiquetas que vienen de los mapas de configuración estén traducidas, y
 * que no sobre ninguna frase. Los dos últimos son los que se rompen solos: se añade una
 * dificultad y nadie se acuerda; se cambia una frase en el componente y la vieja se queda
 * aquí para siempre.
 */
const SRC = join(import.meta.dirname, '..')

/** Todo el código del juego, para buscar en él lo que el diccionario dice saber. */
function codigo(carpeta = ''): string {
  return readdirSync(join(SRC, carpeta), { withFileTypes: true })
    .map((entrada) => {
      const ruta = join(carpeta, entrada.name)
      if (entrada.isDirectory()) return codigo(ruta)
      if (!/\.tsx?$/.test(entrada.name) || /\.test\.tsx?$/.test(entrada.name)) return ''
      if (entrada.name === 'textos.ts') return ''
      return readFileSync(join(SRC, ruta), 'utf8')
    })
    .join('\n')
}

describe('el diccionario', () => {
  it('en inglés devuelve la propia clave', () => {
    expect(texto('en', 'Back to the menu')).toBe('Back to the menu')
    expect(texto('en', 'Play')).toBe('Play')
  })

  it('en español traduce', () => {
    expect(texto('es', 'Back to the menu')).toBe('Volver al menú')
    expect(traductor('es')('Play')).toBe('Jugar')
  })

  it('traduce todas las etiquetas de los mapas de configuración', () => {
    // Si un modo, una dificultad o un escenario gana una entrada y no se traduce, esto
    // cae antes de que nadie vea el juego a medias en español.
    const etiquetas = [
      ...Object.values(GAME_MODE_LABELS),
      ...Object.values(GAME_MODE_HINTS),
      ...Object.values(DIFFICULTY_LABELS),
      ...Object.values(SCENERY_LABELS),
      ...Object.values(SCENERY_HINTS),
    ]
    const sinTraducir = etiquetas.filter((e) => texto('es', e) === e)

    expect(sinTraducir).toEqual([])
  })

  it('no guarda frases que ya no dice nadie', () => {
    // Una frase cambia en el componente y la vieja se queda aquí traducida para siempre:
    // no rompe nada, y por eso nadie la quita nunca.
    const fuente = codigo()
    const huerfanas = TEXT_KEYS.filter((clave) => !fuente.includes(clave))

    expect(huerfanas).toEqual([])
  })
})

describe('los huecos de una frase', () => {
  it('se rellenan por nombre, no por orden', () => {
    // Por orden, el español tendría que fingir la sintaxis inglesa para que los huecos
    // cayeran donde toca.
    expect(formatea('{a} de {b}', { b: 2, a: 1 })).toBe('1 de 2')
  })

  it('deja en paz un hueco que nadie rellena', () => {
    // Antes eso que reventar por una frase a medias: se ve el hueco y se arregla, en vez
    // de pintar «undefined» en mitad del marcador.
    expect(formatea('{a} de {b}', { a: 1 })).toBe('1 de {b}')
  })

  it('llega hasta el traductor', () => {
    expect(traductor('es')('Level {level}, locked', { level: 3 })).toBe('Nivel 3, bloqueado')
    expect(traductor('en')('Level {level}, locked', { level: 3 })).toBe('Level 3, locked')
  })
})
