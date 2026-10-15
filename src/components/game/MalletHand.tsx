'use client'

import { useFrame } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'

import { startGrab, stepGrab, type GrabLatch } from '../../lib/grab'
import { useGrabMode } from '../../lib/settingsClient'
import type { GrabMode } from '../../lib/settings'
import { isPinching } from '../../lib/pinch'
import { useEffect, useRef } from 'react'
import { Vector3, type Group, type Object3D } from 'three'

import { nextGrab, type HandOnTable } from '../../lib/malletGrab'
import { markHandBusy, releaseHands } from '../xr/busyHands'
import { constrainMallet, type Vec2 } from '../../lib/puckPhysics'
import { useGame } from '../../lib/gameStore'

/**
 * The mallet in the hand, with the headset on.
 *
 * It reads both hands every frame, brings them to table coordinates and passes the target
 * to the mallet while it is held. What decides when it is grabbed and when it is released is
 * `lib/malletGrab.ts`, which is tested without a headset; here there is only what needs
 * three: the controller's pose and the change of coordinates.
 *
 * **Both hands, not a chosen one.** Whoever plays grabs the mallet with whichever is free and
 * switches it mid-match, as at a real table. The one that is grabbing leads; if both
 * squeeze, the one that already had it.
 *
 * Outside a session it does nothing: there the mallet is carried by the mouse on the table top.
 */
export function MalletHand({
  rink,
  target,
  onMove,
  onRelease,
}: {
  /** The table, to go from the world to its coordinates. */
  rink: React.RefObject<Group | null>
  /**
   * Where the mallet is going right now. It is the same datum that moves the table, not a
   * copy: if there were two, grabbing the mallet would be measured against a mallet that is
   * not the one seen.
   */
  target: React.RefObject<Vec2>
  /**
   * Where the mallet goes, already inside the table's limits, that it is held and with which
   * hand: it is what decides in which controller the hit vibrates (`useGameHaptics`).
   */
  onMove: (target: Vec2, held: boolean, side: 'left' | 'right' | null) => void
  /** It has been released: the mallet goes back to chasing instead of going in the hand. */
  onRelease: () => void
}) {
  const { recordMilestone } = useGame()
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')
  // And the bare hands, which are the headset's other input mode: without this, whoever does
  // not have the controllers at hand —or cannot hold them— cannot grab the mallet and does
  // not play.
  const leftHand = useXRInputSourceState('hand', 'left')
  const rightHand = useXRInputSourceState('hand', 'right')
  const referenceSpace = useXR((state) => state.originReferenceSpace)
  const origin = useXR((state) => state.origin)
  const pinching = useRef({ left: false, right: false })
  // How the mallet is held: keeping the trigger (or the pinch) held the whole match, or with
  // one tap to grab it and another to release it. A whole match with the hand closed is
  // the longest grab of the thirteen cabinets, so it is where it shows the most (see
  // `lib/grab.ts`). The latch is kept per side, because the mallet changes hands.
  const grabMode = useGrabMode()
  const latch = useRef<{ left: GrabLatch; right: GrabLatch }>({
    left: startGrab(),
    right: startGrab(),
  })

  /** Whether the mallet is in the hand. Where it is, `target` says, and that is the table's. */
  const held = useRef(false)
  // Reused between frames: `worldToLocal` mutates what it receives and this runs at 90 Hz.
  const point = useRef(new Vector3())

  useFrame((_, __, frame) => {
    const group = rink.current
    if (group == null) return

    // What each side says on this frame, **before** deciding anything: the latch only
    // advances once per side and per frame, or the edge that switches on «one tap» would
    // be counted twice and the mallet would be grabbed and released in the same gesture.
    const withController = leftController?.object != null || rightController?.object != null
    let onTable: HandOnTable | null = null
    // Which side the hand that leads this frame is on: it is what switches off the ray of
    // THAT controller and not the other's (see `xr/busyHands.ts`).
    let side: 'left' | 'right' | null = null

    if (withController) {
      const pressed = {
        left: isSqueezing(leftController),
        right: isSqueezing(rightController),
      }
      const holding = stepLatch(latch.current, pressed, grabMode)
      const hand = leadingHand(leftController, rightController, held.current, holding)

      if (hand?.object != null) {
        // The controller's pose arrives in world coordinates; the table may be moved and
        // turned (the hall places it where it belongs), so it is brought to its own.
        const local = group.worldToLocal(
          point.current.setFromMatrixPosition(hand.object.matrixWorld),
        )
        side = hand === leftController ? 'left' : 'right'
        onTable = {
          position: { x: local.x, z: local.z },
          grabbing: holding[side],
        }
      }
    } else {
      // Without a controller, the bare hand. Here there is no button to squeeze: grabbing is
      // bringing the thumb and the index finger together (see `lib/pinch.ts`), and the mallet
      // goes where the palm goes. The pinch goes through the same latch: whoever cannot hold
      // a trigger need not be able to keep their fingers together a whole match either.
      const readings = {
        left: readHand(leftHand, frame, referenceSpace, origin, pinching.current, group, point.current),
        right: readHand(rightHand, frame, referenceSpace, origin, pinching.current, group, point.current),
      }
      const holding = stepLatch(
        latch.current,
        { left: readings.left?.grabbing ?? false, right: readings.right?.grabbing ?? false },
        grabMode,
      )
      for (const eachSide of ['left', 'right'] as const) {
        const reading = readings[eachSide]
        if (reading == null) continue
        const withGrab = { ...reading, grabbing: holding[eachSide] }
        // The one that is grabbing leads; if neither, the first one there is will do to know
        // whether it is over the mallet when it pinches.
        if (withGrab.grabbing || onTable == null) {
          onTable = withGrab
          side = eachSide
        }
      }
    }

    const next = nextGrab(
      { held: held.current, target: target.current },
      onTable,
    )
    const released = held.current && !next.held
    held.current = next.held
    // With the mallet in the hand, the ray of that controller switches off: pointing at the
    // wall while holding something is just the opposite of what is happening.
    // The first step of the tutorial is passed by really grabbing the mallet.
    if (next.held) recordMilestone('grab')
    markHandBusy('left', next.held && side === 'left')
    markHandBusy('right', next.held && side === 'right')
    if (next.held) onMove(constrainMallet(next.target, 'player'), true, side)
    else if (released) onRelease()
  })

  // On removing the scene —going back to the hall, ending the match— nobody carries anything:
  // otherwise the ray would stay off in the arc, where it is the only thing a cabinet is
  // chosen with.
  useEffect(() => () => releaseHands(), [])

  return null
}

/**
 * Which of the two hands carries the mallet.
 *
 * With the mallet already held, the one that keeps squeezing leads —changing hands halfway
 * through a hit because the other one brushed the button would be losing it—; free, the
 * first one to squeeze.
 */
function leadingHand<T>(
  left: T | undefined,
  right: T | undefined,
  held: boolean,
  holding: { left: boolean; right: boolean },
): T | undefined {
  if (held) return holding.left ? left : holding.right ? right : undefined
  if (holding.left) return left
  if (holding.right) return right
  // With nobody grabbing, either one is returned: its position is needed to know whether
  // the hand is over the mallet when it grabs.
  return left ?? right
}

/** Whether the side trigger of that controller is squeezed right now. */
function isSqueezing(
  controller: { gamepad: { 'xr-standard-squeeze'?: { state: string } } } | undefined,
): boolean {
  return controller?.gamepad['xr-standard-squeeze']?.state === 'pressed'
}

/**
 * Advances the latch of both sides and says which one holds the mallet.
 *
 * It mutates the object it receives on purpose: it is the same `ref` that lives between
 * frames, and copying it per pass would be garbage to collect ninety times per second.
 */
function stepLatch(
  latch: { left: GrabLatch; right: GrabLatch },
  pressed: { left: boolean; right: boolean },
  grabMode: GrabMode,
): { left: boolean; right: boolean } {
  latch.left = stepGrab(latch.left, pressed.left, grabMode)
  latch.right = stepGrab(latch.right, pressed.right, grabMode)
  return { left: latch.left.holding, right: latch.right.holding }
}

/**
 * Where a bare hand is over the table, and whether it is grabbing.
 *
 * The joints of the WebXR frame are read and not `state.object`: that object is only filled
 * in by the library when it draws the hand model, and whoever mounts the game decides whether
 * it is drawn —inside the hall, it is not—. The joints arrive whenever the headset tracks them.
 */
function readHand(
  state: ReturnType<typeof useXRInputSourceState<'hand'>>,
  frame: XRFrame | undefined,
  referenceSpace: XRReferenceSpace | null | undefined,
  /** The XR origin, which belongs to whoever mounts the game: the pose arrives in its space. */
  origin: Object3D | undefined,
  pinching: { left: boolean; right: boolean },
  table: Group,
  point: Vector3,
): HandOnTable | null {
  const joints = state?.inputSource.hand
  if (joints == null || frame == null || referenceSpace == null) return null

  const palm = joints.get('wrist')
  const thumb = joints.get('thumb-tip')
  const index = joints.get('index-finger-tip')
  if (palm == null || thumb == null || index == null) return null

  const palmPose = frame.getJointPose?.(palm, referenceSpace)
  if (palmPose == null) return null

  const thumbPose = frame.getJointPose?.(thumb, referenceSpace)
  const indexPose = frame.getJointPose?.(index, referenceSpace)
  const separation =
    thumbPose == null || indexPose == null
      ? null
      : Math.hypot(
          thumbPose.transform.position.x - indexPose.transform.position.x,
          thumbPose.transform.position.y - indexPose.transform.position.y,
          thumbPose.transform.position.z - indexPose.transform.position.z,
        )

  const side = state?.inputSource.handedness === 'left' ? 'left' : 'right'
  const grabbing = isPinching(separation, pinching[side])
  pinching[side] = grabbing

  const { position } = palmPose.transform
  point.set(position.x, position.y, position.z)
  if (origin != null) origin.localToWorld(point)
  table.worldToLocal(point)
  return { position: { x: point.x, z: point.z }, grabbing }
}
