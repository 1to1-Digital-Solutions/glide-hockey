import { describe, expect, it } from 'vitest'
import { GLIDE_HOCKEY_CSS_VARIABLES, DIFFICULTY_COLORS, PALETTE } from './palette'
import { DIFFICULTY_ORDER } from './gameConfig'

/**
 * The palette is the only place where a colour of the game is written, because
 * three layers that do not talk to each other ask for them: the CSS of the
 * screens, the three scene and the headset interface, which has no CSS to draw on.
 *
 * What is checked here is that they are still colours all three can read,
 * that the CSS variables come from the same palette and not from literals
 * written again, and that each difficulty has its own.
 */

const HEX = /^#[0-9a-f]{6}$/i

describe('the colours of the game', () => {
  it('all are six-digit hexadecimals', () => {
    // It is the only format that CSS and three both understand: an `rgb()` or
    // a CSS name would end up black inside the scene.
    for (const [name, value] of Object.entries(PALETTE)) {
      if (typeof value === 'string') expect(value, name).toMatch(HEX)
    }
  })

  it('the background and the text are not the same colour', () => {
    expect(PALETTE.background).not.toBe(PALETTE.foreground)
  })
})

describe('the colour of each difficulty', () => {
  it('all are there, and none repeats a colour', () => {
    // It is what tells the chosen level apart at a glance: two equal ones would leave
    // the choice without a signal.
    const colors = DIFFICULTY_ORDER.map((id) => DIFFICULTY_COLORS[id])

    expect(colors).toHaveLength(DIFFICULTY_ORDER.length)
    for (const color of colors) expect(color).toMatch(HEX)
    expect(new Set(colors).size).toBe(colors.length)
  })
})

describe('the CSS variables of the game', () => {
  it('come from the palette, not from colours written again', () => {
    // Written by hand in each layer they drift without anybody deciding it, which is
    // exactly what this module exists to avoid.
    const values = Object.values(GLIDE_HOCKEY_CSS_VARIABLES) as string[]
    const palette = new Set<string>(Object.values(PALETTE))

    expect(values.length).toBeGreaterThan(0)
    for (const value of values) expect(palette.has(value)).toBe(true)
  })

  it('all are named like CSS variables', () => {
    for (const name of Object.keys(GLIDE_HOCKEY_CSS_VARIABLES)) {
      expect(name).toMatch(/^--[a-z-]+$/)
    }
  })
})
