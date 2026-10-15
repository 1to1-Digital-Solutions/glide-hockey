/**
 * The hall's common words: what the buttons and the states of the menu are called, and the plural.
 *
 * It is the same file in every game, like `goal.ts`, and for the same reason: the button at the
 * end said «Otro reto», «Otra tanda», «Otra tacada» or «Otra vez» depending on the game, and the
 * two-player mode was «Duelo» or «A dos». Whoever goes from one cabinet to another has to find the
 * same words.
 *
 * **How it is used.** Like the sign: the key is the phrase in English. The game's dictionary puts
 * `...MENU_ES` next to `...GOAL_ES`, first of all, and the component says
 * `t(MENU_EN.anotherChallenge)` or directly `t('Another challenge')`. That the game does not
 * translate one of these phrases its own way is watched over by `menuWords.test.ts`.
 *
 * With nothing of the game or of the browser: it is ported to Godot as is.
 */

/** The common phrases, in English, which is their key. */
export const MENU_EN = {
  play: 'Play',
  challenge: 'Challenge',
  anotherChallenge: 'Another challenge',
  anotherRun: 'Another game',
  backToMenu: 'Back to the menu',
  exit: 'Exit',
  duel: 'Duel',
  settings: 'Settings',
  countsForMedal: 'Counts for a medal',
  challengeOver: 'Challenge over',
  /** The mode shown on the sign while the tutorial is pending: «… · no cuenta para medalla». */
  warmup: 'Warm-up',
  /** The same, said on the scoreboard: the same phrase as the sign with the mode «Warm-up». */
  warmupDoesNotCount: 'Warm-up · does not count for a medal',
  /** What the sign says when the tutorial is closed, when the challenge starts from zero. */
  nowItCounts: 'Now it counts for a medal',
  /** The hint of the common exit: holding B or Y for a second (`holdToExit.ts`). */
  exitHint: 'Hold B or Y to exit',
  /** The rows of the menu template (`menuTemplate.ts`): the mode, who plays and what is folded. */
  mode: 'Mode',
  players: 'Players',
  /** The «Jugadores» row says «Solo» and «Duelo»: one alone or two who pass the controller. */
  solo: 'Solo',
  moreOptions: 'More options',
  fewerOptions: 'Fewer options',
} as const

/** One of the common phrases of the menu. */
export type MenuPhrase = (typeof MENU_EN)[keyof typeof MENU_EN]

/** The common phrases in Spanish. Each game's dictionary includes them with `...MENU_ES`. */
export const MENU_ES = {
  Play: 'Jugar',
  Challenge: 'Reto',
  'Another challenge': 'Otro reto',
  'Another game': 'Otra partida',
  'Back to the menu': 'Volver al menú',
  Exit: 'Salir',
  Duel: 'Duelo',
  Settings: 'Ajustes',
  'Counts for a medal': 'Cuenta para medalla',
  'Challenge over': 'Reto terminado',
  'Warm-up': 'Calentamiento',
  'Warm-up · does not count for a medal': 'Calentamiento · no cuenta para medalla',
  'Now it counts for a medal': 'Ahora cuenta para medalla',
  'Hold B or Y to exit': 'Mantén B o Y para salir',
  Mode: 'Modo',
  Players: 'Jugadores',
  Solo: 'Solo',
  'More options': 'Más opciones',
  'Fewer options': 'Menos opciones',
} as const satisfies Record<MenuPhrase, string>

/**
 * The key that applies depending on how many there are: «1 canasta», «2 canastas». Both phrases go
 * in the dictionary, each with its translation, and the number goes in through the placeholder:
 *
 *     t(plural(baskets, '{n} basket', '{n} baskets'), { n: baskets })
 *
 * In English and in Spanish only one is singular (zero is plural too: «0 canastas»).
 */
export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}
