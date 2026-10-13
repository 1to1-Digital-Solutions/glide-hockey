'use client'

import { useXR } from '@react-three/xr'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useGrabMode, useLang } from '../../lib/settingsClient'
import { PALETTE } from '../../lib/palette'
import { COMMON_PALETTE } from '../../lib/commonPalette'
import { DIM_COLOR } from './XRUi'
import { useGame } from '../../lib/gameStore'
import { translator, type TextKey } from '../../lib/textos'
import {
  TUTORIAL_BUTTONS,
  TUTORIAL_STEPS,
  markTutorialSeen,
  tutorialSeen,
  tutorialStep,
  type TutorialStepKey,
} from '../../lib/tutorial'
import { ButtonHighlight, useButtonFeedback } from './buttonHighlight'
import { CanvasPanel, drawParagraph, drawText, roundedRect, paragraphHeight } from './canvasPanel'
import { drawController } from './drawnController'
import { RealController } from './RealController'
import { NO_RAYCAST } from '../raycast'

/**
 * How to throw, inside the headset and only the first time.
 *
 * **It is learned by doing, not by watching.** Each step is passed when whoever is playing does
 * it: the mallet appears in the hand, flies off, sticks. The game **does not stop** meanwhile
 * —the mallet is really picked up—, and the tutorial waits with no clock until what has to
 * happen happens. Before, it was a slide show with a stick figure and the game stopped: you
 * could watch without doing anything and when the time ran out it was taken as learned.
 *
 * **And the controller is shown.** A step that asks for the grab button draws a controller with
 * that button highlighted (`drawnController.ts`): with the headset on, what is in the hand has
 * five buttons and none with its name written on it.
 *
 * **There is always a way out**: next and skip. A step that cannot be achieved —because the
 * mallet does not stick— would leave someone locked inside it.
 *
 * The script lives in `lib/tutorial.ts`, tested without a browser; here it is only painted and
 * listened to.
 */

/**
 * Measurements of the panel, in metres. As wide as the menu's, and quite a bit taller: it
 * carries a counter, a phrase, the drawn controller and two buttons, and the phrase takes
 * **three lines in Spanish where it takes two in English**.
 */
export const PANEL_WIDTH = 0.78
export const PANEL_HEIGHT = 0.62

/**
 * Where it is planted, **when the game does not say**.
 *
 * This value comes from darts —«a little to the right of the dartboard»— and was copied as is
 * to all twelve. The games that know where their panel goes pass it in and this one is not
 * used: appearing somewhere other than where the menu was forces the player to look for it,
 * and whoever has just come in is precisely the one who does not know where to look.
 */
const POSITION: [number, number, number] = [0.68, 1.5, -1.05]
const ROTATION: [number, number, number] = [0, -0.57, 0]

/**
 * At what size each thing on the panel is written, in metres of letter height.
 *
 * A single list for whoever paints and for whoever measures (`tutorial.legible.test.ts`). The
 * counter and the buttons were at 30 and 32 mm and «Saltar tutorial» shrank to 29 to fit: with
 * the panel at a metre and a half, they ended up at 1°.
 */
export const TUTORIAL_TEXT = { counter: 0.036, phrase: 0.042, button: 0.036 } as const

/**
 * The two buttons, at the bottom of the panel: wide enough for «Saltar tutorial» to fit whole
 * at its size, with two centimetres between them.
 */
export const BUTTON = { width: 0.37, height: 0.09, y: -PANEL_HEIGHT / 2 + 0.08 }

export const PANEL_BUTTONS = [
  { id: 'next' as const, x: 0.195, text: 'Next' as TextKey },
  { id: 'skip' as const, x: -0.195, text: 'Skip tutorial' as TextKey },
]

/** What is asked for in each step. */
export const PHRASES: Record<TutorialStepKey, TextKey> = {
  grab: 'Close your hand on the mallet to pick it up',
  hit: 'Push the puck with it',
  goal: 'Score a goal',
}

/**
 * And with **one tap** instead of holding (see `lib/grab.ts`). The tutorial is the only screen
 * that explains the gesture: teaching the holding one to someone who cannot hold anything
 * would be explaining the game to them backwards.
 */
export const PHRASES_WITH_ONE_TAP: Record<TutorialStepKey, TextKey> = {
  grab: 'Press the grip button on the mallet to pick it up',
  hit: 'Push the puck with it',
  goal: 'Score a goal',
}

/** What the phrase is like, to measure it the same way it is painted. */
const PHRASE = { size: TUTORIAL_TEXT.phrase, maxWidth: PANEL_WIDTH - 0.1 }

/**
 * Where each thing falls on the panel of a step.
 *
 * It is calculated and not written by hand because **the phrase does not take up the same
 * in both languages**: the same line is two rows in English and three in Spanish, and the
 * drawn controller has to move down with it. It comes out of here and not from inside the
 * drawing so that the test can check the same numbers that are painted, and not a copy of them.
 */
export function stepLayout(
  ctx: CanvasRenderingContext2D,
  step: TutorialStepKey,
  phrases: Record<TutorialStepKey, TextKey>,
  t: (key: TextKey) => string,
): { phraseTop: number; phraseBottom: number; controller: number } {
  const phraseTop = PANEL_HEIGHT / 2 - 0.13
  const phraseBottom = phraseTop - paragraphHeight(ctx, t(phrases[step]), PHRASE)
  const buttonsTop = BUTTON.y + BUTTON.height / 2
  return { phraseTop: phraseTop, phraseBottom: phraseBottom, controller: (phraseBottom + buttonsTop) / 2 }
}

/**
 * The tutorial panel: the step it is on, what it asks for, the controller button that
 * does it and the two buttons at the bottom. It comes out of the component so that a test
 * can measure it with a fake canvas —`legibility.ts`—: it is text nobody has seen yet
 * with the headset on, and the long phrase in Spanish is where it overflows.
 */
export function drawStep(
  ctx: CanvasRenderingContext2D,
  step: TutorialStepKey | null,
  phrases: Record<TutorialStepKey, TextKey>,
  t: (key: TextKey) => string,
): void {
  roundedRect(ctx, 0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0.02)
  ctx.fillStyle = PALETTE.background
  ctx.fill()

  if (step == null) return

  // Which one it is on, which is what says how much is left.
  drawText(ctx, `${TUTORIAL_STEPS.indexOf(step) + 1}/${TUTORIAL_STEPS.length}`, 0, PANEL_HEIGHT / 2 - 0.05, {
    size: TUTORIAL_TEXT.counter,
    color: DIM_COLOR,
  })

  // In a paragraph and not on one line: shrunk until it fitted on one, the phrase ended up in
  // two-centimetre letters and with the headset on nothing could be understood.
  //
  // **Anchored at the top**, not centred: centred, the phrase that goes from two lines to three
  // grows upwards and slides under the counter. Spanish has them almost always.
  const layout = stepLayout(ctx, step, phrases, t)
  drawParagraph(ctx, t(phrases[step]), 0, layout.phraseTop, {
    ...PHRASE,
    color: PALETTE.foreground,
    weight: '600',
    anchor: 'top',
  })

  drawController(ctx, 0, layout.controller, TUTORIAL_BUTTONS[step], {
    body: DIM_COLOR,
    highlight: PALETTE.foreground,
  })

  for (const button of PANEL_BUTTONS) {
    roundedRect(ctx, button.x, BUTTON.y, BUTTON.width, BUTTON.height, 0.016)
    ctx.fillStyle = DIM_COLOR
    ctx.fill()
    drawText(ctx, t(button.text), button.x, BUTTON.y, {
      size: TUTORIAL_TEXT.button,
      color: PALETTE.background,
      weight: '700',
      maxWidth: BUTTON.width - 0.03,
    })
  }
}

export function XRTutorial({
  position = POSITION,
  rotation = ROTATION,
}: {
  /** Where the game puts it. Without this it places itself, where it was born (see `POSITION`). */
  position?: [number, number, number]
  /** Like three's `rotation`: with the order, if it is not `'XYZ'`. */
  rotation?: [number, number, number] | [number, number, number, 'YXZ']
} = {}) {
  const { gameState, gameMode, milestones: reachedMilestones, setTutorialRunning, setLearning: setTeaching, finishLesson: endLesson, inChallenge: isChallenge } = useGame()
  const t = translator(useLang())
  const phrases = useGrabMode() === 'toggle' ? PHRASES_WITH_ONE_TAP : PHRASES
  const inSession = useXR((state) => state.mode != null)

  // It is decided only once on mount: reading it on every render would switch it off halfway,
  // as soon as it is marked as seen.
  const [pending] = useState(() => !tutorialSeen())
  /** How many steps have been skipped with the button. The only thing this panel remembers. */
  const [skipped, setSkipped] = useState(0)
  // Pointed at and pressed, which is what the button has to answer (`buttonHighlight.tsx`).
  const { stateOf, handlersFor } = useButtonFeedback()

  // **The step is calculated, not stored.** It comes from what whoever is playing has already
  // done (`milestones`) and from whatever has been skipped by button: a tutorial that kept its
  // own count would end up disagreeing with the match, and here the match is what rules.
  const step = tutorialStep(reachedMilestones, skipped)
  // **In the hall's challenge there is no tutorial**: it is the same match for everyone, and
  // the demonstration delays the serve only for whoever has not done it. **Nor in the duel**:
  // the two matches have to be equal, and the tutorial would only come up for whoever has not
  // done it.
  const active = inSession && pending && gameState === 'playing' && step !== null && !isChallenge && gameMode !== 'duel'

  // While it is being taught, in the challenge what the machine scores does not count (`learning`).
  useEffect(() => {
    setTeaching(active)
  }, [active, setTeaching])
  useEffect(() => () => setTeaching(false), [setTeaching])

  // And when it closes with the match under way —through its steps, through «Siguiente» or
  // through «Saltar»—, the challenge starts from zero and the sign announces that now it counts
  // (`finishLesson`). The match ending or leaving the headset is not closing it.
  const wasTeaching = useRef(false)
  useEffect(() => {
    if (active) {
      wasTeaching.current = true
      return
    }
    if (wasTeaching.current && step === null && gameState === 'playing') endLesson()
    wasTeaching.current = false
  }, [active, step, gameState, endLesson])

  const next = useCallback(() => setSkipped((n) => n + 1), [])
  const skip = useCallback(() => setSkipped(TUTORIAL_STEPS.length), [])

  // Marking that it has been seen **is** an effect: it writes outside React and touches no state.
  useEffect(() => {
    if (step === null && pending) markTutorialSeen()
  }, [step, pending])

  // **The game does not wait.** Before, it stopped to explain; now the explanation is playing.
  useEffect(() => {
    setTutorialRunning(false)
    return () => setTutorialRunning(false)
  }, [setTutorialRunning])

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => drawStep(ctx, step, phrases, t),
    [step, phrases, t],
  )

  if (!active) return null

  return (
    <>
      {/* Outside the panel's group on purpose: this does not live on the panel, it lives in the
          hand. It places itself, undoing whatever its parents put on it. On both hands because
          here either of them will do: lighting only one would be saying the other is no use. */}
      <RealController hand="left" button={TUTORIAL_BUTTONS[step]} />
      <RealController hand="right" button={TUTORIAL_BUTTONS[step]} />
      <group position={position} rotation={rotation}>
        <CanvasPanel width={PANEL_WIDTH} height={PANEL_HEIGHT} draw={draw} fallbackColor={PALETTE.background} />
        {PANEL_BUTTONS.map((button) => (
          <group key={button.id} position={[button.x, BUTTON.y, 0.002]}>
            <mesh
              onClick={button.id === 'next' ? next : skip}
              {...handlersFor(button.id)}
            >
              <planeGeometry args={[BUTTON.width, BUTTON.height]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* **Lighting up when pointed at is what says the button responds.** The rest of
                the game's panels already do it and these did not, so with the headset on the
                tutorial looked like a sign: «the buttons are not marked when pointed at». */}
            <ButtonHighlight
              width={BUTTON.width}
              height={BUTTON.height}
              state={stateOf(button.id)}
              glow={COMMON_PALETTE.accent}
              ink={PALETTE.background}
            />
          </group>
        ))}
        {/* The panel cannot be pressed as a whole: only its buttons. */}
        <mesh position={[0, 0, -0.001]} raycast={NO_RAYCAST}>
          <planeGeometry args={[PANEL_WIDTH, PANEL_HEIGHT]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </>
  )
}
