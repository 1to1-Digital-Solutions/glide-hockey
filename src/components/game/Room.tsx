'use client'

import { TABLE_CENTER_Z } from '../../lib/gameConfig'
import { PALETTE } from '../../lib/palette'

/**
 * La sala donde está la mesa: un suelo y poco más.
 *
 * Existe para que en el visor haya una referencia bajo los pies y para que en
 * escritorio la mesa no flote sobre la nada. En realidad mixta no se dibuja:
 * ahí el suelo es el de la habitación del jugador y taparlo rompería el
 * passthrough, que es justo lo que se ha pedido al entrar en `immersive-ar`.
 */

/** Gris azulado del suelo, que fuera de aquí no significa nada. */
const FLOOR_COLOR = '#101a2b'

export function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.95} />
      </mesh>

      {/* Un halo bajo la mesa: separa el suelo del fondo y da profundidad sin
          meter una textura que haya que servir por HTTP. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, TABLE_CENTER_Z]}>
        <ringGeometry args={[1.15, 1.9, 64]} />
        <meshBasicMaterial
          color={PALETTE.primaryDeep}
          transparent
          opacity={0.1}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
