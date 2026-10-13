'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { useFrame, type RootState, type ThreeEvent } from '@react-three/fiber'
import { frameEvents, type Handedness, type HandEvent } from '../../lib/haptics'
import { Vector3, type Group, type PointLight, type Texture } from 'three'
import type { RefObject } from 'react'
import { GOAL_AGAINST_STRENGTH, goalAgainstDirection } from '../../lib/goalAgainst'
import type { HitFeedbackHandle } from '../xr/HitFeedback'
import {
  OPPONENT_SKILLS,
  RAIL_HEIGHT,
  TABLE_LENGTH,
  TABLE_WIDTH,
} from '../../lib/gameConfig'
import { useGame } from '../../lib/gameStore'
import { advanceTable, startTable, type TableState } from '../../lib/matchLoop'
import { playerStart } from '../../lib/opponent'
import { PALETTE } from '../../lib/palette'
import {
  HALF_LENGTH,
  constrainMallet,
  type Vec2,
} from '../../lib/puckPhysics'
import {
  isSceneProbeRequested,
  publishSceneProbe,
  screenPointFromNdc,
  type ScreenPoint,
} from '../../lib/sceneProbe'
import { impactStrength } from '../../lib/audioEngine'
import { type PlayGameSound } from '../../lib/useGameAudio'
import { Mallet } from './Mallet'
import { Puck } from './Puck'
import { MalletHand } from './MalletHand'

/**
 * The match in progress: the puck, the two mallets and the loop that moves them.
 *
 * Nothing that changes sixty times per second goes through React state. The
 * positions live in `useRef` and are written directly onto the three objects;
 * the only thing that goes out to the store are the goals, which are a few per
 * match. With the puck's position in a `useState`, the whole tree would
 * re-render on every frame.
 *
 * Nothing is simulated here: what happens on the table is computed by
 * `lib/matchLoop.ts` from the elapsed time, and this component only passes it
 * the clock and places the result. It is outside so that whole matches can be
 * played in a test —including those of a slow machine, which is where the
 * clock broke— without opening the browser.
 *
 * It is mounted with `key={runId}`, so each match —and each round of the
 * challenge— gets a clean one: remounting it is simpler than putting each piece
 * back in its place by hand.
 *
 * That is why the sound **is received ready-made** and is not opened here: the
 * audio lasts as long as the scene, not as long as a round (see `GameWorld` and
 * `lib/useGameAudio.ts`).
 */
export function Rink({
  play,
  slide,
  feel,
  onHand,
  environment,
  hitFeedback,
}: {
  play: PlayGameSound
  /**
   * The slide of the puck, every frame, with its speed in m/s. **It only
   * sounds** (`useGameAudio`): not in the hand, since sliding is not a contact
   * and it was what left the controllers vibrating the whole rally.
   */
  slide: (speed: number) => void
  /** What is felt in the hand: the mallet's hit on the puck and the goal (`useGameHaptics`). */
  feel?: (event: HandEvent) => void
  /** Which hand carries the mallet in the headset, or `null` on releasing it (`useGameHaptics`). */
  onHand?: (hand: Handedness | null) => void
  /** The room's reflections for the puck, the same ones the table top carries. */
  environment?: Texture
  /**
   * The hit the body receives (`HitFeedback`, mounted in `GameWorld`): it is fired with the
   * goal against and slows the table's clock while its slow motion lasts.
   */
  hitFeedback?: RefObject<HitFeedbackHandle | null>
}) {
  const {
    recordMilestone,
    recordFeat,
    gameState,
    prompt,
    activeDifficulty,
    lastScorer,
    scoreOpponent,
    scorePlayer,
    setMalletHeld,
    waitingForMallet,
    seed,
  } = useGame()

  const skill = OPPONENT_SKILLS[activeDifficulty]

  const rink = useRef<Group>(null)
  const puckObject = useRef<Group>(null)
  const playerObject = useRef<Group>(null)
  const opponentObject = useRef<Group>(null)
  const goalLight = useRef<PointLight>(null)

  // The seed with which the machine chooses its shots is the match number: that
  // way two matches in a row do not repeat the same ones, and two with the same
  // number are the same match (see `AimSeed` in `lib/opponent.ts`). In the
  // hall's challenge it comes from its seed and from the round (`tableSeed`). It
  // is read on mounting, which is exactly once per match and per round of the
  // challenge (`key={runId}`).
  const table = useRef<TableState>(startTable({ skill, lastScorer, seed }))
  /**
   * The machine's goals on this table, whether they count or not: only for whoever looks
   * (`sceneProbe`).
   */
  const goalsAgainst = useRef(0)
  /** How fast the puck is going, for its glow (`Puck`) and its slide (`play.slide`). */
  const puckSpeed = useRef(0)

  // On removing the table (end of round, back to the menu) the slide switches
  // off: nobody would call it again and it would stay sounding at the last speed.
  useEffect(() => () => slide(0), [slide])
  /** Where the player is pointing. The mallet follows behind, it does not jump there. */
  const pointer = useRef<Vec2>(playerStart())
  /** Whether the mallet is held in the hand (headset). With the mouse never. */
  const inHand = useRef(false)

  // The event's point comes in world coordinates and has to be brought to the
  // table's. The same vector is reused: there are several events per frame.
  const worldPoint = useRef(new Vector3())
  /** The vector of the way back: from a point of the table to the world. */
  const tablePoint = useRef(new Vector3())
  /** The eyes, from the camera to the table, to know where the goal against comes from. */
  const headPoint = useRef(new Vector3())

  // With the headset on the mallet goes in the hand, not in the ray: pointing with the
  // controller felt like handling a cursor. Outside a session the mouse still leads on the
  // table top, which is how one plays on a screen.
  const inSession = useXR((state) => state.mode != null)

  const aim = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const rinkGroup = rink.current
      if (rinkGroup == null) return

      // `worldToLocal` mutates what it receives, so it is never passed the
      // event's point: it belongs to the library, which reuses it for the next one.
      const local = rinkGroup.worldToLocal(worldPoint.current.copy(event.point))
      pointer.current = constrainMallet({ x: local.x, z: local.z }, 'player')
    },
    [],
  )

  useFrame((state, delta) => {
    const hitsBefore = table.current.playerHits
    const frame = advanceTable(table.current, {
      // The slow motion of the hit feedback slows **the table** and nothing else: the puck and
      // the mallets go slower for an instant, and the head and the hand carry on at their own
      // pace, which is what keeps it from reading as a frame hitch.
      delta: delta * (hitFeedback?.current?.timeScale() ?? 1),
      pointer: pointer.current,
      // Held in the hand the mallet does not chase: it is where the hand is.
      inHand: inHand.current,
      skill,
      // With the exit question on screen the puck stays still: deciding cannot
      // cost goals.
      playing: gameState === 'playing' && prompt === null,
    })
    const {
      table: next,
      goals,
      struck,
      bounced,
      impact,
    } = frame
    table.current = next

    // How each goal went in, if it was a feat: it is recorded on the match and told to the hall
    // at the end.
    for (const feat of frame.feats) recordFeat(feat)
    for (const goal of goals) {
      if (goal === 'player') scorePlayer()
      else {
        goalsAgainst.current += 1
        scoreOpponent()
      }
    }

    // What is heard from the table, in the order in which it happens: the mallet
    // launches the puck, the puck hits wherever it is going to hit and, if it
    // goes in, the goal is called. Muted, `play` does nothing (see
    // `lib/useGameAudio.ts`).
    // The second step of the tutorial: hitting the puck. The hit is already counted here.
    if (next.playerHits > 0) recordMilestone('hit')
    if (struck) play('strike', impactStrength(impact.strike))
    if (bounced) play('bounce', impactStrength(impact.bounce))
    if (goals.length > 0) play('goal')
    // And what is felt, which is not the same as what is heard: the machine's hit and the
    // bounce off the rail sound, but the hand does not touch them (`frameEvents`).
    if (feel != null) for (const handEvent of frameEvents(hitsBefore, frame)) feel(handEvent)

    // And the goal against, as hit feedback, **after** the goal's vibration: `pulse()` does not
    // queue and each pulse cuts the previous one, so the long one of the hit in both hands is
    // the one that stays and the short one of the arrival does not truncate it. With comfort
    // off the macro does not vibrate and only the arrival is left, as always.
    const rinkNow = rink.current
    if (goals.includes('opponent') && rinkNow != null) {
      const eyes = rinkNow.worldToLocal(state.camera.getWorldPosition(headPoint.current))
      hitFeedback?.current?.hit(GOAL_AGAINST_STRENGTH, goalAgainstDirection(eyes))
    }

    // The sliding puck is heard and seen according to how fast it goes; stopped,
    // or with the match paused, nothing.
    const { x: vx, z: vz } = next.puck.velocity
    const speed = gameState === 'playing' && prompt === null ? Math.hypot(vx, vz) : 0
    puckSpeed.current = speed
    slide(speed)
    place(puckObject.current, next.puck.position)
    place(playerObject.current, next.player.position)
    place(opponentObject.current, next.opponent.position)

    // The goal that was scored in lights up while the celebration lasts. It is
    // what makes it visible in the headset where it went in without looking for
    // the scoreboard.
    const light = goalLight.current
    if (light != null) {
      const celebrating = next.pause > 0
      light.intensity = celebrating ? 6 : 0
      light.color.set(
        next.pendingServe === 'player' ? PALETTE.primary : PALETTE.rival,
      )
      light.position.z =
        next.pendingServe === 'player' ? -HALF_LENGTH : HALF_LENGTH
    }

    // What happens on the table, for whoever has asked for it (see
    // `lib/sceneProbe.ts`). Nobody asks for it in production: there this is one
    // check per frame and it returns.
    const rinkGroup = rink.current
    if (isSceneProbeRequested() && rinkGroup != null) {
      const { x, z } = next.puck.position
      const world = rinkGroup.localToWorld(tablePoint.current.set(x, 0, z))

      publishSceneProbe({
        playerMallet: next.player.position,
        puck: next.puck.position,
        puckScreen: screenPoint(state, world),
        playerHits: next.playerHits,
        goalsAgainst: goalsAgainst.current,
      })
    }
  })

  return (
    <group ref={rink}>
      {/*
        Where one aims. It covers the whole table and not only the player's
        half: on taking the mallet up to the halfway line, the pointer overshoots
        constantly, and with no surface underneath the mallet stays stuck right
        when it needs to move. The limits are set by `constrainMallet`, not by
        the geometry.

        Invisible but still present for the pointers: it is what makes the same
        code work for the mouse and for the ray of the headset's controller.
      */}
      <mesh
        position={[0, 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={inSession ? undefined : aim}
        visible={false}
      >
        <planeGeometry args={[TABLE_WIDTH, TABLE_LENGTH]} />
      </mesh>

      {/* The mallet in the hand: only in a session, which is where there are hands. */}
      {inSession ? (
        <MalletHand
          rink={rink}
          target={pointer}
          onMove={(target, held, side) => {
            pointer.current = target
            inHand.current = held
            // The hand that carries the mallet, so that the hit vibrates in it and not in both.
            onHand?.(side)
            // The state finds out too: the countdown does not serve until it is in the hand.
            setMalletHeld(held)
          }}
          onRelease={() => {
            inHand.current = false
            onHand?.(null)
            setMalletHeld(false)
          }}
        />
      ) : null}

      <Puck ref={puckObject} speedRef={puckSpeed} environment={environment} />
      <Mallet
        ref={playerObject}
        color={PALETTE.primary}
        environment={environment}
        highlighted={waitingForMallet}
      />
      <Mallet ref={opponentObject} color={PALETTE.rival} environment={environment} />

      <pointLight
        ref={goalLight}
        position={[0, RAIL_HEIGHT + 0.12, HALF_LENGTH]}
        intensity={0}
        distance={1.2}
        decay={2}
      />
    </group>
  )
}

/**
 * At which pixel of the page a point of the world is seen.
 *
 * The point is projected and not the object that draws it: the object's world
 * matrix is still that of the previous frame, and the puck crosses the table at
 * six metres per second.
 */
function screenPoint({ camera, gl }: RootState, world: Vector3): ScreenPoint {
  const ndc = world.project(camera)
  return screenPointFromNdc(ndc.x, ndc.y, gl.domElement.getBoundingClientRect())
}

/** Takes an object of the scene to its place on the table. */
function place(object: Group | null, position: Vec2) {
  if (object == null) return
  object.position.set(position.x, 0, position.z)
}
