import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PALETTE } from '../lib/palette'
import { contrast, COMMON_PALETTE } from '../lib/commonPalette'

/**
 * That no colour that **means something** is written loose in the interface.
 *
 * Hit, miss, warning, record and what has been scored have to look the same across the whole
 * hall, and that is why they come from the common palette (`lib/commonPalette.ts`). A literal
 * written by hand in a scoreboard or in a panel is exactly how they drift without anyone deciding
 * it: a «similar» red here, another one there, and the hall is sixteen loose games again.
 *
 * It is not a grep of the whole game: the scenery —the room, the table, the neons— has its
 * colours and they are its own. What is watched is **the interface**: the folders where what is
 * read lives (the headset's panels and the web screens) and the files outside them that paint a
 * scoreboard. Whatever is there has to come from the common palette or from the game's
 * (`lib/palette.ts`); a new literal forces a decision on which of the two it is.
 */

const ROOT = process.cwd()

/** The folders of the interface: everything that goes into them is watched without listing it. */
const DIRS = ['src/components/ui', 'src/components/xr']

/** What paints meaning outside those folders. */
const FILES: string[] = [
  // None: on the table, outside the interface, nothing says hit or miss. The cyan and the
  // red of the mallets and of the goals say whose each thing is, and that belongs to the game.
]

/**
 * What is watched and may carry a literal, and why.
 *
 * Each entry has to still be needed: if the file stops having literals, it is not needed here
 * and the test says so.
 */
const EXCEPTIONS: Record<string, string> = {
  'src/components/xr/RealController.tsx':
    'It is the same file in every game (`comunes.py`): its yellow mark is the one of the ' +
    'hints (`lib/hints.ts`, also shared) and it is changed in all of them at once, not from one game.',
}

/** A colour written by hand: hexadecimal, `rgb()`/`hsl()`, three integer or Tailwind class. */
const LITERAL =
  /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b0x[0-9a-f]{6}\b|\b(?:text|bg|border|ring|fill|stroke|from|to|via|outline|shadow)-(?:red|green|emerald|lime|amber|yellow|orange|rose|sky|cyan|teal|blue|pink|fuchsia|purple|violet|indigo)-\d{2,3}\b/i

/** The code without comments: a colour quoted in an explanation is not a painted colour. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** The code files of a folder, without the tests. */
function codeIn(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const file = `${dir}/${name}`
    if (statSync(join(ROOT, file)).isDirectory()) return codeIn(file)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [file] : []
  })
}

function literalsIn(file: string): string[] {
  return withoutComments(readFileSync(join(ROOT, file), 'utf8'))
    .split('\n')
    .flatMap((line, i) => (LITERAL.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : []))
}

const WATCHED = [...DIRS.flatMap(codeIn), ...FILES]

describe('the loose colours of the interface', () => {
  it('what is watched exists: a file that moves cannot slip out of the watch silently', () => {
    for (const file of [...DIRS, ...FILES]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    expect(WATCHED.length).toBeGreaterThan(5)
  })

  it('no colour written by hand in what is read: it comes from the palette or from a named constant', () => {
    const loose = WATCHED.filter((file) => !(file in EXCEPTIONS)).flatMap(literalsIn)
    expect(loose).toEqual([])
  })

  it('each exception is watched and is still needed', () => {
    for (const file of Object.keys(EXCEPTIONS)) {
      expect(WATCHED, file).toContain(file)
      expect(literalsIn(file), file).not.toEqual([])
    }
  })

  it('recognises a loose colour in any of its forms, and not one quoted in a comment', () => {
    for (const sample of ["'#c2452d'", 'rgba(0, 0, 0, 0.5)', 'hsl(0 50% 50%)', '0xff0000', 'text-red-500'])
      expect(LITERAL.test(sample), sample).toBe(true)
    expect(LITERAL.test(withoutComments('const a = COMMON_PALETTE.miss // and not #c2452d'))).toBe(false)
    expect(LITERAL.test(withoutComments('/* the red #c2452d */ const a = 1'))).toBe(false)
    expect(LITERAL.test("fetch('https://example.com')")).toBe(false)
  })
})

describe("the common colours on the room's panels", () => {
  // The palette checks its colours against the hall's background; the panels of this game are the
  // blue of the room and the buttons that of the rails, and it is on them that the end, the
  // stars and the record are painted.
  it.each([PALETTE.background, PALETTE.rail])('read on %s (4.5:1)', (panel) => {
    for (const name of ['hit', 'miss', 'warning', 'gold', 'accent', 'mutedText'] as const) {
      expect(contrast(COMMON_PALETTE[name], panel), name).toBeGreaterThanOrEqual(4.5)
    }
  })
})
