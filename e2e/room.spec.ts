import { expect, test, type Page } from '@playwright/test'
import { openGame } from './helpers'

/**
 * That the room is **closed**: that looking up is not looking at nothing.
 *
 * The walls reached three and a half metres and there the world ended: above was the
 * compositor's black, which is not the black of a place in the dark but the absence of a place,
 * and with the headset on that is noticed immediately. Now there is a ceiling, and above all
 * there is a **background**.
 *
 * The background is checked by the colour the canvas is cleared with, which is what three sets
 * when the scene has a `background`. It is watched from outside, by wrapping the WebGL context,
 * so as not to put counters in the game's code — just like the draw call budget.
 */

declare global {
  interface Window {
    /** Every clear colour the engine has asked for, in RGBA from 0 to 1. */
    __clearColors?: [number, number, number, number][]
  }
}

/**
 * Records which colours the canvas is cleared with. Before `page.goto`.
 *
 * **All of them** are kept and not the last one: the engine leaves the colour at zero when it
 * finishes painting, so keeping the last one would say there is no background even if there is.
 */
async function spyClearColor(page: Page) {
  await page.addInitScript(() => {
    const colors: [number, number, number, number][] = []
    window.__clearColors = colors
    const gl = WebGL2RenderingContext.prototype
    const original = gl.clearColor
    gl.clearColor = function (r: number, g: number, b: number, a: number) {
      colors.push([r, g, b, a])
      return original.call(this, r, g, b, a)
    }
  })
}

test('the scene brings its own background, and it is not nothing', async ({ page }) => {
  // The game has to bring it and not the `<Canvas>`: mounted in the hall, the hub removes its
  // own on entering the cabinet, so a game without a background of its own is left with none.
  await spyClearColor(page)
  await openGame(page)

  // A background is an **opaque** colour: transparent lets the black behind show through, which
  // is precisely the problem. And dark without getting to black: it is the room of an arcade at
  // night, not the void, and pure black is what the engine sets when there is no background at all.
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.__clearColors ?? [])).some(
          ([r, g, b, a]) => a === 1 && r + g + b > 0 && r + g + b < 0.5,
        ),
      { message: 'the scene was painted without a background of its own: above the walls, nothing' },
    )
    .toBe(true)
})
