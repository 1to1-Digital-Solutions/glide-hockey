import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DIFFICULTY_LABELS } from './gameConfig'
import { GAME_MODE_HINTS, GAME_MODE_LABELS } from './gameMode'
import { PLAYER_LABELS } from './duel'
import { SCENERY_HINTS, SCENERY_LABELS } from './scenery'
import { COMFORT_LABELS, COMFORT_LEGEND } from './comfort'
import { plural } from './menuWords'
import { TEXT_KEYS, formatText, formatFigure, texto, translator, softTranslator, type TextKey } from './textos'

/**
 * The game's dictionary.
 *
 * That the keys exist is checked by TypeScript —they come from the object itself—, so here
 * what the type does not see is looked at: that in English the original is returned without
 * storing it twice, that the labels that come from the configuration maps are translated,
 * and that no phrase is left over. The last two are the ones that break by themselves: a
 * difficulty is added and nobody remembers; a phrase is changed in the component and the old
 * one stays here for ever.
 */
const SRC = join(import.meta.dirname, '..')

/** All the game's code, to search it for what the dictionary claims to know. */
function sourceCode(folder = ''): string {
  return readdirSync(join(SRC, folder), { withFileTypes: true })
    .map((entry) => {
      const filePath = join(folder, entry.name)
      if (entry.isDirectory()) return sourceCode(filePath)
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return ''
      if (entry.name === 'textos.ts') return ''
      return readFileSync(join(SRC, filePath), 'utf8')
    })
    .join('\n')
}

describe('the dictionary', () => {
  it('in English it returns the key itself', () => {
    expect(texto('en', 'Back to the menu')).toBe('Back to the menu')
    expect(texto('en', 'Play')).toBe('Play')
  })

  it('in Spanish it translates', () => {
    expect(texto('es', 'Back to the menu')).toBe('Volver al menú')
    expect(translator('es')('Play')).toBe('Jugar')
  })

  it('it translates all the labels of the configuration maps', () => {
    // If a mode, a difficulty or a scenery gains an entry and it is not translated, this
    // fails before anyone sees the game half in Spanish.
    const labels = [
      ...Object.values(GAME_MODE_LABELS),
      ...Object.values(GAME_MODE_HINTS),
      ...Object.values(DIFFICULTY_LABELS),
      ...Object.values(SCENERY_LABELS),
      ...Object.values(SCENERY_HINTS),
      ...Object.values(COMFORT_LABELS),
      ...PLAYER_LABELS,
      COMFORT_LEGEND,
    ]
    const untranslated = labels.filter((e) => texto('es', e) === e)

    expect(untranslated).toEqual([])
  })

  it('nor is it missing any of the ones that are said', () => {
    // The reverse of the other one, and the one that was missing: that one catches a declared
    // key nobody uses any more —annoying but harmless—, and this one a key that **is used and
    // is not declared**, which is the one that shows. In batting-cage, `t('Fastest')` returned
    // `undefined` and the challenge's scoreboard drew a row with its figure and no name, only
    // in Spanish.
    const source = sourceCode()
    const used = [...source.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1])
    const missing = [...new Set(used)].filter(
      (key) => !(TEXT_KEYS as readonly string[]).includes(key),
    )

    expect(missing).toEqual([])
  })

  it('it does not keep phrases nobody says any more', () => {
    // A phrase changes in the component and the old one stays here translated for ever:
    // it breaks nothing, and that is why nobody ever removes it.
    const source = sourceCode()
    const orphans = TEXT_KEYS.filter((key) => !source.includes(key))

    expect(orphans).toEqual([])
  })
})

describe('the counts, with their plural', () => {
  it('the endless streak of the cover: one goal, two goals, in both languages', () => {
    const streak = (lang: 'en' | 'es', n: number) => translator(lang)(plural(n, '{n} goal', '{n} goals') as TextKey, { n })
    expect([streak('en', 1), streak('en', 2)]).toEqual(['1 goal', '2 goals'])
    expect([streak('es', 1), streak('es', 2)]).toEqual(['1 gol', '2 goles'])
  })
})

describe('the translator that accepts any phrase', () => {
  it('it translates what is in the dictionary, with its gaps', () => {
    expect(softTranslator('es')('Back to the menu')).toBe('Volver al menú')
    expect(softTranslator('es')('Level {level}, locked', { level: 3 })).toBe('Nivel 3, bloqueado')
    expect(softTranslator('en')('Level {level}, locked', { level: 3 })).toBe('Level 3, locked')
  })

  it('and what is not there —the unit of the record, which the hall passes already said— comes out as is', () => {
    expect(softTranslator('es')('puntos en el reto')).toBe('puntos en el reto')
    expect(softTranslator('en')('puntos en el reto')).toBe('puntos en el reto')
    // Nor what is merely named like something of JavaScript's objects.
    expect(softTranslator('es')('toString')).toBe('toString')
  })

  it('it knows the phrases of the goal sign, common to every game', () => {
    expect(softTranslator('es')('{missing} short of gold', { missing: 40 })).toBe('Te han faltado 40 para el oro')
    expect(softTranslator('es')('New record!')).toBe('¡Nuevo récord!')
  })

  it('the mode that counts is called Reto', () => {
    expect(translator('es')('Challenge')).toBe('Reto')
  })
})

describe('the gaps of a phrase', () => {
  it('they are filled by name, not by order', () => {
    // By order, Spanish would have to fake English syntax for the gaps to fall where they
    // should.
    expect(formatText('{a} de {b}', { b: 2, a: 1 })).toBe('1 de 2')
  })

  it('it leaves alone a gap nobody fills', () => {
    // Better that than blowing up over a half-done phrase: the gap is seen and fixed,
    // instead of drawing «undefined» in the middle of the scoreboard.
    expect(formatText('{a} de {b}', { a: 1 })).toBe('1 de {b}')
  })

  it('it reaches the translator', () => {
    expect(translator('es')('Level {level}, locked', { level: 3 })).toBe('Nivel 3, bloqueado')
    expect(translator('en')('Level {level}, locked', { level: 3 })).toBe('Level 3, locked')
  })
})

describe('the figures, in the language of whoever plays', () => {
  it('they group the thousands with a dot in Spanish and with a comma in English', () => {
    expect(formatFigure(12400, 'es')).toBe('12.400')
    expect(formatFigure(12400, 'en')).toBe('12,400')
    expect(formatFigure(1234567, 'es')).toBe('1.234.567')
    expect(formatFigure(-20000, 'es')).toBe('-20.000')
    expect(formatFigure(999, 'es')).toBe('999')
  })

  it('in Spanish from five digits on, like the sign; in English, from four', () => {
    expect(formatFigure(8068, 'es')).toBe('8068')
    expect(formatFigure(8068, 'en')).toBe('8,068')
    expect(formatFigure(9999.6, 'es')).toBe('10.000')
  })

  it('what is not a figure is written as zero', () => {
    expect(formatFigure(Number.NaN, 'es')).toBe('0')
  })

  it('and no `toLocaleString` is left in the code, which wrote «8,068» in Spanish', () => {
    const found: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const filePath = join(dir, entry.name)
        if (entry.isDirectory()) walk(filePath)
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          if (readFileSync(filePath, 'utf8').includes('.toLocaleString(')) found.push(filePath)
        }
      }
    }
    walk(join(__dirname, '..'))
    expect(found).toEqual([])
  })
})
