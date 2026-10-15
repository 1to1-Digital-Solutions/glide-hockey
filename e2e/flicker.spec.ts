import { expect, test } from '@playwright/test'
import { installXREmulator, enterVR } from './support/xr'

/**
 * The flicker on entering, turned into a number.
 *
 * It is what has been reported most from the headset and what has never been seen from a
 * screen. One possible cause was removed —the demonstration repainting the whole tree— and in
 * two games it disappeared; in this one it stayed. Guessing the next one costs another round
 * with the goggles on.
 *
 * Here one does not look: one counts. If on opening the session the world is mounted **twice**,
 * that is the flicker —React throws the tree away and rebuilds it—, and it shows in this number.
 * If it is mounted only once, the flicker is not a remount and it has to be looked for
 * elsewhere, which is also knowing something: without this, that question could not even be asked.
 */

/** How many times each piece has been mounted, according to `lib/mountCount.ts`. */
async function mounts(page: import('@playwright/test').Page) {
  return page.evaluate(() => window.__mounts ?? {})
}

/** How many shader programs the renderer has compiled so far. */
async function programs(page: import('@playwright/test').Page) {
  return page.evaluate(() => window.__programs ?? 0)
}

test('the world is mounted only once when the page opens', async ({ page }) => {
  await page.addInitScript(() => {
    window.__mounts = {}
  })
  await page.goto('/')
  await expect.poll(async () => (await mounts(page)).world ?? 0).toBeGreaterThan(0)

  expect((await mounts(page)).world, 'the world was mounted more than once').toBe(1)
})

test('and entering the headset does not mount it again', async ({ page }) => {
  await page.addInitScript(() => {
    window.__mounts = {}
  })
  await installXREmulator(page)
  await page.goto('/')
  await expect.poll(async () => (await mounts(page)).world ?? 0).toBeGreaterThan(0)

  await enterVR(page)
  await page.waitForTimeout(1500)

  expect(
    (await mounts(page)).world,
    'entering the session remounts the world: that is the flicker',
  ).toBe(1)
})

test('and it leaves no shaders uncompiled for the first frame of the session', async ({ page }) => {
  // The other half of the flicker, and the one that did yield something: on opening the session
  // three new programs were compiled —the materials that only exist inside the headset—, and
  // compiling blocks the thread. `PrewarmShaders` compiles them with `compile` as soon as the
  // session starts; what is watched here is that **after a moment there are no new ones left**,
  // that is, that they do not keep being compiled as things get painted.
  await page.addInitScript(() => {
    window.__mounts = {}
  })
  await installXREmulator(page)
  await page.goto('/')
  await expect.poll(() => programs(page)).toBeGreaterThan(0)

  await enterVR(page)
  await page.waitForTimeout(2000)
  const onEntering = await programs(page)

  // And from here on, not one more: if the number keeps going up while playing, there are
  // materials that get compiled late and each one is a hitch.
  await page.waitForTimeout(3000)
  expect(await programs(page), 'shaders keep being compiled with the session open').toBe(
    onEntering,
  )
})
