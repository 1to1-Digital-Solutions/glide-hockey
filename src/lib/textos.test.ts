import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DIFFICULTY_LABELS } from './gameConfig'
import { GAME_MODE_HINTS, GAME_MODE_LABELS } from './gameMode'
import { PLAYER_LABELS } from './duel'
import { SCENERY_HINTS, SCENERY_LABELS } from './scenery'
import { CONFORT_LABELS, CONFORT_LEGEND } from './comfort'
import { plural } from './menuWords'
import { TEXT_KEYS, formatea, formatoDeCifra, texto, traductor, traductorSuave, type TextKey } from './textos'

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
      ...Object.values(CONFORT_LABELS),
      ...PLAYER_LABELS,
      CONFORT_LEGEND,
    ]
    const sinTraducir = etiquetas.filter((e) => texto('es', e) === e)

    expect(sinTraducir).toEqual([])
  })

  it('ni le falta ninguna de las que se dicen', () => {
    // El reverso del otro, y el que faltaba: aquel caza una clave declarada que ya no usa
    // nadie —molesta pero inofensiva—, y este una que **se usa y no está declarada**, que es
    // la que se ve. En bateo, `t('Fastest')` devolvía `undefined` y el marcador del reto
    // pintaba una fila con su cifra y sin nombre, solo en español.
    const fuente = codigo()
    const usadas = [...fuente.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1])
    const faltan = [...new Set(usadas)].filter(
      (clave) => !(TEXT_KEYS as readonly string[]).includes(clave),
    )

    expect(faltan).toEqual([])
  })

  it('no guarda frases que ya no dice nadie', () => {
    // Una frase cambia en el componente y la vieja se queda aquí traducida para siempre:
    // no rompe nada, y por eso nadie la quita nunca.
    const fuente = codigo()
    const huerfanas = TEXT_KEYS.filter((clave) => !fuente.includes(clave))

    expect(huerfanas).toEqual([])
  })
})

describe('las cuentas, con su plural', () => {
  it('la racha sin fin de la portada: un gol, dos goles, en los dos idiomas', () => {
    const racha = (lang: 'en' | 'es', n: number) => traductor(lang)(plural(n, '{n} goal', '{n} goals') as TextKey, { n })
    expect([racha('en', 1), racha('en', 2)]).toEqual(['1 goal', '2 goals'])
    expect([racha('es', 1), racha('es', 2)]).toEqual(['1 gol', '2 goles'])
  })
})

describe('el traductor que acepta cualquier frase', () => {
  it('traduce lo que está en el diccionario, con sus huecos', () => {
    expect(traductorSuave('es')('Back to the menu')).toBe('Volver al menú')
    expect(traductorSuave('es')('Level {level}, locked', { level: 3 })).toBe('Nivel 3, bloqueado')
    expect(traductorSuave('en')('Level {level}, locked', { level: 3 })).toBe('Level 3, locked')
  })

  it('y lo que no está —la unidad del récord, que el salón pasa ya dicha— sale tal cual', () => {
    expect(traductorSuave('es')('puntos en el reto')).toBe('puntos en el reto')
    expect(traductorSuave('en')('puntos en el reto')).toBe('puntos en el reto')
    // Ni lo que solo se llama como algo de los objetos de JavaScript.
    expect(traductorSuave('es')('toString')).toBe('toString')
  })

  it('sabe las frases del cartel del objetivo, comunes a todos los juegos', () => {
    expect(traductorSuave('es')('{missing} short of gold', { missing: 40 })).toBe('Te han faltado 40 para el oro')
    expect(traductorSuave('es')('New record!')).toBe('¡Nuevo récord!')
  })

  it('el modo que cuenta se llama Reto', () => {
    expect(traductor('es')('Challenge')).toBe('Reto')
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

describe('las cifras, en el idioma de quien juega', () => {
  it('agrupan los miles con punto en español y con coma en inglés', () => {
    expect(formatoDeCifra(12400, 'es')).toBe('12.400')
    expect(formatoDeCifra(12400, 'en')).toBe('12,400')
    expect(formatoDeCifra(1234567, 'es')).toBe('1.234.567')
    expect(formatoDeCifra(-20000, 'es')).toBe('-20.000')
    expect(formatoDeCifra(999, 'es')).toBe('999')
  })

  it('en español desde las cinco cifras, como el cartel; en inglés, desde las cuatro', () => {
    expect(formatoDeCifra(8068, 'es')).toBe('8068')
    expect(formatoDeCifra(8068, 'en')).toBe('8,068')
    expect(formatoDeCifra(9999.6, 'es')).toBe('10.000')
  })

  it('lo que no es una cifra se escribe como cero', () => {
    expect(formatoDeCifra(Number.NaN, 'es')).toBe('0')
  })

  it('y en el código no queda ningún `toLocaleString`, que escribía «8,068» en español', () => {
    const encontrados: string[] = []
    const recorrer = (dir: string) => {
      for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, entrada.name)
        if (entrada.isDirectory()) recorrer(ruta)
        else if (/\.tsx?$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)) {
          if (readFileSync(ruta, 'utf8').includes('.toLocaleString(')) encontrados.push(ruta)
        }
      }
    }
    recorrer(join(__dirname, '..'))
    expect(encontrados).toEqual([])
  })
})
