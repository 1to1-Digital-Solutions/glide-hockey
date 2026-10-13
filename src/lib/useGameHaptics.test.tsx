import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type HapticSession } from './haptics'
import { HAPTIC_RECIPES } from './hapticFeedback'
import { useGameHaptics } from './useGameHaptics'

/**
 * Lo que el hook añade sobre `haptics.ts` (que ya tiene sus tests): que los golpes van a la
 * sesión abierta y **solo** a la mano que `MalletHand` dijo que lleva el mazo, que sin mano no
 * vibra nada, y que la cola del golpe se cancela al desmontar.
 */
const xr = vi.hoisted(() => ({
  left: vi.fn(),
  right: vi.fn(),
  session: null as HapticSession | null,
}))
vi.mock('@react-three/xr', () => ({
  useXR: (select: (state: { session: HapticSession | null }) => unknown) =>
    select({ session: xr.session }),
}))

function withHeadset() {
  xr.left.mockClear()
  xr.right.mockClear()
  xr.session = {
    inputSources: [
      { handedness: 'left', gamepad: { hapticActuators: [{ pulse: xr.left }] } },
      { handedness: 'right', gamepad: { hapticActuators: [{ pulse: xr.right }] } },
    ],
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useGameHaptics', () => {
  it('sin nadie con el mazo en la mano, un golpe no vibra en ninguna', () => {
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())

    result.current.sentir({ tipo: 'golpe', fuerza: 1 })

    expect(xr.left).not.toHaveBeenCalled()
    expect(xr.right).not.toHaveBeenCalled()
  })

  it('con el mazo en la izquierda, el golpe y su cola van a la izquierda y nada más', () => {
    vi.useFakeTimers()
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())

    result.current.noteHand('left')
    result.current.sentir({ tipo: 'golpe', fuerza: 1 })
    expect(xr.left).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(HAPTIC_RECIPES.impact.ms)

    expect(xr.left).toHaveBeenCalledTimes(2)
    expect(xr.right).not.toHaveBeenCalled()
  })

  it('cambiar el mazo de mano cambia la mano que vibra, y soltarlo la apaga', () => {
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())

    result.current.noteHand('left')
    result.current.noteHand('right')
    result.current.sentir({ tipo: 'gol' })
    expect(xr.right).toHaveBeenCalledTimes(1)
    expect(xr.left).not.toHaveBeenCalled()

    result.current.noteHand(null)
    result.current.sentir({ tipo: 'gol' })
    expect(xr.right).toHaveBeenCalledTimes(1)
  })

  it('desmontar cancela la cola que quedaba por sonar', () => {
    vi.useFakeTimers()
    withHeadset()
    const { result, unmount } = renderHook(() => useGameHaptics())

    result.current.noteHand('right')
    result.current.sentir({ tipo: 'golpe', fuerza: 1 })
    unmount()
    vi.advanceTimersByTime(1000)

    expect(xr.right).toHaveBeenCalledTimes(1)
  })

  it('sin sesión inmersiva no hay mandos que pulsar, y no pasa nada', () => {
    withHeadset()
    xr.session = null
    const { result } = renderHook(() => useGameHaptics())

    result.current.noteHand('right')
    expect(() => result.current.sentir({ tipo: 'golpe', fuerza: 1 })).not.toThrow()
    expect(xr.right).not.toHaveBeenCalled()
  })

  it('el pulso del golpe recibido va a la mano que diga, lleve o no el mazo', () => {
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())

    result.current.pulsar({ hand: 'left', intensity: 0.6, ms: 220, delay: 0 })
    result.current.pulsar({ hand: 'right', intensity: 0.6, ms: 220, delay: 0 })

    expect(xr.left).toHaveBeenCalledWith(0.6, 220)
    expect(xr.right).toHaveBeenCalledWith(0.6, 220)
  })
})
