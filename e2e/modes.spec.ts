import { expect, test } from '@playwright/test'
import { openGame, playMatch } from './helpers'

/**
 * The new modes from outside the canvas: the endless match does not end by
 * goals and «Terminar» closes it; Levels starts with the first one with the
 * rest padlocked. Winning a level is covered by the store's unit tests: from
 * outside a goal cannot be scored without depending on the steadiness of the mouse.
 */
test('endless: the machine scores and the match goes on until it is ended', async ({ page }) => {
  await openGame(page)
  await playMatch(page, { goals: 3, level: 'Impossible', endless: true })

  await expect(page.getByText('endless')).toBeVisible()
  // The machine scores three times —what would be the whole match— and nothing happens.
  await expect(page.getByText('3', { exact: true }).first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Again' })).toBeHidden()

  await page.getByRole('button', { name: 'End run', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Again' })).toBeVisible()
})

test('levels: one starts with the first and the rest are padlocked', async ({ page }) => {
  await openGame(page)
  await page.getByRole('button', { name: 'Levels' }).click()

  await expect(page.getByRole('button', { name: /^Level 1,/ })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Level 2, locked' })).toBeDisabled()
  // The machine's level and the goals are set by the ladder: they are not even offered.
  await expect(page.getByLabel(/^Goals/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Impossible' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByText(/Levels · level 1/)).toBeVisible()
})
