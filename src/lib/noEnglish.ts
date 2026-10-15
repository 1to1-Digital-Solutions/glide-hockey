/**
 * What catches English written by hand in the Spanish version: a «round 1», a «6 of 9» or a
 * «Hit» that did not go through the translator and come out as they are with the game in Spanish.
 *
 * It is the same file in every game. Two tests use it: `noEnglish.test.ts` (common), which
 * goes over the whole dictionary, and the one of each game that paints its cover, its scoreboard and
 * its summary with the language in Spanish and hands `englishPhrases` what has been drawn.
 *
 * It looks at two things:
 *
 * - **The phrases of the dictionary itself**: if an English key that has another translation
 *   shows up whole in the Spanish text, someone wrote it without `t()`.
 * - **Single words that are only English**, of the kind that show up in a menu or a scoreboard («of»,
 *   «round», «lives», «streak»…): what is put together in pieces is not in the dictionary, and it is
 *   exactly what slips through. None is also a Spanish word or the name of a sport («strike»,
 *   «spare» or «home run» are said that way in Spanish).
 *
 * The proper names that stay in English (the game's, the hall's) are neither of the
 * two things, so there is no need to set them aside.
 */

/** Words that in a Spanish text can only be untranslated English, in lower case. */
export const ENGLISH_ONLY: readonly string[] = [
  'the', 'of', 'and', 'you', 'your', 'with', 'out', 'over', 'again', 'back', 'new', 'best', 'left', 'right',
  'round', 'level', 'levels', 'lives', 'life', 'streak', 'record', 'score', 'points', 'shots', 'shot',
  'hit', 'hits', 'miss', 'missed', 'easy', 'medium', 'hard', 'play', 'player', 'players', 'wins', 'turn',
  'challenge', 'practice', 'settings', 'leave', 'exit', 'menu', 'hold', 'possible', 'sticks', 'ball', 'balls',
  'target', 'time', 'game', 'mode', 'try', 'start', 'next', 'skip',
]

const LETTER = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ'

/** The expression that finds that phrase whole, without it being a piece of a longer word. */
function whole(phrase: string, flags = ''): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^${LETTER}])${escaped}(?=$|[^${LETTER}])`, flags)
}

/**
 * What there is in English in a text that should be in Spanish: the phrases of the dictionary
 * (`keys`: each English key with its translation, to keep the ones that change) and the
 * words of `ENGLISH_ONLY`. Without repeating and in the order in which they are found.
 */
export function englishPhrases(text: string, keys: readonly (readonly [string, string])[] = []): string[] {
  // The placeholders of an unfilled phrase (`{score}`) are variable names, not text.
  text = text.replace(/\{\w+\}/g, ' ')
  const found: string[] = []
  const note = (phrase: string) => {
    if (!found.includes(phrase)) found.push(phrase)
  }
  // The whole phrases first, from the longest to the shortest: «Out of lives» is reported whole
  // before its single words.
  const translated = keys
    .filter(([english, spanish]) => english !== spanish && !english.includes('{') && /[A-Za-z]{2}/.test(english))
    .map(([english]) => english)
    .sort((a, b) => b.length - a.length)
  for (const english of translated) {
    if (whole(english).test(text)) note(english)
  }
  for (const word of ENGLISH_ONLY) {
    const match = whole(word, 'i').exec(text)
    if (match != null) note(match[0].slice(match[1].length))
  }
  return found
}
