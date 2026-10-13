import { expect, test } from '@playwright/test'

import { openGame, watchTable } from './helpers'
import { enterVR, installXREmulator, skipTutorial, startGameInsideSession } from './support/xr'

/**
 * Playing with bare hands, without controllers.
 *
 * **It is the input mode that left people out.** The game read only the controllers, so
 * without them the mallet could not be picked up —and inside the headset text cannot be
 * painted, so there was no way to explain why either—. Here the controllers are turned off, the
 * hands are turned on with their joints and the whole gesture is made: bringing the palm to the
 * mallet and joining the thumb with the index finger.
 */
test('with bare hands the mallet gets picked up too', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await installXREmulator(page)
  // The demonstration of the gesture stops the match until it ends, and here what is tested is
  // the gesture: one goes in as someone who has already seen it.
  await skipTutorial(page)
  await watchTable(page)
  await openGame(page)
  await enterVR(page)
  await page.evaluate(() => window.__xrTest.useHands())
  await startGameInsideSession(page)

  const mallet = async () => page.evaluate(() => window.__glideHockeyScene?.playerMallet ?? null)
  await expect.poll(mallet, { timeout: 20_000 }).not.toBeNull()
  const before = await mallet()

  // The palm reaches the mallet and pinches: it is the whole gesture. The coordinates are the
  // same as the controller's in `grab.spec.ts`, which is where the mallet is at the start.
  await page.evaluate(() => {
    window.__xrTest.placeHand('right', 0, 0.95, -0.48)
    window.__xrTest.pinch('right', true)
  })
  await page.waitForTimeout(600)

  // Held, the mallet goes where the hand goes.
  await page.evaluate(() => window.__xrTest.placeHand('right', 0.25, 0.95, -0.62))
  await expect
    .poll(
      async () => {
        const now = await mallet()
        if (now == null || before == null) return 0
        return Math.hypot(now.x - before.x, now.z - before.z)
      },
      { timeout: 15_000, message: 'the mallet did not follow the bare hand' },
    )
    .toBeGreaterThan(0.05)

  expect(errors).toEqual([])
})
