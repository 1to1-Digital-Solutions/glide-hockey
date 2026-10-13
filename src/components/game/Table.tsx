'use client'

import {
  GOAL_WIDTH,
  RAIL_HEIGHT,
  TABLE_HEIGHT,
  TABLE_LENGTH,
  TABLE_WIDTH,
} from '../../lib/gameConfig'
import { type Texture } from 'three'
import { PALETTE } from '../../lib/palette'
import { HALF_LENGTH, HALF_WIDTH } from '../../lib/puckPhysics'
/**
 * The table: the table top, the rails around it, the two goals and the
 * markings of the rink.
 *
 * It is scenery and nothing else —it does not move or know about the match—,
 * so it goes in its own component and is drawn once. The measurements are those
 * of `gameConfig.ts`, the same ones the puck bounces with: if the table widens
 * here without widening there, the puck would bounce in mid-air.
 *
 * Local coordinates, with the centre of the table top at the origin and its
 * surface at `y = 0`. Whoever mounts it raises it to the right height (see `Rink`).
 */

/** Thickness of the table top and of the rails around it. */
const TOP_THICKNESS = 0.05
const RAIL_THICKNESS = 0.04

/** Width of each piece of end rail, on either side of the goal. */
const END_RAIL_WIDTH = (TABLE_WIDTH - GOAL_WIDTH) / 2

/** The markings are painted flush with the table top, just enough not to sink into it. */
const MARKING_Y = 0.001

/** Colours of the scenery itself, which mean nothing outside the table. */
const LEG_COLOR = '#0d1626'
const MARKING_COLOR = '#9db4cc'
const GOAL_MOUTH_COLOR = '#050a12'

function Rails() {
  const sideZ = 0
  const sideX = HALF_WIDTH + RAIL_THICKNESS / 2
  const endZ = HALF_LENGTH + RAIL_THICKNESS / 2
  const endX = GOAL_WIDTH / 2 + END_RAIL_WIDTH / 2

  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh
          key={`side-${side}`}
          position={[side * sideX, RAIL_HEIGHT / 2, sideZ]}
          castShadow
        >
          <boxGeometry
            args={[
              RAIL_THICKNESS,
              RAIL_HEIGHT,
              TABLE_LENGTH + RAIL_THICKNESS * 2,
            ]}
          />
          <meshStandardMaterial color={PALETTE.rail} roughness={0.5} />
        </mesh>
      ))}

      {/* The ends are split in two: the goal is in the middle. */}
      {[-1, 1].map((end) =>
        [-1, 1].map((side) => (
          <mesh
            key={`end-${end}-${side}`}
            position={[side * endX, RAIL_HEIGHT / 2, end * endZ]}
            castShadow
          >
            <boxGeometry
              args={[END_RAIL_WIDTH, RAIL_HEIGHT, RAIL_THICKNESS]}
            />
            <meshStandardMaterial color={PALETTE.rail} roughness={0.5} />
          </mesh>
        )),
      )}
    </group>
  )
}

/**
 * The mouth of a goal: the gap through which the puck goes in.
 *
 * The back is dark —it is a gap, and any reflection would give it away as a
 * cover— but the frame carries its owner's colour. Without that, on a white
 * table and two navy blue rails, the two goals are the same black stain and
 * there is no way to know which one to shoot at.
 */
function GoalMouth({ end, color }: { end: 1 | -1; color: string }) {
  const z = end * (HALF_LENGTH + RAIL_THICKNESS / 2)

  return (
    <group>
      <mesh position={[0, RAIL_HEIGHT / 2, z]}>
        <boxGeometry args={[GOAL_WIDTH, RAIL_HEIGHT, RAIL_THICKNESS]} />
        <meshStandardMaterial
          color={GOAL_MOUTH_COLOR}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Lit threshold, already on the table top: it is what is seen from above. */}
      <mesh
        position={[0, MARKING_Y, end * (HALF_LENGTH - 0.02)]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[GOAL_WIDTH, 0.04]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Markings() {
  return (
    <group position={[0, MARKING_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Halfway line: how far each mallet reaches. */}
      <mesh>
        <planeGeometry args={[TABLE_WIDTH, 0.012]} />
        <meshBasicMaterial color={MARKING_COLOR} toneMapped={false} />
      </mesh>

      {/* Centre circle, where the serve is taken. */}
      <mesh>
        <ringGeometry args={[0.16, 0.172, 48]} />
        <meshBasicMaterial color={MARKING_COLOR} toneMapped={false} />
      </mesh>

      {/* Area of each goal: a half circle open towards the centre. The group
          is lying flat, so the Y axis here is the table's −Z and the signs go
          the opposite way to what it seems. */}
      {[-1, 1].map((end) => (
        <mesh key={end} position={[0, -end * (HALF_LENGTH - 0.001), 0]}>
          <ringGeometry
            args={[0.24, 0.252, 32, 1, end === 1 ? 0 : Math.PI, Math.PI]}
          />
          <meshBasicMaterial color={MARKING_COLOR} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function Legs() {
  const x = HALF_WIDTH - 0.08
  const z = HALF_LENGTH - 0.12

  return (
    <group>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}-${sz}`}
            position={[
              sx * x,
              -TOP_THICKNESS - TABLE_HEIGHT / 2,
              sz * z,
            ]}
          >
            <boxGeometry args={[0.06, TABLE_HEIGHT, 0.06]} />
            <meshStandardMaterial color={LEG_COLOR} roughness={0.8} />
          </mesh>
        )),
      )}
    </group>
  )
}

export function Table({ environment }: { environment?: Texture }) {
  return (
    <group>
      {/* The table top reflects the room (`useRoomEnvironment`): it is what
          gives it the shine of a real table and what makes the puck readable
          on it as it moves, because the reflection moves with the head and the
          puck does not. */}
      <mesh position={[0, -TOP_THICKNESS / 2, 0]} receiveShadow>
        <boxGeometry args={[TABLE_WIDTH, TOP_THICKNESS, TABLE_LENGTH]} />
        <meshStandardMaterial
          color={PALETTE.table}
          roughness={0.18}
          metalness={0.08}
          envMap={environment ?? null}
          envMapIntensity={0.7}
        />
      </mesh>
      <Markings />
      <Rails />
      {/* The player's is at positive Z, which is the side they have in front. */}
      <GoalMouth end={1} color={PALETTE.primary} />
      <GoalMouth end={-1} color={PALETTE.rival} />
      <Legs />
    </group>
  )
}
