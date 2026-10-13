// @vitest-environment node

/**
 * That the scene that gets published is still a scene.
 *
 * `GlideHockeyScene` is what the xrcade hall mounts inside its own Canvas and
 * its own WebXR session. The contract says that from there a `<Canvas>` cannot
 * be created, nor an `<XR>`, nor an `<XROrigin>`, nor a single DOM tag painted
 * (see `docs/xrcade.md`).
 *
 * Breaking it **does not break the build or any test here**: the game's web
 * page brings its Canvas and keeps working the same. It would be discovered by
 * mounting it in the hall, with the host's session closing on entering or with
 * a `<div>` trying to paint itself inside a Canvas. That is why it is checked
 * on the code: the imports are walked from the scene's entry and what it uses
 * is looked at.
 */

import { readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const sceneEntry = join(projectRoot, 'src/game/GlideHockeyScene.tsx')

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

/** The modules of the project that are reached from the scene. */
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
 * The code without its comments.
 *
 * Half a dozen modules explain in prose why they do **not** put a `<Canvas>`
 * or an `<XROrigin>`, and searching over the raw source turned precisely those
 * explanations into the failure they describe. The `/* … *\/` blocks are
 * removed —which is also the form of the comments inside JSX— and the `//`
 * lines.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

/** Which reachable modules really use any of these fragments. */
function usedBy(patterns: RegExp[]): string[] {
  return reachableFromScene()
    .filter((file) => {
      const source = withoutComments(readFileSync(file, 'utf8'))
      return patterns.some((pattern) => pattern.test(source))
    })
    .map((file) => relative(projectRoot, file))
}

describe('the scene the host mounts', () => {
  it('reaches more than one module, or nothing would be being checked', () => {
    expect(reachableFromScene().length).toBeGreaterThan(5)
  })

  it('creates no Canvas, session or origin: they belong to the host', () => {
    // `<XR[\\s>]` and not `<XR\\b`: `<XRMenu` and `<XRScoreboard` are the
    // game's immersive interface, which is its own.
    expect(usedBy([/<Canvas[\s>]/, /<XR[\s>]/, /<XROrigin[\s>]/])).toEqual([])
  })

  it('neither opens nor closes the immersive session on its own', () => {
    // `endXrSession` is reached, and must be: it is what «exit» means when the
    // game is its own web page (see `game/exit.tsx`). What there cannot be is a
    // call to enter, which would start a session inside the hall's.
    expect(usedBy([/\benterVR\s*\(/, /\benterAR\s*\(/])).toEqual([])
  })

  it('paints no DOM: inside a Canvas only three objects fit', () => {
    expect(usedBy([/<(?:div|main|button|p|span|header|section)\b/])).toEqual([])
  })
})
