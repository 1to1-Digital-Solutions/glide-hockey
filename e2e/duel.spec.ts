import { expect, test } from '@playwright/test'
import { openGame } from './helpers'

/**
 * The turn-based duel, from start to finish.
 *
 * The rules —whose turn it is, the same seed for both, who wins— are tested without a browser in
 * `lib/duel.ts` and `lib/gameStore.ts`. What is checked here is what only happens on the page:
 * that the scoreboard says whose match it is, that when the first one ends it asks to pass the
 * controller and a button starts the other's, and that at the end it is known who wins and it
 * stays recorded.
 *
 * It is played **without touching the mallet**, like the rest of the browser matches: with the
 * player still the machine scores its seven (the duel comes preconfigured, Medium and to 7). Both
 * lose, and the test accepts a tie or a winner: what is watched is the journey, not the result.
 */

test('the duel comes preconfigured: no level, no goals, no endless', async ({ page }) => {
  await openGame(page)
  await page.getByRole('button', { name: 'Duel', exact: true }).click()

  await expect(page.getByText('whoever beats it by more wins')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Impossible', exact: true })).toHaveCount(0)
  await expect(page.locator('#goal-target')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Endless', exact: true })).toHaveCount(0)
})

test('one plays, the controller is passed, the other plays and it is known who wins', async ({ page }) => {
  test.setTimeout(420_000)
  await openGame(page)
  await page.getByRole('button', { name: 'Duel', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  // The scoreboard on the left belongs to whoever holds the controller, not «Tú».
  await expect(page.getByText('Player 1', { exact: true })).toBeVisible()
  await expect(page.getByText(/Medium · to 7 goals/)).toBeVisible()

  await expect(page.getByRole('heading', { name: /^Player 1: \d+–\d+$/ })).toBeVisible({ timeout: 180_000 })
  await expect(page.getByText('Pass the controller to Player 2.')).toBeVisible()

  await page.getByRole('button', { name: 'Player 2 to play', exact: true }).click()
  await expect(page.getByText('Player 2', { exact: true })).toBeVisible()

  await expect(page.getByRole('heading', { name: /^(Player [12] wins|Tie)$/ })).toBeVisible({ timeout: 180_000 })
  await expect(page.getByText(/^Player 1: \d+–\d+ \((\+|−)?\d+\)$/)).toBeVisible()
  await expect(page.getByText(/^Player 2: \d+–\d+ \((\+|−)?\d+\)$/)).toBeVisible()
  // What is recorded between the two: one duel, won by one of them or tied.
  await expect(page.getByText(/^Duels won: (1–0 · tied: 0|0–1 · tied: 0|0–0 · tied: 1)$/)).toBeVisible()

  // Another duel is started again by the first one.
  await page.getByRole('button', { name: 'New duel', exact: true }).click()
  await expect(page.getByText('Player 1', { exact: true })).toBeVisible()
})
