import { describe, expect, it } from 'vitest'

import {
  MAX_EYE_HEIGHT,
  MIN_EYE_HEIGHT,
  REFERENCE_EYE_HEIGHT,
  RETAKE_DELTA,
  RETAKE_SECONDS,
  hasFloorReference,
  isPlausibleEyeHeight,
  startTracking,
  trackHeight,
  uiRise,
} from './uiHeight'

/**
 * La interfaz a la altura de quien juega.
 *
 * Estaba clavada a una cota fija: a alguien bajo le quedaba por encima de la vista y a
 * alguien alto, a la altura del pecho —y ahí están los ajustes y el botón de salir—. Esto se
 * prueba aquí porque es aritmética; que se lea cómodo ya es de ponerse el visor.
 */
describe('qué cota se da por buena', () => {
  it('la de unos ojos, de pie o sentado', () => {
    expect(isPlausibleEyeHeight(1.6)).toBe(true)
    expect(isPlausibleEyeHeight(MIN_EYE_HEIGHT)).toBe(true)
    expect(isPlausibleEyeHeight(MAX_EYE_HEIGHT)).toBe(true)
  })

  it('y no la del visor en una mesa ni la de nadie de tres metros', () => {
    expect(isPlausibleEyeHeight(0.4)).toBe(false)
    expect(isPlausibleEyeHeight(3)).toBe(false)
    expect(isPlausibleEyeHeight(null)).toBe(false)
    expect(isPlausibleEyeHeight(Number.NaN)).toBe(false)
  })
})

describe('cuánto sube la interfaz', () => {
  it('con la estatura de referencia se queda exactamente donde estaba', () => {
    expect(uiRise(REFERENCE_EYE_HEIGHT)).toBe(0)
  })

  it('sube con quien es más alto y baja con quien es más bajo', () => {
    expect(uiRise(1.8)).toBeCloseTo(0.2, 6)
    expect(uiRise(1.4)).toBeCloseTo(-0.2, 6)
  })

  it('sin cota buena no se inventa nada', () => {
    expect(uiRise(null)).toBe(0)
    expect(uiRise(0.2)).toBe(0)
  })
})

describe('si la sesión mide desde el suelo', () => {
  it('con `local-floor` o `bounded-floor`, sí', () => {
    expect(hasFloorReference(['local-floor'])).toBe(true)
    expect(hasFloorReference(['bounded-floor'])).toBe(true)
  })

  it('sin lista se da por buena: hay navegadores que no la publican', () => {
    expect(hasFloorReference(undefined)).toBe(true)
  })

  it('con lista y sin suelo, no', () => {
    expect(hasFloorReference(['local'])).toBe(false)
  })
})

describe('cuándo se vuelve a medir', () => {
  const paso = (state: ReturnType<typeof startTracking>, cota: number | null, segundos = 1 / 72) =>
    trackHeight(state, cota, 1, segundos)

  it('la primera medida buena se usa tal cual', () => {
    // Entrar y ver el menú a la altura de los ojos, no un panel subiendo despacio.
    expect(paso(startTracking(), 1.75).held).toBeCloseTo(1.75, 6)
  })

  it('sin medida buena no se toca nada', () => {
    const inicial = startTracking()

    expect(paso(inicial, null)).toBe(inicial)
    expect(paso(inicial, 0.3)).toBe(inicial)
  })

  it('moverse mientras se juega no mueve la interfaz', () => {
    // Ponerse de puntillas o agacharse a por algo: la interfaz se queda quieta, que si no
    // el botón se escapa justo al ir a apuntarlo.
    let state = paso(startTracking(), 1.7)
    for (let t = 0; t < 2; t += 1 / 72) state = paso(state, 1.7 + RETAKE_DELTA * 0.8)

    expect(state.held).toBeCloseTo(1.7, 6)
  })

  it('un cambio grande y corto tampoco', () => {
    let state = paso(startTracking(), 1.7)
    for (let t = 0; t < RETAKE_SECONDS / 2; t += 1 / 72) state = paso(state, 1.2)

    expect(state.held).toBeCloseTo(1.7, 6)
  })

  it('pero sentarse a media partida sí', () => {
    let state = paso(startTracking(), 1.7)
    for (let t = 0; t < RETAKE_SECONDS * 2; t += 1 / 72) state = paso(state, 1.2)

    expect(state.held).toBeCloseTo(1.2, 6)
  })
})
