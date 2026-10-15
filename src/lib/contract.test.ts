import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { XRCADE_CONTRACT, type XrcadeCapability } from './settings'

/**
 * **What this game declares it reads from the hall is what its code really reads.**
 *
 * The hall decides which settings to show for each cabinet, and what to require on publishing, from
 * what the game declares in its `package.json` (`xrcade.capabilities`): it imports it from the
 * installed package and does not search for text in it. So the declaration has to be true both ways. A
 * capability that is declared and not used promises a setting that does nothing in this cabinet; one
 * that is used and not declared leaves the hall hiding a setting that does count.
 *
 * **How it is known what it uses.** The `import`s are walked from the package's entry point
 * (`src/game/index.ts`), which is what the hall mounts, and it is checked whether any reachable file
 * calls the read of each setting. `settings.ts` and `settingsClient.ts` do not count: they define all
 * of them, and they are the same file in all seventeen. Nor do the comments, which talk about settings
 * without reading them. The game's own website (`src/app`) is not mounted in the hall and does not
 * count.
 *
 * It is the same file in all seventeen (`organizate/scripts/repos/comunes.py`).
 */

const ROOT = process.cwd()

/** What each setting is read with: the hooks of `settingsClient.ts` and the reads of `settings.ts`. */
const READS: Record<XrcadeCapability, RegExp> = {
  lang: /\b(useLang|langFromCookies)\b/,
  volumes: /\b(useVolumes|readVolumes)\b/,
  scenery: /\b(useScenery|readScenery)\b/,
  playHeight: /\b(usePlayHeight|readPlayHeight)\b/,
  playHeightOffset: /\b(usePlayHeightOffset|readPlayHeightOffset)\b/,
  grab: /\b(useGrabMode|readGrabMode)\b/,
  turn: /\b(useTurnMode|readTurnMode)\b/,
  hand: /\b(useHand|readHand)\b/,
}

/** The ones that define the reads: every game has them, so they say nothing about this game. */
const DEFINERS = new Set(['src/lib/settings.ts', 'src/lib/settingsClient.ts'])

const IMPORTS = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g

function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1')
}

/** The file an `import` of the game itself points to, or `null` if it is from a package. */
function resolve(from: string, specifier: string): string | null {
  let base: string
  if (specifier.startsWith('@/')) base = join(ROOT, 'src', specifier.slice(2))
  else if (specifier.startsWith('.')) base = normalize(join(dirname(from), specifier))
  else return null
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]
  return candidates.find((path) => /\.tsx?$/.test(path) && existsSync(path)) ?? null
}

/** The code of everything that is mounted in the hall, without comments, by relative path. */
function reachable(): Map<string, string> {
  const code = new Map<string, string>()
  const pending = [join(ROOT, 'src', 'game', 'index.ts')]
  while (pending.length > 0) {
    const file = pending.pop()!
    const path = relative(ROOT, file)
    if (code.has(path)) continue
    const source = withoutComments(readFileSync(file, 'utf8'))
    code.set(path, source)
    for (const m of source.matchAll(IMPORTS)) {
      const target = resolve(file, m[1] ?? m[2] ?? m[3])
      if (target !== null) pending.push(target)
    }
  }
  return code
}

function used(): XrcadeCapability[] {
  const code = [...reachable()].filter(([path]) => !DEFINERS.has(path)).map(([, source]) => source)
  return XRCADE_CONTRACT.capabilities.filter((c) => code.some((source) => READS[c].test(source)))
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  xrcade?: { capabilities?: unknown }
}
const declared = pkg.xrcade?.capabilities

describe('the contract with the hall', () => {
  it('has a number and one read per capability', () => {
    expect(Number.isInteger(XRCADE_CONTRACT.version)).toBe(true)
    expect(Object.keys(READS).sort()).toEqual([...XRCADE_CONTRACT.capabilities].sort())
  })

  it('the package.json declares its capabilities, without repeats and from the contract', () => {
    expect(Array.isArray(declared), 'missing "xrcade": { "capabilities": [...] } in package.json').toBe(true)
    const list = declared as string[]
    expect(new Set(list).size).toBe(list.length)
    for (const c of list) expect(XRCADE_CONTRACT.capabilities as readonly string[]).toContain(c)
  })

  it('declares just what its scene reads: not one too many nor one too few', () => {
    const list = [...((declared as string[] | undefined) ?? [])].sort()
    expect(list).toEqual([...used()].sort())
  })

  it('the walk finds the real scene, it does not pass on nothing', () => {
    // Without this, a moved entry point would leave a walk of one file and a «uses nothing».
    expect(reachable().size).toBeGreaterThan(10)
  })
})
