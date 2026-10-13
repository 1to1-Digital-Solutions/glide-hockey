/**
 * El jugador automático: a dónde lleva el mazo para jugar contra la máquina sin nadie delante.
 *
 * Sirve para comprobar sin visor ni ratón que la escena y la lógica están bien cosidas, para medir
 * el coste por fotograma y para que un test juegue una partida entera hasta el final. No pretende
 * jugar bien: pretende que haya goles de los dos lados y que la partida acabe. Con el reloj fijo
 * (`--fixed-fps`) y la semilla de la mesa, juega siempre la misma partida.
 *
 * La regla es la de cualquiera que empieza: con el disco en su mitad, ponerse **detrás** de él
 * (entre el disco y la portería propia) y empujarlo hacia delante; si el mazo ha quedado por
 * delante del disco, rodearlo por un lado en vez de empujarlo hacia su propia portería; con el
 * disco en la otra mitad, volver a defender delante de la portería, alineado con él.
 */
import { MALLET_RADIUS, PLAYER_MALLET_SPEED, PUCK_RADIUS } from '@/lib/gameConfig'
import type { TableState } from '@/lib/matchLoop'
import { HALF_LENGTH, constrainMallet, type Vec2 } from '@/lib/puckPhysics'

/** Lo que se separa el mazo del disco al rodearlo, en metros. */
const RODEO = MALLET_RADIUS + PUCK_RADIUS + 0.04

/** A dónde quiere ir el mazo del jugador automático con la mesa así. */
export function destinoDelBot({ puck, player }: Pick<TableState, 'puck' | 'player'>): Vec2 {
  const p = puck.position
  const m = player.position
  // El disco en la otra mitad: a defender, delante de la portería y alineado con él.
  if (p.z < -0.02) return constrainMallet({ x: p.x * 0.5, z: HALF_LENGTH - 0.28 }, 'player')
  // El mazo ha quedado por delante del disco: rodearlo por el lado en el que ya está.
  if (m.z < p.z + MALLET_RADIUS * 0.5) {
    const lado = m.x >= p.x ? 1 : -1
    return constrainMallet({ x: p.x + lado * RODEO, z: p.z + RODEO }, 'player')
  }
  // Detrás del disco: atravesarlo hacia delante, que es lo que lo manda a la otra portería.
  return constrainMallet({ x: p.x, z: p.z - 0.1 }, 'player')
}

/**
 * Lleva un punto hacia otro sin pasar de la velocidad del mazo: es la mano del jugador automático
 * con visor, que no puede saltar de un lado de la mesa al otro en un fotograma (el mazo en la mano
 * golpea con la velocidad de la mano).
 */
export function acercar(desde: Vec2, hacia: Vec2, delta: number, velocidad = PLAYER_MALLET_SPEED * 0.8): Vec2 {
  const dx = hacia.x - desde.x
  const dz = hacia.z - desde.z
  const d = Math.hypot(dx, dz)
  const paso = velocidad * delta
  if (d <= paso || d === 0) return hacia
  return { x: desde.x + (dx / d) * paso, z: desde.z + (dz / d) * paso }
}
