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
  uiRiseOverWorld,
  worldRise,
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

describe('el mundo a la altura de quien juega', () => {
  it('de pie no se mueve nada, mida lo que mida', () => {
    // Es lo que ve quien no ha pedido nada, que son casi todos: la escena
    // exactamente donde ha estado siempre.
    expect(worldRise(1.2, false)).toBe(0)
    expect(worldRise(1.6, false)).toBe(0)
    expect(worldRise(2.0, false)).toBe(0)
  })

  it('sentado, el mundo baja hasta los ojos', () => {
    // Un jugador sentado mide sobre metro veinte de ojos: el mundo tiene que
    // bajar los cuarenta centímetros que le faltan para alcanzarlo.
    expect(worldRise(1.2, true)).toBeCloseTo(-0.4, 10)
  })

  it('a quien es más alto le sube, por lo mismo', () => {
    expect(worldRise(1.8, true)).toBeCloseTo(0.2, 10)
  })

  it('sin medida buena no se inventa nada', () => {
    // Sin suelo en el espacio de referencia, o con el visor sobre la mesa, la
    // cota no es una estatura: se juega con la escena donde estaba.
    for (const cota of [null, undefined, Number.NaN, 0, 5]) {
      expect(worldRise(cota, true)).toBe(0)
    }
  })
})

describe('la interfaz cuando el mundo ya se ha movido', () => {
  it('con el mundo quieto, la interfaz se coloca ella sola', () => {
    expect(uiRiseOverWorld(1.4, false)).toBeCloseTo(uiRise(1.4), 10)
  })

  it('con el mundo bajado, no se corrige otra vez', () => {
    // Sumar las dos correcciones dejaba el menú a la altura de las rodillas,
    // justo para quien menos puede agacharse a buscarlo.
    expect(uiRiseOverWorld(1.2, true)).toBe(0)
    expect(uiRiseOverWorld(1.9, true)).toBe(0)
  })

  it('sin medida buena no se mueve nada, se pida lo que se pida', () => {
    expect(uiRiseOverWorld(null, true)).toBe(0)
    expect(uiRiseOverWorld(null, false)).toBe(0)
  })
})
