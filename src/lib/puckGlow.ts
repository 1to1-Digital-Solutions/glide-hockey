import { MAX_PUCK_SPEED } from './gameConfig'

/**
 * Cuánto brilla el disco según lo rápido que va.
 *
 * En el visor el disco cruza la mesa en medio segundo y un naranja mate se pierde contra el
 * tablero blanco; que se encienda con la velocidad es lo que deja seguirlo con el rabillo del
 * ojo. Es una cuenta pura sobre la velocidad (m/s) para poder fijarla sin escena: la pinta
 * `Puck.tsx`.
 *
 * **Y ya no lleva anillo.** Tenía además un halo que se ensanchaba con la velocidad, y con el
 * visor puesto no se leía como un disco rápido sino como un foco: «tiene como una aureola
 * alrededor, como un haz de luz; eso lo quitaría». El disco encendido hace el mismo trabajo
 * —dice dónde está sin mirarlo de frente— sin parecer otra cosa.
 */

export interface PuckGlow {
  /** Intensidad emisiva del disco: un punto en reposo, mucho más a toda velocidad. */
  emissive: number
}

/** Brillo en reposo y a toda velocidad. */
const EMISSIVE_REST = 0.12
const EMISSIVE_MAX = 1.1

export function puckGlow(speed: number): PuckGlow {
  const s = Number.isFinite(speed) ? Math.min(1, Math.max(0, speed / MAX_PUCK_SPEED)) : 0
  return { emissive: EMISSIVE_REST + (EMISSIVE_MAX - EMISSIVE_REST) * s }
}
