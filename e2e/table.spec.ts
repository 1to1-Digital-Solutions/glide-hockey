import { expect, test, type Page } from '@playwright/test'
import { openGame, watchTable } from './helpers'
import { openHost } from './support/host'
import { drawCallBudget } from './support/budget'

/**
 * What it costs to paint the table, measured on the real scene.
 *
 * In a pair of goggles what is paid for is not the triangles but the **draw
 * calls**, and those are the same here as there (there, per eye). The fps of a
 * desktop without a GPU would say nothing about the headset; the number of
 * calls does, and it is what is watched when adding the environment map and the
 * puck's halo: the map adds no calls and the halo is one more mesh, only in a match.
 *
 * It is measured from outside, by wrapping the WebGL context, so as not to put
 * counters in the game's code.
 */

interface DrawFrame {
  calls: number
}

declare global {
  interface Window {
    __drawFrames?: DrawFrame[]
  }
}

/** Wraps the WebGL context to count calls. Before `page.goto`. */
async function countDrawCalls(page: Page) {
  await page.addInitScript(() => {
    const frames: DrawFrame[] = []
    window.__drawFrames = frames
    let calls = 0
    const gl = WebGL2RenderingContext.prototype
    for (const name of ['drawElements', 'drawElementsInstanced', 'drawArrays', 'drawArraysInstanced'] as const) {
      const original = gl[name] as (...args: unknown[]) => unknown
      ;(gl as unknown as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
        calls++
        return original.apply(this, args)
      }
    }
    const closeFrame = () => {
      frames.push({ calls })
      if (frames.length > 240) frames.shift()
      calls = 0
      requestAnimationFrame(closeFrame)
    }
    requestAnimationFrame(closeFrame)
  })
}

/** The median of calls per frame, with the scene already settled. */
async function medianCalls(page: Page, count = 30, settleMs = 1500): Promise<number> {
  await page.waitForTimeout(settleMs)
  await page.evaluate(() => {
    window.__drawFrames!.length = 0
  })
  await expect
    .poll(() => page.evaluate(() => window.__drawFrames!.length), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(count)
  const calls = await page.evaluate(() =>
    window.__drawFrames!.map((f) => f.calls).filter((c) => c > 0).sort((a, b) => a - b),
  )
  return calls[Math.floor(calls.length / 2)] ?? 0
}

/**
 * Ceiling of calls per frame of the table in the menu: the board, the rails,
 * the markings, the goals, the legs and the room; the desktop interface
 * does not count (it is DOM).
 */
const TABLE_CEILING = drawCallBudget('table').max

test('the table fits in its draw call budget', async ({ page }) => {
  await countDrawCalls(page)
  await openGame(page)

  const calls = await medianCalls(page)
  console.log(`[table] draw calls per frame: ${calls}`)
  expect(calls).toBeGreaterThan(0)
  expect(calls).toBeLessThanOrEqual(TABLE_CEILING)
})

/**
 * The goal sign, which hangs above the back scoreboard: **one draw call**, and
 * two at most —the background, the two lines and the bar go on the same canvas—.
 *
 * It is measured mounted the way the hall mounts it, which is where it is hung (on the game's web
 * page, without a headset, the goal goes in the DOM scoreboard): with the challenge and the
 * thresholds the hall passes, the scene comes in playing with the sign up. And it is measured
 * against **the same scene at the same moment**, by hiding the sign from the test host: comparing
 * with another mode is no good here, because the digit scoreboard paints one segment per call
 * and changes with the mode and with every goal. For the same reason the measurement with the
 * sign is repeated on both sides of the measurement without it, and it only counts if the two
 * agree: a goal in between changes the scoreboard's digits.
 *
 * The floor of one call is what prevents it from passing by measuring a scene without a sign.
 */
const SIGN = drawCallBudget('goal-sign')

test('the goal sign adds at most two draw calls', async ({ page }) => {
  await countDrawCalls(page)
  await watchTable(page)
  await openHost(page, undefined, {
    challenge: 20261005,
    goal: { medals: { bronze: 1500, silver: 8000, gold: 20000 }, better: 'higher', unit: 'points in the challenge', record: null, mode: 'challenge' },
  })
  // With the puck already in play: the countdown changes digit every second.
  await expect
    .poll(() => page.evaluate(() => window.__glideHockeyScene != null), { message: 'the challenge never got to set the table' })
    .toBe(true)
  await page.waitForTimeout(4_000)
  await expect
    .poll(() => page.evaluate(() => window.__glideHockeyHost.showSign(true)), { message: 'the goal sign is not hung' })
    .toBe(true)

  let measured: { withSign: number; without: number } | null = null
  for (let attempt = 0; attempt < 6 && measured == null; attempt++) {
    const before = await medianCalls(page, 20, 300)
    await page.evaluate(() => window.__glideHockeyHost.showSign(false))
    const without = await medianCalls(page, 20, 300)
    await page.evaluate(() => window.__glideHockeyHost.showSign(true))
    const after = await medianCalls(page, 20, 300)
    if (before === after) measured = { withSign: before, without }
  }

  expect(measured, 'the scene did not stay still between two measurements').not.toBeNull()
  console.log(`[table] the goal sign: ${measured!.withSign - measured!.without} calls (${measured!.without} without it, ${measured!.withSign} with it)`)
  expect(measured!.withSign - measured!.without).toBeGreaterThanOrEqual(SIGN.min)
  expect(measured!.withSign - measured!.without).toBeLessThanOrEqual(SIGN.max)
})
