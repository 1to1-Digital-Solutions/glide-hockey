import { type ThreeEvent } from '@react-three/fiber'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GOAL_PULSE, STRIKE_PULSE, type HapticSession } from './haptics'
import { useGameHaptics } from './useGameHaptics'

/**
 * Lo único que el hook añade sobre `haptics.ts` (que ya tiene sus tests): que
 * los golpes van a la sesión que hay abierta y a la mano que la mesa dijo que
 * lleva el mazo, y que mientras no lo haya dicho van a las dos.
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

const aimWith = (handedness: string) =>
  ({ nativeEvent: { inputSource: { handedness } } }) as unknown as ThreeEvent<PointerEvent>

describe('useGameHaptics', () => {
  it('antes de saber qué mano lleva el mazo, el golpe va a las dos', () => {
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())

    result.current.pulse('strike')

    expect(xr.left).toHaveBeenCalledWith(STRIKE_PULSE.intensity, STRIKE_PULSE.durationMs)
    expect(xr.right).toHaveBeenCalledWith(STRIKE_PULSE.intensity, STRIKE_PULSE.durationMs)
  })

  it('en cuanto un mando mueve el mazo, el golpe va solo a esa mano', () => {
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())

    result.current.noteAim(aimWith('left'))
    result.current.pulse('strike')
    result.current.pulse('bounce')

    expect(xr.left).toHaveBeenCalledTimes(2)
    expect(xr.right).not.toHaveBeenCalled()
  })

  it('cambiar el mazo de mano cambia la mano que vibra; el ratón no la borra', () => {
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())

    result.current.noteAim(aimWith('left'))
    result.current.noteAim(aimWith('right'))
    result.current.noteAim({ nativeEvent: {} } as unknown as ThreeEvent<PointerEvent>)
    result.current.pulse('strike')

    expect(xr.right).toHaveBeenCalledTimes(1)
    expect(xr.left).not.toHaveBeenCalled()
  })

  it('el gol se nota en las dos manos, lleve el mazo quien lo lleve', () => {
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())

    result.current.noteAim(aimWith('right'))
    result.current.pulse('goal')

    expect(xr.left).toHaveBeenCalledWith(GOAL_PULSE.intensity, GOAL_PULSE.durationMs)
    expect(xr.right).toHaveBeenCalledWith(GOAL_PULSE.intensity, GOAL_PULSE.durationMs)
  })

  it('sin sesión inmersiva no hay mandos que pulsar, y no pasa nada', () => {
    withHeadset()
    xr.session = null
    const { result } = renderHook(() => useGameHaptics())

    expect(() => result.current.pulse('goal')).not.toThrow()
    expect(xr.left).not.toHaveBeenCalled()
  })
})
