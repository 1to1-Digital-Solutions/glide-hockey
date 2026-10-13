import { expect, test } from '@playwright/test'
import { openGame } from './helpers'
import { enterButton, enterVR, exitButton, exitXR, installXREmulator, startGameInsideSession } from './support/xr'

/**
 * Immersive mode, on a Quest 3 emulated with IWER.
 *
 * Chromium does not ship WebXR, so without the emulator these paths never run:
 * the other tests go in through the mouse, which is different code. Here a real
 * session is opened and it is checked what state it leaves the game in, by
 * looking at the DOM that stays mounted behind the session.
 *
 * **What these tests do NOT cover, and why:** carrying the mallet with the
 * controller. IWER registers the controllers —the game serves their profiles
 * from `public/webxr-profiles/`— but does not propagate the poses of the
 * pointers down to the scene, so moving the mallet with the ray and pressing
 * the immersive menu are only validated with the headset on (and how the mallet
 * is carried in VR is yet to be decided). What does get checked is that
 * entering the session mounts the immersive scene and leaves the match running
 * without a single error.
 */
test.describe('Immersive session', () => {
  test.beforeEach(async ({ page }) => {
    await installXREmulator(page)
    await openGame(page)
  })

  test('with WebXR available the entry to the headset appears', async ({ page }) => {
    await expect(enterButton(page)).toBeVisible()
  })

  test('entering the headset opens the session and leads to the menu, not to a match', async ({ page }) => {
    await enterVR(page)

    expect(await page.evaluate(() => window.__xrTest.hasSession())).toBe(true)
    // One enters the menu: the match is started by the player. (The menu also
    // offers «Salir» from the headset while there is a session; it is not the HUD's «Salir».)
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  })

  test('the immersive scene is mounted and the match runs inside the session', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))

    await enterVR(page)
    await startGameInsideSession(page)

    await expect(exitButton(page)).toBeVisible()
    // A few frames of a match with the session open: the table, the scoreboard
    // in geometry and the immersive menu are painted here, and a failure of
    // theirs is only told by the console —the scene lives in R3F's root, not in the DOM—.
    await page.waitForTimeout(3_000)
    expect(await page.evaluate(() => window.__xrTest.hasSession())).toBe(true)
    expect(errors).toEqual([])
  })

  test('leaving the session returns to the desktop menu', async ({ page }) => {
    await enterVR(page)
    await startGameInsideSession(page)

    await exitXR(page)

    // Taking the headset off mid match returns to the menu (`XRSessionController`):
    // the headset's match does not continue on the screen, another one is started.
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
    await expect(enterButton(page)).toBeVisible()
  })
})
