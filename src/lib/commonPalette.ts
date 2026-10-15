/**
 * The colours that **mean something**, and mean the same across the whole hall.
 *
 * It is the same file in every game (`comunes.py` watches over it). Each game keeps its
 * scenery and its colours —the cyan of the table, the orange of the fairground, the brass of the
 * bar—, which are its personality and stay in its `palette.ts` or next to the component that
 * paints them. What lives here is the other thing: the green that says «this has counted», the red
 * that says «this has been lost», the yellow that says «watch out», the medals and the neutrals
 * with which a panel is written. If the green for a hit were one in the darts and another in the
 * moles, the hall would read as sixteen loose demos instead of as a single place, and whoever goes
 * from one game to another would have to learn again what each thing means.
 *
 * No React and no three: the same literals are asked for by the CSS of the web, the materials of
 * the scene and the canvases of the headset panels, and the port to Godot copies them as they are.
 */

export const COMMON_PALETTE = {
  /**
   * What has counted: the mole that takes it, the run won, the stroke that goes in.
   *
   * It comes from the hit green of the moles, which had already proved it reads with the mallet in
   * the air. It is light on purpose: over any panel background of the hall it goes past 10:1.
   */
  hit: '#7ae582',
  /**
   * What has been lost or threatens: the mole that gets away, the run lost, overshooting.
   *
   * It is the escaped red of the moles lightened until it goes past 5:1 over any panel of the
   * hall: it is also written as text, and a darker red stays at the minimum or below
   * on the lightest panels. It has to be told apart from the green **without seeing the colour**
   * —by light—, which is all that is left for whoever does not separate red from green (the test
   * measures it).
   */
  miss: '#ff5a4f',
  /**
   * Watch out, this is going to happen: the last seconds, a warning before something is lost.
   *
   * The hall's `--color-aviso` (`xrcade/src/app/globals.css`).
   */
  warning: '#ffc24d',

  /** The neutrals of the hall's panels (`xrcade/src/components/salon/theme.ts`). */
  background: '#0b0a12',
  /** Main text over the background. */
  text: '#edeafd',
  /** The secondary, the dimmed, what cannot be chosen yet. */
  mutedText: '#a6a1cc',
  /** The border of a panel and the separation between its parts. */
  border: '#2b2748',

  /**
   * The accent of the hall: what is pointed at, what is lit, what is going to be pressed.
   *
   * It is the mint of the frame of the lit cabinet in the hall. That the highlight of a pointed-at
   * button is the same in all sixteen games is what makes the gesture be learnt once.
   */
  accent: '#5ee6c0',

  /**
   * The medals, identical to those of the hall (`MEDAL_COLORS` of its `theme.ts`): a gold badge in
   * a game and that of the hall's cabinet have to be the same gold. Lightened relative to the real
   * metal because they are written over a dark background, and gold is also the colour of what is
   * won —stars, records—.
   */
  bronze: '#e39a64',
  silver: '#d3d9e6',
  gold: '#f6c945',
} as const

/** The name of each common colour. */
export type CommonColor = keyof typeof COMMON_PALETTE

/**
 * The contrast between two colours according to WCAG 2.2 (from 1 to 21).
 *
 * It is here and not only in the tests because each game has to check the common colours
 * **over its own panels**, which are not the background of the hall: the hit green that reads on
 * one can go dull on the one next to it.
 */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** The relative luminance of a `#rrggbb`, with the WCAG formula. */
function luminance(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`Not a #rrggbb color: ${hex}`)
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/*
 * The base materials: parameters, not materials.
 *
 * They are plain objects that are spread over the R3F material
 * (`<meshBasicMaterial {...emissiveMaterial(COMMON_PALETTE.hit)} />`). That way the module does not
 * instantiate three —it can be imported from a test or from the server— and each material that is
 * painted is still one per mesh. What they fix is what goes wrong when written by hand.
 */

/** A matte material, with no shine and no metal: that of the kit's low-poly pieces of flat colours. */
export function matteMaterial(color: string): { color: string; roughness: 1; metalness: 0 } {
  return { color, roughness: 1, metalness: 0 }
}

/**
 * A colour that is seen **as it is**, with no light and no tone correction: that of the panels and
 * the signals.
 *
 * Without `toneMapped: false` three applies the scene's tone curve to it and the hit green
 * comes out dull and different in each game, which is exactly what the palette exists to avoid.
 */
export function emissiveMaterial(color: string): { color: string; toneMapped: false } {
  return { color, toneMapped: false }
}

/**
 * A translucent colour: waves, veils, highlights that let what is behind show through.
 *
 * It always carries `depthWrite: false`. A transparent three material **writes depth**
 * even though it is seen through, and then it erases everything that is behind: it is what leaves
 * a button «without colour», as if switched off (`.claude/rules/xr.md`).
 */
export function translucentMaterial(
  color: string,
  opacity: number,
): { color: string; transparent: true; opacity: number; depthWrite: false; toneMapped: false } {
  if (!(opacity >= 0 && opacity <= 1)) throw new RangeError(`Opacity out of [0, 1]: ${opacity}`)
  return { color, transparent: true, opacity: opacity, depthWrite: false, toneMapped: false }
}
