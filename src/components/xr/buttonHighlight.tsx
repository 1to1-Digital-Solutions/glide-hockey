'use client'

import { useCallback, useState } from 'react'
import { NO_RAYCAST } from '../raycast'

/**
 * How a button of a headset panel answers: pointed at it lights up, pressed it sinks.
 *
 * **Why it is in a file of its own and is the same in all thirteen.** The highlight used to be
 * written by hand in every panel —the menu, the tutorial— and in all of them with the same bug:
 * a transparent plane in front of the plate **with the `depthWrite` that materials bring by
 * default**. A transparent material does record its depth unless it is told not to, and
 * that, in a panel, is not a detail: it is what erased the button.
 *
 * ## Why it erased the button, which is not what it looks like
 *
 * three paints what is transparent from far to near, and to sort it it measures the depth **of
 * each object's origin**, not of each pixel. While you look at the centre of the panel, the
 * highlight —5 mm in front— comes out nearer than the plate and is painted afterwards: it blends
 * on top and all is well. But **pointing at a button is looking at it**: the head tilts towards
 * it, the panel stops being face-on and a button half a metre from the centre comes to be
 * *farther along the view axis* than the centre of the plate. Then the order flips: the highlight
 * is painted **first**, writes its depth 5 mm in front, and when the plate is painted —which is
 * the canvas where the button's face, its colour and its lettering are— its pixels fail the depth
 * test inside that rectangle and are discarded. What remains is a button-shaped hole through
 * which the scene behind is seen. Reported with the headset on: «when you put the cursor over
 * a button it is as if the button disappears, showing what is underneath».
 *
 * That it depends on where you look is what made it seem capricious —«and sometimes also
 * when pressing it»—: looking at the centre of the panel it never happens, and looking at the
 * button it always happens.
 *
 * That is why **both things go together** here, and neither works alone:
 *
 * - `depthWrite: false`, so that the highlight cannot erase anything painted afterwards.
 * - `renderOrder`, so that it is **always** painted after the plate. Without this, removing the
 *   `depthWrite` fixes the hole and leaves the other half of the bug: looking at the button, the
 *   plate is painted on top of the highlight and pointing stops being noticeable.
 */

/** Which of the three states a button is in. */
export type ButtonState = 'idle' | 'pointed' | 'pressed'

/**
 * The order in which the layers of a panel are painted.
 *
 * A panel is a pile of planes millimetres from one another, and at that distance **sorting
 * by depth decides nothing reliable**: tilting the head is enough for it to be
 * inverted (see above). So the order is declared, not deduced, and the layers in between
 * do not write depth.
 */
export const PANEL_ORDER = {
  /** The panel's background: the plate everything else goes on. */
  back: -3,
  /** A button's highlight when it frames from behind, without covering the drawing. */
  behind: -2,
  /** Each button's plate. */
  face: -1,
  /** And the highlight that goes in front of what is painted, which is the last thing of the panel. */
  highlight: 10,
} as const

/** How far the highlight sticks out in front of the panel's plate. */
export const HIGHLIGHT_Z = 0.004

/**
 * How much the highlight grows around the pointed button, and how much it goes in on pressing it.
 *
 * Growing and shrinking is what reads as «it has sunk» when the button's face is
 * painted on the canvas and cannot be moved: what moves is the light it carries on top.
 */
const HALO = 0.014
const SINK = 0.01

/**
 * A button's highlight, in front of the plate.
 *
 * Pointed at it lights up with `glow` and overflows the button a little; pressed it darkens with
 * `ink` and goes inside it. Both colours are set by whoever mounts it: this file is the same in
 * the thirteen games and knows nothing of the palette of any of them.
 */
export function ButtonHighlight({
  width,
  height,
  state,
  glow,
  ink,
}: {
  width: number
  height: number
  state: ButtonState
  /** What it lights up with when pointed at. */
  glow: string
  /** And what it darkens with when pressed. */
  ink: string
}) {
  if (state === 'idle') return null

  const pointed = state === 'pointed'
  const margin = pointed ? HALO : -SINK

  return (
    <mesh
      // Pressed it comes closer to the plate: the highlight goes down with the button.
      position={[0, 0, pointed ? HIGHLIGHT_Z : HIGHLIGHT_Z / 2]}
      raycast={NO_RAYCAST}
      renderOrder={PANEL_ORDER.highlight}
    >
      <planeGeometry args={[width + margin, height + margin]} />
      <meshBasicMaterial
        color={pointed ? glow : ink}
        transparent
        opacity={pointed ? 0.28 : 0.45}
        depthWrite={false}
      />
    </mesh>
  )
}

/**
 * Which state each button of the panel is in and what has to be listened to on it to know.
 *
 * Pointing and pressing are kept together because they step on each other: the ray leaves the
 * button between the trigger being squeezed and released, and without releasing the pointed one
 * **the button would stay sunk for ever**. Leaving the button clears both.
 */
export function useButtonFeedback() {
  const [pointed, setPointed] = useState<string | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)

  const forget = useCallback((id: string) => {
    const onlyOther = (current: string | null) => (current === id ? null : current)
    setPointed(onlyOther)
    setPressed(onlyOther)
  }, [])

  const handlersFor = useCallback(
    (id: string) => ({
      onPointerOver: () => setPointed(id),
      onPointerOut: () => forget(id),
      onPointerDown: () => setPressed(id),
      onPointerUp: () => setPressed((current) => (current === id ? null : current)),
    }),
    [forget],
  )

  const stateOf = useCallback(
    (id: string): ButtonState =>
      pressed === id ? 'pressed' : pointed === id ? 'pointed' : 'idle',
    [pointed, pressed],
  )

  return { stateOf, handlersFor }
}
