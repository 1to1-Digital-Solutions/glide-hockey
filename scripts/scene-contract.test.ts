// @vitest-environment node

/**
 * Que la escena que se publica siga siendo una escena.
 *
 * `AirHockeyScene` es lo que el salón de xrcade monta dentro de su propio
 * Canvas y de su propia sesión de WebXR. El contrato dice que desde ahí no se
 * puede crear un `<Canvas>`, ni un `<XR>`, ni un `<XROrigin>`, ni pintar una
 * sola etiqueta de DOM (ver `docs/xrcade.md`).
 *
 * Romperlo **no rompe el build ni ningún test de aquí**: la web del juego trae
 * su Canvas y sigue funcionando igual. Se descubriría montándolo en el salón,
 * con la sesión del anfitrión cerrándose al entrar o con un `<div>` intentando
 * pintarse dentro de un Canvas. Por eso se comprueba sobre el código: se
 * recorren los imports desde la entrada de la escena y se mira qué usa.
 */

import { readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const sceneEntry = join(projectRoot, 'src/game/AirHockeyScene.tsx')

const SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*(['"])([^'"]+)\1/g
const RESOLUTION_ORDER = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

function existsAsFile(candidate: string): boolean {
  try {
    return statSync(candidate).isFile()
  } catch {
    return false
  }
}

function resolveRelative(from: string, specifier: string): string | null {
  const base = join(dirname(from), specifier)
  for (const suffix of RESOLUTION_ORDER) {
    const candidate = `${base}${suffix}`
    if (existsAsFile(candidate)) return candidate
  }
  return null
}

/** Los módulos del proyecto a los que se llega desde la escena. */
function reachableFromScene(): string[] {
  const seen = new Set<string>()
  const pending = [sceneEntry]

  while (pending.length > 0) {
    const file = pending.pop()
    if (file == null || seen.has(file)) continue
    seen.add(file)
    if (!/\.tsx?$/.test(file)) continue

    for (const [, , specifier] of readFileSync(file, 'utf8').matchAll(
      SPECIFIER,
    )) {
      if (!specifier.startsWith('.')) continue
      const resolved = resolveRelative(file, specifier)
      if (resolved != null) pending.push(resolved)
    }
  }

  return [...seen]
}

/**
 * El código sin sus comentarios.
 *
 * Media docena de módulos explican en prosa por qué **no** ponen un `<Canvas>`
 * ni un `<XROrigin>`, y buscar sobre el fuente en bruto convertía justo esas
 * explicaciones en el fallo que describen. Se quitan los bloques `/* … *\/`
 * —que es también la forma de los comentarios dentro del JSX— y las líneas de
 * `//`.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

/** Qué módulos alcanzables usan de verdad alguno de estos fragmentos. */
function usedBy(patterns: RegExp[]): string[] {
  return reachableFromScene()
    .filter((file) => {
      const source = withoutComments(readFileSync(file, 'utf8'))
      return patterns.some((pattern) => pattern.test(source))
    })
    .map((file) => relative(projectRoot, file))
}

describe('la escena que monta el anfitrión', () => {
  it('llega a más de un módulo, o no se estaría comprobando nada', () => {
    expect(reachableFromScene().length).toBeGreaterThan(5)
  })

  it('no crea Canvas, sesión ni origen: son del anfitrión', () => {
    // `<XR[\\s>]` y no `<XR\\b`: `<XRMenu` y `<XRScoreboard` son la interfaz
    // inmersiva del juego, que sí es suya.
    expect(usedBy([/<Canvas[\s>]/, /<XR[\s>]/, /<XROrigin[\s>]/])).toEqual([])
  })

  it('no abre ni cierra la sesión inmersiva por su cuenta', () => {
    // `endXrSession` sí se alcanza, y debe: es lo que significa «salir» cuando
    // el juego es su propia web (ver `game/exit.tsx`). Lo que no puede haber es
    // una llamada a entrar, que arrancaría una sesión dentro de la del salón.
    expect(usedBy([/\benterVR\s*\(/, /\benterAR\s*\(/])).toEqual([])
  })

  it('no pinta DOM: dentro de un Canvas solo caben objetos de three', () => {
    expect(usedBy([/<(?:div|main|button|p|span|header|section)\b/])).toEqual([])
  })
})
