// @vitest-environment node

/**
 * Lo que `npx glide-hockey-assets` deja en el `public/` de quien monta el juego.
 *
 * Vive aquí, junto al ejecutable, porque el typecheck no mira dentro de un
 * `.mjs` y el lint solo comprueba su sintaxis: sin estos tests, que la copia
 * llegue completa no lo vigila nada. Y llegar incompleta no rompe el build: se
 * nota en el visor y tarde, con el jugador sin mandos y sin explicación.
 *
 * Se ejecuta el ejecutable de verdad, en un proceso aparte y contra un destino
 * temporal, que es exactamente lo que hace el anfitrión.
 */

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const bin = join(projectRoot, 'scripts/copy-assets.mjs')

/** Directorios temporales de la prueba en curso, para barrerlos al acabar. */
const temporary: string[] = []

afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  )
})

async function temporaryDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `glide-hockey-${prefix}-`))
  temporary.push(dir)
  return dir
}

interface Run {
  code: number
  stdout: string
  stderr: string
}

/**
 * Ejecuta el copiador y devuelve cómo acabó, sin lanzar: aquí un código de
 * salida distinto de cero es un resultado que se comprueba, no un accidente.
 */
function copyAssets(args: string[], script = bin): Promise<Run> {
  return new Promise((resolve) => {
    execFile(process.execPath, [script, ...args], (error, stdout, stderr) => {
      resolve({
        code: error == null ? 0 : Number(error.code ?? 1),
        stdout,
        stderr,
      })
    })
  })
}

/** Rutas relativas de todos los ficheros que hay bajo un directorio. */
async function filesIn(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort()
}

interface ProfilesList {
  [id: string]: { path?: string }
}

describe('glide-hockey-assets', () => {
  it('deja los perfiles de mando que la lista declara', async () => {
    const destination = await temporaryDir('destino')

    const run = await copyAssets([destination])

    expect(run.stderr).toBe('')
    expect(run.code).toBe(0)

    // Es el recorrido que hace @react-three/xr al conectarse un mando: pide la
    // lista y de ahí el perfil de ese mando. Si falta uno, ese mando no se
    // registra: ni rayo, ni forma de mover el mazo ni de pulsar el menú.
    const listPath = join(destination, 'webxr-profiles/profilesList.json')
    expect(existsSync(listPath)).toBe(true)
    const list = JSON.parse(await readFile(listPath, 'utf8')) as ProfilesList

    const profiles = Object.values(list).map((profile) => profile.path)
    expect(profiles.length).toBeGreaterThan(0)
    const missing = profiles.filter(
      (path) => path == null || !existsSync(join(dirname(listPath), path)),
    )
    expect(missing).toEqual([])
  })

  it('deja los créditos, que la licencia de los perfiles exige copiar', async () => {
    const destination = await temporaryDir('destino')

    await copyAssets([destination])

    const credits = await readFile(join(destination, 'CREDITS.md'), 'utf8')
    expect(credits).toContain('MIT')
  })

  it('deja lo mismo al ejecutarlo dos veces', async () => {
    const destination = await temporaryDir('destino')

    await copyAssets([destination])
    const first = await filesIn(destination)
    const second = await copyAssets([destination])

    expect(second.code).toBe(0)
    expect(await filesIn(destination)).toEqual(first)
  })

  it('se lleva por delante lo que dejara una versión anterior', async () => {
    const destination = await temporaryDir('destino')
    await copyAssets([destination])
    const orphan = join(destination, 'webxr-profiles/mando-viejo.json')
    await writeFile(orphan, 'de la versión de antes')

    await copyAssets([destination])

    expect(existsSync(orphan)).toBe(false)
  })

  it('no toca lo que el anfitrión ya tuviera en el destino', async () => {
    const destination = await temporaryDir('destino')
    // El destino puede ser un directorio compartido con otras cosas del
    // anfitrión: solo se rehace lo que se copia.
    const neighbour = join(destination, 'otro-juego/nivel.json')
    await mkdir(dirname(neighbour), { recursive: true })
    await writeFile(neighbour, '{}')

    await copyAssets([destination])

    expect(existsSync(neighbour)).toBe(true)
  })

  it('crea el destino si no existe', async () => {
    const parent = await temporaryDir('destino')
    const destination = join(parent, 'public/juegos/glide-hockey')

    const run = await copyAssets([destination])

    expect(run.code).toBe(0)
    expect(
      existsSync(join(destination, 'webxr-profiles/profilesList.json')),
    ).toBe(true)
  })

  it('para y dice qué falta si el paquete llega incompleto', async () => {
    // Un paquete de mentira con el ejecutable de verdad y solo una parte de sus
    // ficheros: es lo que se vería si alguna vez se renombra un directorio de
    // `public/` y la lista del copiador se queda atrás.
    const root = await temporaryDir('paquete')
    await mkdir(join(root, 'public'), { recursive: true })
    await mkdir(join(root, 'scripts'), { recursive: true })
    await cp(bin, join(root, 'scripts/copy-assets.mjs'))
    await cp(
      join(projectRoot, 'public/CREDITS.md'),
      join(root, 'public/CREDITS.md'),
    )
    const destination = join(await temporaryDir('destino'), 'glide-hockey')

    const run = await copyAssets([destination], join(root, 'scripts/copy-assets.mjs'))

    expect(run.code).toBe(1)
    expect(run.stderr).toContain('webxr-profiles')
    // Se para antes de tocar el destino: media copia es peor que ninguna,
    // porque el anfitrión se la encuentra y la da por buena.
    expect(existsSync(destination)).toBe(false)
  })

  it('pide el destino, que es la decisión del anfitrión', async () => {
    const run = await copyAssets([])

    expect(run.code).toBe(1)
    expect(run.stderr).toContain('glide-hockey-assets <directorio de destino>')
  })
})
