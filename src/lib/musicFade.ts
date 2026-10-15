/**
 * The music's fade: how it comes in and how it leaves.
 *
 * It came in and went out **abruptly**. With the headset's earphones pressed to the ear, a
 * hard cut sounds like a click and gives the seam away: entering a cabinet, leaving it or
 * turning the music off in the settings were three hard cuts. A long half second of ramp
 * turns it into something that goes unnoticed, which is what a background has to do.
 *
 * Only the sum is here, which is what can be checked without hearing anything. Who moves it
 * and when is the business of `components/game/useGameMusic.ts`.
 */

/** How long the fade lasts, in milliseconds. */
export const MUSIC_FADE_MS = 700

/**
 * The volume partway through a fade from `from` to `to`, with `progress` from 0 to 1.
 *
 * The curve is not straight: it starts and ends smoothly (a `smoothstep`). A straight ramp on
 * the volume does show at the ends —the ear responds to decibels, not to amplitude—, and what
 * is wanted is precisely that it does not show.
 *
 * Out of range it is clamped instead of extrapolated: a clock that jumps cannot raise the
 * music above what was asked for.
 */
export function fadeVolume(from: number, to: number, progress: number): number {
  if (!Number.isFinite(progress) || progress <= 0) return from
  if (progress >= 1) return to
  const smooth = progress * progress * (3 - 2 * progress)
  return from + (to - from) * smooth
}
