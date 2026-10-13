/**
 * Lo que caza el inglés escrito a mano en la versión española: un «round 1», un «6 of 9» o un
 * «Hit» que no pasaron por el traductor y salen tal cual con el juego en español.
 *
 * Es el mismo fichero en todos los juegos. Lo usan dos tests: `sinIngles.test.ts` (común), que
 * repasa el diccionario entero, y el de cada juego que pinta su portada, su marcador y su resumen
 * con el idioma en español y le pasa a `frasesEnIngles` lo que ha quedado escrito.
 *
 * Mira dos cosas:
 *
 * - **Las frases del propio diccionario**: si una clave en inglés que tiene otra traducción
 *   aparece entera en el texto español, es que alguien la escribió sin `t()`.
 * - **Palabras sueltas que solo son inglés**, de las que salen en un menú o un marcador («of»,
 *   «round», «lives», «streak»…): lo que se compone a trozos no está en el diccionario, y es justo
 *   lo que se escapa. Ninguna es también palabra española ni nombre de un deporte («strike»,
 *   «spare» o «home run» se dicen así en español).
 *
 * Los nombres propios que se quedan en inglés (el del juego, el del salón) no son ninguna de las
 * dos cosas, así que no hace falta apartarlos.
 */

/** Palabras que en un texto en español solo pueden ser inglés sin traducir, en minúsculas. */
export const SOLO_INGLES: readonly string[] = [
  'the', 'of', 'and', 'you', 'your', 'with', 'out', 'over', 'again', 'back', 'new', 'best', 'left', 'right',
  'round', 'level', 'levels', 'lives', 'life', 'streak', 'record', 'score', 'points', 'shots', 'shot',
  'hit', 'hits', 'miss', 'missed', 'easy', 'medium', 'hard', 'play', 'player', 'players', 'wins', 'turn',
  'challenge', 'practice', 'settings', 'leave', 'exit', 'menu', 'hold', 'possible', 'sticks', 'ball', 'balls',
  'target', 'time', 'game', 'mode', 'try', 'start', 'next', 'skip',
]

const LETRA = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ'

/** La expresión que encuentra esa frase entera, sin que sea un trozo de una palabra más larga. */
function entera(frase: string, banderas = ''): RegExp {
  const escapada = frase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^${LETRA}])${escapada}(?=$|[^${LETRA}])`, banderas)
}

/**
 * Lo que hay en inglés en un texto que tendría que estar en español: las frases del diccionario
 * (`claves`: cada clave en inglés con su traducción, para quedarse con las que cambian) y las
 * palabras de `SOLO_INGLES`. Sin repetir y en el orden en que se encuentran.
 */
export function frasesEnIngles(texto: string, claves: readonly (readonly [string, string])[] = []): string[] {
  // Los huecos de una frase sin rellenar (`{score}`) son nombres de variable, no texto.
  texto = texto.replace(/\{\w+\}/g, ' ')
  const halladas: string[] = []
  const anotar = (frase: string) => {
    if (!halladas.includes(frase)) halladas.push(frase)
  }
  // Las frases enteras primero, de la más larga a la más corta: «Out of lives» se dice entera
  // antes que sus palabras sueltas.
  const traducidas = claves
    .filter(([ingles, espanol]) => ingles !== espanol && !ingles.includes('{') && /[A-Za-z]{2}/.test(ingles))
    .map(([ingles]) => ingles)
    .sort((a, b) => b.length - a.length)
  for (const ingles of traducidas) {
    if (entera(ingles).test(texto)) anotar(ingles)
  }
  for (const palabra of SOLO_INGLES) {
    const hallada = entera(palabra, 'i').exec(texto)
    if (hallada != null) anotar(hallada[0].slice(hallada[1].length))
  }
  return halladas
}
