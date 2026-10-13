'use client'

import { useCallback, useEffect, useRef } from 'react'
import { HitFeedback, type HitFeedbackHandle } from '../xr/HitFeedback'
import { useComfort } from '../../lib/comfort'
import { XRUiHeight } from '../xr/XRUiHeight'
import { useXR } from '@react-three/xr'
import { BACK_SCOREBOARD, THRESHOLD_SOUND, tutorialPlacement } from '../../lib/scoreboardSign'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from '../../lib/gameConfig'
import { countMount } from '../../lib/mountCount'
import { endSoundsLikeWin } from '../../lib/duel'
import { useGame } from '../../lib/gameStore'
import { thresholdCrossed, type Medal } from '../../lib/goal'
import { showsPlace } from '../../lib/settings'
import {
  EYE_HEIGHTS,
  distanceFromEyes,
  eyesAt,
  panelRotation,
  type PanelPose,
  type Point,
} from '../../lib/panelReading'
import { REFERENCE_EYE_HEIGHT, uiRiseOverWorld, worldRise } from '../../lib/uiHeight'
import { useGameAudio } from '../../lib/useGameAudio'
import { useGameMusic } from '../../lib/useGameMusic'
import { useGameHaptics } from '../../lib/useGameHaptics'
import { useRoomEnvironment } from '../../lib/useRoomEnvironment'
import { menuPlacement } from '../../lib/xrMenuLayout'
import {
  XRCountdown,
  XRGameOver,
  XRQuitButton,
  XRQuitConfirm,
  XRScoreboard,
} from '../xr/XRHud'
import { XRMenu } from '../xr/XRMenu'
import { XRTutorial } from '../xr/XRTutorial'
import { XRSessionController } from '../xr/XRSessionController'
import { Hints } from './Hints'
import { ScoreboardSign } from './ScoreboardSign'
import { PrewarmShaders } from './PrewarmShaders'
import { Rink } from './Rink'
import { Backdrop } from './Backdrop'
import { ROOM_BACKDROP, Room } from './Room'
import { Table } from './Table'
import type { HostAnchor } from '../../lib/hostAnchor'
import { WorldAnchor } from './WorldAnchor'
import { XRWorldHeight } from '../xr/XRWorldHeight'

/**
 * The whole game as THREE OBJECTS, with no Canvas and no session of its own.
 *
 * It is what gets mounted inside the Canvas of whoever hosts it —its own
 * website or the xrcade hall— and that is why there is no `<Canvas>`, no `<XR>`
 * and no `<XROrigin>` here: WebXR gives one session per document and that
 * session is tied to the Canvas that opened it, so whoever owns the Canvas owns
 * the session. If the game opened it, going back to the hall would close it,
 * and going back to a hall that is a 2D page means taking the headset off.
 *
 * No DOM can come in here: inside a Canvas only three objects fit. The 2D menu
 * and scoreboard stay in the game's website; inside the headset their
 * equivalents are `<XRMenu>` and `<XRScoreboard>`, which are geometry, and they
 * hang from the table so that they are where one is looking.
 *
 * **The player does not move from the place their host put them.** What moves
 * is the table, and only once per session (see `WorldAnchor`).
 */

/**
 * The column of the menu and the settings, **far and to the left** (common rule of the hall,
 * `.claude/rules/xr.md`, «La columna va lejos y a la izquierda, fuera de donde se juega»): 1.5 m
 * from the eyes, 55° to the left, with its centre at eye height and facing whoever plays.
 *
 * **It was at one metre and 42° to the right, and the button that opens it 57° to the left.**
 * Seen with the headset: it was pressed on one side and opened on the other, and the two ended
 * up so close that they got in the way while playing. Now they go together and on the same side,
 * out of the mallet's reach: the edge of the table is 55 cm from the centre and the column
 * starts at almost a metre.
 *
 * TO BE CALIBRATED WITH THE HEADSET: `distance` and `azimuth`.
 */
export const COLUMN = { distance: 1.5, azimuth: 55 } as const

/**
 * How much the column grows so that its lettering can still be read at the new distance.
 *
 * The whole group is scaled —lettering, buttons and hit areas— and no measurement is retouched
 * one by one: the panel takes up almost the same in the eye as it did at 1.05 m. The tightest is
 * «The room» with the eyes at 1.2 m: with 1.3 it stays at 1.39° (the minimum is 1.4°), with 1.35
 * it scrapes through; 1.4 leaves some margin. `menu.legible.test.ts` and `exit.legible.test.ts`
 * measure it with the texts at this scale. TO BE CALIBRATED WITH THE HEADSET.
 */
export const COLUMN_SCALE = 1.4

const COLUMN_AZIMUTH = (COLUMN.azimuth * Math.PI) / 180

/** Where each piece of the immersive interface goes, in table coordinates. */
export const XR_UI = {
  /** Scoreboard: at the back, above the machine's goal. */
  scoreboard: BACK_SCOREBOARD.center,
  /**
   * Menu, end of match and exit notice: the column (`COLUMN`). The measurements are those of
   * the space of whoever plays converted to those of the table, which is what it hangs from.
   */
  panel: [
    -COLUMN.distance * Math.sin(COLUMN_AZIMUTH),
    REFERENCE_EYE_HEIGHT - TABLE_HEIGHT,
    -COLUMN.distance * Math.cos(COLUMN_AZIMUTH) - TABLE_CENTER_Z,
  ] as [number, number, number],
  /**
   * The menu, **almost head-on** and at the column's distance (`menuPlacement`, the common
   * template of the hall: it appears 30° or less from the gaze). On starting it moves aside: the
   * end screen and the exit notice come up in the column.
   */
  menu: menuPlacement(),
  /** Countdown: floating above the serve point. */
  countdown: [0, 0.34, 0] as [number, number, number],
  /**
   * The demonstration of how the mallet is grabbed: at eye level and to one side, to the right
   * of the goal sign, so as to cover neither the sign nor the scoreboard (`tutorialPlacement`).
   *
   * At 1.2 m: at a metre and a half its counter stayed at 1°. It covers neither the table, nor
   * the scoreboard, nor the sign (`tutorial.legible.test.ts`).
   */
  tutorial: tutorialPlacement(),
}

/**
 * The button that opens the column: **in the column's place**, turned and scaled like it.
 *
 * It is pressed and the column opens right where the button was —while it is open the button
 * hides, or else they would overlap—. Before it went 57° to the left, at 0.9 m, almost at chest
 * height and without turning towards the player, with the menu opening on the right.
 */
export const XR_QUIT = XR_UI.panel

/**
 * And how much the button grows: more than the column, because it is an eleven-centimetre piece
 * that has to be seen out of the corner of the eye at a metre and a half —at the column's scale
 * it took up 6° and got lost against the machines of the room—. Like this it takes up about 11°.
 * TO BE CALIBRATED WITH THE HEADSET.
 */
export const BUTTON_SCALE = 2.6

/**
 * Where a piece of the interface ends up in the space of whoever plays —the feet at the origin
 * and `−Z` ahead—: the table is planted `TABLE_CENTER_Z` from them and `TABLE_HEIGHT` off the
 * floor.
 */
export function fromPlayerSpace(piece: readonly [number, number, number]): [number, number, number] {
  return [piece[0], piece[1] + TABLE_HEIGHT, piece[2] + TABLE_CENTER_Z]
}

/** How many metres from the eyes of whoever plays the centre of a piece ends up, counting height. */
export function distanceFromPlayer(piece: readonly [number, number, number]): number {
  return distanceFromEyes(fromPlayerSpace(piece), eyesAt(REFERENCE_EYE_HEIGHT))
}

/**
 * The rotation of the panels with lettering: facing the eyes of whoever plays and tilted towards
 * them.
 *
 * Tilted by eye, the farthest row reads foreshortened. The interface goes up and down with the
 * eyes (`XRUiHeight`), so the rotation is computed once for the reference ones.
 */
export const XR_UI_ROTATION = {
  panel: panelRotation(fromPlayerSpace(XR_UI.panel), eyesAt(REFERENCE_EYE_HEIGHT)),
  menu: panelRotation(fromPlayerSpace(XR_UI.menu), eyesAt(REFERENCE_EYE_HEIGHT)),
  quit: panelRotation(fromPlayerSpace(XR_QUIT), eyesAt(REFERENCE_EYE_HEIGHT)),
  tutorial: panelRotation(fromPlayerSpace(XR_UI.tutorial), eyesAt(REFERENCE_EYE_HEIGHT)),
}

/**
 * Where a panel is read from: with the eyes at each height of `EYE_HEIGHTS` and with the hall's
 * play height set to standing or to eye height.
 *
 * The panel is measured where it really ends up: it rises by what the world goes down or up
 * (`XRWorldHeight`) plus what the interface rises above it (`XRUiHeight`). It is what the
 * `*.legible.test.ts` use.
 */
export function panelViews(
  piece: readonly [number, number, number],
  rotation: PanelPose['rotation'],
): { where: string; pose: PanelPose; eyes: Point }[] {
  const [x, y, z] = fromPlayerSpace(piece)
  return EYE_HEIGHTS.flatMap((eyeHeight) =>
    [false, true].map((atEyeHeight) => ({
      where: `eyes at ${eyeHeight} m${atEyeHeight ? ', world at their height' : ''}`,
      pose: {
        position: [x, y + worldRise(eyeHeight, atEyeHeight) + uiRiseOverWorld(eyeHeight, atEyeHeight), z] as const,
        rotation,
      },
      eyes: eyesAt(eyeHeight),
    })),
  )
}

/**
 * Some texts noted down on the column's canvas, taken to the scale at which it is drawn
 * (`COLUMN_SCALE`): it is what the `*.legible.test.ts` measure of what goes in it.
 */
export function atColumnScale<T extends { x: number; y: number; width: number; height: number }>(
  drawn: readonly T[],
): T[] {
  const k = COLUMN_SCALE
  return drawn.map((e) => ({ ...e, x: e.x * k, y: e.y * k, width: e.width * k, height: e.height * k }))
}

export interface GameWorldProps {
  /**
   * Whoever mounts the scene also puts a DOM interface around it. Then the
   * panels inside the scene are only needed with the headset on: their buttons
   * would catch the mouse clicks in front of the table, because pointers look
   * at whether there are handlers and not at whether anything is seen.
   *
   * Mounted in the xrcade hall there is none of that —the hub puts no DOM—, so
   * the panels are always there. Without this, the game was seen in the hub and
   * there was no way to start the match.
   */
  hasDomUi?: boolean
  /**
   * Where and with what heading to plant the world, if whoever mounts the scene knows it:
   * the xrcade hall lends the anchor with which it has its arc of cabinets planted.
   * Without it, the world is planted in front of wherever one is looking on entering.
   */
  anchor?: HostAnchor
}

export function GameWorld({ hasDomUi = false, anchor }: GameWorldProps) {
  // How many times the world is mounted, when someone is counting it (`lib/mountCount.ts`).
  // Mounting it twice on entering the session **is** the flicker reported from the headset.
  useEffect(() => {
    countMount('world')
  }, [])

  const {
    gameState,
    runId,
    scenery,
    isRecord,
    totalPlayerGoals,
    totalOpponentGoals,
    duel,
    medal,
  } = useGame()
  const duelOver = duel?.over ?? false
  const mode = useXR((state) => state.mode)

  // The sound hangs from the scene and not from the table: the table is created
  // anew in every match and in every round of the challenge, and with the audio
  // inside, the round won took with it the goal that won it —the context closed
  // while it sounded— and created another context per round (see `lib/useGameAudio.ts`).
  const { play, slide, filter } = useGameAudio()
  useGameMusic()
  const haptics = useGameHaptics()
  // The hit feedback: the table fires it with the goal against (`Rink`) and this one draws it.
  const hitFeedback = useRef<HitFeedbackHandle>(null)
  const [comfort] = useComfort()
  // What is heard and what is felt go separately: everything that happens on the table sounds
  // —the slide, the rail, the machine's hit—, but in the hand only what the hand touches: the
  // mallet's hit on the puck (and the goal, softly). The slide vibrated every frame and in both
  // hands, and with the headset on the controllers buzzed the whole rally (see `lib/haptics.ts`).
  // The end of the match. Before it was silence: the last goal went in, it sounded like any
  // other and the end screen arrived without warning. With the headset on it is worse still,
  // because the scoreboard is where one is not always looking. The beaten mark goes **on top**
  // of the closing sound and not in its place: it can be beaten winning or losing, and both have
  // to be heard. In the hand, only the closing one: a second pulse behind it would cut the first.
  const finished = useRef(false)
  useEffect(() => {
    if (gameState !== 'finished') {
      finished.current = false
      return
    }
    if (finished.current) return
    finished.current = true
    // The end of the duel sounds like winning: one of the two in front wins it (`duel.ts`).
    const wins = endSoundsLikeWin(duelOver, { scored: totalPlayerGoals, conceded: totalOpponentGoals })
    play(wins ? 'win' : 'loss')
    haptics.feel({ type: 'end' })
    if (isRecord) play('record')
  }, [gameState, play, haptics, isRecord, totalPlayerGoals, totalOpponentGoals, duelOver])

  // The medal threshold that has just been crossed: the short sound of the sign's celebration.
  // It comes from the same medal the sign looks at, so it sounds when the sign changes colour,
  // and here and not in the sign because whoever plays without a headset hears it too, and they
  // do not have the sign hung up.
  const previousMedal = useRef(medal)
  useEffect(() => {
    const crossed = thresholdCrossed(previousMedal.current, medal)
    previousMedal.current = medal
    if (crossed != null) play(THRESHOLD_SOUND[crossed])
  }, [medal, play])
  // And in the mallet hand, when the sign celebrates it.
  const feelThreshold = useCallback((crossed: Medal) => haptics.feel({ type: 'threshold', medal: crossed }), [haptics])

  // The reflections of the table and of the puck, computed once (see the hook).
  const environment = useRoomEnvironment()
  // What is drawn around is said by the hall's scenery (`xrcade:scenery`) and
  // not by the type of session: the hall always enters in augmented reality if
  // the headset has it, so the type does not say what was chosen. The mode only
  // acts as a guard —outside `immersive-ar` there is no real room to show and
  // the room is drawn anyway— and changing it is seen on the next frame, without
  // leaving.
  const passthrough = !showsPlace(mode, scenery)
  const immersive = mode != null
  /** Whether it is time to draw the panels inside the scene. */
  const showPanels = !hasDomUi || immersive

  // THE WHOLE WORLD hangs from `XRWorldHeight`, which lowers it to whoever plays
  // if they have asked for it in the hall's settings. It wraps the whole scene,
  // lights included: moving only the target would leave it floating above its
  // scenery.
  return (
    <XRWorldHeight>
      {/* Starts and closes matches according to the state of the immersive session. */}
      <XRSessionController />

      {/* Room light: an overhead one that acts as a spotlight on the table and
          a fill that keeps the shadows from coming out black. */}
      <hemisphereLight args={['#cfe4ff', '#0a1220', 1.1]} />
      <directionalLight
        position={[1.6, 4, 1.2]}
        intensity={2}
        color="#ffffff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-far={14}
      />

      <WorldAnchor anchor={anchor}>
        {/* The place, and **the background of the place**. The colour goes here
            and not in the `<Canvas>` for two reasons: in passthrough there can be
            none —an opaque background covers the real room— and mounted in the
            hall the hub removes its own on entering the cabinet, so if the game
            does not bring the background, nobody brings it. Without it, looking
            over the walls shows the compositor's black. */}
        {/* The background is indeed mounted and unmounted: it is the colour the image is cleared
            with, not a material, and it compiles nothing. */}
        {!passthrough ? <Backdrop color={ROOM_BACKDROP} /> : null}
        {/* The room is **hidden** in your own room, not unmounted. Unmounting it releases its
            materials, and the shaders only it used are compiled again on coming back: a hitch
            at every change of scenery, with the headset on. Hidden it is not drawn and casts no
            shadow, and it is denied the pointers, which do not look at whether something is seen. */}
        {/* The room is the scenery that shakes with the hit feedback: not the table, since the
            mallet goes in the hand and would come away from it. The camera is never touched.
            Reduced motion is checked by the component itself: the hall does not send it
            (`lib/settings.ts`). */}
        <HitFeedback
          ref={hitFeedback}
          comfort={comfort}
          applyFilter={filter}
          vibrate={haptics.pulse}
        >
          <group visible={!passthrough} pointerEvents={passthrough ? 'none' : undefined}>
            <Room />
          </group>
        </HitFeedback>

        {/* What teaches how to play without a single letter: the footprints on the floor, the
            ghost mallet, the marked goal and the controller with its button lit. It goes
            **outside** the table's group because half of what it draws is on the floor, and it
            is always mounted —in the menu too— because mounting a mesh halfway through a match
            compiles its material and that is a hitch with the headset on. What switches on and
            off is its opacity; the script decides when (`lib/hintScript.ts`). */}
        <Hints />

        <group position={[0, TABLE_HEIGHT, TABLE_CENTER_Z]}>
          <Table environment={environment} />
          {/* The puck and the mallets only during the match: in the menu the
              table looks empty, which is what makes starting noticeable. `key`
              creates it anew in every match and in every round of the challenge. */}
          {gameState !== 'menu' ? (
            <Rink
              key={runId}
              play={play}
              slide={slide}
              feel={haptics.feel}
              onHand={haptics.noteHand}
              environment={environment}
              hitFeedback={hitFeedback}
            />
          ) : null}

          {/* The interface inside the scene is not mounted when the host puts
              its own in DOM and there is no headset. It is not only that it is
              not needed: pointers look at whether there are handlers and not at
              whether anything is seen, so its buttons would catch mouse clicks
              in front of the table. Mounted in the hall —which puts no DOM— it
              is always there, or the game is left with no way to start the
              match. */}
          {/* At the eye height of whoever plays: the measurements were taken with a
              person in front and that person stayed inside the code (see `XRUiHeight`). */}
          {showPanels ? (
            <XRUiHeight>
              <group position={XR_UI.scoreboard} rotation={[BACK_SCOREBOARD.tilt, 0, 0]}>
                <XRScoreboard />
              </group>
              {/* What has to be beaten, head-on: above the scoreboard, which is where one
                  already looks. */}
              <ScoreboardSign onCelebrate={feelThreshold} />
              {/* The menu appears almost head-on, at the column's scale; the rest, in the column. */}
              <group position={XR_UI.menu} rotation={XR_UI_ROTATION.menu} scale={COLUMN_SCALE}>
                <XRMenu />
              </group>
              <group position={XR_UI.panel} rotation={XR_UI_ROTATION.panel} scale={COLUMN_SCALE}>
                <XRGameOver />
                <XRQuitConfirm />
              </group>
              <group position={XR_UI.countdown}>
                <XRCountdown />
              </group>
              {/* The demonstration goes **where the menu was**: whoever sees it has just pressed
                  «empezar» and is looking there. It is passed the place instead of being left to
                  position itself —the value it was born with is that of darts, and added to this
                  group it left it three metres off the floor, turned, a metre and a half above
                  the menu it came from—. */}
              <XRTutorial position={XR_UI.tutorial} rotation={XR_UI_ROTATION.tutorial} />
              <group position={XR_QUIT} rotation={XR_UI_ROTATION.quit} scale={BUTTON_SCALE}>
                <XRQuitButton />
              </group>
            </XRUiHeight>
          ) : null}
        </group>
      </WorldAnchor>
      {/* Warms up the shaders of the scene, and it goes HERE and not in the Canvas of the
          game's website: the hall mounts this and not that, so hung from there nothing was
          prewarmed right where the game is really played. */}
      <PrewarmShaders />
    </XRWorldHeight>
  )
}
