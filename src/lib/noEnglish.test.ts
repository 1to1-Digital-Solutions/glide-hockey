import { describe, expect, it } from 'vitest'
import { ENGLISH_ONLY, englishPhrases } from './noEnglish'
import { TEXT_KEYS, texto } from './textos'

/**
 * Nothing in English in the Spanish version.
 *
 * It is the same file in every game: it tests the detector and goes over the game's whole
 * dictionary. What is written by hand in a component without going through `t()` is not in the
 * dictionary, and that is caught by the test of each game that paints its cover, its scoreboard
 * and its summary in Spanish (`noEnglish.es.test.tsx`), with this same detector.
 */

describe('the detector', () => {
  it('catches the single words that are only English, as they were written', () => {
    expect(englishPhrases('Reto · Fácil · round 1')).toEqual(['round'])
    expect(englishPhrases('6 of 9 · Racha ×4')).toEqual(['of'])
    expect(englishPhrases('Streak ×4')).toEqual(['Streak'])
    expect(englishPhrases('Te has quedado sin vidas')).toEqual([])
  })

  it('catches a whole phrase of the dictionary, before its words', () => {
    const keys = [
      ['Out of lives', 'Sin vidas'],
      ['Batting Cage', 'Batting Cage'],
    ] as const

    expect(englishPhrases('Out of lives · 3 / 13', keys)).toEqual(['Out of lives', 'of', 'Out', 'lives'])
    // The proper name stays the same in both languages: it is not an untranslated phrase.
    expect(englishPhrases('Batting Cage', keys)).toEqual([])
  })

  it('does not mistake a piece of a word or what carries an accent for English', () => {
    expect(englishPhrases('Volver al menú · tu récord · éxito · Ofertas')).toEqual([])
    expect(englishPhrases('Récord: 12', [['Hit', 'Bateada']])).toEqual([])
    expect(englishPhrases('Hit!', [['Hit', 'Bateada']])).toEqual(['Hit'])
  })

  it('phrases with placeholders are only looked at for what they say, not for the name of the placeholder', () => {
    expect(englishPhrases('Tu récord {record} · llevas {score}')).toEqual([])
    expect(englishPhrases('{n} of {total}', [['{n} of {total}', '{n} de {total}']])).toEqual(['of'])
  })

  it('every word of the list is English and nothing else: in lower case and without repeating', () => {
    expect(new Set(ENGLISH_ONLY).size).toBe(ENGLISH_ONLY.length)
    for (const word of ENGLISH_ONLY) expect(word).toMatch(/^[a-z]+$/)
  })
})

describe('the dictionary of the game', () => {
  it('no Spanish phrase carries a word that is only English', () => {
    const withEnglish = TEXT_KEYS.flatMap((key) => {
      const found = englishPhrases(texto('es', key))
      return found.length === 0 ? [] : [`${key} → ${texto('es', key)}: ${found.join(', ')}`]
    })

    expect(withEnglish).toEqual([])
  })
})
