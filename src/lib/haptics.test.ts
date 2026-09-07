import { type ThreeEvent } from '@react-three/fiber'
import { describe, expect, it, vi } from 'vitest'
import {
  BOUNCE_PULSE,
  GOAL_PULSE,
  STRIKE_PULSE,
  handednessOf,
  handsFor,
  pulseFor,
  pulseSession,
  type HapticSession,
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
