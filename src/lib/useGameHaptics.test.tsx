import { type ThreeEvent } from '@react-three/fiber'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GOAL_PULSE, STRIKE_PULSE, type HapticSession } from './haptics'
import { scaledPulse, useGameHaptics } from './useGameHaptics'

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

describe('la fuerza del impacto en la mano', () => {
  it('un roce vibra menos que un golpe seco, pero se nota', () => {
    const seco = scaledPulse(STRIKE_PULSE, 1).intensity
    const roce = scaledPulse(STRIKE_PULSE, 0).intensity
    expect(seco).toBe(STRIKE_PULSE.intensity)
    expect(roce).toBeGreaterThan(0)
    expect(roce).toBeLessThan(seco)
    expect(scaledPulse(STRIKE_PULSE, 0).durationMs).toBe(STRIKE_PULSE.durationMs)
  })

  it('llega al mando escalado, y el gol siempre entero', () => {
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())
    result.current.noteAim(aimWith('right'))

    result.current.pulse('strike', 0)
    result.current.pulse('goal', 0)

    expect(xr.right.mock.calls[0][0]).toBeLessThan(STRIKE_PULSE.intensity)
    expect(xr.right.mock.calls[1][0]).toBe(GOAL_PULSE.intensity)
  })
})

/**
 * El roce del disco. No es un suceso: es un fondo que se pide cada fotograma y
 * que el hook convierte en una cadena de toques (ver `stepSlide` en
 * `haptics.ts`). Lo que se comprueba aquí es lo que el hook añade: que llega al
 * mando que lleva el mazo y que sin visor no pasa nada.
 */
describe('el roce del disco en la mano', () => {
  it('llega a la mano que lleva el mazo mientras el disco se desliza', () => {
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())
    result.current.noteAim(aimWith('right'))

    for (let i = 0; i < 90; i++) result.current.slide(3, 1 / 90)

    expect(xr.right.mock.calls.length).toBeGreaterThan(8)
    expect(xr.left).not.toHaveBeenCalled()
    // Leve: muy por debajo del golpe del mazo, que es el que tiene que destacar.
    expect(xr.right.mock.calls[0][0]).toBeLessThan(STRIKE_PULSE.intensity / 2)
  })

  it('el disco parado no vibra', () => {
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())

    for (let i = 0; i < 90; i++) result.current.slide(0, 1 / 90)

    expect(xr.right).not.toHaveBeenCalled()
    expect(xr.left).not.toHaveBeenCalled()
  })

  it('sin sesión inmersiva no hay mandos que zumbar, y no pasa nada', () => {
    withHeadset()
    xr.session = null
    const { result } = renderHook(() => useGameHaptics())

    expect(() => result.current.slide(3, 1 / 90)).not.toThrow()
    expect(xr.right).not.toHaveBeenCalled()
  })
})
