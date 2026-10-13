'use client'

import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Group } from 'three'
import { celebrationPulse, thresholdCrossed, CELEBRATION_SECONDS, type Medal, type GoalSignView } from '../../lib/goal'
import { COMMON_PALETTE } from '../../lib/commonPalette'
import { CanvasPanel, drawText, roundedRect } from './canvasPanel'
import { MIN_ANGLE, minTextHeight } from './legibility'

/**
 * The goal sign: what has to be beaten, head-on and without covering the game.
 *
 * It is the same file in every game of the hall (what it says comes from `lib/goal.ts`, which
 * explains how it is mounted). Each game gives it the place, the orientation and the distance at
 * which it is read: standing over a target two metres away or twenty, or lying on the ground.
 *
 * **It is drawn once and enlarged with the distance.** What decides whether a letter can be read
 * is what it takes up in the eye, so the sign always measures the same degrees: it is painted to
 * be read at `DRAW_DISTANCE` and the group is scaled to the real distance. That way the texture
 * is the same, and small, at two metres as at twenty, and changing the distance does not redo it.
 *
 * It costs one draw call: the background, the two lines and the bar go on the same canvas.
 */

/** At what distance the sign is read just as it is drawn, in metres. */
export const DRAW_DISTANCE = 2

/** What those degrees of visual angle measure at the draw distance, in metres. */
function degrees(angle: number): number {
  return (minTextHeight(DRAW_DISTANCE) * angle) / MIN_ANGLE
}

/**
 * The font, in degrees of visual angle: what is read at a glance while playing, which is
 * almost twice the minimum of `legibility.ts`. A long phrase shrinks until it fits, and the
 * panel's test warns if any drops below the minimum.
 */
export const SIGN_FONT = { title: degrees(1.4), detail: degrees(1.2) }

/**
 * With three lines (the end with its `footer`) the font drops a little to fit on the same sign: it
 * is read standing still, with nothing to do but read, and it stays above the minimum.
 */
export const SIGN_FONT_WITH_FOOTER = { title: degrees(1.2), detail: degrees(1.0), gap: degrees(0.25) }

/** The sign at the draw distance: 24° wide by 4.5° high. */
export const SIGN_PANEL = { width: degrees(24), height: degrees(4.5) }

const MARGIN = degrees(0.5)
const GAP = degrees(0.35)
const BAR_HEIGHT = degrees(0.35)
const USABLE_WIDTH = SIGN_PANEL.width - 2 * MARGIN

/** What the sign measures for each metre of reading distance: to decide where it fits. */
export function signAspect(): { width: number; height: number } {
  return { width: SIGN_PANEL.width / DRAW_DISTANCE, height: SIGN_PANEL.height / DRAW_DISTANCE }
}

/** How much the sign has to be enlarged for it to read the same at that distance. */
export function signScale(distance: number): number {
  return distance / DRAW_DISTANCE
}

/**
 * Paints the whole sign. Apart from the component so that it can be **measured** with the
 * recording canvas (`legibility.ts`): what decides whether it can be read is what ends up written.
 *
 * @param celebration The medal whose threshold has just been crossed, while the celebration lasts.
 */
export function drawSign(
  ctx: CanvasRenderingContext2D,
  view: GoalSignView,
  celebration: Medal | null = null,
): void {
  const { width, height } = SIGN_PANEL
  const accent = celebration ?? view.medal
  const footer = view.footer ?? null
  const font = footer == null ? { ...SIGN_FONT, gap: GAP } : SIGN_FONT_WITH_FOOTER

  roundedRect(ctx, 0, 0, width - degrees(0.1), height - degrees(0.1), degrees(0.5))
  // Translucent: whatever goes by behind can still be made out. What does not count, even more so.
  ctx.fillStyle = `${COMMON_PALETTE.background}${view.subdued ? '99' : 'e0'}`
  ctx.fill()
  ctx.lineWidth = degrees(celebration == null ? 0.06 : 0.16)
  ctx.strokeStyle = celebration == null ? COMMON_PALETTE.border : COMMON_PALETTE[celebration]
  ctx.stroke()

  // What there is gets laid out centred: a single line sits in the middle, not hanging from the top.
  const rows = [
    font.title,
    ...(view.detail == null ? [] : [font.detail]),
    ...(footer == null ? [] : [font.detail]),
    ...(view.bar == null ? [] : [BAR_HEIGHT]),
  ]
  const totalHeight = rows.reduce((sum, row) => sum + row, 0) + font.gap * (rows.length - 1)
  let y = totalHeight / 2

  // While it celebrates, the title says the medal: the colour alone is not understood.
  drawText(ctx, celebration != null && view.cheer != null ? view.cheer : view.title, 0, y - font.title / 2, {
    size: font.title,
    color: celebration != null ? COMMON_PALETTE[celebration] : view.subdued ? COMMON_PALETTE.mutedText : COMMON_PALETTE.text,
    weight: '700',
    maxWidth: USABLE_WIDTH,
  })
  y -= font.title + font.gap

  for (const line of [view.detail, footer]) {
    if (line == null) continue
    drawText(ctx, line, 0, y - font.detail / 2, {
      size: font.detail,
      color: COMMON_PALETTE.mutedText,
      maxWidth: USABLE_WIDTH,
    })
    y -= font.detail + font.gap
  }

  if (view.bar != null) {
    const center = y - BAR_HEIGHT / 2
    roundedRect(ctx, 0, center, USABLE_WIDTH, BAR_HEIGHT, BAR_HEIGHT / 2)
    ctx.fillStyle = COMMON_PALETTE.border
    ctx.fill()
    const filled = USABLE_WIDTH * view.bar
    if (filled > 0) {
      // From the left, with the corner rounded while it fits.
      roundedRect(ctx, -USABLE_WIDTH / 2 + filled / 2, center, filled, BAR_HEIGHT, Math.min(BAR_HEIGHT, filled) / 2)
      ctx.fillStyle = accent == null ? COMMON_PALETTE.accent : COMMON_PALETTE[accent]
      ctx.fill()
    }
  }
}

/** Whether whoever plays has asked for things not to move on their own. */
function wantsNoSwaying(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export interface GoalSignProps {
  /** What it says, already translated: it comes from `goalSign()`. With `useMemo`: each new view repaints. */
  view: GoalSignView
  /** Where its centre goes, in the coordinates of the group it hangs from. */
  position: readonly [number, number, number]
  /**
   * How it is oriented, like three's `rotation`. With nothing, standing and facing +Z; tilted
   * towards the eyes of whoever reads it, it is read head-on, and with `[-Math.PI / 2, 0, 0]` it
   * lies on the ground.
   */
  rotation?: readonly [number, number, number] | readonly [number, number, number, 'YXZ']
  /** How many metres from the eyes it sits: its size comes from that. Lying down, the foreshortened one. */
  distance: number
  /** The medal that already belongs to whoever plays (`medalToCelebrate`). When it goes up, the sign celebrates it. */
  celebrate?: Medal | null
  /** Called once per threshold crossed: here the game puts its short sound and its pulse on the controller. */
  onCelebrate?: (medal: Medal) => void
}

export function GoalSign({
  view,
  position,
  rotation = [0, 0, 0],
  distance,
  celebrate = null,
  onCelebrate,
}: GoalSignProps) {
  const group = useRef<Group>(null)
  const scale = signScale(distance)

  // The celebration comes from comparing the medal of now with that of the previous render. Mounted
  // with a medal already won there is nothing to celebrate: the threshold has not been seen crossed.
  const [previous, setPrevious] = useState(celebrate)
  const [celebration, setCelebration] = useState<{ medal: Medal } | null>(null)
  if (previous !== celebrate) {
    setPrevious(celebrate)
    const crossed = thresholdCrossed(previous, celebrate)
    setCelebration(crossed == null ? null : { medal: crossed })
  }

  // The notice is read from the last render: whoever passes a new function each time repeats nothing.
  const notify = useRef(onCelebrate)
  useEffect(() => {
    notify.current = onCelebrate
  }, [onCelebrate])

  const notified = useRef<object | null>(null)
  const startedAt = useRef<number | null>(null)
  useEffect(() => {
    if (celebration == null) return
    // Once per threshold, even if the effect repeats.
    if (notified.current !== celebration) {
      notified.current = celebration
      startedAt.current = null
      notify.current?.(celebration.medal)
    }
    const timer = setTimeout(() => setCelebration(null), CELEBRATION_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [celebration])

  // The pulse of the celebration, by reference: it is a group that grows and comes back, not a state.
  useFrame(({ clock }) => {
    const node = group.current
    if (node == null) return
    if (celebration == null || wantsNoSwaying()) {
      node.scale.setScalar(scale)
      return
    }
    startedAt.current ??= clock.elapsedTime
    node.scale.setScalar(scale * celebrationPulse(clock.elapsedTime - startedAt.current))
  })

  const medal = celebration?.medal ?? null
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => drawSign(ctx, view, medal),
    [view, medal],
  )

  return (
    <group ref={group} name="cartel-de-objetivo" position={[...position] as [number, number, number]} rotation={rotation as [number, number, number]} scale={scale}>
      <CanvasPanel
        width={SIGN_PANEL.width}
        height={SIGN_PANEL.height}
        draw={draw}
        fallbackColor={COMMON_PALETTE.background}
      />
    </group>
  )
}
