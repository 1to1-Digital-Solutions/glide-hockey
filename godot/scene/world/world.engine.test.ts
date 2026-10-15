/**
 * The world of Glide Hockey in Godot, against the web and in the engine:
 *
 * - **The arcade room** (`Room.tsx`): the copies of each multimesh, the arcade machines inside the
 *   room and facing the table, and the halo under it.
 * - **The room and your own room**: your room only with augmented reality; with it, the room is
 *   hidden without being unmounted and the background stops covering.
 * - **The hints** (`Hints.tsx`) with the web's script: what lights up on entering, on starting the
 *   match and on grabbing the mallet, what each milestone puts out, the deadlines, that nothing
 *   appears all at once, that without a headset they are not shown, and that what is painted lands
 *   where the measurements of `hintScript.ts` say.
 * - **The real controller** beside the ghost mallet, with the package's model and the grip marked.
 *
 * It runs inside the engine, with the domain tests (`npm run godot:build -- --tests`).
 */
import { Environment, Node3D } from 'godot'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SceneryRig, type RoomView } from '@kit/runtime/scene/scenery'
import { RealController } from '@kit/runtime/ui/controller'

import { MAX_EXPIRY } from '@/lib/hints'
import { MALLET_RADIUS, PUCK_RADIUS, TABLE_CENTER_Z } from '@/lib/gameConfig'
import {
  HINTS_ON_THE_TABLE,
  HINT_SCRIPT,
  FOOTPRINTS,
  FOOTPRINTS_Y,
  CONTROLLER_BESIDE_MALLET,
  GOAL_MARK,
  inPlayerHalf,
  onTheTable,
  type HintFact,
} from '@/lib/hintScript'
import { playerStart } from '@/lib/opponent'
import { gameStorage } from '@/lib/storage'

import { GameHints, besideMallet } from './hints'
import { CABINET, ROOM, Room, machinePlacements } from './room'

const CONTROLLERS_DIR = 'res://games/glide-hockey/mandos'

describe('the arcade room of the web', () => {
  it('the same copies as the instanced meshes of the web', () => {
    const room = new Room(new Environment())
    expect(room.copies).toEqual({ stripes: 5, walls: 3, trims: 3, machines: 10 })
    room.node.free()
  })

  it('the arcade machines fit between the walls and face the table', () => {
    for (const s of machinePlacements()) {
      expect(Math.abs(s.x) + CABINET.depth / 2).toBeLessThanOrEqual(ROOM.width / 2)
      expect(s.z - CABINET.depth / 2).toBeGreaterThanOrEqual(TABLE_CENTER_Z - ROOM.depth / 2)
      // Its front (+Z rotated) points toward the centre of the table and not toward the wall.
      const front = { x: Math.sin(s.rotation), z: Math.cos(s.rotation) }
      const toward = { x: -s.x, z: TABLE_CENTER_Z - s.z }
      expect(front.x * toward.x + front.z * toward.z, JSON.stringify(s)).toBeGreaterThan(0)
    }
  })
})

describe('the room and your own room', () => {
  let room: Room
  let environment: Environment
  let transparentCalls: boolean[]
  let passthrough: boolean
  const view: RoomView = {
    hayPassthrough: () => passthrough,
    transparente: (yes) => transparentCalls.push(yes),
  }

  beforeEach(() => {
    gameStorage()?.clear()
    environment = new Environment()
    room = new Room(environment)
    transparentCalls = []
    passthrough = false
  })
  afterEach(() => room.node.free())

  it('without augmented reality the room is seen even if the hall asks for your own room', () => {
    const scenery = new SceneryRig({ mostrar: (yes) => room.show(yes), vista: view })
    gameStorage()!.setItem('xrcade:scenery', 'room')
    scenery.actualizar()
    expect(scenery.hayHabitacion).toBe(false)
    expect(room.node.visible).toBe(true)
    expect(environment.background_color.a).toBe(1)
    expect(transparentCalls).toEqual([false])
  })

  it('with it, your own room: the room is hidden without being unmounted and the background does not cover', () => {
    passthrough = true
    const scenery = new SceneryRig({ mostrar: (yes) => room.show(yes), vista: view })
    scenery.alternar()
    scenery.actualizar()
    expect(scenery.elegido).toBe('room')
    expect(room.node.visible).toBe(false)
    expect(room.node.get_child_count()).toBeGreaterThan(5)
    expect(environment.background_color.a).toBe(0)
    expect(transparentCalls).toEqual([true])
    // Going back to the room shows it; the choice goes in the hall's key, for every cabinet.
    scenery.alternar()
    scenery.actualizar()
    expect(scenery.elegido).toBe('place')
    expect(room.node.visible).toBe(true)
  })
})

describe('the hints, with the script of the web', () => {
  let floor: Node3D
  let table: Node3D
  let hints: GameHints
  const facts = (h: Partial<Record<HintFact, boolean>> = {}) => ({ round: false, grab: false, hit: false, goal: false, ...h })

  beforeEach(() => {
    floor = new Node3D()
    table = new Node3D()
    floor.add_child(table)
    hints = new GameHints(floor, table, new RealController({ mano: 'right', dir: CONTROLLERS_DIR, perfil: () => 'meta-quest-touch-plus', junto: besideMallet() }))
  })
  afterEach(() => floor.free())

  function run(seconds: number, h: Partial<Record<HintFact, boolean>>, showing = true): void {
    for (let t = 0; t < seconds; t += 0.05) hints.update(0.05, { showing, facts: facts(h) })
  }

  it('on entering, only the footprints; nothing appears all at once', () => {
    hints.update(0.05, { showing: true, facts: facts() })
    expect(hints.strength.floor).toBeGreaterThan(0)
    expect(hints.strength.floor).toBeLessThan(0.2)
    run(1, {})
    expect(hints.visibleHints()).toEqual(['floor'])
  })

  it('with the match, the controller and the ghost mallet; with the mallet in the hand, the goal; and they leave', () => {
    run(1, { round: true })
    expect(hints.visibleHints()).toEqual(['floor', 'controller', 'gesture'])
    run(1, { round: true, grab: true })
    expect(hints.visibleHints()).toEqual(['floor', 'goal'])
    run(1, { round: true, grab: true, hit: true })
    expect(hints.visibleHints()).toEqual(['goal'])
    run(1, { round: true, grab: true, hit: true, goal: true })
    expect(hints.visibleHints()).toEqual([])
  })

  it('what rises from the table is gone with the mallet in the hand, before the puck sets off', () => {
    run(1, { round: true })
    run(1, { round: true, grab: true })
    const visible = hints.visibleHints()
    for (const id of HINTS_ON_THE_TABLE) expect(visible, id).not.toContain(id)
  })

  it('none stays on: past the longest deadline, all of them are out even if nothing is done', () => {
    run(MAX_EXPIRY + 1, { round: true, grab: true })
    expect(hints.visibleHints()).toEqual([])
    expect(Math.max(...HINT_SCRIPT.map((hint) => hint.expiresAfter))).toBeLessThanOrEqual(MAX_EXPIRY)
  })

  it('without a headset they are not shown and their deadlines do not run', () => {
    run(30, { round: true }, false)
    expect(hints.visibleHints()).toEqual([])
    run(1, { round: true })
    expect(hints.visibleHints()).toContain('gesture')
  })

  it('the footprints go at the feet, side by side and facing forward', () => {
    run(1, {})
    const footprints: Node3D[] = []
    for (let i = 0; i < floor.get_child_count(); i++) {
      const n = floor.get_child(i)
      if (n instanceof Node3D && n !== table) footprints.push(n)
    }
    expect(footprints.length).toBe(FOOTPRINTS.length)
    footprints.forEach((n, i) => {
      expect(n.position.x).toBeCloseTo(FOOTPRINTS[i].x, 6)
      expect(n.position.y).toBeCloseTo(FOOTPRINTS_Y, 6)
      expect(n.position.z).toBeCloseTo(FOOTPRINTS[i].z, 6)
    })
  })

  it('the ghost pushes through the player half until it touches the puck at the serve', () => {
    let nearest = Infinity
    let farthest = -Infinity
    for (let t = 0; t < 1.7; t += 0.02) {
      hints.update(0.02, { showing: true, facts: facts({ round: true }) })
      const p = hints.ghost.position
      expect(inPlayerHalf({ x: p.x, z: p.z }), `${p.z}`).toBe(true)
      nearest = Math.min(nearest, p.z)
      farthest = Math.max(farthest, p.z)
    }
    expect(nearest).toBeLessThan(PUCK_RADIUS + MALLET_RADIUS + 0.01)
    expect(farthest).toBeGreaterThan(playerStart().z + 0.1)
  })

  it('the goal mark is traced inside the table, at the machine end', () => {
    const p = hints.goalMark.position
    expect(p.z).toBeCloseTo(GOAL_MARK.z, 6)
    for (const z of [p.z - GOAL_MARK.depth / 2, p.z + GOAL_MARK.depth / 2]) {
      for (const x of [-GOAL_MARK.width / 2, GOAL_MARK.width / 2]) expect(onTheTable({ x, z })).toBe(true)
    }
  })

  it('the controller goes a hand breadth from the mallet spot, enlarged and with the grip marked', () => {
    run(1, { round: true })
    const controller = hints.controller!
    expect(controller.visible).toBe(true)
    expect(controller.perfil).toBe('meta-quest-touch-plus')
    expect(controller.sitioDeLaMarca).not.toBeNull()
    const beside = besideMallet()
    expect(controller.nodo.position.x).toBeCloseTo(playerStart().x + CONTROLLER_BESIDE_MALLET.separation, 6)
    expect(controller.nodo.position.y).toBeCloseTo(CONTROLLER_BESIDE_MALLET.height, 6)
    expect(controller.nodo.position.z).toBeCloseTo(playerStart().z, 6)
    expect(controller.nodo.scale.x).toBeCloseTo(beside.escala, 6)
    expect(controller.nodo.rotation.y).toBeCloseTo(beside.giro, 6)
    run(1, { round: true, grab: true })
    expect(controller.visible).toBe(false)
    // It stays hanging from the table: hiding it does not unmount it.
    expect(controller.nodo.get_parent()).toBe(table)
  })
})
