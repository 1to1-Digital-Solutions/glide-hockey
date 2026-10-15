'use client'

import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useMemo, useRef, useState } from 'react'
import { Group, Mesh, MeshBasicMaterial } from 'three'

import {
  HINT_MARK_COLOR,
  THROB,
  moveToward,
  advanceHints,
  throb,
  sweepPhase,
  noHints,
} from '../../lib/hints'
import type { Hand } from '../../lib/settings'
import { useHand } from '../../lib/settingsClient'
import { MALLET_RADIUS, TABLE_CENTER_Z, TABLE_HEIGHT } from '../../lib/gameConfig'
import { useGame } from '../../lib/gameStore'
import {
  DECAL_Y,
  PUSH,
  HINT_SCRIPT,
  FOOTPRINT,
  FOOTPRINTS,
  FOOTPRINTS_Y,
  GOAL_MARK,
  ghostMalletAt,
  controllerBesideMallet,
  CONTROLLER_BESIDE_MALLET,
  type MalletHint,
  type HintFact,
} from '../../lib/hintScript'
import { RealController } from '../xr/RealController'
import { NO_RAYCAST } from '../raycast'

/**
 * The visual hints: what has to be done, taught without a single letter.
 *
 * **Why it exists.** The tutorial explains the game and stays as a safety net, but the first
 * thing someone does on entering is not to read: it is to look around. If looking around does
 * not show where to stand, what to grab or what to do with it, the game starts with a question
 * — and what is read afterwards already arrives late. Here are the answers, drawn: the
 * footprints on the floor, the ghost mallet pushing towards the puck, the mark of the opposing
 * goal and the real controller with the grab button lit.
 *
 * **And none of them stays on.** Each one switches off by itself as soon as the gesture is made
 * once, or when its deadline runs out; `lib/hintScript.ts` decides it on top of the engine of
 * `lib/hints.ts`, both tested without a browser. Here it is only drawn.
 *
 * **Everything is mounted at once and never unmounted**, even if it is not seen. Mounting a new
 * mesh halfway through a match forces three to compile its material, and compiling a shader
 * blocks the thread: with the headset on that is a hitch, and right at the moment the hint wants
 * to be looked at. Mounted from the start, `PrewarmShaders` compiles it with everything else.
 * What switches on and off is `visible` and the opacity — and a hint that is off is invisible,
 * so it does not cost a draw call either.
 *
 * **The milestones are not listened for, they are deduced.** The mallet already records when it
 * is grabbed and the table when it is hit and when a goal is scored (`lib/gameStore.ts`), which
 * is where the tutorial draws from too. That way this hint finds out about nothing and stops the
 * game for nobody.
 *
 * **Only inside the headset.** Outside the session one plays with the mouse on a screen, and
 * there the website tells it with letters, which are read before starting and without having
 * the hands busy.
 */

/** How opaque each hint gets when fully lit. */
const OPACITY = { floor: 0.75, gesture: 0.7, goal: 0.72 } as const

/**
 * What is painted on a surface is separated by biasing the depth when rasterising and not by
 * raising it a millimetre: the millimetre is enough in the browser and not enough with the
 * headset on.
 */
const DECAL = {
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4,
} as const

/** What all the materials of a hint carry: amber, translucent and with no tone mapping. */
const PAINT = {
  color: HINT_MARK_COLOR,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  toneMapped: false,
} as const

/**
 * The measurements of the ghost mallet.
 *
 * The ring goes at the radius of the real mallet, which is what makes it read as «this one
 * here» and not as a stain: made fatter it would show a mallet that does not exist. The handle
 * is a sketch, just enough for the ring not to read as a hole in the table.
 */
const GHOST = { thickness: 0.008, handle: { radius: 0.02, height: 0.05 } } as const

/** Where the hint's controller goes: it only depends on the hand, so it is computed once per hand. */
function besideMallet(hand: Hand) {
  const { position, rotation } = controllerBesideMallet(hand)
  return {
    position: [position.x, position.y, position.z] as const,
    rotation: [0, rotation, 0] as const,
    scale: CONTROLLER_BESIDE_MALLET.scale,
  }
}

/** Has whoever plays asked for things not to move by themselves? */
function reducedMotion(): boolean {
  if (typeof window === 'undefined' || window.matchMedia == null) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Hints() {
  const inSession = useXR((state) => state.mode != null)
  const { gameState, milestones } = useGame()

  const [still] = useState(reducedMotion)
  /** The hall's preferred hand: its controller is the one shown, and on its side of the mallet. */
  const hand = useHand()
  const beside = useMemo(() => besideMallet(hand), [hand])

  /** The clock of each hint and which ones are shown, without going through React state. */
  const hintState = useRef(noHints())
  /**
   * What the script takes as done. The same object is **mutated** on every frame instead of
   * building a new one: ninety objects per second are ninety objects to collect, and this does
   * not leave here.
   */
  const facts = useRef<Record<HintFact, boolean>>({
    round: false,
    grab: false,
    hit: false,
    goal: false,
  })
  /** How much of each one is seen right now, from 0 to 1. */
  const strength = useRef<Record<MalletHint, number>>({
    floor: 0,
    controller: 0,
    gesture: 0,
    goal: 0,
  })

  const footprints = useRef<(Mesh | null)[]>([])
  const ghost = useRef<Group>(null)
  const ghostPaint = useRef<(MeshBasicMaterial | null)[]>([])
  const goalMark = useRef<Mesh>(null)
  const controller = useRef<Group>(null)

  useFrame(({ clock }, delta) => {
    // From the moment the cabinet is entered, which is when one can already take position;
    // whatever needs mallet or puck is waited for by the script itself with `round`.
    const showing = inSession
    facts.current.round = gameState !== 'menu'
    facts.current.grab = milestones.grab
    facts.current.hit = milestones.hit
    facts.current.goal = milestones.goal
    const step = advanceHints(HINT_SCRIPT, facts.current, hintState.current, showing ? delta : 0)
    const now = clock.elapsedTime
    const pulse = still ? 1 : throb(now, THROB.strength)

    for (const hint of HINT_SCRIPT) {
      const wanted = showing && step.lit.has(hint.id) ? 1 : 0
      strength.current[hint.id] = moveToward(strength.current[hint.id], wanted, delta)
    }

    // The footprints on the floor, throbbing: it is what sets them apart from a carpet stain.
    const onFloor = strength.current.floor
    for (const piece of footprints.current) {
      if (piece == null) continue
      piece.visible = onFloor > 0.004
      ;(piece.material as MeshBasicMaterial).opacity = onFloor * OPACITY.floor * pulse
    }

    // The ghost mallet, giving its push: it draws back slowly and pushes fast until it touches
    // the puck. Still in its place if it has been asked that nothing moves by itself.
    const withGesture = strength.current.gesture
    const group = ghost.current
    if (group != null) {
      group.visible = withGesture > 0.004
      const progress = still ? 0 : sweepPhase(now, PUSH.period).progress
      const where = ghostMalletAt(progress)
      group.position.set(where.x, 0, where.z)
    }
    for (const material of ghostPaint.current) {
      if (material != null) material.opacity = withGesture * OPACITY.gesture * pulse
    }

    // The mark of the opposing goal. **It does not throb**: it stays on while playing —it is
    // decalled on the back, where it cannot cover anything—, and something that pulsates while
    // the puck crosses the table steals the gaze right when it is needed elsewhere.
    const atGoal = strength.current.goal
    if (goalMark.current != null) {
      goalMark.current.visible = atGoal > 0.004
      ;(goalMark.current.material as MeshBasicMaterial).opacity = atGoal * OPACITY.goal
    }

    // The real controller. It switches off by hiding the group and not by unmounting it:
    // unmounting it releases the model's materials and showing it again would recompile them.
    if (controller.current != null) controller.current.visible = strength.current.controller > 0.004
  })

  return (
    <group name="hints">
      {/* The footprints, on the floor and at the feet of whoever enters: that is where the
          anchor leaves them. Side by side and facing forward, which is the air hockey stance. */}
      {FOOTPRINTS.map((footprint, index) => (
        <mesh
          key={index}
          ref={(piece) => {
            footprints.current[index] = piece
          }}
          visible={false}
          raycast={NO_RAYCAST}
          position={[footprint.x, FOOTPRINTS_Y, footprint.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          // A footprint is an oval: the twelve-sided circle stretched along the foot.
          scale={[FOOTPRINT.width / 2, FOOTPRINT.length / 2, 1]}
        >
          <circleGeometry args={[1, 12]} />
          <meshBasicMaterial {...PAINT} {...DECAL} />
        </mesh>
      ))}

      {/* What goes on the table, in its coordinates: the same place where the table top and
          the match are planted (`GameWorld`), so that these measurements are those of
          `hintScript` and not a translation of them. */}
      <group position={[0, TABLE_HEIGHT, TABLE_CENTER_Z]}>
        {/* The ghost mallet. The group is planted where the mallet would be, and the push takes
            it from one side to the other of the player's half. */}
        <group ref={ghost} visible={false}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, DECAL_Y, 0]} raycast={NO_RAYCAST}>
            <torusGeometry args={[MALLET_RADIUS, GHOST.thickness, 8, 24]} />
            <meshBasicMaterial
              ref={(material) => {
                ghostPaint.current[0] = material
              }}
              {...PAINT}
            />
          </mesh>
          {/* The handle, sketched: without it the ring reads as a hole in the table and not as
              something to grab. */}
          <mesh position={[0, GHOST.handle.height / 2, 0]} raycast={NO_RAYCAST}>
            <cylinderGeometry
              args={[GHOST.handle.radius, GHOST.handle.radius, GHOST.handle.height, 10]}
            />
            <meshBasicMaterial
              ref={(material) => {
                ghostPaint.current[1] = material
              }}
              {...PAINT}
            />
          </mesh>
        </group>

        {/* The mark of the opposing goal, decalled on the back: where what is hit goes.
            Painted and not raised, since the puck passes through there. */}
        <mesh
          ref={goalMark}
          visible={false}
          raycast={NO_RAYCAST}
          position={[0, DECAL_Y, GOAL_MARK.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[GOAL_MARK.width, GOAL_MARK.depth]} />
          <meshBasicMaterial {...PAINT} {...DECAL} />
        </mesh>
      </group>

      {/* The real controller with the grab button throbbing, **next to the ghost mallet** and
          not on the hand: the hand is taken by the tutorial's copy, and two copies of the same
          model in the same place overlap. This way it shows from the first time. Inside a
          group of its own to switch it off without unmounting it, and in the table's
          coordinates (`controllerBesideMallet`). */}
      <group ref={controller} visible={false} position={[0, TABLE_HEIGHT, TABLE_CENTER_Z]}>
        <RealController hand={hand} button="agarre" beside={beside} />
      </group>
    </group>
  )
}
