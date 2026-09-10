import { type ThreeEvent } from '@react-three/fiber'
import { describe, expect, it, vi } from 'vitest'
import {
  BOUNCE_PULSE,
  GOAL_PULSE,
  handednessOf,
  handsFor,
  PRESS_PULSE,
  pulseFor,
  pulsePressed,
  pulseSession,
  STRIKE_PULSE,
  type HapticSession,
  type HapticSource,
} from './haptics'

function source(handedness: string, pulse?: (value: number, duration: number) => unknown) {
  return {
    handedness,
    gamepad: pulse ? { hapticActuators: [{ pulse }] } : { hapticActuators: [] },
  }
}

const pointerFrom = (inputSource: unknown) =>
  ({ nativeEvent: { inputSource } }) as unknown as ThreeEvent<PointerEvent>

describe('pulseFor', () => {
  it('cada suceso de la mesa tiene su golpe', () => {
    expect(pulseFor('strike')).toBe(STRIKE_PULSE)
    expect(pulseFor('bounce')).toBe(BOUNCE_PULSE)
    expect(pulseFor('goal')).toBe(GOAL_PULSE)
  })

  it('se distinguen sin mirar: el golpe es fuerte, el rebote un toque y el gol largo en las dos manos', () => {
    expect(STRIKE_PULSE.intensity).toBeGreaterThan(BOUNCE_PULSE.intensity)
    expect(GOAL_PULSE.durationMs).toBeGreaterThan(STRIKE_PULSE.durationMs)
    expect(GOAL_PULSE.hands).toBe('both')
    expect(STRIKE_PULSE.hands).toBe('mallet')
  })
})

describe('handednessOf', () => {
  it('lee la mano del mando que mueve el mazo', () => {
    expect(handednessOf(pointerFrom({ handedness: 'left' }))).toBe('left')
    expect(handednessOf(pointerFrom({ handedness: 'right' }))).toBe('right')
  })

  it('con el ratón, o con un mando sin mano, no hay mano', () => {
    expect(handednessOf({ nativeEvent: {} } as unknown as ThreeEvent<PointerEvent>)).toBeNull()
    expect(handednessOf(pointerFrom({ handedness: 'none' }))).toBeNull()
  })
})

describe('handsFor', () => {
  it('el golpe del mazo va a la mano que lo lleva', () => {
    expect(handsFor(STRIKE_PULSE, 'left')).toEqual(['left'])
    expect(handsFor(BOUNCE_PULSE, 'right')).toEqual(['right'])
  })

  it('sin saber aún qué mano lleva el mazo, va a las dos', () => {
    expect(handsFor(STRIKE_PULSE, null)).toEqual(['left', 'right'])
  })

  it('el gol siempre va a las dos', () => {
    expect(handsFor(GOAL_PULSE, 'left')).toEqual(['left', 'right'])
  })
})

describe('pulseSession', () => {
  it('pulsa solo el mando de la mano del mazo', () => {
    const left = vi.fn()
    const right = vi.fn()
    const session: HapticSession = { inputSources: [source('left', left), source('right', right)] }

    expect(pulseSession(session, STRIKE_PULSE, 'right')).toBe(1)
    expect(right).toHaveBeenCalledWith(STRIKE_PULSE.intensity, STRIKE_PULSE.durationMs)
    expect(left).not.toHaveBeenCalled()
  })

  it('el gol llega a las dos manos', () => {
    const left = vi.fn()
    const right = vi.fn()
    const session: HapticSession = { inputSources: [source('left', left), source('right', right)] }

    expect(pulseSession(session, GOAL_PULSE, 'right')).toBe(2)
  })

  it('un mando sin vibrador, o que rechaza el pulso, no rompe nada', () => {
    const rejects = vi.fn(() => Promise.reject(new Error('sin permiso')))
    const throws = vi.fn(() => {
      throw new Error('desconectado')
    })
    // El que lanza va en una mano de verdad: puesto en `none` no llegaría a
    // llamarse y el caso que se quiere probar no ocurriría.
    const session: HapticSession = {
      inputSources: [source('left', throws), source('right', rejects), source('none')],
    }

    expect(() => pulseSession(session, GOAL_PULSE, null)).not.toThrow()
    expect(pulseSession(session, GOAL_PULSE, null)).toBe(1)
  })

  it('sin sesión no hay a quién pulsar', () => {
    expect(pulseSession(null, STRIKE_PULSE, 'left')).toBe(0)
  })
})


describe('un mando que dice tener vibrador pero no lo tiene', () => {
  it('se salta sin romper', () => {
    // `hapticActuators` está en el estándar pero no todos los navegadores lo
    // rellenan igual: unos lo dejan vacío y otros ponen un objeto sin `pulse`.
    const sinNada = { gamepad: undefined, handedness: 'left' }
    const sinLista = { gamepad: {}, handedness: 'right' }
    const sinPulse = { gamepad: { hapticActuators: [{}] }, handedness: 'none' }
    const session = {
      inputSources: [sinNada, sinLista, sinPulse],
    } as unknown as HapticSession

    expect(pulseSession(session, GOAL_PULSE, null)).toBe(0)
  })
})

/**
 * El toque que confirma un botón del visor.
 *
 * Dentro del visor el mando no se dibuja y lo que se pulsa es un rectángulo flotando: sin
 * este toque, el botón no da ninguna señal de haber oído nada. Va **al mando que ha
 * pulsado** y no a las dos manos, que contestarle a la otra sería contestarle a quien no ha
 * hecho nada.
 */
describe('el toque de un botón', () => {
  /** Un evento de puntero como el que llega de un mando del visor. */
  const desdeElMando = (source: HapticSource) => ({ nativeEvent: { inputSource: source } })

  it('vibra el mando que lo pulsa', () => {
    const pulse = vi.fn(() => Promise.resolve(true))

    expect(pulsePressed(desdeElMando(source('right', pulse)))).toBe(true)
    expect(pulse).toHaveBeenCalledWith(PRESS_PULSE.intensity, PRESS_PULSE.durationMs)
  })

  it('con el ratón no hay mando, y no pasa nada', () => {
    // Es el caso de escritorio: el mismo menú, sin nada que vibrar.
    expect(pulsePressed({ nativeEvent: {} })).toBe(false)
    expect(pulsePressed(null)).toBe(false)
  })

  it('un mando sin vibrador sigue siendo un mando', () => {
    expect(pulsePressed(desdeElMando(source('right')))).toBe(false)
  })

  it('un vibrador que falla no para la partida', () => {
    const roto: HapticSource = {
      handedness: 'right',
      gamepad: {
        hapticActuators: [
          {
            pulse: () => {
              throw new Error('sin vibrador')
            },
          },
        ],
      },
    }

    expect(pulsePressed(desdeElMando(roto))).toBe(false)
  })

  it('y uno que devuelve una promesa rota tampoco ensucia la consola', () => {
    const rechaza: HapticSource = {
      handedness: 'right',
      gamepad: { hapticActuators: [{ pulse: () => Promise.reject(new Error('no')) }] },
    }

    expect(pulsePressed(desdeElMando(rechaza))).toBe(true)
  })

  it('un toque de fuerza cero no es un toque', () => {
    const pulse = vi.fn(() => Promise.resolve(true))

    expect(
      pulsePressed(desdeElMando(source('right', pulse)), { ...PRESS_PULSE, intensity: 0 }),
    ).toBe(false)
    expect(pulse).not.toHaveBeenCalled()
  })
})
