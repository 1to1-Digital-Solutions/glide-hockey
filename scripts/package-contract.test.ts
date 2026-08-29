// @vitest-environment node

/**
 * Que el paquete publicado lleve dentro lo que hace falta para montarlo.
 *
 * `files` decide qué sube a npm, y lo que se deje fuera no falla al empaquetar
 * ni al construir: falla en la aplicación que instala el juego, que importa un
 * módulo que no está o sirve unos ficheros que nunca llegaron.
 *
 * El resto del `package.json` —`exports`, `peerDependencies`, `sideEffects`—
 * lo valida `npm run catalog:validate` desde xrcade al dar de alta el juego
 * (ver `docs/xrcade.md`). Aquí se comprueba lo que aquel no puede saber: que
 * las rutas que declara existen de verdad dentro del paquete, y que la entrada
 * llega con todo lo que importa detrás — que es lo que de verdad decide si el
 * anfitrión puede montarlo.
 */

import { execFile } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

interface PackageManifest {
  exports: Record<string, string>
  bin: Record<string, string>
  peerDependencies: Record<string, string>
  dependencies?: Record<string, string>
}

/** Los ficheros que subirían a npm, según lo que declara `files`. */
function packedFiles(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile(
      'npm',
      ['pack', '--dry-run', '--json'],
      { cwd: projectRoot },
      (error, stdout) => {
        if (error != null) {
          reject(error)
          return
        }
        const [tarball] = JSON.parse(stdout) as { files: { path: string }[] }[]
        resolve(tarball.files.map((file) => file.path))
      },
    )
  })
}

/**
 * Módulos que un fichero fuente pide por su nombre: `from '…'`, un import
 * suelto por sus efectos, un `import('…')` diferido o un `require('…')`.
 */
const SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*(['"])([^'"]+)\1/g

/** Sufijos que prueba un empaquetador al resolver una ruta relativa. */
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

/**
 * Todos los ficheros del propio proyecto a los que se llega desde unas entradas,
 * siguiendo sus imports relativos.
 *
 * Los que van por su nombre a secas (`three`, `react`) son los de
 * `peerDependencies` y los pone el anfitrión, así que aquí no cuentan. Un
 * especificador relativo que no resuelva se ignora en vez de fallar: eso ya lo
 * caza el typecheck, y aquí solo se pregunta por lo que se publica.
 */
function reachableFrom(entries: string[]): string[] {
  const seen = new Set<string>()
  const pending = [...entries]

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

/** Rutas relativas de todos los ficheros que hay bajo un directorio. */
async function filesIn(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort()
}

let packed: string[]
let manifest: PackageManifest

beforeAll(async () => {
  ;[packed, manifest] = await Promise.all([
    packedFiles(),
    readFile(join(projectRoot, 'package.json'), 'utf8').then(
      (raw) => JSON.parse(raw) as PackageManifest,
    ),
  ])
  // Empaquetar arranca npm entero: en una máquina fría se pasa de los cinco
  // segundos por defecto sin que nada vaya mal.
}, 120_000)

describe('el paquete que se publica', () => {
  it('lleva dentro todo lo que apunta `exports`', () => {
    const targets = Object.values(manifest.exports).map((target) =>
      target.replace(/^\.\//, ''),
    )

    expect(targets.length).toBeGreaterThan(0)
    expect(targets.filter((target) => !packed.includes(target))).toEqual([])
  })

  it('lleva dentro los módulos que esa entrada importa, no solo la entrada', () => {
    // Publicar el punto de entrada sin lo que hay debajo no falla al empaquetar
    // ni al construir aquí: falla al instalarlo, importando un módulo que no
    // subió. Y no hace falta borrar `src/lib` de `files` para provocarlo: basta
    // con que el juego importe algo de `src/app`, que es de la web y no viaja.
    const entries = Object.values(manifest.exports)
      .map((target) => join(projectRoot, target.replace(/^\.\//, '')))
      .filter((target) => /\.tsx?$/.test(target))

    const reachable = reachableFrom(entries).map((file) =>
      relative(projectRoot, file),
    )

    // Si el rastreo dejara de seguir imports, se quedaría en las entradas y
    // pasaría sin comprobar nada.
    expect(reachable.length).toBeGreaterThan(entries.length)
    expect(reachable.filter((file) => !packed.includes(file))).toEqual([])
  })

  it('lleva dentro el ejecutable que copia los ficheros estáticos', () => {
    const targets = Object.values(manifest.bin).map((target) =>
      target.replace(/^\.\//, ''),
    )

    expect(targets.length).toBeGreaterThan(0)
    expect(targets.filter((target) => !packed.includes(target))).toEqual([])
  })

  it('lleva dentro los ficheros estáticos que ese ejecutable copia', async () => {
    // El ejecutable lee de `public/` dentro del paquete instalado: lo que no
    // suba a npm no está ahí, y `air-hockey-assets` se para diciendo que el
    // paquete llegó incompleto (ver `copy-assets.test.ts`).
    const assets = (await filesIn(join(projectRoot, 'public'))).map(
      (file) => `public/${file}`,
    )

    expect(assets.length).toBeGreaterThan(0)
    expect(assets.filter((asset) => !packed.includes(asset))).toEqual([])
  })

  it('no lleva los tests, que no le sirven a quien lo monta', () => {
    expect(packed.filter((file) => /\.test\.tsx?$/.test(file))).toEqual([])
  })

  it('deja React y three al anfitrión, nunca en `dependencies`', () => {
    // Dos copias de React rompen los hooks y dos de three, la escena. Es el
    // fallo caro porque no rompe el build: rompe la partida.
    const shared = ['react', 'react-dom', 'three', '@react-three/fiber']

    for (const paquete of shared) {
      expect(manifest.peerDependencies).toHaveProperty(paquete)
      expect(manifest.dependencies ?? {}).not.toHaveProperty(paquete)
    }
  })
})
