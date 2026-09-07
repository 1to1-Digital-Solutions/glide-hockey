import { describe, expect, it } from 'vitest'
import { STRIKE_PULSE } from './haptics'
import { scaledPulse } from './useGameHaptics'

/**
 * La vibración se escala con la fuerza del impacto, no con la puntuación: un
 * roce y un golpe seco tienen que notarse distintos en la mano. Lo que no
 * cambia es la duración, que es lo que hace que se reconozcan como el mismo
 * suceso.
 */

describe('la vibración según la fuerza del impacto', () => {
  it('el golpe más fuerte vibra entero', () => {
    expect(scaledPulse(STRIKE_PULSE, 1).intensity).toBeCloseTo(STRIKE_PULSE.intensity, 9)
  })

  it('el más flojo se nota, pero poco', () => {
    const flojo = scaledPulse(STRIKE_PULSE, 0).intensity

    expect(flojo).toBeGreaterThan(0)
    expect(flojo).toBeLessThan(STRIKE_PULSE.intensity)
  })

  it('lo que va entre medias, va entre medias', () => {
    expect(scaledPulse(STRIKE_PULSE, 0.5).intensity).toBeGreaterThan(
      scaledPulse(STRIKE_PULSE, 0.2).intensity,
    )
  })

  it('la duración no cambia: es lo que hace reconocible el suceso', () => {
    for (const strength of [0, 0.5, 1]) {
      expect(scaledPulse(STRIKE_PULSE, strength).durationMs).toBe(STRIKE_PULSE.durationMs)
    }
  })

  it('una fuerza imposible se trata como la máxima, no como un pulso raro', () => {
    // Sale de la velocidad del disco, que en un fotograma perdido puede llegar
    // como NaN: sin esto, el mando recibiría una intensidad que no es número.
    for (const strength of [Number.NaN, Number.POSITIVE_INFINITY, 5]) {
      expect(scaledPulse(STRIKE_PULSE, strength).intensity, String(strength)).toBeCloseTo(
        STRIKE_PULSE.intensity,
        9,
      )
    }
  })

  it('y una negativa, como la mínima', () => {
    expect(scaledPulse(STRIKE_PULSE, -3).intensity).toBe(scaledPulse(STRIKE_PULSE, 0).intensity)
  })
})
