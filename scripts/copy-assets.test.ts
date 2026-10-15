// @vitest-environment node

/**
 * What `npx glide-hockey-assets` leaves in the `public/` of whoever mounts the game.
 *
 * It lives here, next to the executable, because the typecheck does not look
 * inside an `.mjs` and the lint only checks its syntax: without these tests,
 * nothing watches that the copy arrives complete. And arriving incomplete does
 * not break the build: it is noticed in the headset and late, with the player
 * without controllers and without an explanation.
 *
 * The real executable is run, in a separate process and against a temporary
 * destination, which is exactly what the host does.
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

/** Temporary directories of the test under way, to sweep them when it ends. */
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
 * Runs the copier and returns how it ended, without throwing: here a non-zero
 * exit code is a result that gets checked, not an accident.
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

/** Relative paths of all the files there are under a directory. */
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
  it('leaves the controller profiles the list declares', async () => {
    const destination = await temporaryDir('destination')

    const run = await copyAssets([destination])

    expect(run.stderr).toBe('')
    expect(run.code).toBe(0)

    // It is the path @react-three/xr takes when a controller connects: it asks
    // for the list and from there the profile of that controller. If one is
    // missing, that controller is not registered: no ray, no way to move the
    // mallet or to press the menu.
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

  it('leaves the credits, which the licence of the profiles requires copying', async () => {
    const destination = await temporaryDir('destination')

    await copyAssets([destination])

    const credits = await readFile(join(destination, 'CREDITS.md'), 'utf8')
    expect(credits).toContain('MIT')
  })

  it('leaves the same thing when run twice', async () => {
    const destination = await temporaryDir('destination')

    await copyAssets([destination])
    const first = await filesIn(destination)
    const second = await copyAssets([destination])

    expect(second.code).toBe(0)
    expect(await filesIn(destination)).toEqual(first)
  })

  it('sweeps away whatever a previous version left', async () => {
    const destination = await temporaryDir('destination')
    await copyAssets([destination])
    const orphan = join(destination, 'webxr-profiles/old-controller.json')
    await writeFile(orphan, 'from the previous version')

    await copyAssets([destination])

    expect(existsSync(orphan)).toBe(false)
  })

  it('does not touch what the host already had in the destination', async () => {
    const destination = await temporaryDir('destination')
    // The destination may be a directory shared with other things of the
    // host: only what is copied is redone.
    const neighbour = join(destination, 'another-game/level.json')
    await mkdir(dirname(neighbour), { recursive: true })
    await writeFile(neighbour, '{}')

    await copyAssets([destination])

    expect(existsSync(neighbour)).toBe(true)
  })

  it('creates the destination if it does not exist', async () => {
    const parent = await temporaryDir('destination')
    const destination = join(parent, 'public/juegos/glide-hockey')

    const run = await copyAssets([destination])

    expect(run.code).toBe(0)
    expect(
      existsSync(join(destination, 'webxr-profiles/profilesList.json')),
    ).toBe(true)
  })

  it('stops and says what is missing if the package arrives incomplete', async () => {
    // A fake package with the real executable and only a part of its files: it
    // is what would be seen if a directory of `public/` is ever renamed and the
    // copier's list is left behind.
    const root = await temporaryDir('package')
    await mkdir(join(root, 'public'), { recursive: true })
    await mkdir(join(root, 'scripts'), { recursive: true })
    await cp(bin, join(root, 'scripts/copy-assets.mjs'))
    await cp(
      join(projectRoot, 'public/CREDITS.md'),
      join(root, 'public/CREDITS.md'),
    )
    const destination = join(await temporaryDir('destination'), 'glide-hockey')

    const run = await copyAssets([destination], join(root, 'scripts/copy-assets.mjs'))

    expect(run.code).toBe(1)
    expect(run.stderr).toContain('webxr-profiles')
    // It stops before touching the destination: half a copy is worse than
    // none, because the host finds it and takes it as good.
    expect(existsSync(destination)).toBe(false)
  })

  it('asks for the destination, which is the decision of the host', async () => {
    const run = await copyAssets([])

    expect(run.code).toBe(1)
    expect(run.stderr).toContain('glide-hockey-assets <destination directory>')
  })
})
