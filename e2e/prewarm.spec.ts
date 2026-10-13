import { expect, test, type Page } from '@playwright/test'
import { SCENERY_KEY } from '../src/lib/settings'
import {
  installDrawCallCounter,
  linkTimes,
  letSettle,
  chooseInSalon,
  inBatches,
  storeBeforeOpen,
  shaderTypes,
  watchPrograms,
} from './support/scenery'
import { enterHostBooth, openHost } from './support/host'
import { installXREmulator } from './support/xr'

/**
 * That on entering the cabinet a shader is not compiled per frame.
 *
 * **What was fixed.** The prewarming (`<PrewarmShaders />`) hung from the Canvas of the game's
 * web page, which is one of its two hosts. The other is the hall, and the hall mounts the scene
 * and not the Canvas: right where it is really played nothing was prewarmed.
 *
 * **Why it is worse there.** On the web one enters the headset from a page that has been
 * painting the scene for a while, so almost everything is compiled before opening the session.
 * In the hall a cabinet is chosen **with the headset already on**: the scene is born inside an
 * open session and without having painted a single frame, so everything is compiled on the go,
 * one material per frame, and compiling blocks the thread. That is the hitch of the first
 * seconds of a match.
 *
 * **How it is seen without goggles.** Not by how many shaders are compiled —they are the same
 * with prewarming and without it—, but by **when**: each compilation is dated in draw calls
 * (`e2e/support/scenery.ts`). When warming, **all of them come out with the same date**, in one
 * batch and before painting; without warming there is no batch, each one goes in its own frame.
 *
 * The test host mounts the scene on demand in order to reproduce it: one enters the session
 * first and the scene is mounted afterwards, as in the arc of cabinets.
 */

/** Enters the way the hall enters: in augmented reality, which is where the scenery rules. */
async function enterAsTheHall(page: Page) {
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

test.describe('The shaders are warm where it is played', () => {
  test('the scene the hall mounts compiles its shaders in one batch, not one by one', async ({
    page,
  }) => {
    await installDrawCallCounter(page)
    await watchPrograms(page)
    await installXREmulator(page)
    // In «your room», which is the scenery with the fewest things in view: that way the room
    // stays mounted and hidden, and what gets warmed of it has been painted by nobody.
    await storeBeforeOpen(page, SCENERY_KEY, 'room')
    await openHost(page, undefined, { onDemand: true })
    await enterAsTheHall(page)
    // What belongs to the host —its rays, its pointer— is compiled on entering and is not the
    // game's: it is left to settle so that it does not count as a shader of the scene.
    await letSettle(page)

    const beforeTheCabinet = (await linkTimes(page)).length
    await enterHostBooth(page)
    await letSettle(page)

    const fromTheScene = (await linkTimes(page)).slice(beforeTheCabinet)
    const { largestBatch: biggestBatch, stray: loose } = inBatches(fromTheScene)
    console.log(
      `[prewarm] the scene compiled ${fromTheScene.length} shaders: ${biggestBatch} in one batch and ${loose} loose`,
    )

    expect(fromTheScene.length, 'the scene compiled no shader at all: the test measures nothing').toBeGreaterThan(
      3,
    )
    expect(
      biggestBatch,
      'the scene compiled its shaders one by one, as it came to paint each material: that is a hitch per frame on entering the cabinet',
    ).toBeGreaterThan(loose)
  })

  test('and the backdrop that is shown on changing scenery was already warm', async ({
    page,
  }) => {
    // «Your room» and the room are two sets of materials, and on entering only one is seen. The
    // other is mounted and hidden —that is why it is hidden instead of unmounted—, so the
    // prewarming goes through it all the same: showing it cannot compile anything.
    await installDrawCallCounter(page)
    await watchPrograms(page)
    await installXREmulator(page)
    await storeBeforeOpen(page, SCENERY_KEY, 'room')
    await openHost(page, undefined, { onDemand: true })
    await enterAsTheHall(page)
    await letSettle(page)
    await enterHostBooth(page)
    await letSettle(page)

    const settled = (await shaderTypes(page)).length
    await chooseInSalon(page, 'place')
    await letSettle(page)
    await chooseInSalon(page, 'room')
    await letSettle(page)

    // What is painted has to be warm: the prewarming goes through the whole scene, whether it
    // is seen or not. **The shadow map is not**: `compile()` only prepares the pass that is
    // seen, and three does not compile the `MeshDepthMaterial` of something that casts nothing
    // because it is hidden. It is one shader, once per visit, and there is no way to bring it
    // forward from the scene.
    const newOnes = (await shaderTypes(page)).slice(settled)
    console.log(`[prewarm] on changing scenery this was compiled: ${newOnes.join(', ') || 'nothing'}`)
    expect(
      newOnes.filter((type) => type !== 'MeshDepthMaterial'),
      'showing the backdrop compiled shaders of what is painted: that is a hitch on changing scenery with the headset on',
    ).toEqual([])
  })
})
