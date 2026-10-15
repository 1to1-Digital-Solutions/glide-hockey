/**
 * The visual hints of Glide Hockey in Godot: what has to be done, shown without a single letter
 * (`components/game/Hints.tsx`). The footprints on the floor say where to stand, facing forward
 * and side by side; the ghost mallet pushing until it touches the puck, what is grabbed and what
 * is done with it; the real controller beside it with the grip throbbing, with what; and the mark
 * traced on the opposite goal, where what is hit goes.
 *
 * **None of them stays on.** When each one lights up and goes out is decided by the web's script
 * (`lib/hintScript.ts`) on top of the games' shared engine (`lib/hints.ts`), both as they are, and
 * the measurements of what is painted are theirs: here it is only painted. The two that rise from
 * the table (the ghost and the controller) leave with the mallet in the hand, which is before the
 * puck sets off.
 *
 * **Everything is mounted at once** and lit with `visible` and the opacity: mounting a mesh in the
 * middle of a match is compiling a material in the middle of a match. The footprints hang from the
 * space of whoever plays; the rest, from the table. As on the web, **only with the headset on**
 * (`showing`); `-- --ayudas` shows them on the flat screen.
 */
import { Node3D, Vector3, type MeshInstance3D, type StandardMaterial3D } from 'godot'

import { arcTriangles } from '@kit/lib/ui/icons'
import { hoop, cylinder, quad, mesh, flatMesh, opacidad, translucent, layFlat } from '@kit/runtime/scene/parts'
import type { RealController } from '@kit/runtime/ui/controller'

import type { Hand } from '@/lib/settings'
import { HINT_MARK_COLOR, THROB, moveToward, advanceHints, throb, sweepPhase, noHints } from '@/lib/hints'
import { MALLET_RADIUS } from '@/lib/gameConfig'
import {
  DECAL_Y,
  PUSH,
  HINT_SCRIPT,
  FOOTPRINT,
  FOOTPRINTS,
  FOOTPRINTS_Y,
  CONTROLLER_BESIDE_MALLET,
  GOAL_MARK,
  controllerBesideMallet,
  ghostMalletAt,
  type MalletHint,
  type HintFact,
} from '@/lib/hintScript'

/** How opaque each hint gets when fully lit (`OPACITY` of `Hints.tsx`). */
export const HINT_OPACITY = { floor: 0.75, gesture: 0.7, goal: 0.72 } as const

/**
 * The measurements of the ghost mallet: the ring at the radius of the real mallet and a sketch of a
 * handle (`GHOST`).
 */
export const GHOST = { thickness: 0.008, handle: { radius: 0.02, height: 0.05 } } as const

/** Below this, a hint that is going out is no longer painted (the web's `> 0.004`). */
const FADED_OUT = 0.004

/**
 * Where the controller goes beside the ghost mallet, in the table's coordinates (the web's
 * `besideMallet`): a hand's breadth from the spot where the mallet starts, on the side of the
 * dominant hand, at the height of the hand and with the grip facing the eyes.
 */
export function besideMallet(hand: Hand = 'right'): { posicion: Vector3; giro: number; escala: number } {
  const { position, rotation } = controllerBesideMallet(hand)
  return { posicion: new Vector3(position.x, position.y, position.z), giro: rotation, escala: CONTROLLER_BESIDE_MALLET.scale }
}

/** What the hints need to know about the match, every frame. */
export interface HintsMoment {
  /**
   * With the headset on (or forced on the flat screen): without that, they are not shown and their
   * deadlines do not run.
   */
  showing: boolean
  /**
   * What has been done: the match under way, the mallet in the hand, the first hit and the first
   * goal.
   */
  facts: Readonly<Record<HintFact, boolean>>
}

export class GameHints {
  private readonly state = noHints()
  private readonly strengths: Record<MalletHint, number> = { floor: 0, controller: 0, gesture: 0, goal: 0 }
  private readonly footprints: { node: MeshInstance3D; material: StandardMaterial3D }[] = []
  readonly ghost = new Node3D()
  private readonly ghostPaint: StandardMaterial3D[] = []
  readonly goalMark: MeshInstance3D
  private readonly goalMarkPaint: StandardMaterial3D
  private clock = 0
  private allOff = false

  constructor(
    /** The space of whoever plays: the feet at the origin. The footprints go there. */
    floor: Node3D,
    /** The table's space: its centre, at the height of the top. The rest goes there. */
    table: Node3D,
    /**
     * The real controller beside the ghost mallet, already placed with `besideMallet()`, or
     * nothing.
     */
    readonly controller: RealController | null = null,
  ) {
    for (const h of FOOTPRINTS) {
      // A footprint is an oval: the twelve-sided circle stretched along the foot.
      const material = translucent(HINT_MARK_COLOR, 0, 3)
      const node = layFlat(mesh(flatMesh(arcTriangles(0, 1, 0, Math.PI * 2, 12)), material), h.x, FOOTPRINTS_Y, h.z)
      node.scale = new Vector3(FOOTPRINT.width / 2, FOOTPRINT.length / 2, 1)
      node.visible = false
      floor.add_child(node)
      this.footprints.push({ node, material })
    }

    // The ghost mallet: the ring traced on the table and the sketched handle, since without it the
    // ring reads as a hole and not as something to grab. Godot's ring already lies flat.
    this.ghost.set_name('GhostMallet')
    this.ghost.visible = false
    const paint = () => {
      const m = translucent(HINT_MARK_COLOR, 0, 4)
      this.ghostPaint.push(m)
      return m
    }
    const ring = hoop(MALLET_RADIUS, GHOST.thickness, paint(), 24)
    ring.position = new Vector3(0, DECAL_Y, 0)
    this.ghost.add_child(ring)
    this.ghost.add_child(cylinder(GHOST.handle.radius, GHOST.handle.radius, GHOST.handle.height, paint(), new Vector3(0, GHOST.handle.height / 2, 0), 10))
    table.add_child(this.ghost)

    // The mark of the opposite goal, traced at the far end: the puck goes through there.
    this.goalMarkPaint = translucent(HINT_MARK_COLOR, 0, 4)
    this.goalMark = layFlat(quad(GOAL_MARK.width, GOAL_MARK.depth, this.goalMarkPaint), 0, DECAL_Y, GOAL_MARK.z)
    this.goalMark.set_name('GoalMark')
    this.goalMark.visible = false
    table.add_child(this.goalMark)

    if (controller != null) table.add_child(controller.nodo)
  }

  /** How much of each hint is seen right now, from 0 to 1. */
  get strength(): Readonly<Record<MalletHint, number>> {
    return this.strengths
  }

  /** The hints' clock: the screenshots wait until they are fully lit. */
  get seconds(): number {
    return this.clock
  }

  update(delta: number, moment: HintsMoment): void {
    this.clock += delta
    const { showing } = moment
    const step = advanceHints(HINT_SCRIPT, moment.facts, this.state, showing ? delta : 0)
    let anyVisible = false
    for (const hint of HINT_SCRIPT) {
      const wanted = showing && step.lit.has(hint.id) ? 1 : 0
      this.strengths[hint.id] = moveToward(this.strengths[hint.id], wanted, delta)
      if (this.strengths[hint.id] > FADED_OUT) anyVisible = true
    }
    // All of them off and already hidden: nothing to paint, and the engine is not touched.
    if (!anyVisible && this.allOff) return
    this.allOff = !anyVisible
    const pulse = throb(this.clock, THROB.strength)

    // The footprints, throbbing: it is what sets them apart from a stain on the carpet.
    const floor = this.strengths.floor
    for (const h of this.footprints) {
      h.node.visible = floor > FADED_OUT
      opacidad(h.material, floor * HINT_OPACITY.floor * pulse)
    }

    // The ghost mallet, giving its push: it draws back slowly and pushes fast until it touches the
    // puck.
    const gesture = this.strengths.gesture
    this.ghost.visible = gesture > FADED_OUT
    const where = ghostMalletAt(sweepPhase(this.clock, PUSH.period).progress)
    this.ghost.position = new Vector3(where.x, 0, where.z)
    for (const m of this.ghostPaint) opacidad(m, gesture * HINT_OPACITY.gesture * pulse)

    // The goal mark **does not throb**: it stays while playing, and something that pulses while
    // the puck crosses the table steals the gaze just when it is needed elsewhere.
    const goal = this.strengths.goal
    this.goalMark.visible = goal > FADED_OUT
    opacidad(this.goalMarkPaint, goal * HINT_OPACITY.goal)

    // The controller goes out by hiding it, not unmounting it: showing it again would recompile the
    // model.
    const controller = this.controller
    if (controller != null) {
      if (this.strengths.controller > FADED_OUT) {
        controller.encender('agarre')
        controller.actualizar(delta)
      } else controller.apagar()
    }
  }

  /** What is really seen: the hints with something painted right now. */
  visibleHints(): MalletHint[] {
    const visible: Record<MalletHint, boolean> = {
      floor: this.footprints.some((h) => h.node.visible),
      controller: this.controller?.visible ?? false,
      gesture: this.ghost.visible,
      goal: this.goalMark.visible,
    }
    return HINT_SCRIPT.map((hint) => hint.id).filter((id) => visible[id])
  }
}
