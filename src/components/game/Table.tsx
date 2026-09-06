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
 * La mesa: el tablero, las bandas que lo rodean, las dos porterías y las
 * marcas de la pista.
 *
 * Es decorado y nada más —no se mueve ni sabe de la partida—, así que va en su
 * propio componente y se pinta una vez. Las medidas son las de `gameConfig.ts`,
 * las mismas con las que rebota el disco: si la mesa se ensancha aquí sin
 * ensancharse allí, el disco rebotaría en el aire.
 *
 * Coordenadas locales, con el centro del tablero en el origen y su superficie
 * en `y = 0`. Quien la monta la sube a la altura que toca (ver `Rink`).
 */

/** Grosor del tablero y de las bandas que lo rodean. */
const TOP_THICKNESS = 0.05
const RAIL_THICKNESS = 0.04

/** Ancho de cada trozo de banda del fondo, a los lados de la portería. */
const END_RAIL_WIDTH = (TABLE_WIDTH - GOAL_WIDTH) / 2

/** Las marcas se pintan pegadas al tablero, lo justo para no calarse en él. */
const MARKING_Y = 0.001

/** Colores propios del decorado, que fuera de la mesa no significan nada. */
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

      {/* Los fondos van partidos en dos: en medio está la portería. */}
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
 * La boca de una portería: el hueco por el que entra el disco.
 *
 * El fondo es oscuro —es un hueco, y cualquier reflejo lo delataría como tapa—
 * pero el marco lleva el color de su dueño. Sin eso, sobre una mesa blanca y
 * dos bandas azul marino, las dos porterías son la misma mancha negra y no hay
 * forma de saber a cuál se tira.
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

      {/* Umbral encendido, ya sobre el tablero: es lo que se ve desde arriba. */}
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
      {/* Línea de medio campo: hasta dónde llega cada mazo. */}
      <mesh>
        <planeGeometry args={[TABLE_WIDTH, 0.012]} />
        <meshBasicMaterial color={MARKING_COLOR} toneMapped={false} />
      </mesh>

      {/* Círculo central, donde se saca. */}
      <mesh>
        <ringGeometry args={[0.16, 0.172, 48]} />
        <meshBasicMaterial color={MARKING_COLOR} toneMapped={false} />
      </mesh>

      {/* Área de cada portería: media circunferencia abierta hacia el centro.
          El grupo está tumbado, así que el eje Y de aquí es el −Z de la mesa y
          los signos van al revés de lo que parece. */}
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
      {/* El tablero refleja la sala (`useRoomEnvironment`): es lo que le da el
          brillo de una mesa de verdad y lo que hace que el disco se lea sobre
          él al moverse, porque el reflejo se mueve con la cabeza y el disco no. */}
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
      {/* La del jugador está en Z positivo, que es el lado que tiene delante. */}
      <GoalMouth end={1} color={PALETTE.primary} />
      <GoalMouth end={-1} color={PALETTE.rival} />
      <Legs />
    </group>
  )
}
