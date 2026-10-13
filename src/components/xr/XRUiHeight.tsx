'use client'

import { useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import { useXR } from '@react-three/xr'
import type { Group } from 'three'

import { usePlayHeight } from '../../lib/settingsClient'
import {
  hasFloorReference,
  isPlausibleEyeHeight,
  startTracking,
  trackHeight,
  uiRiseOverWorld,
  type HeightTracker,
} from '../../lib/uiHeight'

/**
 * Puts whatever hangs from here at the eye height of whoever is playing.
 *
 * The heights of the interface were measured with one person in front of it, and that person
 * stayed inside the code: for someone a metre and a half tall the panels sit above a
 * comfortable line of sight —and that is where the settings and the exit button are— and for
 * someone two metres tall, at chest height. It is one of the few things that cannot be adjusted
 * by hand, because nobody is going to enter a menu they cannot reach in order to raise the
 * menu.
 *
 * **It is placed and it stays still.** An interface that chased the head would rise when
 * standing on tiptoe and drop when crouching, right while aiming at a button. Only a large,
 * sustained change —sitting down— places it again (see `lib/uiHeight.ts`).
 *
 * It is moved by reference and not by state: it is a height that changes at most twice per
 * session, and repainting the tree for it would be repainting it for nothing.
 *
 * Outside the headset there is nobody to measure and the group stays at zero, which is where
 * the heights have always been.
 */
export function XRUiHeight({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null)
  const tracker = useRef<HeightTracker>(startTracking())
  const mode = useXR((state) => state.mode)
  const hasFloor = useXR((state) => hasFloorReference(state.session?.enabledFeatures))
  // If the whole world has already come down, the interface came with it and it
  // does not need a correction of its own (see `uiRiseOverWorld`).
  const atEyeHeight = usePlayHeight() === 'eyes'

  useFrame(({ camera }, delta) => {
    const node = group.current
    if (node == null) return

    if (mode == null) {
      // Outside a session there is no height to follow, and the next one starts measuring from
      // zero.
      tracker.current = startTracking()
      node.position.y = 0
      return
    }

    // Without a floor, the origin is the point where the session started and the height of the
    // head is not measured from the floor: it is not a stature and cannot be used as one.
    const measured = hasFloor && isPlausibleEyeHeight(camera.position.y) ? camera.position.y : null
    tracker.current = trackHeight(tracker.current, measured, 1 - Math.exp(-3.5 * delta), delta)
    node.position.y = uiRiseOverWorld(tracker.current.held, atEyeHeight)
  })

  return <group ref={group}>{children}</group>
}
