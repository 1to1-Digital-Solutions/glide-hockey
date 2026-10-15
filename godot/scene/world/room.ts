/**
 * The arcade room around the table: the web's `Room.tsx`, with its measurements and its colours.
 *
 * The carpet with its stripes, the three walls seen from the spot of whoever plays (the fourth is
 * behind their back) with their trim, the ceiling that closes the room from above, the two neons
 * on the back wall, **ten switched-off arcade machines** —a row at the back and three on each
 * side— and the halo under the table. With the headset on, a table floating in black is dizzying
 * and does not let you judge distances: what gives the scale are the familiar things around, the
 * height of a machine and where the floor ends. That is why it is there, and why it goes whole
 * and not just the floor.
 *
 * **What is repeated goes in multimeshes**, like the web's `instancedMesh`: the stripes, the
 * walls, the trims and the three parts of each machine are seven draw calls and not forty. None
 * of this moves, so the copies are placed once.
 *
 * **It hangs from the space of whoever plays** (the feet at the origin), and it is what shakes
 * with the hit taken: not the table, since the mallet goes in the hand and would come unstuck from
 * it. With «tu habitación» it is hidden whole and the background turns transparent (`show`): an
 * opaque background would cover the room.
 *
 * What casts a shadow is what casts it on the web (`castShadow`): the machines' cabinets. The
 * kit's parts come without it.
 */
import { BoxMesh, Color, Node3D, QuadMesh, Vector2, Vector3, type Environment, type Transform3D } from 'godot'

import { quad, ring, withShadow, matte, multiMesh, unlit, translucent, layFlat } from '@kit/runtime/scene/parts'
import { deCuaternion, escalar, giroSobre, multiplicar, transformOf, type M3 } from '@kit/runtime/scene/matrices'

import { BACK_NEONS } from '@/lib/scoreboardSign'
import { TABLE_CENTER_Z } from '@/lib/gameConfig'
import { PALETTE } from '@/lib/palette'

/** The dark carpet of an arcade and the stripes of its pattern (`Room.tsx`). */
export const CARPET_COLOR = '#141d33'
const CARPET_STRIPE_COLOR = '#1b2748'
const WALL_COLOR = '#0b1220'
const WALL_TRIM_COLOR = '#070d17'
/**
 * The ceiling, a shade darker than the walls; it is also the scene's background (`ROOM_BACKDROP`).
 */
export const CEILING_COLOR = '#070b14'
export const ROOM_BACKDROP = CEILING_COLOR
const CABINET_COLOR = '#24304d'
const SCREEN_COLOR = '#0a1424'
const NEON_PINK = '#f43f5e'
const NEON_CYAN = '#38bdf8'

/** How much the room takes up and the measurements of an arcade machine, the web's. */
export const ROOM = { width: 9, depth: 10, height: 3.4 } as const
export const CABINET = { width: 0.8, height: 1.85, depth: 0.75 } as const

/** Where each arcade machine is and which way it faces. */
export interface MachinePlacement {
  x: number
  z: number
  rotation: number
}

/** The ten arcade machines: four at the back and three against each side wall, facing the table. */
export function machinePlacements(centre = TABLE_CENTER_Z): MachinePlacement[] {
  return [
    ...[-2.6, -1.5, 1.5, 2.6].map((x) => ({ x, z: centre - ROOM.depth / 2 + 0.5, rotation: 0 })),
    ...[-1.5, 0, 1.5].map((z) => ({ x: -ROOM.width / 2 + 0.5, z: centre + z, rotation: Math.PI / 2 })),
    ...[-1.5, 0, 1.5].map((z) => ({ x: ROOM.width / 2 - 0.5, z: centre + z, rotation: -Math.PI / 2 })),
  ]
}

const X = { x: 1, y: 0, z: 0 }
const Y = { x: 0, y: 1, z: 0 }

function rotationAbout(axis: typeof X, angle: number): M3 {
  return deCuaternion(giroSobre(axis, angle))
}

/**
 * A copy placed like the web's: three's `Euler(rx, ry, 0)` goes in XYZ order, that is `Rx · Ry`,
 * and that is how it is composed here. With the screens on the sides that tilts the screen toward
 * one flank and not backward, just as on the web.
 */
function copy(x: number, y: number, z: number, rx: number, ry: number, scale: readonly [number, number, number] = [1, 1, 1]): Transform3D {
  const m = multiplicar(rotationAbout(X, rx), rotationAbout(Y, ry))
  return transformOf(escalar(m, scale[0], scale[1], scale[2]), x, y, z)
}

function plane(width: number, height: number): QuadMesh {
  const mesh = new QuadMesh()
  mesh.size = new Vector2(width, height)
  return mesh
}

export class Room {
  /** The whole room: what is hidden with «tu habitación» and what the hit taken shakes. */
  readonly node = new Node3D()
  /** How many copies each multimesh carries, so that a test counts them against the web. */
  readonly copies: Record<'stripes' | 'walls' | 'trims' | 'machines', number>
  private withRoom: boolean | null = null

  constructor(private readonly environment: Environment) {
    this.node.set_name('Room')
    const centre = TABLE_CENTER_Z
    const n = this.node

    // The carpet, at the origin as on the web, and its stripes over the centre of the table.
    n.add_child(layFlat(quad(ROOM.width, ROOM.depth, matte(CARPET_COLOR, { rugosidad: 1 })), 0, 0, 0))
    const stripes = [-4, -2, 0, 2, 4].map((x) => copy(x, 0.002, centre, -Math.PI / 2, 0))
    n.add_child(multiMesh(plane(0.5, ROOM.depth), matte(CARPET_STRIPE_COLOR, { rugosidad: 1 }), stripes))

    const sides = [
      { x: 0, z: centre - ROOM.depth / 2, rotation: 0, width: ROOM.width },
      { x: -ROOM.width / 2, z: centre, rotation: Math.PI / 2, width: ROOM.depth },
      { x: ROOM.width / 2, z: centre, rotation: -Math.PI / 2, width: ROOM.depth },
    ]
    const walls = sides.map((side) => copy(side.x, ROOM.height / 2, side.z, 0, side.rotation, [side.width, ROOM.height, 1]))
    const trims = sides.map((side) => copy(side.x, 0.18, side.z, 0, side.rotation, [side.width, 0.36, 1]))
    n.add_child(multiMesh(plane(1, 1), matte(WALL_COLOR, { rugosidad: 1 }), walls))
    n.add_child(multiMesh(plane(1, 1), matte(WALL_TRIM_COLOR, { rugosidad: 1 }), trims))

    // The ceiling faces down, or it would be seen from outside and not from inside.
    const ceiling = quad(ROOM.width, ROOM.depth, matte(CEILING_COLOR, { rugosidad: 1 }), new Vector3(0, ROOM.height, centre))
    ceiling.rotation = new Vector3(Math.PI / 2, 0, 0)
    n.add_child(ceiling)

    // The neons on the back wall: two strips of light, with no tone mapping (`toneMapped={false}`).
    // At the height the goal sign leaves free (`BACK_NEONS`).
    BACK_NEONS.strips.forEach((neon, i) => {
      const color = [NEON_PINK, NEON_CYAN][i]!
      n.add_child(quad(neon.width, BACK_NEONS.thickness, unlit(color), new Vector3(0, neon.y, centre - ROOM.depth / 2 + 0.03)))
    })

    // The machines: the cabinet, the switched-off screen slightly tilted and the lit sign on top.
    const placements = machinePlacements(centre)
    const part = (s: MachinePlacement, lx: number, ly: number, lz: number, tilt: number) => {
      // The part's position, rotated like the cabinet and taken to its place.
      const c = Math.cos(s.rotation)
      const sn = Math.sin(s.rotation)
      return copy(s.x + lx * c + lz * sn, ly, s.z - lx * sn + lz * c, tilt, s.rotation)
    }
    const body = new BoxMesh()
    body.size = new Vector3(CABINET.width, CABINET.height, CABINET.depth)
    n.add_child(withShadow(multiMesh(body, matte(CABINET_COLOR, { rugosidad: 0.85 }), placements.map((s) => part(s, 0, CABINET.height / 2, 0, 0)))))
    n.add_child(multiMesh(plane(CABINET.width * 0.78, 0.5), unlit(SCREEN_COLOR), placements.map((s) => part(s, 0, 1.35, CABINET.depth / 2 + 0.01, -0.18))))
    n.add_child(multiMesh(plane(CABINET.width * 0.86, 0.26), unlit(PALETTE.primaryDeep), placements.map((s) => part(s, 0, CABINET.height - 0.18, CABINET.depth / 2 + 0.01, 0))))

    // The halo under the table: it separates it from the floor and gives depth without a texture.
    n.add_child(layFlat(ring(1.15, 1.9, translucent(PALETTE.primaryDeep, 0.12), 64), 0, 0.004, centre))

    this.copies = { stripes: stripes.length, walls: walls.length, trims: trims.length, machines: placements.length }
  }

  /**
   * Shows the room or removes it to see your own room; with no room, the background covers nothing.
   */
  show(withRoom: boolean): void {
    if (withRoom === this.withRoom) return
    this.withRoom = withRoom
    this.node.visible = withRoom
    this.environment.background_color = withRoom ? Color.html(ROOM_BACKDROP) : new Color(0, 0, 0, 0)
  }

  get roomShown(): boolean {
    return this.withRoom ?? true
  }
}
