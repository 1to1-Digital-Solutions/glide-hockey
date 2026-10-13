import { DEFAULT_GOALS, type Difficulty } from './gameConfig'

/**
 * El duelo: dos personas, un mando y la misma máquina.
 *
 * **Por qué por partidas y no gol a gol.** Sin red, dos jugadores solo pueden turnarse el mando, y
 * en air hockey el ritmo lo es todo: pasarse el visor tras cada gol —quitárselo, ajustarlo, volver
 * a coger el mazo— rompería cada jugada y convertiría la partida en una sucesión de esperas. Los
 * hermanos con modo a dos cambian de turno por una unidad de juego entera (un cuadro en bolos, un
 * hoyo en minigolf, un partido en table-tennis), y aquí la unidad natural es **la partida**.
 *
 * **Por qué contra la máquina y no uno contra otro.** No hay forma de devolverle a alguien un disco
 * que se jugó hace un minuto. Lo que sí se puede es darles a los dos **el mismo rival**: la
 * máquina, al mismo nivel y a los mismos goles (`DUEL_SETUP`), y con **la misma semilla** en las
 * dos partidas (`Duel.seed`). La máquina elige cada tiro con un hash de la semilla, la jugada y el
 * golpe (`opponent.ts`), así que en la misma jugada y el mismo golpe tira igual a los dos: nadie
 * juega contra una máquina con más suerte. Como la mesa es caótica, el disco no rebota igual —eso
 * lo decide cómo juega cada uno—, pero las decisiones de la máquina sí son las mismas.
 *
 * **Gana quien le saque más ventaja a la máquina**: goles a favor menos goles en contra. Ganar o
 * perder la partida no basta para comparar —los dos pueden ganarla— y los goles a favor tampoco:
 * quien pierde 5–7 ha marcado más que quien gana 7–0. La diferencia sí dice quién ha dominado a la
 * máquina. Con la misma diferencia es empate: desempatar por otra cifra sería premiar algo que
 * nadie buscaba.
 *
 * Funciones puras, sin React: el duelo entero se prueba sin montar el juego, y el port de Godot lo
 * usa tal cual.
 */

export type Player = 0 | 1

/** Cómo se llama cada uno en pantalla, en inglés: es la clave con la que se traduce. */
export const PLAYER_LABELS = ['Player 1', 'Player 2'] as const satisfies readonly [string, string]

/**
 * Cómo se juega el duelo: la máquina en Media y a 7 goles, la partida con la que se entra en la
 * práctica.
 *
 * Fijo para que los dos jueguen contra lo mismo sin ponerse de acuerdo en el menú, que es justo lo
 * que hace falta para que la ventaja de uno se compare con la del otro. Media y no Fácil porque en
 * Fácil quien sepa mover el mazo gana 7–0, y dos 7–0 son un empate que no dice nada.
 */
export const DUEL_SETUP = { difficulty: 'medium', goalTarget: DEFAULT_GOALS } as const satisfies {
  difficulty: Difficulty
  goalTarget: number
}

/** El marcador de una partida contra la máquina. */
export interface MatchScore {
  /** Goles que metió quien jugaba. */
  readonly scored: number
  /** Goles que le metió la máquina. */
  readonly conceded: number
}

/** Un duelo: la semilla de la máquina y las dos partidas, en orden de jugador. */
export interface Duel {
  /** Con qué semilla elige sus tiros la máquina en las dos partidas (`AimSeed.match`). */
  readonly seed: number
  /** `null` es que todavía no se ha jugado. */
  readonly matches: readonly [MatchScore | null, MatchScore | null]
}

/** Un duelo sin empezar, con la semilla de sus dos partidas: le toca al primero. */
export function newDuel(seed: number): Duel {
  return { seed, matches: [null, null] }
}

/** A quién le toca jugar, o `null` si los dos han jugado ya. */
export function duelTurn(duel: Duel): Player | null {
  if (duel.matches[0] == null) return 0
  if (duel.matches[1] == null) return 1
  return null
}

/**
 * Quién tiene el mando: a quien le toca o, con las dos partidas jugadas, el último que jugó.
 *
 * Es lo que pinta el marcador —de quién es la partida que se ve— y siempre es alguien: un duelo
 * acabado sigue enseñando la partida que lo cerró.
 */
export function controllerHolder(duel: Duel): Player {
  return duelTurn(duel) ?? 1
}

/** ¿Han jugado los dos? */
export function duelOver(duel: Duel): boolean {
  return duelTurn(duel) == null
}

/**
 * Apunta la partida de quien tenía el turno. La semilla no cambia: es la de las dos.
 *
 * Con el duelo acabado no apunta nada: una tercera partida no es de nadie, y sobrescribir una de
 * las dos cambiaría el resultado de algo que ya se ha visto.
 */
export function recordMatch(duel: Duel, score: MatchScore): Duel {
  const turn = duelTurn(duel)
  if (turn == null) return duel
  return { seed: duel.seed, matches: turn === 0 ? [score, duel.matches[1]] : [duel.matches[0], score] }
}

/** La ventaja que le sacó a la máquina: positiva si le metió más goles de los que recibió. */
export function margin(score: MatchScore): number {
  return score.scored - score.conceded
}

/** La ventaja escrita como se lee en un marcador: «+3», «−2» o «0». */
export function formatMargin(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `−${-value}`
  return '0'
}

/** Quién ha ganado el duelo, o `null` si no ha acabado o van empatados. */
export function duelWinner(duel: Duel): Player | null {
  const [one, two] = duel.matches
  if (one == null || two == null) return null
  const diff = margin(one) - margin(two)
  if (diff === 0) return null
  return diff > 0 ? 0 : 1
}

/**
 * Si el final que acaba de llegar suena a ganar. `duelAcabado` es que con esta partida han jugado
 * ya los dos (`DuelView.over`); fuera del duelo, `false`.
 *
 * Fuera del duelo, y en la partida del primero, lo dice el marcador contra la máquina. **El final
 * del duelo suena siempre a ganar**: ahí no se cierra una partida contra la máquina sino el duelo,
 * y lo gana uno de los dos que están delante —o empatan, que tampoco es perder—. Con el marcador
 * de la segunda partida, un duelo ganado por quien jugó primero sonaba a derrota.
 */
export function endSoundsLikeWin(duelAcabado: boolean, marcador: MatchScore): boolean {
  return duelAcabado || marcador.scored > marcador.conceded
}
