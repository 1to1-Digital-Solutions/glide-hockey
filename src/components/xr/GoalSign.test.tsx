import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CELEBRATION_SECONDS, type Medal, type GoalSignView } from '../../lib/goal'
import { COMMON_PALETTE } from '../../lib/commonPalette'
import { recordingCanvas } from './legibility'

/**
 * The celebration of a threshold: of the sign and only of the sign.
 *
 * It is mounted without a Canvas —what is looked at is when it notifies, what it paints and how
 * much it grows—, with three's frame and the panel's plate replaced by what the test can call by hand.
 */

const scene = vi.hoisted(() => ({
  frame: null as ((state: { clock: { elapsedTime: number } }) => void) | null,
  draw: null as ((ctx: CanvasRenderingContext2D) => void) | null,
}))

vi.mock('@react-three/fiber', () => ({
  useFrame: (onFrame: (state: { clock: { elapsedTime: number } }) => void) => {
    scene.frame = onFrame
  },
}))

vi.mock('./canvasPanel', async (original) => ({
  ...(await original<typeof import('./canvasPanel')>()),
  CanvasPanel: ({ draw }: { draw: (ctx: CanvasRenderingContext2D) => void }) => {
    scene.draw = draw
    return null
  },
}))

import { GoalSign, DRAW_DISTANCE, signScale } from './GoalSign'

/** React DOM does not know `<group>`: its warnings are silenced, and only those. */
const THREE_WARNINGS = ['is unrecognized in this browser', 'incorrect casing', 'React does not recognize', 'Invalid value for prop']

const VIEW: GoalSignView = {
  title: 'Silver at 16 · you have 9',
  detail: 'Lives ♥♥♡',
  bar: 0.3,
  medal: 'silver',
  subdued: false,
}

const DISTANCE = 6

/** The colours the border has been painted with: the last `strokeStyle` that was left set. */
function border(): string {
  const { ctx } = recordingCanvas()
  scene.draw!(ctx)
  return String(ctx.strokeStyle)
}

/** How much the sign's group measures after that frame. */
function scaleAt(container: HTMLElement, seconds: number): number {
  const group = container.querySelector('group') as unknown as { scale: { setScalar: (value: number) => void } }
  let applied = Number.NaN
  group.scale = { setScalar: (value) => void (applied = value) }
  scene.frame!({ clock: { elapsedTime: seconds } })
  return applied
}

function sign(celebrate: Medal | null, onCelebrate?: (medal: Medal) => void) {
  return <GoalSign view={VIEW} position={[0, 4, -3]} distance={DISTANCE} celebrate={celebrate} onCelebrate={onCelebrate} />
}

beforeEach(() => {
  vi.useFakeTimers()
  const original = console.error
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (THREE_WARNINGS.some((warning) => String(args[0]).includes(warning))) return
    original(...args)
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the sign celebrates the threshold crossed', () => {
  it('notifies once, changes colour and goes back on its own when it ends', () => {
    const onCelebrate = vi.fn()
    const { rerender } = render(sign(null, onCelebrate))
    expect(border()).toBe(COMMON_PALETTE.border)

    rerender(sign('bronze', onCelebrate))

    expect(onCelebrate).toHaveBeenCalledTimes(1)
    expect(onCelebrate).toHaveBeenCalledWith('bronze')
    expect(border()).toBe(COMMON_PALETTE.bronze)

    // Another render with no change of medal repeats nothing.
    rerender(sign('bronze', onCelebrate))
    expect(onCelebrate).toHaveBeenCalledTimes(1)

    act(() => void vi.advanceTimersByTime(CELEBRATION_SECONDS * 1000 + 1))
    expect(border()).toBe(COMMON_PALETTE.border)
  })

  it('each threshold is celebrated: from bronze to silver it notifies again', () => {
    const onCelebrate = vi.fn()
    const { rerender } = render(sign(null, onCelebrate))

    rerender(sign('bronze', onCelebrate))
    rerender(sign('silver', onCelebrate))

    expect(onCelebrate.mock.calls).toEqual([['bronze'], ['silver']])
    expect(border()).toBe(COMMON_PALETTE.silver)
  })

  it('mounted with the medal already won it celebrates nothing: the threshold has not been seen crossed', () => {
    const onCelebrate = vi.fn()
    render(sign('gold', onCelebrate))

    expect(onCelebrate).not.toHaveBeenCalled()
    expect(border()).toBe(COMMON_PALETTE.border)
  })

  it('losing the medal —another run— turns the celebration off without notifying', () => {
    const onCelebrate = vi.fn()
    const { rerender } = render(sign(null, onCelebrate))
    rerender(sign('bronze', onCelebrate))

    rerender(sign(null, onCelebrate))

    expect(onCelebrate).toHaveBeenCalledTimes(1)
    expect(border()).toBe(COMMON_PALETTE.border)
  })

  it('with nobody to notify, it celebrates all the same', () => {
    const { rerender } = render(sign(null))

    rerender(sign('gold'))

    expect(border()).toBe(COMMON_PALETTE.gold)
  })
})

describe('the pulse', () => {
  it('the sign measures what its distance asks for, and on celebrating it grows and comes back', () => {
    const base = signScale(DISTANCE)
    const { container, rerender } = render(sign(null))
    expect(base).toBe(DISTANCE / DRAW_DISTANCE)
    expect(scaleAt(container, 10)).toBe(base)

    rerender(sign('silver'))

    // The first frame of the celebration marks the beginning.
    expect(scaleAt(container, 20)).toBe(base)
    expect(scaleAt(container, 20.25)).toBeGreaterThan(base * 1.1)
    expect(scaleAt(container, 21)).toBe(base)
  })

  it('with «menos movimiento» asked for, it does not move: it only changes colour', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))
    const { container, rerender } = render(sign(null))

    rerender(sign('silver'))
    scaleAt(container, 20)

    expect(scaleAt(container, 20.25)).toBe(signScale(DISTANCE))
    expect(border()).toBe(COMMON_PALETTE.silver)
  })
})
