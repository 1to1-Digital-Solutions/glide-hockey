'use client'

import { EXIT_ARROW } from './canvasPanel'
import { PANEL_ORDER } from './buttonHighlight'
import { NO_RAYCAST } from '../raycast'
import { Shape } from 'three'

import { type ReactNode, useRef, useState } from 'react'
import { pulsePressed } from '../../lib/haptics'
import { type ThreeEvent } from '@react-three/fiber'
import { PALETTE } from '../../lib/palette'
import { COMMON_PALETTE } from '../../lib/commonPalette'
import {
  DIGIT_ADVANCE,
  DIGIT_SEGMENTS,
  SEGMENT_LAYOUT,
  SEGMENT_THICKNESS,
  digitsOf,
} from '../../lib/xrDigits'
import { pressCounts, pressTime } from '../../lib/xrPress'

/**
 * Interface pieces for the immersive sessions.
 *
 * In VR/AR there is no DOM, so menu, scoreboard and buttons are geometry.
 * Everything here is local: no fonts, no textures, nothing that goes out to the
 * network (see `lib/xrDigits.ts` for the why of the hand-drawn numbers).
 */

/**
 * The highlight of the button being pointed at: the hall's accent, the same in every game, so
 * that the gesture of pointing is learned once.
 */
const HIGHLIGHT_COLOR = COMMON_PALETTE.accent

/**
 * And the one it lights up with when pressed, which is something other than pointing at it.
 *
 * The button **sinks and changes colour** instead of disappearing: it shrinks below its
 * resting size —which at one metre reads as going inwards— and the halo goes from the accent
 * to the white of the text and rises in intensity. Reported with the headset on: «when the
 * button is pressed, the button should still be there (react well, as if sinking, changing
 * colour and all that is fine, but not disappearing)».
 */
const PRESSED_COLOR = COMMON_PALETTE.text

/** How much a pressed button shrinks, from the 1.08 it grows to when pointed at. */
const PRESSED_SCALE = 0.98
/** What is switched off or secondary: the soft neutral of the hall's panels. */
export const DIM_COLOR = COMMON_PALETTE.mutedText

/** Where a button is and how much its sensitive area takes up. */
export interface XrHitBox {
  position: [number, number, number]
  size: [number, number, number]
}

/**
 * Background panel. In AR it is what lifts the interface off the room.
 *
 * In the game's colour and translucent: it is the same background, letting what
 * is behind show through.
 */
export function XRPanel({
  width,
  height,
  color = PALETTE.background,
  opacity = 0.86,
}: {
  width: number
  height: number
  color?: string
  opacity?: number
}) {
  return (
    /*
      **Without writing depth, and with its place in the order.** It is a transparent plane
      of a panel, and millimetres away from the buttons it carries on top the depth sorting
      decides nothing reliable: tilting the head towards a button at the edge is enough for
      the background to be painted AFTER it and, writing depth, to wipe it out
      (see `buttonHighlight.tsx`).
    */
    <mesh position={[0, 0, -0.02]} renderOrder={PANEL_ORDER.back}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        color={color}
        transparent
        depthWrite={false}
        opacity={opacity}
        toneMapped={false}
      />
    </mesh>
  )
}

/**
 * 3D button.
 *
 * Three decisions that come from how a button is pointed at in the headset:
 *
 * - **It resolves on press, not on release.** `onClick` requires pressing and
 *   releasing over the same object; pointing freehand at one metre, the ray
 *   leaves the button between one thing and the other and the press is lost.
 * - **A double brush is a single press**, since here a button receives more
 *   than one pointer. Who counts is decided by `lib/xrPress.ts`.
 * - **The focus is visible.** The button pointed at grows *and* lights up with
 *   a halo: shape and colour, never colour alone.
 *
 * The sensitive area is an invisible box larger than the drawing: pointing in
 * the air, a target of the exact size of the icon is missed constantly. Being
 * invisible does not exclude it from raycasting — the pointers look at whether
 * there are listeners, not at whether it is seen.
 */
export function XRPressable({
  box,
  onSelect,
  children,
  disabled = false,
}: {
  box: XrHitBox
  onSelect: () => void
  children: ReactNode
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const lastPress = useRef<number | null>(null)

  const handle = (event: ThreeEvent<PointerEvent>) => {
    setPressed(true)
    // The event is stopped with the button switched off too: otherwise it would
    // go through to whatever is behind the panel.
    event.stopPropagation()

    const now = pressTime()
    if (!pressCounts(now, lastPress.current, disabled)) return
    lastPress.current = now

    // The controller that pressed answers. Inside the headset it is not drawn, so this tap is
    // the only thing that says the button has heard; with the mouse there is no controller and
    // nothing happens.
    pulsePressed(event)

    onSelect()
  }

  const active = hovered && !disabled
  const [hitWidth, hitHeight] = box.size

  return (
    <group
      position={box.position}
      scale={pressed ? PRESSED_SCALE : active ? 1.08 : 1}
      onPointerDown={handle}
      onPointerOver={(event) => {
        event.stopPropagation()
        if (!disabled) setHovered(true)
      }}
      onPointerUp={() => setPressed(false)}
      onPointerOut={() => {
        setHovered(false)
        setPressed(false)
      }}
    >
      {children}

      {/* Focus halo: behind the drawing, to frame it without covering it.
          **Without writing depth and with its place in the order.** A transparent plane
          of a panel does record its depth unless it is told not to, and millimetres
          away from its neighbours the depth sorting flips over as soon as the head
          is tilted towards a button at the edge: then the halo was painted before the
          panel's background and erased it, and the button looked like a hole into the
          scene. The whole why, in `buttonHighlight.tsx`.
          Pressed, it lights up more and changes colour: it is the only thing that says,
          from inside, that the button has heard. */}
      <mesh position={[0, 0, -0.014]} visible={active || pressed} renderOrder={PANEL_ORDER.behind}>
        <planeGeometry args={[hitWidth * 0.98, hitHeight * 0.94]} />
        <meshBasicMaterial
          color={pressed ? PRESSED_COLOR : HIGHLIGHT_COLOR}
          transparent
          depthWrite={false}
          opacity={pressed ? 0.55 : 0.34}
          toneMapped={false}
        />
      </mesh>

      <mesh visible={false}>
        <boxGeometry args={box.size} />
      </mesh>
    </group>
  )
}

/**
 * A number, in segments.
 *
 * `size` is the height of a digit in metres; the width and the thickness come
 * from it, so the whole thing scales without going out of square (see
 * `lib/xrDigits.ts`).
 */
export function XRNumber({
  value,
  size = 0.09,
  color = PALETTE.foreground,
  position = [0, 0, 0],
}: {
  value: number
  size?: number
  color?: string
  position?: [number, number, number]
}) {
  const digits = digitsOf(value)
  const advance = size * DIGIT_ADVANCE
  const width = (digits.length - 1) * advance

  return (
    <group position={position}>
      {digits.map((digit, index) => (
        <group key={index} position={[index * advance - width / 2, 0, 0]}>
          {DIGIT_SEGMENTS[digit].map((segment) => {
            const { x, y, horizontal } = SEGMENT_LAYOUT[segment]
            const long = size * 0.42
            const thin = size * SEGMENT_THICKNESS
            return (
              <mesh key={segment} position={[x * size, y * size, 0]}>
                <planeGeometry
                  args={horizontal ? [long, thin] : [thin, long]}
                />
                <meshBasicMaterial color={color} toneMapped={false} />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

/** A button plate: the background the icon goes on. */
export function XRPlate({
  width,
  height,
  color,
  opacity = 1,
}: {
  width: number
  height: number
  color: string
  opacity?: number
}) {
  return (
    // In front of the panel's background and of the halo, and without writing depth: the
    // layers of a panel are declared, not deduced (see `buttonHighlight.tsx`).
    <mesh position={[0, 0, -0.006]} renderOrder={PANEL_ORDER.face}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        color={color}
        transparent
        depthWrite={false}
        opacity={opacity}
        toneMapped={false}
      />
    </mesh>
  )
}

/**
 * «Play» triangle, pointing to the right.
 *
 * Without rotating it: `CircleGeometry` puts its first vertex at angle 0, which
 * is the right. Rotated −90° that vertex ended up at the bottom and the button
 * read as «download», not as «play».
 */
export function XRPlayIcon({ size = 0.06 }: { size?: number }) {
  return (
    <mesh>
      {/* A circle with three sides is a triangle, and it saves a geometry of
          its own for the only shape that is not a rectangle. */}
      <circleGeometry args={[size, 3]} />
      <meshBasicMaterial color={PALETTE.primaryInk} toneMapped={false} />
    </mesh>
  )
}

/** The exit arrow, as a flat shape: the same one that is painted on the canvases. */
const EXIT_SHAPE = (() => {
  const { tip: arrowTip, shaft: arrowShaft, thickness: arrowThickness, elbow: arrowElbow, wings: arrowWings } = EXIT_ARROW
  const shape = new Shape()
  shape.moveTo(arrowTip, 0)
  shape.lineTo(arrowElbow, arrowWings)
  shape.lineTo(arrowElbow, arrowThickness / 2)
  shape.lineTo(arrowShaft, arrowThickness / 2)
  shape.lineTo(arrowShaft, -arrowThickness / 2)
  shape.lineTo(arrowElbow, -arrowThickness / 2)
  shape.lineTo(arrowElbow, -arrowWings)
  shape.closePath()
  return shape
})()

/**
 * The arrow for **leaving the game**: going back to the hall.
 *
 * **A single shape for all thirteen.** Each game said «exit» in its own way —the word
 * «Exit», a cross, a door, a door with an arrow— and the cross, besides, means «close
 * this» in several panels. Reported with the headset on: «it is not clear which one is the
 * button to leave the game: sometimes a square appears, other times it says "leave"… it
 * should be unified». The shape comes from `EXIT_ARROW`, the same one that the games which
 * draw the menu with text paint on their canvas.
 */
export function XRExitIcon({
  size = 0.05,
  color = PALETTE.foreground,
}: {
  size?: number
  color?: string
}) {
  return (
    <mesh scale={size} raycast={NO_RAYCAST}>
      <shapeGeometry args={[EXIT_SHAPE]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

/** Three bars: «back to the menu». */
export function XRMenuIcon({
  size = 0.05,
  color = PALETTE.foreground,
}: {
  size?: number
  color?: string
}) {
  return (
    <group>
      {[-1, 0, 1].map((row) => (
        <mesh key={row} position={[0, row * size * 0.32, 0]}>
          <planeGeometry args={[size, size * 0.16]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Speaker with or without waves: the headset's sound switch.
 *
 * The state is read **by shape before colour** —the waves are there or they are
 * not, and muted it is struck through with a bar— because the menu is looked at
 * from one metre and with the headset on, where a cyan and a grey look quite alike.
 */
/**
 * A musical note: the head and its stem. It says whether the background music
 * is playing or switched off, with the same diagonal strike-through as the
 * muted speaker, so that the two switches read the same without reading anything.
 */
export function XRMusicIcon({
  playing,
  size = 0.05,
}: {
  playing: boolean
  size?: number
}) {
  const color = playing ? PALETTE.foreground : DIM_COLOR

  return (
    <group>
      {/* The head of the note, oval because it lies somewhat tilted. */}
      <mesh position={[-size * 0.18, -size * 0.3, 0]} rotation={[0, 0, -0.35]} scale={[1.3, 1, 1]}>
        <circleGeometry args={[size * 0.22, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* The stem, going up on the right of the head. */}
      <mesh position={[-size * 0.02, size * 0.05, 0]}>
        <planeGeometry args={[size * 0.09, size * 0.75]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* And the flag, bending to the right at the very top. */}
      <mesh position={[size * 0.14, size * 0.34, 0]} rotation={[0, 0, -0.5]}>
        <planeGeometry args={[size * 0.34, size * 0.09]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      {playing ? null : (
        <mesh rotation={[0, 0, -Math.PI / 4]}>
          <planeGeometry args={[size * 1.05, size * 0.11]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

export function XRSoundIcon({
  muted,
  size = 0.05,
}: {
  muted: boolean
  size?: number
}) {
  const color = muted ? DIM_COLOR : PALETTE.foreground

  return (
    <group position={[-size * 0.12, 0, 0]}>
      {/* Body and bell of the speaker, facing right. A circle with three
          sides is a triangle, and rotated half a turn it leaves the vertex on the
          left: it is the bell opening towards where the sound comes out. */}
      <mesh position={[-size * 0.46, 0, 0]}>
        <planeGeometry args={[size * 0.3, size * 0.42]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[-size * 0.16, 0, 0]} rotation={[0, 0, Math.PI]}>
        <circleGeometry args={[size * 0.44, 3]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      {/* Playing, two waves coming out of the bell; muted, a diagonal
          strike-through where they would be. */}
      {muted ? (
        <mesh position={[size * 0.42, 0, 0]} rotation={[0, 0, -Math.PI / 4]}>
          <planeGeometry args={[size * 0.62, size * 0.11]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ) : (
        [0, 1].map((index) => (
          <mesh key={index} position={[size * (0.42 + index * 0.24), 0, 0]}>
            <planeGeometry args={[size * 0.09, size * (0.34 + index * 0.3)]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        ))
      )}
    </group>
  )
}

/**
 * What is painted around, said with a drawing: with the game's room, four
 * closed walls; with the player's own room, the frame of an open window.
 *
 * The **shape** changes and not only the colour, which inside the headset
 * changes with the light of the scene and cannot be the only signal (WCAG 1.4.1).
 */
export function XRSceneryIcon({
  room,
  lit = true,
  size = 0.05,
}: {
  room: boolean
  lit?: boolean
  size?: number
}) {
  const color = lit ? PALETTE.foreground : DIM_COLOR
  const thickness = size * 0.12

  return (
    <group>
      {/* The frame, always. */}
      {[
        [0, size * 0.34, size * 0.8, thickness],
        [0, -size * 0.34, size * 0.8, thickness],
        [-size * 0.34, 0, thickness, size * 0.8],
        [size * 0.34, 0, thickness, size * 0.8],
      ].map(([x, y, barWidth, barHeight], index) => (
        <mesh key={index} position={[x, y, 0]}>
          <planeGeometry args={[barWidth, barHeight]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}

      {/* Closed, the inside filled; open, only the crossbar of the window. */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={room ? [size * 0.68, thickness] : [size * 0.56, size * 0.56]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Plus or minus sign, for the quantity selectors. */
export function XRSignIcon({
  sign,
  size = 0.05,
  color = PALETTE.foreground,
}: {
  sign: 'plus' | 'minus'
  size?: number
  color?: string
}) {
  return (
    <group>
      <mesh>
        <planeGeometry args={[size, size * 0.22]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {sign === 'plus' ? (
        <mesh>
          <planeGeometry args={[size * 0.22, size]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  )
}
