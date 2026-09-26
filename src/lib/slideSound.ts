/**
 * El roce del disco deslizándose: cuánto se oye y a qué tono, según su velocidad.
 *
 * Solo las cuentas, sin audio: las usa `audioEngine.ts` para mover su voz de ruido filtrado, y el
 * port a Godot para mover el bucle que se renderizó de esa misma voz. Un solo sitio para las dos,
 * así que el disco suena igual de rápido en las dos.
 */
import { MAX_PUCK_SPEED } from './gameConfig'
import { STALL_SPEED } from './puckPhysics'

/** Tope del roce respecto a un golpe entero, y su banda de frecuencias en Hz. */
export const SLIDE_MAX_LEVEL = 0.28
export const SLIDE_PITCH_MIN = 380
export const SLIDE_PITCH_MAX = 1900
/** Segundos que tarda el roce en seguir a la velocidad: sin saltos entre fotogramas. */
export const SLIDE_SMOOTHING = 0.05

/**
 * Cuánto se oye el disco deslizándose, de 0 a 1, según su velocidad en m/s.
 *
 * Nada por debajo de la velocidad a la que el disco cuenta como parado
 * (`STALL_SPEED`): un disco quieto no roza. De ahí sube con la raíz de la
 * velocidad —el oído nota más el arranque que la punta— hasta el tope a la
 * velocidad máxima. Es un sonido de fondo: nunca llega al volumen de un golpe.
 */
export function slideLevel(speed: number): number {
  if (!Number.isFinite(speed) || speed <= STALL_SPEED) return 0
  const t = Math.min(1, (speed - STALL_SPEED) / (MAX_PUCK_SPEED - STALL_SPEED))
  return SLIDE_MAX_LEVEL * Math.sqrt(t)
}

/**
 * A qué frecuencia se filtra el roce según la velocidad: más rápido, más agudo.
 * Es lo que hace que la velocidad se oiga y no solo el volumen.
 */
export function slidePitch(speed: number): number {
  const s = Number.isFinite(speed) ? Math.min(1, Math.max(0, speed / MAX_PUCK_SPEED)) : 0
  return SLIDE_PITCH_MIN + (SLIDE_PITCH_MAX - SLIDE_PITCH_MIN) * s
}
