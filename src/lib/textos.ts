/**
 * What the game says, in Spanish.
 *
 * **The key is the English text itself.** There are no invented ids (`hud.points`) for two
 * reasons. The first is that it reads: the component says `t('Back to the menu')`, and
 * whoever passes by knows what gets painted without going to look up the dictionary. The
 * second is that TypeScript watches it on its own: `TextKey` comes from the keys of this
 * object, so changing the phrase in the component and forgetting about here **does not
 * compile**, instead of leaving an orphan key that only shows when someone puts the game in
 * Spanish.
 *
 * English is not stored twice: if the language is English, `texto` returns the key.
 * This file only has the translation.
 *
 * **What does NOT go in here.** Comments, identifiers and programmer errors are in English
 * because they are for whoever maintains the repo. The storage keys are never touched
 * either: translating them would wipe the records of whoever plays.
 *
 * The language is chosen by the player just once, in the xrcade menu, and it gets here
 * through the hall's cookie (see `settings.ts`).
 */

import type { Lang } from './settings'
import { GOAL_ES } from './goal'
import { MENU_ES } from './menuWords'

const ES = {
  // The goal sign, common to every game of the hall. First, so that what the game already
  // said on its own does not clash.
  ...GOAL_ES,
  // The hall's common buttons and states (`menuWords.ts`), said the same in every game.
  ...MENU_ES,
  // And what this game gives it: the challenge's mission and what remains (`scoreboardSign.ts`).
  'Win games until you lose one': 'Gana partidos hasta perder uno',
  'Round {round} · to {goals} goals · goal +{points}': 'Ronda {round} · a {goals} goles · gol +{points}',
  // What the menu says about each mode («Cuenta para medalla» is the common one of `MENU_ES`).
  'Does not count for a medal': 'No cuenta para medalla',

  // What the tab says and what is read when sharing the link. The name stays in English on
  // purpose: it is the product's, the same one lettered on the hall's cabinet and the one
  // that will go on the store page. What gets translated is what comes after it.
  '{name} — you against the machine': '{name} — tú contra la máquina',
  '{name} against the machine: choose the level and the goals to play to, and put the puck in its net. Play in the browser or in mixed reality (VR/AR).':
    '{name} contra la máquina: elige el nivel y los goles a los que jugar, y mete el disco en su portería. Juega en el navegador o en realidad mixta (VR/AR).',

  // Cover
  'You against the machine. Move the mallet with the mouse and put the puck in its goal. In the headset, take it with the grip button and the mallet follows your hand.':
    'Tú contra la máquina. Mueve el mazo con el ratón y mete el disco en su portería. Con el visor, cógelo con el botón de agarre y el mazo sigue a tu mano.',
  'Game mode': 'Modo de juego',
  'Machine level': 'Nivel de la máquina',
  Goals: 'Goles',
  'Fixed goals': 'Goles fijos',
  Endless: 'Sin fin',
  Level: 'Nivel',
  'What you see around you': 'Lo que ves a tu alrededor',
  'Around you': 'A tu alrededor',
  // The hit taken (`lib/comfort.ts`): how much a goal against is felt.
  'When hit': 'Al recibir',
  Off: 'Apagado',
  Gentle: 'Suave',
  Full: 'Normal',
  'Play in the headset': 'Jugar con el visor',

  // Modes, difficulties and scenery
  Practice: 'Práctica',
  Levels: 'Niveles',
  'You choose the level and the goals. Losing costs nothing.':
    'Eliges el nivel y los goles. Perder no cuesta nada.',
  'One game at a time. The level you win stays unlocked for next time.':
    'Una partida cada vez. El nivel que ganas queda desbloqueado para la próxima.',
  'It steps up on its own, in one run. The first game you lose ends it.':
    'Sube solo, en una tanda. La primera partida que pierdas la termina.',
  'Take turns with one controller against the same machine: whoever beats it by more wins.':
    'Por turnos con un mando contra la misma máquina: gana quien le saque más ventaja.',
  Easy: 'Fácil',
  Medium: 'Media',
  Hard: 'Difícil',
  Expert: 'Experta',
  Impossible: 'Imposible',
  'The room': 'La sala',
  'Your room': 'Tu habitación',
  'The table with the arcade room around it.': 'La mesa con la sala del arcade alrededor.',
  'Headset and augmented reality only: the table stands in your own room.':
    'Solo con visor y realidad aumentada: la mesa se planta en tu propia habitación.',

  // What the ladder decides for you
  '· endless': '· sin fin',
  'Level · {level} of {total} · {difficulty}, to {goals} goals':
    'Nivel · {level} de {total} · {difficulty}, a {goals} goles',
  'Level {level}, locked': 'Nivel {level}, bloqueado',
  'Level {level}, {stars} star': 'Nivel {level}, {stars} estrella',
  'Level {level}, {stars} stars': 'Nivel {level}, {stars} estrellas',

  // Scoreboard
  You: 'Tú',
  Machine: 'Máquina',
  Points: 'Puntos',
  Streak: 'Racha',
  '· round {round}': '· ronda {round}',
  // It only shows past round fifteen: the lap it is on and what it multiplies by.
  '· lap {lap} ×{multiplier}': '· vuelta {lap} ×{multiplier}',
  '· level {level}': '· nivel {level}',
  endless: 'sin fin',
  'to {goals} goals': 'a {goals} goles',

  // End of the match
  'Game over': 'Fin de la partida',
  'Level {level} cleared': 'Nivel {level} superado',
  'Level {level} not cleared': 'Nivel {level} no superado',
  'Game won': 'Partida ganada',
  'Game lost': 'Partida perdida',
  'The challenge ends at round {round}.': 'El reto acaba en la ronda {round}.',
  '{stars} star · level {level} unlocked.': '{stars} estrella · nivel {level} desbloqueado.',
  '{stars} stars · level {level} unlocked.': '{stars} estrellas · nivel {level} desbloqueado.',
  '{stars} star · score {scored}–{conceded}.': '{stars} estrella · marcador {scored}–{conceded}.',
  '{stars} stars · score {scored}–{conceded}.':
    '{stars} estrellas · marcador {scored}–{conceded}.',
  'Win the game to open the next one.': 'Gana la partida para abrir la siguiente.',
  'Final score: {scored}–{conceded}.': 'Marcador final: {scored}–{conceded}.',
  points: 'puntos',
  'New best streak!': '¡Nueva mejor racha!',
  'New record!': '¡Nuevo récord!',
  'Your best endless streak: {goals}': 'Tu mejor racha sin fin: {goals}',
  Scored: 'Marcados',
  Conceded: 'Encajados',
  'Best streak': 'Mejor racha',
  Again: 'Otra vez',

  // The duel
  'Player 1': 'Jugador 1',
  'Player 2': 'Jugador 2',
  '{player}: {scored}–{conceded}': '{player}: {scored}–{conceded}',
  '{player}: {scored}–{conceded} ({margin})': '{player}: {scored}–{conceded} ({margin})',
  'Pass the controller to {player}.': 'Pásale el mando a {player}.',
  '{player} to play': 'Le toca a {player}',
  '{player} wins': 'Gana {player}',
  Tie: 'Empate',
  'Duels won: {one}–{two} · tied: {ties}': 'Duelos ganados: {one}–{two} · empatados: {ties}',
  'New duel': 'Nuevo duelo',

  // Progress, on the cover
  'Levels cleared:': 'Niveles superados:',
  'of {total}': 'de {total}',
  'Your best endless streak:': 'Tu mejor racha sin fin:',
  // The streak, with its plural (`plural` of `menuWords.ts`): «1 gol», «2 goles».
  '{n} goal': '{n} gol',
  '{n} goals': '{n} goles',
  'Your record on {mode}:': 'Tu récord en {mode}:',

  // While playing
  'End run': 'Terminar tanda',
  'Leave the game': 'Dejar la partida',
  Stage: 'Fase',
  'Leave the game?': '¿Dejar la partida?',
  'You lose the goals you have scored.': 'Pierdes los goles que lleves.',
  'Keep playing': 'Seguir jugando',
  Leave: 'Salir',
  'Setting up the table…': 'Montando la mesa…',

  // What the tutorial asks for at each step, and its two ways out.
  'Close your hand on the mallet to pick it up':
    'Cierra la mano sobre el mazo para cogerlo',
  'Push the puck with it':
    'Empuja el disco con él',
  'Score a goal':
    'Marca un gol',
  'Press the grip button on the mallet to pick it up':
    'Pulsa el botón de agarre sobre el mazo para cogerlo',
  Next: 'Siguiente',
  'Skip tutorial': 'Saltar tutorial',
} as const

/** Every phrase the game knows how to say, written the way it is said in English. */
export type TextKey = keyof typeof ES

/**
 * All the phrases the game knows how to say.
 *
 * It is there so that a test can check that none has been left orphaned: a phrase changes
 * in the component and the old one stays here translated forever —it breaks nothing, and
 * that is why nobody ever removes it—.
 */
export const TEXT_KEYS = Object.keys(ES) as readonly TextKey[]

/**
 * A phrase in the language asked for.
 *
 * In English it returns the key, which already is the phrase: storing the original twice
 * would be having two places to change it and one to forget about.
 */
export function texto(lang: Lang, key: TextKey): string {
  return lang === 'es' ? ES[key] : key
}

/**
 * Fills the gaps of a phrase.
 *
 * Phrases with a gap carry `{something}` and are not split into pieces to concatenate them:
 * the word order changes from one language to another, and concatenating forces Spanish to
 * fake English syntax.
 */
export function formatText(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (gap, name: string) =>
    name in values ? String(values[name]) : gap,
  )
}

/** A translator that accepts any phrase: the goal sign's one (`Translate` of `goal.ts`). */
export type Translator = (key: string, values?: Record<string, string | number>) => string

/**
 * The translator that does not require the phrase to be in the dictionary: one that is not
 * there comes out as is.
 *
 * It is the one the goal sign receives, which translates its phrases and also what reaches it
 * already said from outside —the unit of the record, which the hall passes in the language of
 * whoever plays—.
 */
export function softTranslator(lang: Lang): Translator {
  return (phrase, values) => {
    // With `hasOwnProperty` and not with `in`: a unit named like something of `Object` is not a phrase.
    const said = lang === 'es' && Object.prototype.hasOwnProperty.call(ES, phrase) ? ES[phrase as TextKey] : phrase
    return values === undefined ? said : formatText(said, values)
  }
}

/**
 * The translator of a language, so as not to repeat it on every line.
 *
 * It is asked for once at the top of the component —`const t = translator(useLang())`— and
 * used as `t('Back to the menu')`, or with gaps: `t('· round {round}', { round })`.
 */
export function translator(lang: Lang) {
  return (key: TextKey, values?: Record<string, string | number>): string => {
    const phrase = texto(lang, key)
    return values === undefined ? phrase : formatText(phrase, values)
  }
}

/**
 * A figure with its thousands separated the way they are written in that language: «12.400»
 * and «12,400».
 *
 * English groups with a comma from four digits on («2,100») and Spanish with a dot and **from
 * five** («2100», «12.400»): it is the rule of the RAE and of CLDR, and the same as the goal
 * sign's (`NOTATION`, in `goal.ts`), so that the scoreboard and the sign write alike.
 *
 * By hand and not with `toLocaleString`: what it returns depends on the language data the
 * browser carries —the headset's does not carry all of it—, and with a fixed `'en-GB'` the
 * Spanish version said «8,068». It is Gloop Pop's arithmetic.
 */
export function formatFigure(n: number, lang: Lang): string {
  if (!Number.isFinite(n)) return '0'
  const { separator, from } = lang === 'es' ? { separator: '.', from: 5 } : { separator: ',', from: 4 }
  const rounded = Math.round(n)
  let rest = String(Math.abs(rounded))
  let thousands = ''
  // It is decided once, with the whole figure: either all of it is grouped or it is not grouped.
  const grouped = rest.length >= from
  while (grouped && rest.length > 3) {
    thousands = `${separator}${rest.slice(-3)}${thousands}`
    rest = rest.slice(0, -3)
  }
  return `${rounded < 0 ? '-' : ''}${rest}${thousands}`
}
