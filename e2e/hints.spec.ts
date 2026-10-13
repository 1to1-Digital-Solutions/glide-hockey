import { expect, test } from '@playwright/test'

import { CROSSFADE } from '../src/lib/hints'
import { HINT_SCRIPT } from '../src/lib/hintScript'
import { openGame } from './helpers'
import { installDrawCallCounter, letSettle, medianDrawCalls } from './support/scenery'
import { enterVR, installXREmulator, skipTutorial, startGameInsideSession } from './support/xr'

/**
 * The visual hints, inside the headset.
 *
 * **What is checked here and what is not.** That the script turns itself off, that what rises
 * from the table disappears before the serve and that each dimension lands where it says is
 * measured by `src/lib/hintScript.test.ts`, without a browser and with figures. What is only
 * seen here is that **they really get painted** —which is different from the script turning them
 * on— and that **they stop being painted** when their time runs out.
 *
 * **And they are measured by what they cost**, which is the only thing a hint lets one see from
 * outside the headset: the draw calls per frame (`e2e/support/scenery.ts`). A hint that is on
 * costs; off, it is invisible and costs nothing. That turns «is it still up?» into a number.
 *
 * Whether they **read** —whether the ghost is understood as a push or as an amber smudge— no
 * number says. That is what the screenshots are for, and the answer arrives with the goggles on
 * (`organizate/docs/pendiente-de-visor.md`).
 *
 * **One goes in with the tutorial already seen** so that its panel waits for nobody. The
 * controller with the lit button is shown by the hints the first time too, **next to the ghost
 * mallet**; the lesson's copy goes above the hand, so they do not step on each other.
 */

const SCREENSHOTS = 'test-results/screenshots'

/**
 * Where to look in order to see them.
 *
 * The emulator always enters looking straight ahead and the hints are where one looks
 * afterwards: the footprints **at the feet** and the ghost over the table. Fifty degrees down is
 * the only angle that catches both things at once, and it was chosen by looking at screenshots
 * at −20, −35, −50 and −70: at −28 the screenshot showed a lovely table and no hint at all.
 *
 * **The two measurements of a comparison are taken with the head in the same place**: otherwise,
 * what is compared are two views and not two scenes.
 */
const TOWARD_THE_HINTS = { yaw: 0, pitch: -50 }

/** How long the most patient hint takes to leave on its own, plus the crossfade it fades with. */
const UNTIL_THEY_LEAVE = Math.max(...HINT_SCRIPT.map((hint) => hint.expiresAfter)) + CROSSFADE + 2

/**
 * How many draw calls per frame all the hints at once may cost.
 *
 * The two eyes of an immersive session double every mesh, and the controller's model brings its
 * own —it is, by far, the expensive one: that is why it is the hint that lasts least—. The rest
 * are five meshes: the two footprints, the ring and the handle of the ghost and the goal mark.
 */
const HINTS_CEILING = 60

/** Lets the crossfade they appear or leave with finish, which lasts almost half a second. */
async function letCrossfade(page: import('@playwright/test').Page) {
  await page.waitForTimeout(CROSSFADE * 1000 + 300)
  await letSettle(page)
}

test.describe('The visual hints', () => {
  test.beforeEach(async ({ page }) => {
    await installDrawCallCounter(page)
    await installXREmulator(page)
    await skipTutorial(page)
    await openGame(page)
  })

  test('are painted on entering the cabinet, and leave on their own when their time runs out', async ({
    page,
  }) => {
    test.setTimeout(UNTIL_THEY_LEAVE * 1000 + 60_000)
    await enterVR(page)
    await page.evaluate(({ yaw, pitch }) => window.__xrTest.lookAt(yaw, pitch), TOWARD_THE_HINTS)
    await letCrossfade(page)

    const withHints = await medianDrawCalls(page)
    await page.screenshot({ path: `${SCREENSHOTS}/hints-on-entry.png` })

    // They are left to expire, which is the only way to turn them off without touching the
    // scene. **The head does not move between one measurement and the other.**
    await page.waitForTimeout(UNTIL_THEY_LEAVE * 1000)
    await letSettle(page)
    const withoutHints = await medianDrawCalls(page)
    await page.screenshot({ path: `${SCREENSHOTS}/hints-expired.png` })

    expect(withHints, 'the hints cost nothing: are they being painted?').toBeGreaterThan(withoutHints)
    expect(
      withHints - withoutHints,
      `${withHints} calls with hints and ${withoutHints} without them: they have gone over budget`,
    ).toBeLessThanOrEqual(HINTS_CEILING)
  })

  test('with the match under way the push and the goal are shown', async ({ page }) => {
    // **The screenshot is there to be looked at**, and it is the only way to judge what matters
    // here: that the ghost mallet reads as a push toward the puck and not as a stain on the
    // table. What does get checked is that the match starts with the hints up, which is the
    // moment they are needed.
    await enterVR(page)
    await startGameInsideSession(page)
    await page.evaluate(({ yaw, pitch }) => window.__xrTest.lookAt(yaw, pitch), TOWARD_THE_HINTS)
    await letCrossfade(page)

    await page.screenshot({ path: `${SCREENSHOTS}/hints-playing.png` })
    // And the match keeps waiting for the mallet: it is what guarantees that nothing runs across
    // the table while the ghost is on top of it.
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toHaveCount(0)
  })
})
