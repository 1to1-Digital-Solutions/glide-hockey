/**
 * The game's palette: the only place where one of its colours is written.
 *
 * The same colours are asked for by three layers that do not talk to each other
 * —the CSS of the desktop screens, the three scene and the headset interface,
 * which has no CSS to draw on—, and written by hand in each one they drift
 * without anybody deciding it. Here are the ones that **identify the game**,
 * which are exactly the ones more than one layer needs; the neutral ones of a
 * single layer stay, named, next to the component that draws them.
 */

import type { CSSProperties } from 'react'
import type { Difficulty } from './gameConfig'

export const PALETTE = {
  /** Background of the game and of the headset panels: dark-room blue. */
  background: '#0b1220',
  /** Text and numbers. */
  foreground: '#ffffff',
  /** The game's cyan: what is active, lit or chosen. */
  primary: '#38bdf8',
  /** The two ends of the main button's gradient. */
  primaryBright: '#7dd3fc',
  primaryDeep: '#0284c7',
  /** Ink of the main button: on that light cyan, white cannot be read. */
  primaryInk: '#042335',
  /** Orange of the puck, which is also the accent of the player's data. */
  puck: '#f97316',
  /** Red of the rival: its mallet, its score and the goals conceded. */
  rival: '#f43f5e',
  /** Cold white of the table surface. */
  table: '#e6edf5',
  /** Dark blue of the frame and the rails. */
  rail: '#152238',
} as const

/**
 * Colour of each difficulty: it progresses from green (easy) to red (impossible).
 * A visual signal of risk, always accompanied by text so as not to depend on
 * colour alone.
 */
export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: '#15803d',
  medium: '#65a30d',
  hard: '#d97706',
  expert: '#ea580c',
  impossible: '#dc2626',
}

/**
 * The palette as CSS variables, which is what the desktop screens consume
 * (`src/game/styles.css`).
 *
 * The game sets them on its own container, inline (see `GameScene`), and the
 * CSS does not write them: the game is published as code, with no build step
 * of its own, so the only way for the CSS and the scene to read the same
 * literals is for whoever draws the container to hand them over.
 *
 * They hang from the container and never from `:root`: mounted inside another
 * application, a global `--color-primary` would change the look of the host.
 */
export const GLIDE_HOCKEY_CSS_VARIABLES = {
  '--color-background': PALETTE.background,
  '--color-foreground': PALETTE.foreground,
  '--color-primary': PALETTE.primary,
  '--color-primary-bright': PALETTE.primaryBright,
  '--color-primary-deep': PALETTE.primaryDeep,
  '--color-primary-ink': PALETTE.primaryInk,
  '--color-accent': PALETTE.puck,
  '--color-rival': PALETTE.rival,
} as CSSProperties
