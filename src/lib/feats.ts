import { HALF_LENGTH, type Scorer } from './puckPhysics'
import type { GameResult } from './seed'
import { createStoredPreference } from './storage'

/**
 * Las hazañas de Glide Hockey: lo que el juego tiene que saber para que el salón pueda dar sus
 * logros de destreza y el oculto (`xrcade/docs/logros-de-steam.md`, los marcados con ➕).
 *
 * El juego no sabe de Steam ni de logros: apunta la primera vez que alguien consigue cada cosa
 * y se lo cuenta al salón al acabar la partida, con el nombre de API que el salón declara en
 * Steamworks. Todo son cuentas puras sobre lo que la mesa ya dice (quién toca el disco, dónde y
 * quién marca) y sobre el marcador, así que el port de Godot lo hereda tal cual.
 *
 * - `GH_SHUTOUT`: ganar un partido sin encajar un gol.
 * - `GH_LONG_SHOT`: marcar de un solo toque desde el fondo de tu campo.
 * - `GH_OWN_GOAL` (oculto): marcar en tu propia portería.
 */
export const FEATS = ['GH_SHUTOUT', 'GH_LONG_SHOT', 'GH_OWN_GOAL'] as const

export type Feat = (typeof FEATS)[number]

/** Dónde se recuerda cuáles se han conseguido ya. Con el prefijo del juego, como los récords. */
export const FEATS_KEY = 'glide-hockey:hazanas'

/** El resultado con sus hazañas, o tal cual si no se estrenó ninguna. */
export function withFeats(resultado: GameResult, nuevas: readonly Feat[]): GameResult {
  return nuevas.length > 0 ? { ...resultado, feats: [...nuevas] } : resultado
}

/**
 * Las hazañas del texto guardado, en el orden de `HAZANAS` y sin repetir. Es entrada externa
 * (se edita a mano desde el navegador), así que lo que no es una hazaña de este juego se ignora.
 */
export function readFeats(texto: string | null): Feat[] {
  const escritas = new Set((texto ?? '').split(','))
  return FEATS.filter((hazana) => escritas.has(hazana))
}

/** El texto guardado, tal cual: comparable con `Object.is` (ver `createStoredPreference`). */
const guardadas = createStoredPreference<string>({
  key: FEATS_KEY,
  parse: (raw) => raw ?? '',
  serialize: (value) => value,
})

/** Las que ya se consiguieron alguna vez. */
export function storedFeats(): Feat[] {
  return readFeats(guardadas.get())
}

/**
 * Apunta las hazañas de una partida y devuelve **solo las que se estrenan**: las que ya estaban
 * no se vuelven a contar al salón. Sin ninguna nueva no escribe nada.
 */
export function earnFeats(conseguidas: Iterable<Feat>): Feat[] {
  const antes = new Set(storedFeats())
  const ahora = new Set(conseguidas)
  const nuevas = FEATS.filter((hazana) => ahora.has(hazana) && !antes.has(hazana))
  if (nuevas.length > 0) {
    guardadas.save(FEATS.filter((hazana) => antes.has(hazana) || ahora.has(hazana)).join(','))
  }
  return nuevas
}

/**
 * Qué deja un partido cerrado: ganarlo sin encajar. La partida sin fin no cuenta —la cierra el
 * jugador cuando quiere y un 1-0 abandonado no es un partido—, y el duelo tampoco, que es de dos.
 */
export function matchFeats({
  won: ganado,
  conceded: encajados,
  sinFin,
}: {
  won: boolean
  conceded: number
  sinFin: boolean
}): Feat[] {
  return ganado && !sinFin && encajados === 0 ? ['GH_SHUTOUT'] : []
}

/**
 * La jugada en curso, contada desde el último saque: quién tocó el disco el último y, si fue el
 * jugador, cuántas veces seguidas y desde dónde.
 */
export interface Possession {
  /** Quién tocó el disco el último, o `null` si nadie desde el saque. */
  readonly last: Scorer | null
  /** Toques seguidos del jugador sin que la máquina toque entre medias. */
  readonly touchesInARow: number
  /** Si el primero de esos toques fue con el disco en el fondo del campo propio. */
  readonly fromTheBack: boolean
}

/** La jugada recién sacada: nadie ha tocado el disco. */
export const NEW_POSSESSION: Possession = { last: null, touchesInARow: 0, fromTheBack: false }

/**
 * Desde dónde cuenta un tiro como lejano: la mitad de atrás del campo propio, más cerca de tu
 * portería que de la línea de medio campo. El mazo no cruza esa línea, así que «desde tu campo»
 * es cualquier tiro; lo que pide destreza es cruzar la mesa entera de un toque.
 */
export const BACK_OF_OWN_HALF = HALF_LENGTH / 2

/**
 * Un toque de un mazo al disco. `z` es dónde estaba el disco, en coordenadas de la mesa: el
 * campo del jugador es el de `z` positiva.
 */
export function touch(jugada: Possession, quien: Scorer, z: number): Possession {
  if (quien === 'opponent') return { last: 'opponent', touchesInARow: 0, fromTheBack: false }
  const primero = jugada.last !== 'player'
  return {
    last: 'player',
    touchesInARow: primero ? 1 : jugada.touchesInARow + 1,
    fromTheBack: primero ? z >= BACK_OF_OWN_HALF : jugada.fromTheBack,
  }
}

/**
 * La hazaña que deja un gol, según cómo fue la jugada: el del jugador de un solo toque desde el
 * fondo, o el que el jugador se mete en su propia portería (el último toque fue suyo).
 */
export function goalFeat(jugada: Possession, gol: Scorer): Feat | null {
  if (jugada.last !== 'player') return null
  if (gol === 'opponent') return 'GH_OWN_GOAL'
  return jugada.touchesInARow === 1 && jugada.fromTheBack ? 'GH_LONG_SHOT' : null
}
