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
export const HAZANAS = ['GH_SHUTOUT', 'GH_LONG_SHOT', 'GH_OWN_GOAL'] as const

export type Hazana = (typeof HAZANAS)[number]

/** Dónde se recuerda cuáles se han conseguido ya. Con el prefijo del juego, como los récords. */
export const HAZANAS_KEY = 'glide-hockey:hazanas'

/** El resultado con sus hazañas, o tal cual si no se estrenó ninguna. */
export function conHazanas(resultado: GameResult, nuevas: readonly Hazana[]): GameResult {
  return nuevas.length > 0 ? { ...resultado, feats: [...nuevas] } : resultado
}

/**
 * Las hazañas del texto guardado, en el orden de `HAZANAS` y sin repetir. Es entrada externa
 * (se edita a mano desde el navegador), así que lo que no es una hazaña de este juego se ignora.
 */
export function leerHazanas(texto: string | null): Hazana[] {
  const escritas = new Set((texto ?? '').split(','))
  return HAZANAS.filter((hazana) => escritas.has(hazana))
}

/** El texto guardado, tal cual: comparable con `Object.is` (ver `createStoredPreference`). */
const guardadas = createStoredPreference<string>({
  key: HAZANAS_KEY,
  parse: (raw) => raw ?? '',
  serialize: (value) => value,
})

/** Las que ya se consiguieron alguna vez. */
export function hazanasGuardadas(): Hazana[] {
  return leerHazanas(guardadas.get())
}

/**
 * Apunta las hazañas de una partida y devuelve **solo las que se estrenan**: las que ya estaban
 * no se vuelven a contar al salón. Sin ninguna nueva no escribe nada.
 */
export function estrenarHazanas(conseguidas: Iterable<Hazana>): Hazana[] {
  const antes = new Set(hazanasGuardadas())
  const ahora = new Set(conseguidas)
  const nuevas = HAZANAS.filter((hazana) => ahora.has(hazana) && !antes.has(hazana))
  if (nuevas.length > 0) {
    guardadas.save(HAZANAS.filter((hazana) => antes.has(hazana) || ahora.has(hazana)).join(','))
  }
  return nuevas
}

/**
 * Qué deja un partido cerrado: ganarlo sin encajar. La partida sin fin no cuenta —la cierra el
 * jugador cuando quiere y un 1-0 abandonado no es un partido—, y el duelo tampoco, que es de dos.
 */
export function hazanasDelPartido({
  ganado,
  encajados,
  sinFin,
}: {
  ganado: boolean
  encajados: number
  sinFin: boolean
}): Hazana[] {
  return ganado && !sinFin && encajados === 0 ? ['GH_SHUTOUT'] : []
}

/**
 * La jugada en curso, contada desde el último saque: quién tocó el disco el último y, si fue el
 * jugador, cuántas veces seguidas y desde dónde.
 */
export interface Jugada {
  /** Quién tocó el disco el último, o `null` si nadie desde el saque. */
  readonly ultimo: Scorer | null
  /** Toques seguidos del jugador sin que la máquina toque entre medias. */
  readonly toquesSeguidos: number
  /** Si el primero de esos toques fue con el disco en el fondo del campo propio. */
  readonly desdeElFondo: boolean
}

/** La jugada recién sacada: nadie ha tocado el disco. */
export const JUGADA_NUEVA: Jugada = { ultimo: null, toquesSeguidos: 0, desdeElFondo: false }

/**
 * Desde dónde cuenta un tiro como lejano: la mitad de atrás del campo propio, más cerca de tu
 * portería que de la línea de medio campo. El mazo no cruza esa línea, así que «desde tu campo»
 * es cualquier tiro; lo que pide destreza es cruzar la mesa entera de un toque.
 */
export const FONDO_DEL_CAMPO = HALF_LENGTH / 2

/**
 * Un toque de un mazo al disco. `z` es dónde estaba el disco, en coordenadas de la mesa: el
 * campo del jugador es el de `z` positiva.
 */
export function tocar(jugada: Jugada, quien: Scorer, z: number): Jugada {
  if (quien === 'opponent') return { ultimo: 'opponent', toquesSeguidos: 0, desdeElFondo: false }
  const primero = jugada.ultimo !== 'player'
  return {
    ultimo: 'player',
    toquesSeguidos: primero ? 1 : jugada.toquesSeguidos + 1,
    desdeElFondo: primero ? z >= FONDO_DEL_CAMPO : jugada.desdeElFondo,
  }
}

/**
 * La hazaña que deja un gol, según cómo fue la jugada: el del jugador de un solo toque desde el
 * fondo, o el que el jugador se mete en su propia portería (el último toque fue suyo).
 */
export function hazanaDelGol(jugada: Jugada, gol: Scorer): Hazana | null {
  if (jugada.ultimo !== 'player') return null
  if (gol === 'opponent') return 'GH_OWN_GOAL'
  return jugada.toquesSeguidos === 1 && jugada.desdeElFondo ? 'GH_LONG_SHOT' : null
}
