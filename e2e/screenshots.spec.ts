import { expect, test } from '@playwright/test'
import { ENSAYO, enterHostVR, openHost } from './support/host'
import { installXREmulator } from './support/xr'
import { takeScreenshot, inRun, lookToward, trialGoal, runReady, requestRun } from './support/common'

/**
 * The common screenshots of the UX, the same in the seventeen: the headset menu looking straight ahead,
 * the goal sign before starting, the sign when crossing bronze and the end.
 *
 * It is the same file in every game. It mounts the scene in the game's test host with
 * a trial goal (`trialGoal`, bronze at 10) and moves it with the run hook
 * (`support/common.ts`), without playing: what is looked at here is what is seen, not the gesture. The screenshots
 * go to `test-results/capturas/<game>-<what>.png`, to put the seventeen side by side.
 *
 * What the sign says is checked with what the scene hands it to paint (the `sign` hook), in
 * English, which is the language of the tests' browser.
 */

test.use({ locale: 'en-US' })

test('the menu is born facing forward, the sign says bronze and celebrates it when crossed', async ({ page }) => {
  const goal = trialGoal(ENSAYO)
  const { bronze, gold } = goal.medals
  await installXREmulator(page)
  await requestRun(page)
  await openHost(page, undefined, { goal })
  await enterHostVR(page)
  await expect.poll(() => runReady(page), { message: 'the scene has not left the run hook' }).toBe(true)

  await lookToward(page, 0, 0)
  await takeScreenshot(page, '1-menu')

  await inRun(page, 'start')
  await expect
    .poll(async () => (await inRun(page, 'sign'))?.detail ?? '')
    .toContain(ENSAYO.better === 'higher' ? `Bronze ${bronze}` : `Gold ${gold} or less`)
  await takeScreenshot(page, '2-cartel-antes')

  if (ENSAYO.better === 'higher') {
    await inRun(page, 'score', 1)
    await expect.poll(async () => (await inRun(page, 'sign'))?.title).toBe(`Bronze at ${bronze} · you have 1`)
    await inRun(page, 'score', bronze)
    await expect.poll(async () => (await inRun(page, 'sign'))?.cheer).toBe('Bronze!')
  } else {
    await inRun(page, 'score', gold)
    await expect.poll(async () => (await inRun(page, 'sign'))?.title).toBe(`Gold with ${gold} or less · you have ${gold}`)
  }
  await takeScreenshot(page, '3-cartel-bronce')

  await inRun(page, 'end')
  await expect.poll(async () => (await inRun(page, 'sign'))?.title ?? '').toMatch(/^(Bronze|Gold) · /)
  await takeScreenshot(page, '4-final')
})
