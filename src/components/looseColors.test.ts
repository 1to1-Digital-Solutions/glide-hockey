import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PALETTE } from '../lib/palette'
import { contrast, COMMON_PALETTE } from '../lib/commonPalette'

/**
 * Que ningún color que **signifique algo** se escriba suelto en la interfaz.
 *
 * Acierto, fallo, aviso, récord y lo apuntado tienen que verse igual en todo el salón, y por eso
 * salen de la paleta común (`lib/paleta.ts`). Un literal escrito a mano en un marcador o en un
 * panel es justo como se desvían sin que nadie lo decida: un rojo «parecido» aquí, otro allá, y el
 * salón vuelve a ser dieciséis juegos sueltos.
 *
 * No es un grep de todo el juego: el escenario —la sala, la mesa, los neones— tiene sus colores y
 * son suyos. Se vigila **la interfaz**: las carpetas donde vive lo que se lee (los paneles del
 * visor y las pantallas de la web) y los ficheros de fuera que pintan un marcador. Lo que haya ahí
 * tiene que salir de la paleta común o de la del juego (`lib/palette.ts`); un literal nuevo obliga
 * a decidir cuál de las dos es.
 */

const RAIZ = process.cwd()

/** Las carpetas de la interfaz: todo lo que entre en ellas queda vigilado sin apuntarlo. */
const CARPETAS = ['src/components/ui', 'src/components/xr']

/** Lo que pinta significado fuera de esas carpetas. */
const FICHEROS: string[] = [
  // Ninguno: en la mesa, fuera de la interfaz, nada dice acierto o fallo. El cian y el
  // rojo de los mazos y de las porterías dicen de quién es cada cosa, y eso es del juego.
]

/**
 * Lo vigilado que puede llevar un literal, y por qué.
 *
 * Cada entrada tiene que seguir haciendo falta: si el fichero deja de tener literales, sobra aquí
 * y el test lo dice.
 */
const EXCEPCIONES: Record<string, string> = {
  'src/components/xr/RealController.tsx':
    'Es el mismo fichero en todos los juegos (`comunes.py`): su marca amarilla es la de las ' +
    'ayudas (`lib/ayudas.ts`, también común) y se cambia en todos a la vez, no desde un juego.',
}

/** Un color escrito a mano: hexadecimal, `rgb()`/`hsl()`, entero de three o clase de Tailwind. */
const LITERAL =
  /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b0x[0-9a-f]{6}\b|\b(?:text|bg|border|ring|fill|stroke|from|to|via|outline|shadow)-(?:red|green|emerald|lime|amber|yellow|orange|rose|sky|cyan|teal|blue|pink|fuchsia|purple|violet|indigo)-\d{2,3}\b/i

/** El código sin comentarios: un color citado en una explicación no es un color pintado. */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** Los ficheros de código de una carpeta, sin los tests. */
function codigoDe(carpeta: string): string[] {
  return readdirSync(join(RAIZ, carpeta)).flatMap((nombre) => {
    const ruta = `${carpeta}/${nombre}`
    if (statSync(join(RAIZ, ruta)).isDirectory()) return codigoDe(ruta)
    return /\.(ts|tsx)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : []
  })
}

function literalesDe(ruta: string): string[] {
  return sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'))
    .split('\n')
    .flatMap((linea, i) => (LITERAL.test(linea) ? [`${ruta}:${i + 1}: ${linea.trim()}`] : []))
}

const VIGILADOS = [...CARPETAS.flatMap(codigoDe), ...FICHEROS]

describe('los colores sueltos de la interfaz', () => {
  it('lo vigilado existe: un fichero que se mueve no puede salirse de la vigilancia en silencio', () => {
    for (const ruta of [...CARPETAS, ...FICHEROS]) expect(existsSync(join(RAIZ, ruta)), ruta).toBe(true)
    expect(VIGILADOS.length).toBeGreaterThan(5)
  })

  it('ningún color escrito a mano en lo que se lee: sale de la paleta o de una constante con nombre', () => {
    const sueltos = VIGILADOS.filter((ruta) => !(ruta in EXCEPCIONES)).flatMap(literalesDe)
    expect(sueltos).toEqual([])
  })

  it('cada excepción está vigilada y sigue haciendo falta', () => {
    for (const ruta of Object.keys(EXCEPCIONES)) {
      expect(VIGILADOS, ruta).toContain(ruta)
      expect(literalesDe(ruta), ruta).not.toEqual([])
    }
  })

  it('reconoce un color suelto en cualquiera de sus formas, y no uno citado en un comentario', () => {
    for (const suelto of ["'#c2452d'", 'rgba(0, 0, 0, 0.5)', 'hsl(0 50% 50%)', '0xff0000', 'text-red-500'])
      expect(LITERAL.test(suelto), suelto).toBe(true)
    expect(LITERAL.test(sinComentarios('const a = PALETA.fallo // y no #c2452d'))).toBe(false)
    expect(LITERAL.test(sinComentarios('/* el rojo #c2452d */ const a = 1'))).toBe(false)
    expect(LITERAL.test("fetch('https://example.com')")).toBe(false)
  })
})

describe('los colores comunes sobre los paneles de la sala', () => {
  // La paleta comprueba sus colores sobre el fondo del salón; los paneles de este juego son del
  // azul de la sala y los botones del de las bandas, y es sobre ellos donde se pintan el final,
  // las estrellas y el récord.
  it.each([PALETTE.background, PALETTE.rail])('se leen sobre %s (4,5:1)', (panel) => {
    for (const nombre of ['hit', 'miss', 'warning', 'gold', 'accent', 'mutedText'] as const) {
      expect(contrast(COMMON_PALETTE[nombre], panel), nombre).toBeGreaterThanOrEqual(4.5)
    }
  })
})
