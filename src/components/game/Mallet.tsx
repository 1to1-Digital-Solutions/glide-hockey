'use client'

import { type Ref } from 'react'
import { type Group, type Texture } from 'three'
import { NO_RAYCAST } from '../raycast'
import { MALLET_RADIUS } from '../../lib/gameConfig'

/** Height of the base that slides on the table and of the knob that is grabbed. */
const BASE_HEIGHT = 0.028
const KNOB_HEIGHT = 0.045

/**
 * A mallet, the player's or the machine's.
 *
 * Like the puck, it does not know where it is: the match loop places it (see
 * `Rink`). The only thing of its own is the colour, which is what tells at a
 * glance whose each half of the table is.
 *
 * **And the room's reflections, the same ones the table and the puck carry.** It is the
 * object that is a hand's breadth from the eyes the whole match: without them it had less
 * finish than the table underneath, and that shows much more than the other way round. It
 * does not cost one more draw call — the map is already loaded and is shared.
 *
 * **Out of reach of the rays.** With the headset on the mallet goes in the hand, and the ray
 * with which the menu is pressed comes out of that same hand: the first thing it meets is the
 * mallet, which keeps the event and leaves the button none the wiser. From inside that is not
 * seen as «the mallet is in the way», it is seen as **the button does not work**. The fix
 * reached the other games and not this one —the same mallet, the same failure, and in
 * hole-patrol it was already written—. On desktop nothing is lost: there is no ray there.
 */
export function Mallet({
  color,
  environment,
  highlighted = false,
  ref,
}: {
  color: string
  /** The room's reflections, the same ones the table top carries. */
  environment?: Texture
  /**
   * That it has to be grabbed **now**: it lights up so that it is seen which one it is.
   *
   * The countdown asks for it while it waits to have it in the hand. Without this, the only
   * thing that happened was that the 1 stayed stuck: «the countdown stays stopped on the 1
   * with no explanation. The user could be helped, or the object could glow more».
   */
  highlighted?: boolean
  ref?: Ref<Group>
}) {
  return (
    <group ref={ref}>
      <mesh position={[0, BASE_HEIGHT / 2, 0]} castShadow raycast={NO_RAYCAST}>
        <cylinderGeometry
          args={[MALLET_RADIUS, MALLET_RADIUS, BASE_HEIGHT, 32]}
        />
        <meshStandardMaterial
          color={color}
          roughness={0.4}
          metalness={0.1}
          envMap={environment ?? null}
          envMapIntensity={0.5}
          emissive={color}
          emissiveIntensity={highlighted ? 0.9 : 0}
        />
      </mesh>

      <mesh position={[0, BASE_HEIGHT + KNOB_HEIGHT / 2, 0]} castShadow raycast={NO_RAYCAST}>
        <cylinderGeometry
          args={[MALLET_RADIUS * 0.45, MALLET_RADIUS * 0.55, KNOB_HEIGHT, 24]}
        />
        <meshStandardMaterial
          color={color}
          roughness={0.55}
          envMap={environment ?? null}
          envMapIntensity={0.4}
          emissive={color}
          emissiveIntensity={highlighted ? 0.9 : 0}
        />
      </mesh>
    </group>
  )
}
