import { MAX_PUCK_SPEED } from './gameConfig'

/**
 * El halo del disco: cuánto brilla según lo rápido que va.
 *
 * En el visor el disco cruza la mesa en medio segundo y un naranja mate se
 * pierde contra el tablero blanco; el halo que crece con la velocidad es lo
 * que deja seguirlo con el rabillo del ojo. Es una cuenta pura sobre la
 * velocidad (m/s) para poder fijarla sin escena: la pinta `Puck.tsx`.
 */

export interface PuckGlow {
  /** Intensidad emisiva del disco: un punto en reposo, mucho más a toda velocidad. */
  emissive: number
  /** Opacidad del anillo de luz que rodea al disco (0 = no se ve). */
  halo: number
  /** Cuánto se ensancha el anillo respecto al disco, en veces su radio. */
  haloScale: number
}

/** Brillo en reposo y a toda velocidad. */
const EMISSIVE_REST = 0.12
const EMISSIVE_MAX = 1.1
/** El anillo empieza a verse a partir de esta fracción de la velocidad máxima. */
const HALO_FROM = 0.15
const HALO_MAX_OPACITY = 0.55
const HALO_SCALE_REST = 1.15
const HALO_SCALE_MAX = 1.9

export function puckGlow(speed: number): PuckGlow {
  const s = Number.isFinite(speed) ? Math.min(1, Math.max(0, speed / MAX_PUCK_SPEED)) : 0
  const halo = Math.max(0, (s - HALO_FROM) / (1 - HALO_FROM))
  return {
    emissive: EMISSIVE_REST + (EMISSIVE_MAX - EMISSIVE_REST) * s,
    halo: HALO_MAX_OPACITY * halo,
    haloScale: HALO_SCALE_REST + (HALO_SCALE_MAX - HALO_SCALE_REST) * halo,
  }
}
