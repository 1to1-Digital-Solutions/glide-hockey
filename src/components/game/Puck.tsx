'use client'

import { useRef, type Ref, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type Texture,
} from 'three'
import { PUCK_RADIUS } from '../../lib/gameConfig'
import { PALETTE } from '../../lib/palette'
import { puckGlow } from '../../lib/puckGlow'
/** Thickness of the puck. Just enough for its edge to be seen from the side. */
const PUCK_HEIGHT = 0.022

/**
 * The puck.
 *
 * It does not know where it is: the match loop places it by moving its group
 * (see `Rink`). That way the position does not go through React state, which
 * at sixty frames per second would re-render the whole tree. What it does know
 * is how fast it is going (`speedRef`, which the loop writes): with the speed
 * its glow grows with the speed (`lib/puckGlow.ts`), which is what lets it be
 * followed in the headset when it crosses the table in half a second.
 */
export function Puck({
  ref,
  speedRef,
  environment,
}: {
  ref?: Ref<Group>
  /** Speed of the puck in m/s, written every frame by the table's loop. */
  speedRef?: RefObject<number>
  /** The room's reflections, the same ones the table top carries. */
  environment?: Texture
}) {
  const body = useRef<Mesh>(null)

  useFrame(() => {
    const glow = puckGlow(speedRef?.current ?? 0)
    const material = body.current?.material as MeshStandardMaterial | undefined
    if (material != null) material.emissiveIntensity = glow.emissive

  })

  return (
    <group ref={ref}>
      <mesh ref={body} position={[0, PUCK_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry
          args={[PUCK_RADIUS, PUCK_RADIUS, PUCK_HEIGHT, 32]}
        />
        <meshStandardMaterial
          color={PALETTE.puck}
          roughness={0.3}
          metalness={0.15}
          emissive={PALETTE.puck}
          emissiveIntensity={0.12}
          envMap={environment ?? null}
          envMapIntensity={0.5}
        />
      </mesh>

      {/* Lighter cap: it gives the puck its top face and gives the eye a point
          of reference when it crosses the table at full speed. */}
      <mesh position={[0, PUCK_HEIGHT + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[PUCK_RADIUS * 0.62, 32]} />
        <meshBasicMaterial color={PALETTE.primaryBright} toneMapped={false} />
      </mesh>
    </group>
  )
}
