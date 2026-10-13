import { expect, type Page } from '@playwright/test'
import { TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE } from '../../src/lib/tutorial'
import { XR_EMULATOR_BUNDLE } from './globalSetup'

interface XRTestApi {
  hasSession: () => boolean
  connectControllers: () => void
  /** Switches to bare hands: turns the controllers off and the hands on with their joints. */
  useHands: () => void
  placeHand: (handedness: 'left' | 'right', x: number, y: number, z: number) => void
  /** Brings the thumb and the index finger together or apart, which is the «grab» of a bare hand. */
  pinch: (handedness: 'left' | 'right', pressed: boolean) => void
  placeController: (handedness: 'left' | 'right', x: number, y: number, z: number) => void
  squeeze: (handedness: 'left' | 'right', pressed: boolean) => void
  /** Turns the head, in degrees. It is needed to look at where the hints are: at the floor. */
  lookAt: (yaw?: number, pitch?: number) => void
  endSession: () => Promise<void>
}

declare global {
  interface Window {
    __xrTest: XRTestApi
  }
}

/** Installs the emulated Quest 3 before the page loads. */
export async function installXREmulator(page: Page) {
  await page.addInitScript({ path: XR_EMULATOR_BUNDLE })
}

export function enterButton(page: Page) {
  return page.getByRole('button', { name: 'Play in the headset' })
}

/** It is only there with a match under way: it is the DOM mirror of the state. */
export function exitButton(page: Page) {
  return page.getByRole('button', { name: 'Exit', exact: true })
}

export async function enterVR(page: Page) {
  await enterButton(page).click()
  await expect
    .poll(() => page.evaluate(() => window.__xrTest.hasSession()), {
      message: 'the immersive session did not start',
    })
    .toBe(true)
  await page.evaluate(() => window.__xrTest.connectControllers())
}

export async function exitXR(page: Page) {
  await page.evaluate(() => window.__xrTest.endSession())
  await expect
    .poll(() => page.evaluate(() => window.__xrTest.hasSession()), {
      message: 'the immersive session did not close',
    })
    .toBe(false)
}

/**
 * Starts a practice match with the desktop menu, which stays mounted behind the session.
 * Inside the headset it would be started with the ray, but the emulator does not
 * propagate the poses of the pointers down to the scene.
 */
export async function startGameInsideSession(page: Page, attempts = 8) {
  const play = page.getByRole('button', { name: 'Play', exact: true })
  // The menu opens on the challenge, and these tests play a practice match.
  await page.getByRole('button', { name: 'Practice', exact: true }).focus()
  await page.keyboard.press('Enter')
  for (let attempt = 0; attempt < attempts; attempt++) {
    await play.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
    if ((await play.count()) === 0) return
  }
  throw new Error(`Could not start the match inside the session in ${attempts} attempts`)
}

/**
 * Leaves the game as if the demonstration of the gesture had already been seen.
 *
 * **It is needed before opening the game.** With the headset on and never having seen it, the
 * demonstration runs between «start» and the first throw, and the match waits for it: whoever
 * does not know the gesture yet does not play (see `lib/gameStore.ts`). A test that is going to
 * make the gesture is not testing that, and waiting six seconds in each one only lengthens the
 * suite.
 *
 * What is written is the same thing the game writes when it finishes it (`lib/tutorial.ts`), and
 * that is why **the key and the value** are imported from there instead of being copied. The
 * value is the version of the lesson: it used to be copied by hand as `'1'`, and as soon as it
 * went up to `'2'` —the demonstration switched to showing the grab button instead of the
 * trigger— the tests stopped skipping it and were left waiting six seconds for an explanation.
 */
export async function skipTutorial(page: Page) {
  await page.addInitScript(([key, value]: readonly string[]) => {
    try {
      window.localStorage.setItem(key!, value!)
    } catch {
      // Storage capped: the demonstration will come up, and the test that needs it out of the
      // way will find out when it does not see the gesture.
    }
  }, [TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE])
}
