'use client'

import { useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import { useXR } from '@react-three/xr'
import type { Group } from 'three'

import { usePlayHeight, usePlayHeightOffset } from '../../lib/settingsClient'
import {
  hasFloorReference,
  isPlausibleEyeHeight,
  startTracking,
  trackHeight,
  worldRise,
  type HeightTracker,
} from '../../lib/uiHeight'

/**
 * Lowers the world down to whoever plays, if they have asked for it.
 *
 * **What it fixes.** The scene's heights were chosen with a person standing
 * in front, and that person stayed inside the code. Seated —on a chair, on
 * a sofa, in a wheelchair— the whole world ends up above where the arm
 * reaches, and nothing fails: there is simply no run. It is the biggest
 * barrier the hall had, and the only one that could not be got around by
 * playing worse.
 *
 * **Only when it is asked for.** The play height is chosen once in the hall's
 * settings and holds for the thirteen cabinets (`lib/settings.ts`). Guessing
 * it would be worse than not having it: for whoever is standing, moving the
 * floor under their feet turns their stomach, and there are short people who
 * prefer the world as it is.
 *
 * **It is placed and stays still.** A world that chased the head would rise
 * on standing on tiptoe and drop on crouching, right when you are
 * aiming. Only a big, sustained change —sitting down mid-run— places
 * it again, with the same tracking the UI uses.
 *
 * **The fine height, on top.** What the hall lets you tune five centimetres
 * at a time (`xrcade:play-height-offset`) is added to the above, standing or
 * seated: the chair, the stature or the headset's badly calibrated floor that
 * a switch does not level. It is the same maths the Godot port does with the
 * kit, so that the game ends up at the same height in both.
 *
 * It moves by reference and not by state: it is a height that changes at most
 * twice per session, and repainting the tree for it would be repainting it for
 * nothing.
 *
 * Outside the headset there is nobody to measure and the group stays at zero,
 * which is where the scene has always been.
 */
export function XRWorldHeight({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null)
  const tracking = useRef<HeightTracker>(startTracking())
  const mode = useXR((state) => state.mode)
  const withFloor = useXR((state) =>
    hasFloorReference(state.session?.enabledFeatures),
  )
  const atEyeHeight = usePlayHeight() === 'eyes'
  const fineHeight = usePlayHeightOffset()

  useFrame(({ camera }, delta) => {
    const node = group.current
    if (node == null) return

    if (mode == null) {
      // Outside a session there is no stature to track, and the next one
      // starts measuring from zero.
      tracking.current = startTracking()
      node.position.y = 0
      return
    }

    // Without a floor, the origin is the point where the session started and
    // the head's height does not measure from the floor: it is not a stature
    // and cannot be used.
    const measurement =
      withFloor && isPlausibleEyeHeight(camera.position.y)
        ? camera.position.y
        : null
    tracking.current = trackHeight(
      tracking.current,
      measurement,
      1 - Math.exp(-3.5 * delta),
      delta,
    )
    node.position.y =
      worldRise(tracking.current.held, atEyeHeight) + fineHeight
  })

  return <group ref={group}>{children}</group>
}
