'use client'

import { TABLE_CENTER_Z } from '../../lib/gameConfig'
import { PALETTE } from '../../lib/palette'

/**
 * El salón recreativo donde está la mesa: moqueta con dibujo, máquinas
 * apagadas contra las paredes, neones y la luz baja de un sitio así.
 *
 * No es decoración: con el visor puesto, una mesa flotando en negro marea y no
 * hay forma de calcular distancias. Lo que da la escala son las cosas conocidas
 * alrededor —el alto de una máquina, dónde acaba el suelo—, y eso es lo que
 * deja jugar de pie sin perder el sitio. Y es el sitio que le toca: una mesa de
 * air hockey es el mueble que uno se encuentra en un salón recreativo, que es
 * literalmente lo que es xrcade.
 *
 * Todo es geometría por código y colores planos: la política de seguridad del
 * salón no deja descargar texturas ni modelos (ver `docs/xrcade.md`), y de paso
 * el juego pesa lo que pesa.
 *
 * En realidad mixta no se dibuja nada de esto: ahí el sitio es la habitación de
 * quien juega y taparla rompería el passthrough.
 */

/** La moqueta oscura de un recreativo y las bandas de su dibujo. */
const CARPET_COLOR = '#141d33'
const CARPET_STRIPE_COLOR = '#1b2748'
/** Las paredes y su zócalo. */
const WALL_COLOR = '#0b1220'
const WALL_TRIM_COLOR = '#070d17'
/** Los muebles de las máquinas, y la pantalla apagada de cada una. */
const CABINET_COLOR = '#24304d'
const SCREEN_COLOR = '#0a1424'
/** Los neones de la pared: rosa y cian, que es lo que hay en estos sitios. */
const NEON_PINK = '#f43f5e'
const NEON_CYAN = '#38bdf8'

/** Lo que ocupa la sala. */
const ROOM_WIDTH = 9
const ROOM_DEPTH = 10
const ROOM_HEIGHT = 3.4
/** Las máquinas, del tamaño de una recreativa de verdad. */
const CABINET = { width: 0.8, height: 1.85, depth: 0.75 }

/** Una recreativa apagada, contra la pared. */
function Cabinet({ x, z, rotation }: { x: number; z: number; rotation: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, CABINET.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[CABINET.width, CABINET.height, CABINET.depth]} />
        <meshStandardMaterial color={CABINET_COLOR} roughness={0.85} />
      </mesh>
      {/* La pantalla, apagada y algo inclinada, que es como se ven de lejos. */}
      <mesh position={[0, 1.35, CABINET.depth / 2 + 0.01]} rotation={[-0.18, 0, 0]}>
        <planeGeometry args={[CABINET.width * 0.78, 0.5]} />
        <meshBasicMaterial color={SCREEN_COLOR} toneMapped={false} />
      </mesh>
      {/* El cartel de arriba, encendido: es lo único que ilumina la fila. */}
      <mesh position={[0, CABINET.height - 0.18, CABINET.depth / 2 + 0.01]}>
        <planeGeometry args={[CABINET.width * 0.86, 0.26]} />
        <meshBasicMaterial color={PALETTE.primaryDeep} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Room() {
  const centre = TABLE_CENTER_Z

  return (
    <group>
      {/* La moqueta, con sus bandas: lo que dice que el suelo es un suelo. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial color={CARPET_COLOR} roughness={1} />
      </mesh>
      {[-4, -2, 0, 2, 4].map((offset) => (
        <mesh
          key={offset}
          position={[offset, 0.002, centre]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.5, ROOM_DEPTH]} />
          <meshStandardMaterial color={CARPET_STRIPE_COLOR} roughness={1} />
        </mesh>
      ))}

      {/* Las paredes, con zócalo. Solo las tres que se ven desde el sitio de
          quien juega: la cuarta queda a su espalda. */}
      {[
        { pos: [0, ROOM_HEIGHT / 2, centre - ROOM_DEPTH / 2] as const, rot: 0, w: ROOM_WIDTH },
        { pos: [-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, centre] as const, rot: Math.PI / 2, w: ROOM_DEPTH },
        { pos: [ROOM_WIDTH / 2, ROOM_HEIGHT / 2, centre] as const, rot: -Math.PI / 2, w: ROOM_DEPTH },
      ].map((wall, index) => (
        <group key={index}>
          <mesh position={wall.pos} rotation={[0, wall.rot, 0]} receiveShadow>
            <planeGeometry args={[wall.w, ROOM_HEIGHT]} />
            <meshStandardMaterial color={WALL_COLOR} roughness={1} />
          </mesh>
          <mesh
            position={[wall.pos[0], 0.18, wall.pos[2]]}
            rotation={[0, wall.rot, 0]}
          >
            <planeGeometry args={[wall.w, 0.36]} />
            <meshStandardMaterial color={WALL_TRIM_COLOR} roughness={1} />
          </mesh>
        </group>
      ))}

      {/* Los neones de la pared del fondo: dos rayas de luz, que es lo que se
          ve al levantar la vista en un recreativo. */}
      {[
        { y: 2.6, color: NEON_PINK, width: 5 },
        { y: 2.3, color: NEON_CYAN, width: 3.6 },
      ].map((neon) => (
        <mesh key={neon.y} position={[0, neon.y, centre - ROOM_DEPTH / 2 + 0.03]}>
          <planeGeometry args={[neon.width, 0.06]} />
          <meshBasicMaterial color={neon.color} toneMapped={false} />
        </mesh>
      ))}

      {/* Las máquinas: una fila al fondo y otra a cada lado, todas apagadas. */}
      {[-2.6, -1.5, 1.5, 2.6].map((x) => (
        <Cabinet key={`back-${x}`} x={x} z={centre - ROOM_DEPTH / 2 + 0.5} rotation={0} />
      ))}
      {[-1.5, 0, 1.5].map((z) => (
        <Cabinet key={`left-${z}`} x={-ROOM_WIDTH / 2 + 0.5} z={centre + z} rotation={Math.PI / 2} />
      ))}
      {[-1.5, 0, 1.5].map((z) => (
        <Cabinet key={`right-${z}`} x={ROOM_WIDTH / 2 - 0.5} z={centre + z} rotation={-Math.PI / 2} />
      ))}

      {/* El halo bajo la mesa: la separa del suelo y da profundidad sin meter
          una textura que haya que servir por HTTP. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, centre]}>
        <ringGeometry args={[1.15, 1.9, 64]} />
        <meshBasicMaterial
          color={PALETTE.primaryDeep}
          transparent
          opacity={0.12}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
