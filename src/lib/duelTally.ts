import type { Player } from './duel'
import { createStoredPreference } from './storage'

/**
 * Cuántos duelos ha ganado cada uno, guardado en el navegador.
 *
 * Jugar contra alguien es el momento más memorable de una sesión, y un duelo que se cierra y se
 * borra no deja nada: lo que cuenta entre dos es quién gana, y se apunta. Es lo mismo que hacen
 * minigolf y table-tennis, con el mismo formato.
 *
 * El récord no lo toca a propósito: los goles de un duelo son de dos personas y no dicen nada de
 * la marca de ninguna. Y esto no viaja al salón: el salón enseña la mejor marca de una persona, y
 * esto es de la pareja que esté delante. Tampoco identifica a nadie: son tres números.
 *
 * Sin React, para que el port de Godot lo guarde con estas mismas funciones; lo que la web pinta
 * suscrito vive en `useDuelTally.ts`.
 */

/** Los duelos ganados por cada uno, en orden de jugador, y los empatados. */
export interface DuelTally {
  readonly wins: readonly [number, number]
  readonly ties: number
}

/** Dónde se recuerda. Con prefijo, como los récords, para no chocar con nada. */
export const DUEL_TALLY_KEY = 'glide-hockey:duel-tally'

const EMPTY: DuelTally = { wins: [0, 0], ties: 0 }

/** Un contador entero y no negativo, o cero: es entrada externa. */
function count(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

/** Interpreta lo leído del almacenamiento. */
export function parseDuelTally(raw: string | null): DuelTally {
  if (raw == null) return EMPTY
  try {
    const value = JSON.parse(raw) as { wins?: unknown[]; ties?: unknown }
    const wins = Array.isArray(value?.wins) ? value.wins : []
    return { wins: [count(wins[0]), count(wins[1])], ties: count(value?.ties) }
  } catch {
    // Lo escribió otra versión, o alguien a mano desde las herramientas del navegador.
    return EMPTY
  }
}

/**
 * El marcador, guardado como el texto que se escribió.
 *
 * Se guarda **el texto y no el objeto** a propósito: `createStoredPreference` vuelve a leer y
 * a interpretar en cada lectura, y `useSyncExternalStore` compara dos lecturas seguidas con
 * `Object.is`. Un objeto nuevo cada vez dejaría a React repintando sin parar; un texto no.
 */
const guardado = createStoredPreference<string>({
  key: DUEL_TALLY_KEY,
  parse: (raw) => raw ?? '',
  serialize: (value) => value,
})

/**
 * El marcador tal y como está guardado, para quien se suscribe a él (`useDuelTally.ts`): el texto
 * y no el objeto, por lo que se cuenta arriba.
 */
export const storedTally = {
  subscribe: guardado.subscribe,
  get: guardado.get,
  getServer: guardado.getServer,
}

/** Interpreta el texto guardado: vacío es que todavía no hay nada apuntado. */
export function tallyFromText(texto: string): DuelTally {
  return parseDuelTally(texto === '' ? null : texto)
}

/** Lo que llevan ahora mismo, sin suscribirse a nada. */
export function getDuelTally(): DuelTally {
  return tallyFromText(guardado.get())
}

/**
 * Apunta cómo acabó un duelo: quién lo ganó, o `null` si fue empate.
 *
 * No devuelve nada: quien lo mire está suscrito (`useDuelTally`) y se entera solo. Devolver
 * el marcador invitaría a guardarlo en estado de React, y entonces habría dos copias de lo
 * mismo que pueden discrepar.
 */
export function saveDuelResult(winner: Player | null): void {
  const antes = getDuelTally()
  const tally: DuelTally =
    winner == null
      ? { wins: antes.wins, ties: antes.ties + 1 }
      : {
          wins:
            winner === 0
              ? [antes.wins[0] + 1, antes.wins[1]]
              : [antes.wins[0], antes.wins[1] + 1],
          ties: antes.ties,
        }

  guardado.save(JSON.stringify(tally))
}
