import { expect, test, type Page } from '@playwright/test'
import { SCENERY_KEY } from '../src/lib/settings'
import { OWN_SCENERY_KEY } from '../src/lib/scenery'
import {
  lightCombinations,
  installDrawCallCounter,
  letSettle,
  chooseInSalon,
  storeBeforeOpen,
  readKey,
  medianDrawCalls,
  linkedPrograms,
  watchPrograms,
} from './support/scenery'
import { openHost } from './support/host'
import { installXREmulator } from './support/xr'

/**
 * The scenery is chosen by the hall (`xrcade:scenery`), not by the type of session or a setting of the game.
 *
 * It is mounted the way the hall mounts it: inside the test host's Canvas and entering in
 * augmented reality, which is how the hall enters whenever the headset has it. There the type of
 * session is the same with both choices, so the only thing that can take the room away is the
 * scenery.
 */

/**
 * How many draw calls per frame, at the very least, separate the room from your own room.
 *
 * Roomy on purpose: the carpet, the walls, the machines and the neons are many more per
 * frame, and the scenery button changes icon on changing, which is a couple.
 */
const WHAT_THE_BACKDROP_PAINTS = 10

/** Enters the way the hall enters: in augmented reality. */
async function enterAsTheHall(page: Page) {
  // It is retried because the store does not accept the session until the Canvas has connected
  // it with three, a little after the first frame.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.__glideHockeyHost.enterAR().then(
            () => true,
            () => false,
          ),
        ),
      { message: 'the host could not open the augmented reality session' },
    )
    .toBe(true)
}

async function hasSession(page: Page) {
  return page.evaluate(() => window.__xrTest.hasSession())
}

test.describe('The scenery is chosen by the hall', () => {
  test.beforeEach(async ({ page }) => {
    await installDrawCallCounter(page)
    await installXREmulator(page)
  })

  test('with «room» the room is not painted and with «place» it is, without leaving the session', async ({ page }) => {
    await storeBeforeOpen(page, SCENERY_KEY, 'room')
    await openHost(page)
    await enterAsTheHall(page)

    const inYourRoom = await medianDrawCalls(page)
    await chooseInSalon(page, 'place')
    const withBackdrop = await medianDrawCalls(page)
    console.log(`[scenery] calls per frame: your room ${inYourRoom}, backdrop ${withBackdrop}`)

    expect(withBackdrop, 'with «place» in augmented reality the room was not painted').toBeGreaterThan(
      inYourRoom + WHAT_THE_BACKDROP_PAINTS,
    )
    // And going back to your room takes it away again, in the same session.
    await chooseInSalon(page, 'room')
    expect(await medianDrawCalls(page), 'with «room» the room kept being painted').toBeLessThan(
      withBackdrop - WHAT_THE_BACKDROP_PAINTS,
    )
    expect(await hasSession(page), 'changing the scenery closed the session').toBe(true)
  })

  test('the own key of the game does not rule: at «room» and with nothing from the hall, the room is painted', async ({
    page,
  }) => {
    await storeBeforeOpen(page, OWN_SCENERY_KEY, 'room')
    await openHost(page)
    await enterAsTheHall(page)

    const withTheOwnKey = await medianDrawCalls(page)
    // It was deleted on mounting the match, and without moving to the arcade's: what the hall says rules.
    expect(await readKey(page, OWN_SCENERY_KEY), 'the own key of the game is still stored').toBeNull()
    expect(await readKey(page, SCENERY_KEY), 'the own key of the game was moved to the one of the arcade').toBeNull()

    await chooseInSalon(page, 'room')
    const inYourRoom = await medianDrawCalls(page)
    console.log(`[scenery] calls per frame: own key ${withTheOwnKey}, your room ${inYourRoom}`)

    expect(withTheOwnKey, 'the own key of the game took the room away').toBeGreaterThan(
      inYourRoom + WHAT_THE_BACKDROP_PAINTS,
    )
  })

  test('toggling the scenery does not change the lights or recompile any shader', async ({ page }) => {
    // The hitch on changing scenery with the headset on. Removing a light or the fog along with
    // the room changes the program of everything that is lit, and unmounting the backdrop frees
    // its shaders, which get compiled again on coming back. The lights stay mounted —off
    // where they do not light anything—, the fog moves away and the backdrop is hidden.
    await watchPrograms(page)
    await storeBeforeOpen(page, SCENERY_KEY, 'room')
    await openHost(page)
    await enterAsTheHall(page)
    await letSettle(page)

    // A whole lap first: what only exists in one of the two sceneries is compiled the first
    // time it is seen, and that happens once per visit, not on every change.
    await chooseInSalon(page, 'place')
    await letSettle(page)
    await chooseInSalon(page, 'room')
    await letSettle(page)
    const afterTheFirstLap = await linkedPrograms(page)

    await chooseInSalon(page, 'place')
    await letSettle(page)
    await chooseInSalon(page, 'room')
    await letSettle(page)

    const lights = await lightCombinations(page)
    console.log(`[scenery] lights it is painted with: ${lights.join(' | ')}`)
    expect(lights, 'the number of lights changed with the scenery').toHaveLength(1)
    expect(
      (await linkedPrograms(page)) - afterTheFirstLap,
      'changing scenery again recompiled shaders: that is a hitch with the headset on',
    ).toBe(0)
    expect(await hasSession(page), 'changing the scenery closed the session').toBe(true)
  })
})
