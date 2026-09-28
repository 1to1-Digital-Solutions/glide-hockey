import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { XRCADE_CONTRACT, type XrcadeCapability } from './ajustes'

/**
 * **Lo que este juego declara que lee del salón es lo que su código lee de verdad.**
 *
 * El salón decide qué ajustes enseñar para cada cabina, y qué exigir al publicar, con lo que el
 * juego declara en su `package.json` (`xrcade.capabilities`): lo importa del paquete instalado y
 * no busca texto en él. Así que la declaración tiene que ser verdad en los dos sentidos. Una
 * capacidad que se declara y no se usa promete un ajuste que en esta cabina no hace nada; una que
 * se usa y no se declara deja al salón escondiendo un ajuste que sí cuenta.
 *
 * **Cómo se sabe qué usa.** Se recorren los `import` desde el punto de entrada del paquete
 * (`src/game/index.ts`), que es lo que el salón monta, y se mira si algún fichero alcanzable llama
 * a la lectura de cada ajuste. `ajustes.ts` y `ajustesCliente.ts` no cuentan: los definen todos,
 * y son el mismo fichero en los diecisiete. Tampoco los comentarios, que hablan de ajustes sin
 * leerlos. La web del propio juego (`src/app`) no se monta en el salón y no cuenta.
 *
 * Es el mismo fichero en los diecisiete (`organizate/scripts/repos/comunes.py`).
 */

const RAIZ = process.cwd()

/** Con qué se lee cada ajuste: los ganchos de `ajustesCliente.ts` y las lecturas de `ajustes.ts`. */
const LECTURAS: Record<XrcadeCapability, RegExp> = {
  lang: /\b(useLang|langFromCookies)\b/,
  volumes: /\b(useVolumes|readVolumes)\b/,
  scenery: /\b(useScenery|readScenery)\b/,
  playHeight: /\b(usePlayHeight|readPlayHeight)\b/,
  playHeightOffset: /\b(usePlayHeightOffset|readPlayHeightOffset)\b/,
  grab: /\b(useGrabMode|readGrabMode)\b/,
  turn: /\b(useTurnMode|readTurnMode)\b/,
  hand: /\b(useHand|readHand)\b/,
}

/** Los que definen las lecturas: los tienen todos, así que no dicen nada de este juego. */
const DEFINEN = new Set(['src/lib/ajustes.ts', 'src/lib/ajustesCliente.ts'])

const IMPORTS = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g

function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1')
}

/** El fichero al que apunta un `import` del propio juego, o `null` si es de un paquete. */
function resolver(desde: string, especificador: string): string | null {
  let base: string
  if (especificador.startsWith('@/')) base = join(RAIZ, 'src', especificador.slice(2))
  else if (especificador.startsWith('.')) base = normalize(join(dirname(desde), especificador))
  else return null
  const candidatos = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]
  return candidatos.find((ruta) => /\.tsx?$/.test(ruta) && existsSync(ruta)) ?? null
}

/** El código de todo lo que se monta en el salón, sin comentarios, por ruta relativa. */
function alcanzable(): Map<string, string> {
  const codigo = new Map<string, string>()
  const pendientes = [join(RAIZ, 'src', 'game', 'index.ts')]
  while (pendientes.length > 0) {
    const fichero = pendientes.pop()!
    const ruta = relative(RAIZ, fichero)
    if (codigo.has(ruta)) continue
    const fuente = sinComentarios(readFileSync(fichero, 'utf8'))
    codigo.set(ruta, fuente)
    for (const m of fuente.matchAll(IMPORTS)) {
      const destino = resolver(fichero, m[1] ?? m[2] ?? m[3])
      if (destino !== null) pendientes.push(destino)
    }
  }
  return codigo
}

function usadas(): XrcadeCapability[] {
  const codigo = [...alcanzable()].filter(([ruta]) => !DEFINEN.has(ruta)).map(([, fuente]) => fuente)
  return XRCADE_CONTRACT.capabilities.filter((c) => codigo.some((fuente) => LECTURAS[c].test(fuente)))
}

const paquete = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as {
  xrcade?: { capabilities?: unknown }
}
const declaradas = paquete.xrcade?.capabilities

describe('el contrato con el salón', () => {
  it('tiene número y una lectura por capacidad', () => {
    expect(Number.isInteger(XRCADE_CONTRACT.version)).toBe(true)
    expect(Object.keys(LECTURAS).sort()).toEqual([...XRCADE_CONTRACT.capabilities].sort())
  })

  it('el package.json declara sus capacidades, sin repetir y del contrato', () => {
    expect(Array.isArray(declaradas), 'falta "xrcade": { "capabilities": [...] } en package.json').toBe(true)
    const lista = declaradas as string[]
    expect(new Set(lista).size).toBe(lista.length)
    for (const c of lista) expect(XRCADE_CONTRACT.capabilities as readonly string[]).toContain(c)
  })

  it('declara justo lo que su escena lee: ni una de más ni una de menos', () => {
    const lista = [...((declaradas as string[] | undefined) ?? [])].sort()
    expect(lista).toEqual([...usadas()].sort())
  })

  it('el recorrido encuentra la escena de verdad, no pasa en vacío', () => {
    // Sin esto, un punto de entrada movido dejaría un recorrido de un fichero y un «no usa nada».
    expect(alcanzable().size).toBeGreaterThan(10)
  })
})
