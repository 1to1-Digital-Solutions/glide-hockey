'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { BACK_NEONS } from '../../lib/scoreboardSign'
import { TABLE_CENTER_Z } from '../../lib/gameConfig'
import { PALETTE } from '../../lib/palette'

/**
 * The amusement arcade where the table is: patterned carpet, machines switched
 * off against the walls, neons and the low light of a place like that.
 *
 * It is not decoration: with the headset on, a table floating in black is
 * dizzying and there is no way to judge distances. What gives the scale are the
 * familiar things around —the height of a machine, where the floor ends—, and
 * that is what lets one play standing without losing one's place. And it is the
 * place it belongs in: an air hockey table is the piece of furniture one finds
 * in an amusement arcade, which is literally what xrcade is.
 *
 * Everything is geometry in code and flat colours: the hall's security policy
 * does not allow downloading textures or models (see `docs/xrcade.md`), and
 * incidentally the game weighs what it weighs.
 *
 * In mixed reality none of this is drawn: there the place is the room of
 * whoever plays and covering it would break the passthrough.
 */

/** The dark carpet of an arcade and the stripes of its pattern. */
const CARPET_COLOR = '#141d33'
const CARPET_STRIPE_COLOR = '#1b2748'
/** The walls and their skirting. */
const WALL_COLOR = '#0b1220'
const WALL_TRIM_COLOR = '#070d17'
/**
 * The ceiling, a shade darker than the walls.
 *
 * **It is not decoration.** Without it, looking up with the headset on showed the
 * compositor's black: not the black of a room in the dark, but nothingness, which is what
 * tells the eye that this is not a place. It closes the room at the top and that is all.
 */
const CEILING_COLOR = '#070b14'

/**
 * The background of the scene: what is seen where nothing is drawn.
 *
 * It comes from here and not from the `<Canvas>` because it belongs to the place, not to the
 * host: mounted in the hall, the hub removes its own on entering the cabinet, and the game
 * that does not bring its own is left with the compositor's black. In the ceiling's shade, so
 * that the edge of the room is not cut out against it.
 */
export const ROOM_BACKDROP = CEILING_COLOR
/** The cabinets of the machines, and the switched-off screen of each one. */
const CABINET_COLOR = '#24304d'
const SCREEN_COLOR = '#0a1424'
/** The neons on the wall: pink and cyan, which is what there is in these places. */
const NEON_PINK = '#f43f5e'
const NEON_CYAN = '#38bdf8'
/** The colour of each strip of `BACK_NEONS`, from top to bottom. */
const NEON_COLORS = [NEON_PINK, NEON_CYAN] as const

/** What the room takes up. */
const ROOM_WIDTH = 9
const ROOM_DEPTH = 10
const ROOM_HEIGHT = 3.4
/** The machines, the size of a real arcade machine. */
const CABINET = { width: 0.8, height: 1.85, depth: 0.75 }

/** A copy of an instanced mesh: where it goes, how it is turned and how much it measures. */
interface Copy {
  position: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  scale?: readonly [number, number, number]
}

/**
 * Places the copies of an instanced mesh. It is done only once: none of this
 * moves, and a whole room of still things has no reason to cost one draw call
 * per thing.
 */
function usePlaced(copies: readonly Copy[]): React.RefObject<InstancedMesh | null> {
  const node = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    // The mesh is mounted with the group; the guard is for TypeScript.
    const mesh = node.current
    /* v8 ignore next */
    if (mesh == null) return
    const matrix = new Matrix4()
    const quaternion = new Quaternion()
    copies.forEach((copy, index) => {
      const [rx, ry, rz] = copy.rotation ?? [0, 0, 0]
      const [sx, sy, sz] = copy.scale ?? [1, 1, 1]
      quaternion.setFromEuler(new Euler(rx, ry, rz))
      matrix.compose(new Vector3(...copy.position), quaternion, new Vector3(sx, sy, sz))
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [copies])

  return node
}

/** Where each arcade machine is and which way it faces. */
interface CabinetSpot {
  x: number
  z: number
  rotation: number
}

/**
 * The ten arcade machines of the room, **in three meshes** and not in thirty.
 *
 * They are ten identical boxes with two signs each: drawn one by one they cost
 * thirty draw calls, more than half the budget of the whole scene, for ten
 * pieces of furniture that do not move. Instanced they cost three, one per
 * material, and they look exactly the same.
 *
 * Each mesh is placed by hand with its matrix because they never change: it is
 * done once on mounting the room and nobody touches them again.
 */
function Cabinets({ spots }: { spots: readonly CabinetSpot[] }) {
  const bodies = useRef<InstancedMesh>(null)
  const screens = useRef<InstancedMesh>(null)
  const signs = useRef<InstancedMesh>(null)

  const matrices = useMemo(() => {
    const scratch = new Matrix4()
    const rotation = new Quaternion()
    const one = new Vector3(1, 1, 1)
    const place = (spot: CabinetSpot, local: Vector3, tilt: number) => {
      // The local position of the part, turned like the cabinet and taken to its place.
      const offset = local.clone().applyAxisAngle(new Vector3(0, 1, 0), spot.rotation)
      rotation.setFromEuler(new Euler(tilt, spot.rotation, 0))
      return scratch
        .compose(new Vector3(spot.x + offset.x, offset.y, spot.z + offset.z), rotation, one)
        .clone()
    }
    return {
      bodies: spots.map((spot) => place(spot, new Vector3(0, CABINET.height / 2, 0), 0)),
      screens: spots.map((spot) => place(spot, new Vector3(0, 1.35, CABINET.depth / 2 + 0.01), -0.18)),
      signs: spots.map((spot) => place(spot, new Vector3(0, CABINET.height - 0.18, CABINET.depth / 2 + 0.01), 0)),
    }
  }, [spots])

  useLayoutEffect(() => {
    for (const [node, list] of [
      [bodies.current, matrices.bodies],
      [screens.current, matrices.screens],
      [signs.current, matrices.signs],
    ] as const) {
      // The three are mounted at once; the guard is so that TypeScript knows
      // they exist.
      /* v8 ignore next */
      if (node == null) continue
      list.forEach((matrix, index) => node.setMatrixAt(index, matrix))
      node.instanceMatrix.needsUpdate = true
    }
  }, [matrices])

  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, spots.length]} castShadow receiveShadow>
        <boxGeometry args={[CABINET.width, CABINET.height, CABINET.depth]} />
        <meshStandardMaterial color={CABINET_COLOR} roughness={0.85} />
      </instancedMesh>
      {/* The screen, switched off and slightly tilted, which is how they look from afar. */}
      <instancedMesh ref={screens} args={[undefined, undefined, spots.length]}>
        <planeGeometry args={[CABINET.width * 0.78, 0.5]} />
        <meshBasicMaterial color={SCREEN_COLOR} toneMapped={false} />
      </instancedMesh>
      {/* The sign at the top, lit: it is the only thing that lights the row. */}
      <instancedMesh ref={signs} args={[undefined, undefined, spots.length]}>
        <planeGeometry args={[CABINET.width * 0.86, 0.26]} />
        <meshBasicMaterial color={PALETTE.primaryDeep} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

export function Room() {
  const centre = TABLE_CENTER_Z
  /** The stripes of the carpet's pattern, all the same. */
  const stripeCopies = useMemo<Copy[]>(
    () => [-4, -2, 0, 2, 4].map((x) => ({ position: [x, 0.002, centre] as const, rotation: [-Math.PI / 2, 0, 0] as const })),
    [centre],
  )

  /**
   * The three walls seen from the place of whoever plays —the fourth is behind
   * their back— and their skirtings. They measure differently, so each copy
   * carries its scale: the instanced plane is one metre by one metre.
   */
  const sides = useMemo(
    () => [
      { position: [0, 0, centre - ROOM_DEPTH / 2] as const, rotation: 0, width: ROOM_WIDTH },
      { position: [-ROOM_WIDTH / 2, 0, centre] as const, rotation: Math.PI / 2, width: ROOM_DEPTH },
      { position: [ROOM_WIDTH / 2, 0, centre] as const, rotation: -Math.PI / 2, width: ROOM_DEPTH },
    ],
    [centre],
  )
  const wallCopies = useMemo<Copy[]>(
    () =>
      sides.map((side) => ({
        position: [side.position[0], ROOM_HEIGHT / 2, side.position[2]] as const,
        rotation: [0, side.rotation, 0] as const,
        scale: [side.width, ROOM_HEIGHT, 1] as const,
      })),
    [sides],
  )
  const trimCopies = useMemo<Copy[]>(
    () =>
      sides.map((side) => ({
        position: [side.position[0], 0.18, side.position[2]] as const,
        rotation: [0, side.rotation, 0] as const,
        scale: [side.width, 0.36, 1] as const,
      })),
    [sides],
  )

  const stripes = usePlaced(stripeCopies)
  const walls = usePlaced(wallCopies)
  const trims = usePlaced(trimCopies)

  const cabinets = useMemo<CabinetSpot[]>(
    () => [
      ...[-2.6, -1.5, 1.5, 2.6].map((x) => ({ x, z: centre - ROOM_DEPTH / 2 + 0.5, rotation: 0 })),
      ...[-1.5, 0, 1.5].map((z) => ({ x: -ROOM_WIDTH / 2 + 0.5, z: centre + z, rotation: Math.PI / 2 })),
      ...[-1.5, 0, 1.5].map((z) => ({ x: ROOM_WIDTH / 2 - 0.5, z: centre + z, rotation: -Math.PI / 2 })),
    ],
    [centre],
  )

  return (
    <group>
      {/* The carpet, with its stripes: what says that the floor is a floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial color={CARPET_COLOR} roughness={1} />
      </mesh>
      <instancedMesh ref={stripes} args={[undefined, undefined, stripeCopies.length]}>
        <planeGeometry args={[0.5, ROOM_DEPTH]} />
        <meshStandardMaterial
          color={CARPET_STRIPE_COLOR}
          roughness={1}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </instancedMesh>

      {/* The walls, with skirting. Only the three seen from the place of
          whoever plays: the fourth is behind their back. */}
      <instancedMesh ref={walls} args={[undefined, undefined, wallCopies.length]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={1} />
      </instancedMesh>
      <instancedMesh ref={trims} args={[undefined, undefined, trimCopies.length]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={WALL_TRIM_COLOR} roughness={1} />
      </instancedMesh>

      {/* The ceiling, which closes the room at the top. Without it, looking up
          was seeing the compositor's black —nothingness, not a room in the
          dark—, and that is what tells the eye that the place is not a place.
          It faces down (`Math.PI / 2`), or it would be seen from outside and
          not from inside. */}
      <mesh position={[0, ROOM_HEIGHT, centre]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial color={CEILING_COLOR} roughness={1} />
      </mesh>

      {/* The neons on the back wall: two stripes of light, which is what one
          sees on looking up in an arcade. */}
      {BACK_NEONS.strips.map((neon, i) => (
        <mesh key={neon.y} position={[0, neon.y, centre - ROOM_DEPTH / 2 + 0.03]}>
          <planeGeometry args={[neon.width, BACK_NEONS.thickness]} />
          <meshBasicMaterial color={NEON_COLORS[i]} toneMapped={false} />
        </mesh>
      ))}

      {/* The machines: one row at the back and another on each side, all switched off. */}
      <Cabinets spots={cabinets} />

      {/* The glow under the table: it separates it from the floor and gives
          depth without bringing in a texture that would have to be served over HTTP. */}
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
