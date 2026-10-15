// @vitest-environment node

/**
 * That the published package carries inside what is needed to mount it.
 *
 * `files` decides what goes up to npm, and what is left out does not fail on
 * packing or on building: it fails in the application that installs the game,
 * which imports a module that is not there or serves files that never arrived.
 *
 * The rest of `package.json` —`exports`, `peerDependencies`, `sideEffects`— is
 * validated by `npm run catalog:validate` from xrcade when registering the game
 * (see `docs/xrcade.md`). Here what that one cannot know is checked: that the
 * paths it declares really exist inside the package, and that the entry arrives
 * with everything it imports behind it — which is what really decides whether
 * the host can mount it.
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

/** The files that would go up to npm, according to what `files` declares. */
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
 * Modules a source file asks for by name: `from '…'`, a bare import for its
 * effects, a deferred `import('…')` or a `require('…')`.
 */
const SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*(['"])([^'"]+)\1/g

/** Suffixes a bundler tries when resolving a relative path. */
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
 * All the files of the project itself that are reached from some entries,
 * following their relative imports.
 *
 * Those that go by their bare name (`three`, `react`) are the ones of
 * `peerDependencies` and the host provides them, so here they do not count. A
 * relative specifier that does not resolve is ignored instead of failing: the
 * typecheck already catches that, and here only what is published is asked about.
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

/** Relative paths of all the files there are under a directory. */
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
  // Packing starts the whole of npm: on a cold machine it goes past the
  // default five seconds without anything being wrong.
}, 120_000)

describe('the package that gets published', () => {
  it('carries inside everything `exports` points to', () => {
    const targets = Object.values(manifest.exports).map((target) =>
      target.replace(/^\.\//, ''),
    )

    expect(targets.length).toBeGreaterThan(0)
    expect(targets.filter((target) => !packed.includes(target))).toEqual([])
  })

  it('carries inside the modules that entry imports, not only the entry', () => {
    // Publishing the entry point without what is underneath does not fail on
    // packing or on building here: it fails on installing it, importing a
    // module that did not go up. And there is no need to delete `src/lib` from
    // `files` to cause it: it is enough for the game to import something from
    // `src/app`, which belongs to the web page and does not travel.
    const entries = Object.values(manifest.exports)
      .map((target) => join(projectRoot, target.replace(/^\.\//, '')))
      .filter((target) => /\.tsx?$/.test(target))

    const reachable = reachableFrom(entries).map((file) =>
      relative(projectRoot, file),
    )

    // If the crawl stopped following imports, it would stay at the entries and
    // would pass without checking anything.
    expect(reachable.length).toBeGreaterThan(entries.length)
    expect(reachable.filter((file) => !packed.includes(file))).toEqual([])
  })

  it('carries inside the executable that copies the static files', () => {
    const targets = Object.values(manifest.bin).map((target) =>
      target.replace(/^\.\//, ''),
    )

    expect(targets.length).toBeGreaterThan(0)
    expect(targets.filter((target) => !packed.includes(target))).toEqual([])
  })

  it('carries inside the static files that executable copies', async () => {
    // The executable reads from `public/` inside the installed package: what
    // does not go up to npm is not there, and `glide-hockey-assets` stops saying
    // that the package arrived incomplete (see `copy-assets.test.ts`).
    const assets = (await filesIn(join(projectRoot, 'public'))).map(
      (file) => `public/${file}`,
    )

    expect(assets.length).toBeGreaterThan(0)
    expect(assets.filter((asset) => !packed.includes(asset))).toEqual([])
  })

  it('does not carry the tests, which are of no use to whoever mounts it', () => {
    expect(packed.filter((file) => /\.test\.tsx?$/.test(file))).toEqual([])
  })

  it('leaves React and three to the host, never in `dependencies`', () => {
    // Two copies of React break the hooks and two of three, the scene. It is
    // the expensive failure because it does not break the build: it breaks the match.
    const shared = ['react', 'react-dom', 'three', '@react-three/fiber']

    for (const packageName of shared) {
      expect(manifest.peerDependencies).toHaveProperty(packageName)
      expect(manifest.dependencies ?? {}).not.toHaveProperty(packageName)
    }
  })
})
