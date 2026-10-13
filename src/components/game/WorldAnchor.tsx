'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { Euler, Quaternion, Vector3, type Group } from 'three'

import { entryPlacement, type HostAnchor } from '../../lib/hostAnchor'

/**
 * Plants the game's world in front of the player on entering the headset.
 *
 * The scene cannot move the player —the place where they are is decided by
 * their host, and the game puts no `<XROrigin>` (see `docs/xrcade.md`)—, so it
 * moves the scenery: when the session starts, the table is placed where the
 * player is and facing where they look. Without this, whoever enters looking
 * elsewhere finds the table behind their back.
 *
 * **It is placed once per session and stays still.** A table that chased the
 * head would be unplayable: the puck is aimed on it and any drift moves the
 * target under the hand. Having to turn towards it on starting is the same
 * thing that happens with a real table.
 *
 * Outside an immersive session it transforms nothing: on desktop the camera
 * leads, and it already looks at the table.
 */
export function WorldAnchor({
  children,
  anchor,
}: {
  children: ReactNode
  /**
   * Where and with what heading to plant it, if whoever mounts the scene knows
   * it: the xrcade hall lends the anchor with which it has its arc of cabinets
   * planted. Without it the gaze leads, which is the only thing known on the
   * game's website.
   */
  anchor?: HostAnchor
}) {
  const ref = useRef<Group>(null)
  const mode = useXR((state) => state.mode)
  const placed = useRef(false)
  /**
   * The lent anchor, while it has not been used.
   *
   * It is spent on the first placement: from then on the gaze leads, which is what is needed
   * on recentring the room, because then the reference space moves as a whole and what was
   * lent stays pointing at where there is no longer anything.
   */
  const lent = useRef(anchor ?? null)

  // Each session is placed anew: on entering again, the player may be in
  // another spot of the room and looking elsewhere.
  useEffect(() => {
    placed.current = false
  }, [mode])
  /**
   * **And on recentring the room.** Holding the system button repositions the headset's
   * reference space: the whole world turns under the placement, which keeps pointing at
   * where one was looking before, and the scene ends up behind one's back. It is the gesture
   * made on putting the headset back on. WebXR announces it with the reference space's
   * `reset` event.
   */
  const referenceSpace = useXR((state) => state.originReferenceSpace)
  useEffect(() => {
    if (referenceSpace == null) return
    const onRecenter = () => {
      placed.current = false
    }
    referenceSpace.addEventListener('reset', onRecenter)
    return () => referenceSpace.removeEventListener('reset', onRecenter)
  }, [referenceSpace])

  useFrame((state) => {
    const group = ref.current
    if (group == null) return

    if (mode == null) {
      // On leaving the headset the placement is undone: the desktop camera
      // points at where the table is by default, not at where it was left.
      if (placed.current) {
        group.position.set(0, 0, 0)
        group.rotation.set(0, 0, 0)
        placed.current = false
      }
      return
    }

    if (placed.current) return
    placed.current = true

    const { camera } = state
    camera.getWorldPosition(gazePosition)
    camera.getWorldQuaternion(gazeQuaternion)

    // The YXZ order isolates the horizontal turn in the first angle: that way the
    // table faces where the player looks without inheriting the tilt of their
    // head, which would leave it crooked.
    gazeEuler.setFromQuaternion(gazeQuaternion, 'YXZ')

    // Where and with what heading it is planted, still in world coordinates: whatever the
    // host lends if it lends anything, and if not, the feet and the gaze of right now.
    // **Anchoring to the gaze inside the hall throws things out of place**: reading the
    // cabinets on the left forces a turn of the head, and so the scenery came out turned
    // that way, sideways to the body.
    const placement = entryPlacement(lent.current, { x: gazePosition.x, z: gazePosition.z }, gazeEuler.y)
    lent.current = null
    gazePosition.set(placement.x, 0, placement.z)

    // The work is done in the parent's space —the `<XROrigin>` of whoever mounts—,
    // so its orientation has to be discounted instead of assuming it is zero.
    let parentYaw = 0
    const parent = group.parent
    if (parent != null) {
      parent.getWorldQuaternion(parentQuaternion)
      parentEuler.setFromQuaternion(parentQuaternion, 'YXZ')
      parentYaw = parentEuler.y
      parent.worldToLocal(gazePosition)
    }

    // Only the floor: the table's height is its own, not that of the eyes of
    // whoever enters.
    group.position.set(gazePosition.x, 0, gazePosition.z)
    group.rotation.set(0, placement.yaw - parentYaw, 0)
  })

  // The group carries a name so that where the scenery ended up planted can be
  // measured from outside: it is what the anchor e2e checks, which cannot be seen from a screen.
  return (
    <group ref={ref} name="world-anchor">
      {children}
    </group>
  )
}

// Reused between frames: creating vectors inside `useFrame` generates
// garbage on each of the headset's ninety frames per second.
const gazePosition = new Vector3()
const gazeQuaternion = new Quaternion()
const gazeEuler = new Euler()
const parentQuaternion = new Quaternion()
const parentEuler = new Euler()
