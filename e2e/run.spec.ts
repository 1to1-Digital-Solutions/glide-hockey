import { expect, test } from '@playwright/test'
import { openGame, playMatch } from './helpers'

/**
 * A real match, from start to finish.
 *
 * It is the only thing that checks the pieces together: the physics, the
 * machine, the state and the scoreboard. Each one has its unit tests, but that
 * the puck goes into a goal and that raises the scoreboard on screen is proven
 * by none of them.
 *
 * It is played **without touching the mallet**: with the player still, the
 * machine ends up scoring, and there the whole journey is seen without
 * depending on a test's aim. On Impossible, besides, it takes a few seconds
 * instead of a minute.
 */
test('the machine scores and the match ends', async ({ page }) => {
  await openGame(page)
  await playMatch(page, { goals: 3, level: 'Impossible' })

  // To three goals and with the mallet standing still, the machine gets there first.
  await expect(
    page.getByRole('heading', { name: 'Game lost' }),
  ).toBeVisible()

  await expect(page.getByText('Conceded')).toBeVisible()
  // The summary shows the score it ended with.
  await expect(page.getByText('Final score: 0–3.')).toBeVisible()
})

test('from the summary one goes back to the menu', async ({ page }) => {
  await openGame(page)
  await playMatch(page, { goals: 3, level: 'Impossible' })

  await expect(
    page.getByRole('heading', { name: 'Game lost' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Back to the menu' }).click()

  await expect(page.getByRole('heading', { name: 'Glide Hockey' })).toBeVisible()
})

test('leaving the match goes back to the menu without waiting for the end', async ({
  page,
}) => {
  await openGame(page)
  await playMatch(page, { goals: 15, level: 'Easy' })

  // It asks first: the button gets pressed by accident and leaving loses the goals.
  await page.getByRole('button', { name: 'Leave the game' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: 'Leave', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Glide Hockey' })).toBeVisible()
})

test('the menu opens on the challenge: it asks for no level or goals, and Play without touching anything starts it', async ({ page }) => {
  await openGame(page)

  await expect(page.getByRole('button', { name: 'Challenge' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Counts for a medal.', { exact: false })).toBeVisible()
  await expect(page.getByLabel(/^Goals/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Impossible' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Play', exact: true }).click()

  await expect(page.getByText(/Challenge · round 1/)).toBeVisible()
  // The goal, said up front from the first second: the mission, and then what has been earned
  // and what is left. Without a hall there are no thresholds: the mark to beat is the record here.
  const goal = page.locator('[data-goal]')
  await expect(goal).toHaveText(/^Win games until you lose one/)
  await expect(goal).toHaveText(/Round 1 · to 3 goals · goal \+100/, { timeout: 30_000 })
})

test('practice is still one tap away, and there is no goal to hang there', async ({ page }) => {
  await openGame(page)
  await page.getByRole('button', { name: 'Practice', exact: true }).click()

  await expect(page.getByText('Does not count for a medal.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  await expect(page.getByText('Machine')).toBeVisible()
  await expect(page.locator('[data-goal]')).toHaveCount(0)
})
