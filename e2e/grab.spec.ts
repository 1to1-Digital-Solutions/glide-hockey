import { expect, test } from '@playwright/test'
import { openGame, watchTable } from './helpers'
import { enterVR, installXREmulator, skipTutorial, startGameInsideSession } from './support/xr'

/**
 * Picking up the mallet with the hand, inside a real session.
 *
 * **It is the test that was missing.** The mallet is grabbed by bringing the hand to it and
 * squeezing the side trigger, and to know where the hand is the game reads the controller's
 * `state.object`. That object is written **only** by `XRControllerModel`, which with
 * `model: false` is not mounted —so the mallet could not be grabbed either here or in the hall,
 * and from outside it looked as if the button did not work—. Nothing caught it: the other tests
 * go in through the mouse, which is another path.
 *
 * Now the controller is placed and squeezed from the emulator (`support/xr-emulator.src.ts`), so
 * this is played the way it is really played.
 */
test('the mallet goes with the hand when the trigger is squeezed', async ({ page }) => {
  await installXREmulator(page)
  // The demonstration of the gesture stops the match until it ends, and here what is tested
  // is the gesture: one goes in as someone who has already seen it.
  await skipTutorial(page)
  await watchTable(page)
  await openGame(page)
  await enterVR(page)
  await startGameInsideSession(page)

  const mallet = async () =>
    page.evaluate(() => window.__glideHockeyScene?.playerMallet ?? null)

  await expect.poll(mallet, { timeout: 20_000 }).not.toBeNull()
  const before = await mallet()

  // The hand reaches the mallet and squeezes: it is the whole gesture, and neither of the two
  // things on its own has to be enough.
  await page.evaluate(() => {
    window.__xrTest.placeController('right', 0, 0.95, -0.48)
    window.__xrTest.squeeze('right', true)
  })
  await page.waitForTimeout(600)

  // Held, the mallet goes where the hand goes: the hand moves and the mallet follows it.
  await page.evaluate(() => window.__xrTest.placeController('right', 0.25, 0.95, -0.62))
  await expect
    .poll(async () => {
      const now = await mallet()
      if (now == null || before == null) return 0
      return Math.hypot(now.x - before.x, now.z - before.z)
    }, { timeout: 15_000, message: 'the mallet did not follow the hand' })
    .toBeGreaterThan(0.05)
})
