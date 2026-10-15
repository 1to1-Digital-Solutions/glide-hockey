import { describe, expect, it } from 'vitest'
import {
  contrast,
  emissiveMaterial,
  matteMaterial,
  translucentMaterial,
  COMMON_PALETTE,
  type CommonColor,
} from './commonPalette'

/** What is written as text over a panel: it has to give the contrast of normal text. */
const WRITTEN_AS_TEXT: CommonColor[] = [
  'hit',
  'miss',
  'warning',
  'text',
  'mutedText',
  'accent',
  'bronze',
  'silver',
  'gold',
]

describe('the common palette', () => {
  it('they are all lowercase #rrggbb, which is what CSS, three and Godot read the same', () => {
    for (const color of Object.values(COMMON_PALETTE)) expect(color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('does not repeat colours: two meanings with the same colour cannot be told apart', () => {
    const colors = Object.values(COMMON_PALETTE)
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('everything that is written reads over the background of the hall (WCAG AA, 4.5:1)', () => {
    for (const name of WRITTEN_AS_TEXT) {
      expect(contrast(COMMON_PALETTE[name], COMMON_PALETTE.background), name).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('the main text goes past AAA (7:1): it is the one read at arm\'s length', () => {
    expect(contrast(COMMON_PALETTE.text, COMMON_PALETTE.background)).toBeGreaterThanOrEqual(7)
  })

  it('the border is told apart from the background without getting to compete with what is written', () => {
    const border = contrast(COMMON_PALETTE.border, COMMON_PALETTE.background)
    expect(border).toBeGreaterThan(1.2)
    expect(border).toBeLessThan(contrast(COMMON_PALETTE.mutedText, COMMON_PALETTE.background))
  })

  it('hit and miss are told apart by light, without seeing the colour', () => {
    // For whoever does not separate red from green all that is left is how bright each one is.
    expect(contrast(COMMON_PALETTE.hit, COMMON_PALETTE.miss)).toBeGreaterThanOrEqual(1.8)
  })

  it('the medals are those of the hall, so that the badge of the game and that of the cabinet match', () => {
    // Copied from `MEDAL_COLORS` (`xrcade/src/components/salon/theme.ts`).
    expect([COMMON_PALETTE.bronze, COMMON_PALETTE.silver, COMMON_PALETTE.gold]).toEqual(['#e39a64', '#d3d9e6', '#f6c945'])
  })
})

describe('the contrast', () => {
  it('goes from 1 (the same colour) to 21 (black on white), in any order', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contrast('#7ae582', '#7ae582')).toBe(1)
  })

  it('matches the WCAG figure in a known case', () => {
    // #767676 on white is the lightest grey that gives 4.5:1.
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })

  it('does not guess colours that are not #rrggbb', () => {
    expect(() => contrast('red', '#000000')).toThrow(/#rrggbb/)
    expect(() => contrast('#fff', '#000000')).toThrow(/#rrggbb/)
  })
})

describe('the base materials', () => {
  it('the matte one does not shine and is not metal', () => {
    expect(matteMaterial(COMMON_PALETTE.hit)).toEqual({ color: '#7ae582', roughness: 1, metalness: 0 })
  })

  it('the emissive one shows the colour as it is, without the scene\'s tone curve', () => {
    expect(emissiveMaterial(COMMON_PALETTE.miss)).toEqual({ color: '#ff5a4f', toneMapped: false })
  })

  it('the translucent one never writes depth, which would erase what it has behind', () => {
    expect(translucentMaterial(COMMON_PALETTE.hit, 0.5)).toEqual({
      color: '#7ae582',
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      toneMapped: false,
    })
    expect(translucentMaterial(COMMON_PALETTE.hit, 0).opacity).toBe(0)
    expect(translucentMaterial(COMMON_PALETTE.hit, 1).opacity).toBe(1)
  })

  it('the translucent one does not accept an opacity outside [0, 1]', () => {
    expect(() => translucentMaterial(COMMON_PALETTE.hit, -0.1)).toThrow(RangeError)
    expect(() => translucentMaterial(COMMON_PALETTE.hit, 1.5)).toThrow(RangeError)
    expect(() => translucentMaterial(COMMON_PALETTE.hit, Number.NaN)).toThrow(RangeError)
  })

  it('each call gives a new object: spreading it over a material does not touch the one next to it', () => {
    expect(matteMaterial(COMMON_PALETTE.gold)).not.toBe(matteMaterial(COMMON_PALETTE.gold))
  })
})
