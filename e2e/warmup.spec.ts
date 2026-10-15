import { expect, test } from '@playwright/test'
import { openGame, watchTable } from './helpers'
import { TUTORIAL_SEEN_KEY } from '../src/lib/tutorial'
import { enterVR, installXREmulator } from './support/xr'

/**
 * Learning by playing the challenge costs nothing: **with the tutorial pending, the machine's
 * goals do not count**.
 *
 * The challenge is what the menu opens on, and whoever is new to the game plays it while the
 * tutorial asks them to pick up the mallet, push the puck and score. On Easy and to three goals,
 * the machine won the round —and the whole challenge— before anybody had scored their first
 * goal. Here one goes in with the tutorial unseen, picks up the mallet and concedes three: they
 * go into the table (`goalsAgainst`), but the scoreboard stays at zero, the match stays alive
 * and the tutorial, unfinished.
 */
test('with the tutorial pending, three goals against leave the challenge intact', async ({ page }) => {
  test.setTimeout(180_000)
  await installXREmulator(page)
  await watchTable(page)
  await openGame(page)
  await enterVR(page)

  // The menu opens on the challenge: it is played as is, without touching the mode.
  await expect(page.getByRole('button', { name: 'Challenge', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const play = page.getByRole('button', { name: 'Play', exact: true })
  for (let attempt = 0; attempt < 8 && (await play.count()) > 0; attempt += 1) {
    await play.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
  }
  await expect(play).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.__glideHockeyScene != null), { timeout: 20_000 }).toBe(true)

  // The serve waits for the mallet in the hand: it is picked up.
  await page.evaluate(() => {
    window.__xrTest.placeController('right', 0, 0.95, -0.48)
    window.__xrTest.squeeze('right', true)
  })
  await page.waitForTimeout(600)

  // Three of the big mistakes: three own goals. With the puck in the own half, the hand is put
  // between the puck and midfield and pushes it toward the goal of whoever plays (the machine,
  // on Easy, can take minutes to score on its own). The hand goes 1.25 m ahead of where the
  // mallet ends up on the table.
  const toTheTable = 1.25
  const hand = (x: number, z: number) =>
    page.evaluate(({ x, z }) => window.__xrTest.placeController('right', x, 0.95, z), { x, z: z - toTheTable })
  const goalsAgainst = () => page.evaluate(() => window.__glideHockeyScene?.goalsAgainst ?? 0)
  const deadline = Date.now() + 150_000
  while ((await goalsAgainst()) < 3 && Date.now() < deadline) {
    // Parked in the corner of the rail, right next to the own goal: from there the puck cannot be
    // hit toward the other one.
    await hand(0.5, 0.95)
    await page.waitForTimeout(500)
    // Only with the puck almost stopped in the own half: if it is coming or going, the mallet on
    // its way could send it back toward the other one and score, and that would close the tutorial.
    const puck = await page.evaluate(() => window.__glideHockeyScene?.puck ?? null)
    await page.waitForTimeout(200)
    const later = await page.evaluate(() => window.__glideHockeyScene?.puck ?? null)
    if (puck == null || later == null || Math.hypot(later.x - puck.x, later.z - puck.z) > 0.03) continue
    if (puck.z < 0.12) continue
    // Around the outside of the puck until getting between it and midfield, and from there to the own goal.
    await hand(0.5, puck.z - 0.2)
    await page.waitForTimeout(350)
    await hand(puck.x, puck.z - 0.18)
    await page.waitForTimeout(300)
    await hand(puck.x * 0.2, 0.99)
    await page.waitForTimeout(600)
  }
  expect(await goalsAgainst(), 'the three own goals did not go in').toBeGreaterThanOrEqual(3)

  // None counted: the scoreboard at zero and the match alive.
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'Machine' })).toHaveText(/Machine\s*0$/)
  await expect(page.getByText('Game over')).toHaveCount(0)
  await expect(play).toHaveCount(0)
  expect(await page.evaluate((key) => window.localStorage.getItem(key), TUTORIAL_SEEN_KEY)).toBeNull()
})
