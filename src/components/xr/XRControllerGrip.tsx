'use client'

import {
  CombinedPointer,
  DefaultXRControllerGrabPointer,
  DefaultXRInputSourceRayPointer,
  XRSpace,
  useXRInputSourceStateContext,
} from '@react-three/xr'
import type { ComponentProps } from 'react'
import type { Object3D } from 'three'

import { useHandBusy } from './busyHands'

/**
 * The controller inside the headset: its place in space and its pointers, **with no model**.
 *
 * **Why it exists.** With `controller: { model: false }` the library does not mount
 * `XRControllerModel`, and that component is the only one that writes `state.object` — the
 * three object that goes attached to the fist. Without it, `useXRInputSourceState('controller',
 * hand).object` is always `undefined`, so **any game that picks something up by bringing the
 * hand to it never finds out where the hand is**: the mallet is not grabbed, the bat is not
 * lifted, and from the outside it looks as if the grab button did not work. It was discovered
 * with the headset on, in three games at once.
 *
 * And the model cannot be switched on: they are `.glb` files the library downloads from a CDN,
 * and the hall's security policy blocks it. So here goes an empty group placed on the fist,
 * which is the only thing that was needed: the pose, with nothing to draw and nothing to
 * download.
 *
 * **The grab pointer comes back too.** It is the one `stick-rush` uses to catch the sticks;
 * switched off, that game cannot be played. A game that did not have it (`grab={false}`) stays
 * without it: moving to this controller does not change its pointers.
 *
 * **And the ray switches off with something in the hand** (`busyHands.ts`): with the object
 * held it stayed on, pointing at the wall, as if a spot were being pointed out. The drawing is
 * switched off, not the pointer: releasing and pressing a menu button again works the same.
 */
/**
 * Records in the controller's state the object that goes attached to the fist.
 *
 * **It is written on purpose**: that is how the library does it in its own
 * `XRControllerModel`, and it is exactly the gap this component comes to fill. It goes in a
 * separate function because writing it inside the component is, for the linter, touching on
 * your own what a hook returns — which is almost always a mistake, and here it is the contract.
 *
 * @param previous If given, it is only cleared while it is still that one: on unmount the
 *   object of the next controller may already have come in, and clearing it would leave the
 *   game without a pose.
 */
function recordFist(
  state: { object?: Object3D },
  node: Object3D | null,
  previous?: Object3D | null,
): void {
  if (previous !== undefined && state.object !== previous) return
  state.object = node ?? undefined
}

export function XRControllerGrip({
  grabRadius,
  rayLength = 6,
  grab: withGrab = true,
  ray: rayModel,
}: {
  /** Radius of the grab sphere, in metres. Without it, the library's. */
  grabRadius?: number
  /** How far the ray the menus are pressed with reaches. */
  rayLength?: number
  /** Whether the controller carries a grab pointer. */
  grab?: boolean
  /** How the ray is drawn, if the game has its own. Without it, a faint one of `rayLength`. */
  ray?: Exclude<ComponentProps<typeof DefaultXRInputSourceRayPointer>['rayModel'], boolean | undefined>
}) {
  const state = useXRInputSourceStateContext('controller')
  const busy = useHandBusy(state.inputSource.handedness as 'left' | 'right' | undefined)

  return (
    <>
      <XRSpace space="grip-space">
        {/* The group is registered as soon as three creates it, and unhooked on unmount:
            leaving recorded an object that is no longer in the scene would give a frozen
            pose. */}
        <group
          ref={(node: Object3D | null) => {
            recordFist(state, node)
            return () => recordFist(state, null, node)
          }}
        />
      </XRSpace>

      <CombinedPointer>
        {withGrab && <DefaultXRControllerGrabPointer {...(grabRadius == null ? {} : { radius: grabRadius })} />}
        <DefaultXRInputSourceRayPointer
          makeDefault
          minDistance={0.2}
          rayModel={busy ? false : (rayModel ?? { maxLength: rayLength, opacity: 0.35 })}
          cursorModel={!busy}
        />
      </CombinedPointer>
    </>
  )
}
