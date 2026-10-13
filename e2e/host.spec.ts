import { expect, test } from '@playwright/test'
import { watchTable } from './helpers'
import { ASSETS_BASE, enterHostBooth, isAtSiteRoot, openHost } from './support/host'
import { installXREmulator } from './support/xr'

/**
 * The game mounted the way the hall mounts it: inside somebody else's Canvas,
 * with a session that is not its own and its files under the host's prefix.
 *
 * `scripts/scene-contract.test.ts` reads the code and checks that from
 * `<GlideHockeyScene>` no Canvas, XR or DOM is reached; this is what proves
 * that the scene really works mounted in someone else's Canvas, and that
 * mounting it and playing does not touch the host's session —which is what
 * allows going from the game to the hall without taking the headset off—.
 */
test.describe('Mounted inside another host', () => {
  test('the scene is mounted inside the foreign Canvas without dirtying the console', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))

    await openHost(page)
    await page.waitForTimeout(2_000)

    // A failure of the scene cannot be seen from outside: `<GlideHockeyScene>`
    // paints no DOM and the Canvas stays just as black. What tells is the
    // console, and here the same security policy as in the hall rules.
    expect(errors).toEqual([])
  })

  test('the controller finds its profile under the host prefix', async ({ page }) => {
    await installXREmulator(page)
    const host = await openHost(page)

    // The session and the store belong to the host, so entering the headset
    // does too. It is retried because the store does not accept the session
    // until the Canvas has connected it with three, a little after the first frame.
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.__glideHockeyHost.enterVR().then(
              () => true,
              () => false,
            ),
          ),
        { message: 'the host could not open the immersive session' },
      )
      .toBe(true)
    await page.evaluate(() => window.__xrTest.connectControllers())

    // Registering a controller is reading its profile; it is what the contract
    // asks to wire to the host (`baseAssetPath`) and the only thing this game
    // serves as a static file. Nothing is requested from the root, where the
    // hall has nothing.
    await expect
      .poll(() => host.requested.filter((p) => p.startsWith(`${ASSETS_BASE}webxr-profiles/`)), {
        message: 'the controller profile was not requested under the host prefix',
      })
      .not.toEqual([])
    expect(host.requested.filter(isAtSiteRoot)).toEqual([])
    expect(await page.evaluate(() => window.__xrTest.hasSession())).toBe(true)
  })

  test('with a challenge, the scene mounted inside the session comes in playing and reports at the end', async ({ page }) => {
    // As in the hall: one enters the session and afterwards chooses a cabinet. The scene is born
    // inside an open session, and that cannot be taken as «the headset was entered with a desktop
    // match half played», which would discard it and leave the challenge in the menu.
    test.setTimeout(120_000)
    await watchTable(page)
    await installXREmulator(page)
    await openHost(page, undefined, { onDemand: true, challenge: 20260925 })
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.__glideHockeyHost.enterVR().then(
              () => true,
              () => false,
            ),
          ),
        { message: 'the host could not open the immersive session' },
      )
      .toBe(true)
    await page.evaluate(() => window.__xrTest.connectControllers())
    await enterHostBooth(page)

    // Without touching «play»: the table sets itself up, which is what says there is a match.
    await expect
      .poll(() => page.evaluate(() => window.__glideHockeyScene != null), {
        timeout: 15_000,
        message: 'the challenge never got to set the table',
      })
      .toBe(true)

    // The serve waits for the mallet in the hand: it is picked up, and moved aside to a rail so
    // that the machine scores on its own. Without a tutorial, which is not given in the
    // challenge: here it is pending (it has never been seen) and, if it came up, the machine's
    // goals would not count and the challenge would not end.
    await page.evaluate(() => {
      window.__xrTest.placeController('right', 0, 0.95, -0.48)
      window.__xrTest.squeeze('right', true)
    })
    await page.waitForTimeout(600)
    await page.evaluate(() => window.__xrTest.placeController('right', 0.32, 0.95, -0.4))

    // The machine wins the first round and the challenge ends: one report, of the challenge.
    await expect
      .poll(() => page.evaluate(() => window.__finished.map(({ mode: gameMode, points: score, challenge: isChallenge }) => ({ gameMode, score, isChallenge }))), {
        timeout: 90_000,
        message: 'the scene did not report the end of the challenge',
      })
      .toEqual([{ gameMode: 'challenge', score: 0, isChallenge: true }])
    // The mallet parked on the rail can deflect a shot of the machine into its own goal: it is
    // the hidden feat, and it is the only one this match can give (`lib/feats.ts`).
    const [report] = await page.evaluate(() => window.__finished)
    expect([undefined, ['GH_OWN_GOAL']]).toContainEqual(report?.feats)
  })
})
