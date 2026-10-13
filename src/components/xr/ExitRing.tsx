'use client'

import { useFrame } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import { useEffect, useMemo, useRef } from 'react'
import { DoubleSide, Matrix4, Quaternion, RingGeometry, Vector3, type Group } from 'three'

import { EXIT_BUTTONS, HOLD_IDLE, holdStep } from '../../lib/holdToExit'
import { COMMON_PALETTE } from '../../lib/commonPalette'
import { endXrSession } from './xrStore'

/**
 * The «hold to exit» ring on the game's own web: holding the B or the Y for one second closes
 * the session, and while it is held a ring fills in front of the eyes.
 *
 * It is the same exit as the hall's (`xrcade/src/components/salon/ExitRing.tsx` and, in Godot,
 * `exit_ring.gd`), with the same count (`lib/holdToExit.ts`) and the same ring: so whoever learns to
 * exit a game in the hall exits the same way from the game opened on its own. **Only the Canvas of
 * the game's web mounts it**: inside the hall the hall already puts it, and two rings would be two exits. Outside
 * the headset there are no controllers, and it does nothing.
 */

/** The measurements of the ring, the hall's: at half a metre, about eleven degrees wide. */
export const EXIT_RING = { inner: 0.04, outer: 0.052, distance: 0.5, segments: 48 } as const

/** What each segment of the ring takes up in the index (`RingGeometry` with a single ring: two triangles). */
const INDICES_PER_SEGMENT = 6

const position = new Vector3()
const rotation = new Quaternion()
const ahead = new Vector3()
const one = new Vector3(1, 1, 1)
const pose = new Matrix4()
const inverse = new Matrix4()

/** Whether either of the two controllers has one of the exit buttons pressed. */
function pressed(controllers: readonly ({ gamepad: Record<string, { state?: string } | undefined> } | undefined)[]): boolean {
  return controllers.some((controller) => EXIT_BUTTONS.some((button) => controller?.gamepad[button]?.state === 'pressed'))
}

export function ExitRing({ onExit = endXrSession }: { onExit?: () => void }) {
  const mode = useXR((state) => state.mode)
  const left = useXRInputSourceState('controller', 'left')
  const right = useXRInputSourceState('controller', 'right')
  const group = useRef<Group>(null)
  const count = useRef(HOLD_IDLE)

  // One whole turn from twelve o'clock and to the right (the angle goes down); what fills is the
  // same geometry with fewer segments painted.
  const fill = useMemo(
    () => new RingGeometry(EXIT_RING.inner, EXIT_RING.outer, EXIT_RING.segments, 1, Math.PI / 2, -Math.PI * 2),
    [],
  )
  const track = useMemo(() => new RingGeometry(EXIT_RING.inner, EXIT_RING.outer, EXIT_RING.segments, 1), [])
  useEffect(
    () => () => {
      fill.dispose()
      track.dispose()
    },
    [fill, track],
  )

  useFrame(({ camera }, delta) => {
    const g = group.current
    if (g === null) return
    const step = holdStep(count.current, mode != null && pressed([left, right]), delta)
    count.current = step.state
    g.visible = step.progress > 0
    g.userData.progress = step.progress
    if (g.visible) {
      fill.setDrawRange(0, Math.ceil(EXIT_RING.segments * step.progress) * INDICES_PER_SEGMENT)
      // In front of the eyes, facing them, whatever happens with the groups it hangs from.
      camera.getWorldPosition(position)
      camera.getWorldQuaternion(rotation)
      ahead.set(0, 0, -EXIT_RING.distance).applyQuaternion(rotation).add(position)
      pose.compose(ahead, rotation, one)
      if (g.parent !== null) {
        g.parent.updateWorldMatrix(true, false)
        pose.premultiply(inverse.copy(g.parent.matrixWorld).invert())
      }
      pose.decompose(g.position, g.quaternion, g.scale)
    }
    if (step.exit) {
      // A tap on both hands: the gesture has been understood, as in the hall.
      for (const controller of [left, right]) {
        const actuators = (controller?.inputSource.gamepad as { hapticActuators?: readonly { pulse?: (strength: number, ms: number) => unknown }[] } | undefined)
          ?.hapticActuators
        void actuators?.[0]?.pulse?.(0.5, 80)
      }
      onExit()
    }
  })

  return (
    <group ref={group} name="aro-de-salir" visible={false} userData={{ role: 'aro-de-salir', progress: 0 }}>
      {/* Above everything of the game: without depth and painted last. */}
      <mesh geometry={track} renderOrder={1000} raycast={() => null} position={[0, 0, -0.001]}>
        <meshBasicMaterial color={COMMON_PALETTE.text} transparent opacity={0.28} depthTest={false} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh name="aro-de-salir-relleno" geometry={fill} renderOrder={1001} raycast={() => null}>
        <meshBasicMaterial color={COMMON_PALETTE.accent} transparent depthTest={false} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}
