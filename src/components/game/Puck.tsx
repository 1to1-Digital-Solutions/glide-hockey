'use client'

import { type Ref } from 'react'
import { type Group } from 'three'
import { PUCK_RADIUS } from '../../lib/gameConfig'
import { PALETTE } from '../../lib/palette'

/** Grosor del disco. Lo justo para que se le vea el canto desde el borde. */
const PUCK_HEIGHT = 0.022

/**
 * El disco.
 *
 * No sabe dónde está: lo coloca el bucle de la partida moviendo su grupo (ver
 * `Rink`). Así la posición no pasa por el estado de React, que a sesenta
 * fotogramas por segundo repintaría el árbol entero.
 */
export function Puck({ ref }: { ref?: Ref<Group> }) {
  return (
    <group ref={ref}>
      <mesh position={[0, PUCK_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry
          args={[PUCK_RADIUS, PUCK_RADIUS, PUCK_HEIGHT, 32]}
        />
        <meshStandardMaterial
          color={PALETTE.puck}
          roughness={0.35}
          metalness={0.1}
        />
      </mesh>

      {/* Tapa más clara: da la cara superior del disco y le pone un punto de
          referencia al ojo cuando cruza la mesa a toda velocidad. */}
      <mesh position={[0, PUCK_HEIGHT + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[PUCK_RADIUS * 0.62, 32]} />
        <meshBasicMaterial color={PALETTE.primaryBright} toneMapped={false} />
      </mesh>
    </group>
  )
}
