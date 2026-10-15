import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type HapticSession } from './haptics'
import { HAPTIC_RECIPES } from './hapticFeedback'
import { useGameHaptics } from './useGameHaptics'

/**
 * What the hook adds on top of `haptics.ts` (which already has its tests): that the strikes go
 * to the open session and **only** to the hand `MalletHand` said holds the mallet, that with no
 * hand nothing vibrates, and that the tail of the strike is cancelled on unmount.
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
  it('with nobody holding the mallet, a strike vibrates in neither hand', () => {
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())

    result.current.feel({ type: 'hit', strength: 1 })

    expect(xr.left).not.toHaveBeenCalled()
    expect(xr.right).not.toHaveBeenCalled()
  })

  it('with the mallet in the left hand, the strike and its tail go to the left and nowhere else', () => {
    vi.useFakeTimers()
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())

    result.current.noteHand('left')
    result.current.feel({ type: 'hit', strength: 1 })
    expect(xr.left).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(HAPTIC_RECIPES.impact.ms)

    expect(xr.left).toHaveBeenCalledTimes(2)
    expect(xr.right).not.toHaveBeenCalled()
  })

  it('changing the mallet to the other hand changes the hand that vibrates, and releasing it turns it off', () => {
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())

    result.current.noteHand('left')
    result.current.noteHand('right')
    result.current.feel({ type: 'goal' })
    expect(xr.right).toHaveBeenCalledTimes(1)
    expect(xr.left).not.toHaveBeenCalled()

    result.current.noteHand(null)
    result.current.feel({ type: 'goal' })
    expect(xr.right).toHaveBeenCalledTimes(1)
  })

  it('unmounting cancels the tail that was still to play', () => {
    vi.useFakeTimers()
    withHeadset()
    const { result, unmount } = renderHook(() => useGameHaptics())

    result.current.noteHand('right')
    result.current.feel({ type: 'hit', strength: 1 })
    unmount()
    vi.advanceTimersByTime(1000)

    expect(xr.right).toHaveBeenCalledTimes(1)
  })

  it('without an immersive session there are no controllers to pulse, and nothing happens', () => {
    withHeadset()
    xr.session = null
    const { result } = renderHook(() => useGameHaptics())

    result.current.noteHand('right')
    expect(() => result.current.feel({ type: 'hit', strength: 1 })).not.toThrow()
    expect(xr.right).not.toHaveBeenCalled()
  })

  it('the pulse of the hit feedback goes to the hand it says, whether or not it holds the mallet', () => {
    withHeadset()
    const { result } = renderHook(() => useGameHaptics())

    result.current.pulse({ hand: 'left', intensity: 0.6, ms: 220, delay: 0 })
    result.current.pulse({ hand: 'right', intensity: 0.6, ms: 220, delay: 0 })

    expect(xr.left).toHaveBeenCalledWith(0.6, 220)
    expect(xr.right).toHaveBeenCalledWith(0.6, 220)
  })
})
