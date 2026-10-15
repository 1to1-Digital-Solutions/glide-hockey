import { act, cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { markHandBusy, releaseHands } from './busyHands'

/**
 * The controller of the game's own website (`XRControllerGrip`): **the ray goes off with the
 * hand busy**. Mounted in the hall the controller belongs to the hub; here this component draws
 * it, and it is the one that has to read the registry of busy hands (`busyHands.ts`).
 *
 * It is mounted without a Canvas or a session: the XR library is replaced by pieces that record
 * what they are called with, which is what is looked at. The pointers have to still be there
 * —the grab one and the ray— and the only thing that changes with the hand busy is the drawing
 * of the ray and of its cursor.
 */

const rays: Record<string, unknown>[] = []
const grabs: Record<string, unknown>[] = []

vi.mock('@react-three/xr', () => ({
  CombinedPointer: ({ children }: { children: ReactNode }) => <>{children}</>,
  DefaultXRControllerGrabPointer: (props: Record<string, unknown>) => {
    grabs.push(props)
    return null
  },
  DefaultXRInputSourceRayPointer: (props: Record<string, unknown>) => {
    rays.push(props)
    return null
  },
  XRSpace: () => null,
  useXRInputSourceStateContext: () => ({ inputSource: { handedness: 'right' } }),
}))

const { XRControllerGrip } = await import('./XRControllerGrip')

afterEach(() => {
  cleanup()
  act(() => releaseHands())
  rays.length = 0
  grabs.length = 0
})

describe("the controller of the game's own website", () => {
  it('with the hand free, the ray and its cursor are drawn', () => {
    render(<XRControllerGrip />)
    expect(rays.at(-1)).toMatchObject({ makeDefault: true, cursorModel: true })
    expect(rays.at(-1)?.rayModel).toBeTruthy()
    expect(grabs.length).toBeGreaterThan(0)
  })

  it('with something in that hand, the ray and the cursor go off; on release they come back', () => {
    render(<XRControllerGrip />)
    act(() => markHandBusy('right', true))
    expect(rays.at(-1)).toMatchObject({ makeDefault: true, rayModel: false, cursorModel: false })
    act(() => markHandBusy('right', false))
    expect(rays.at(-1)?.rayModel).toBeTruthy()
    expect(rays.at(-1)?.cursorModel).toBe(true)
  })

  it('a game without a grab pointer still has none, and keeps its ray', () => {
    render(<XRControllerGrip grab={false} ray={{ maxLength: 3, opacity: 0.9 }} />)
    expect(grabs).toEqual([])
    expect(rays.at(-1)?.rayModel).toEqual({ maxLength: 3, opacity: 0.9 })
    act(() => markHandBusy('right', true))
    expect(rays.at(-1)?.rayModel).toBe(false)
  })

  it('the other hand being busy does not turn off the ray of this one', () => {
    render(<XRControllerGrip />)
    act(() => markHandBusy('left', true))
    expect(rays.at(-1)?.rayModel).toBeTruthy()
  })
})
