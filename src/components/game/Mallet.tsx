'use client'

import { type Ref } from 'react'
import { type Group } from 'three'
import { MALLET_RADIUS } from '../../lib/gameConfig'

/** Alto de la base que roza la mesa y del pomo que se agarra. */
const BASE_HEIGHT = 0.028
const KNOB_HEIGHT = 0.045

/**
 * Un mazo, el del jugador o el de la máquina.
 *
 * Como el disco, no sabe dónde está: lo coloca el bucle de la partida (ver
 * `Rink`). Lo único suyo es el color, que es lo que distingue de un vistazo de
 * quién es cada mitad de la mesa.
 */
export function Mallet({ color, ref }: { color: string; ref?: Ref<Group> }) {
  return (
    <group ref={ref}>
      <mesh position={[0, BASE_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry
          args={[MALLET_RADIUS, MALLET_RADIUS, BASE_HEIGHT, 32]}
        />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
      </mesh>

      <mesh position={[0, BASE_HEIGHT + KNOB_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry
          args={[MALLET_RADIUS * 0.45, MALLET_RADIUS * 0.55, KNOB_HEIGHT, 24]}
        />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
    </group>
  )
}
