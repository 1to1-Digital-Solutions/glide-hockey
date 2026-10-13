/**
 * Las palabras comunes del salón: cómo se llaman los botones y los estados del menú, y el plural.
 *
 * Es el mismo fichero en todos los juegos, como `objetivo.ts`, y por la misma razón: el botón del
 * final decía «Otro reto», «Otra tanda», «Otra tacada» u «Otra vez» según el juego, y el modo a dos
 * era «Duelo» o «A dos». Quien pasa de una cabina a otra tiene que encontrar las mismas palabras.
 *
 * **Cómo se usa.** Como el cartel: la clave es la frase en inglés. El diccionario del juego pone
 * `...MENU_ES` junto a `...OBJETIVO_ES`, lo primero, y el componente dice `t(MENU_EN.otroReto)` o
 * directamente `t('Another challenge')`. Que el juego no traduzca una de estas frases a su manera
 * lo vigila `palabras.test.ts`.
 *
 * Sin nada del juego ni del navegador: se porta a Godot tal cual.
 */

/** Las frases comunes, en inglés, que es su clave. */
export const MENU_EN = {
  jugar: 'Play',
  reto: 'Challenge',
  otroReto: 'Another challenge',
  otraPartida: 'Another game',
  volverAlMenu: 'Back to the menu',
  salir: 'Exit',
  duelo: 'Duel',
  ajustes: 'Settings',
  cuentaParaMedalla: 'Counts for a medal',
  retoTerminado: 'Challenge over',
  /** El modo que se enseña en el cartel mientras el tutorial está pendiente: «… · no cuenta para medalla». */
  calentamiento: 'Warm-up',
  /** Lo mismo, dicho en el marcador: la misma frase que el cartel con el modo «Warm-up». */
  calentamientoNoCuenta: 'Warm-up · does not count for a medal',
  /** Lo que dice el cartel al cerrar el tutorial, cuando el reto empieza de cero. */
  ahoraCuenta: 'Now it counts for a medal',
  /** La pista de la salida común: sostener un segundo el B o el Y (`holdToExit.ts`). */
  pistaDeSalir: 'Hold B or Y to exit',
  /** Las filas de la plantilla del menú (`plantillaDelMenu.ts`): el modo, quién juega y lo plegado. */
  modo: 'Mode',
  jugadores: 'Players',
  /** La fila «Jugadores» dice «Solo» y «Duelo»: uno solo o dos que se pasan el mando. */
  solo: 'Solo',
  masOpciones: 'More options',
  menosOpciones: 'Fewer options',
} as const

/** Una de las frases comunes del menú. */
export type FraseDelMenu = (typeof MENU_EN)[keyof typeof MENU_EN]

/** Las frases comunes en español. El diccionario de cada juego las incluye con `...MENU_ES`. */
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
} as const satisfies Record<FraseDelMenu, string>

/**
 * La clave que toca según cuántos sean: «1 canasta», «2 canastas». Las dos frases van en el
 * diccionario, cada una con su traducción, y el número entra por el hueco:
 *
 *     t(plural(canastas, '{n} basket', '{n} baskets'), { n: canastas })
 *
 * En inglés y en español solo el uno va en singular (el cero también es plural: «0 canastas»).
 */
export function plural(cuantos: number, una: string, varias: string): string {
  return cuantos === 1 ? una : varias
}
