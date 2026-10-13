import { expect, test, type Page } from '@playwright/test'
import { openGame, playMatch } from './helpers'

/**
 * The hit feedback (`components/xr/HitFeedback.tsx`), measured frame by frame in a real
 * browser.
 *
 * What matters most cannot be seen in a screenshot: **that the camera does not move in any
 * frame**. Moving the view without the head moving is what causes sickness with the headset,
 * and the macro is made to shake the backdrop and never the camera. The component's probe
 * (`window.__hitFeedback`) records on every frame the camera's pose, how far the room has been
 * displaced, the vignette, the pace of the table's clock and the filter's cutoff.
 */

/** What the component records per frame. */
interface Sample {
  camera: number[]
  shake: [number, number, number]
  vignette: number
  timeScale: number
  cutoff: number
}

const OPEN = 20000

/** Waits for the probe to be in place: the scene mounts it, and it loads separately. */
async function probeReady(page: Page) {
  await expect.poll(() => page.evaluate(() => window.__hitFeedback != null)).toBe(true)
}

/** What has been recorded so far. */
function samples(page: Page): Promise<Sample[]> {
  return page.evaluate(() => (window.__hitFeedback?.samples() ?? []) as Sample[])
}

/**
 * Waits for the hit to have passed entirely: some sample with vignette and, after it, a while of
 * frames already at rest.
 */
async function untilItPasses(page: Page): Promise<Sample[]> {
  await expect
    .poll(
      async () => {
        const list = await samples(page)
        const lastWithHit = list.findLastIndex((m) => m.vignette > 0)
        return lastWithHit >= 0 && list.length - lastWithHit > 10
      },
      { message: 'the hit never got to be seen and fade out', timeout: 60_000 },
    )
    .toBe(true)
  return samples(page)
}

function checkTheWholeHit(list: Sample[]) {
  // The camera, identical in every frame: matrix, position and rotation.
  const first = JSON.stringify(list[0].camera)
  expect(list[0].camera).toHaveLength(16 + 3 + 4)
  for (const m of list) expect(JSON.stringify(m.camera)).toBe(first)

  // The room has moved and has gone back exactly to its place.
  expect(list.some((m) => m.shake.some((v) => v !== 0))).toBe(true)
  const last = list.at(-1)!
  expect(last.shake).toEqual([0, 0, 0])
  // The vignette has gone up and has faded out.
  expect(Math.max(...list.map((m) => m.vignette))).toBeGreaterThan(0)
  expect(last.vignette).toBe(0)
  // The table's clock has slowed down and has gone back to its pace.
  expect(Math.min(...list.map((m) => m.timeScale))).toBeLessThan(1)
  expect(last.timeScale).toBe(1)
  // And the ear has been muffled and unmuffled.
  expect(Math.min(...list.map((m) => m.cutoff))).toBeLessThan(OPEN)
  expect(last.cutoff).toBe(OPEN)
}

test('a hit moves the room, darkens the edges, slows the table and muffles the ear, without touching the camera', async ({ page }) => {
  await openGame(page)
  await playMatch(page, { goals: 5, level: 'Easy' })
  await probeReady(page)

  await page.evaluate(() => {
    window.__hitFeedback!.measure()
    window.__hitFeedback!.hit(1, { x: -1, y: 0, z: 0 })
  })

  checkTheWholeHit(await untilItPasses(page))
})

test('the goal against triggers the hit, a weak one', async ({ page }) => {
  await openGame(page)
  await probeReady(page)
  await page.evaluate(() => window.__hitFeedback!.measure())
  // With the mallet still, on Impossible the machine scores in a few seconds.
  await playMatch(page, { goals: 5, level: 'Impossible' })

  const list = await untilItPasses(page)
  checkTheWholeHit(list)
  // Weak: nobody has touched you. At full strength the vignette would reach 0.9.
  expect(Math.max(...list.map((m) => m.vignette))).toBeLessThan(0.7)
})

test('with comfort turned off, the hit does nothing', async ({ page }) => {
  await openGame(page)
  // It is chosen the way anyone would choose it: in the menu's row, behind «More options», which
  // the challenge does not offer (it is a fixed match).
  await page.getByRole('button', { name: 'Practice', exact: true }).click()
  await page.getByRole('button', { name: 'More options', exact: true }).click()
  await page.getByRole('button', { name: 'Off', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Off', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await playMatch(page, { goals: 5, level: 'Easy' })
  await probeReady(page)

  await page.evaluate(() => {
    window.__hitFeedback!.measure()
    window.__hitFeedback!.hit(1, { x: -1, y: 0, z: 0 })
  })
  // A while of frames: what a whole hit lasts and a bit more.
  await page.waitForTimeout(1_200)
  const list = await samples(page)
  expect(list.length).toBeGreaterThan(5)
  for (const m of list) {
    expect(m.vignette).toBe(0)
    expect(m.shake).toEqual([0, 0, 0])
    expect(m.timeScale).toBe(1)
    expect(m.cutoff).toBe(OPEN)
  }
})

test('the screenshot: the vignette at its peak, darker on the side of the hit', async ({ page }) => {
  const screenshotPath = process.env.HIT_SCREENSHOT
  test.skip(screenshotPath == null, 'only when the screenshot is asked for (HIT_SCREENSHOT=path.png)')
  await openGame(page)
  await playMatch(page, { goals: 5, level: 'Easy' })
  await probeReady(page)
  await page.evaluate(() => {
    window.__hitFeedback!.hit(1, { x: -1, y: 0, z: 0 })
    // The vignette's peak: at the end of its attack.
    window.__hitFeedback!.pinAge(0.06)
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: screenshotPath! })
})
