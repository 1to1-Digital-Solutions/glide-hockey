import { expect, test } from '@playwright/test'
import { openGame, playMatch } from './helpers'

/**
 * Los modos nuevos desde fuera del lienzo: la partida sin fin no se acaba por
 * goles y la cierra «Terminar»; Niveles empieza por el primero con el resto
 * con candado. Ganar un nivel lo cubren los unitarios del store: desde fuera no
 * se puede meter un gol sin depender del pulso del ratón.
 */
test('sin fin: la máquina marca y la partida sigue hasta que se termina', async ({ page }) => {
  await openGame(page)
  await playMatch(page, { goles: 3, nivel: 'Impossible', sinFin: true })

  await expect(page.getByText('endless')).toBeVisible()
  // La máquina marca tres veces —lo que sería la partida entera— y no pasa nada.
  await expect(page.getByText('3', { exact: true }).first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Again' })).toBeHidden()

  await page.getByRole('button', { name: 'End run', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Again' })).toBeVisible()
})

test('niveles: se empieza por el primero y el resto tiene candado', async ({ page }) => {
  await openGame(page)
  await page.getByRole('button', { name: 'Levels' }).click()

  await expect(page.getByRole('button', { name: /^Level 1,/ })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Level 2, locked' })).toBeDisabled()
  // El nivel de la máquina y los goles los manda la escalera: ni se ofrecen.
  await expect(page.getByLabel(/^Goals/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Impossible' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByText(/Levels · level 1/)).toBeVisible()
})
