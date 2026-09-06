import { expect, test } from '@playwright/test'
import { abrirJuego, jugarPartida } from './helpers'

/**
 * Los modos nuevos desde fuera del lienzo: la partida sin fin no se acaba por
 * goles y la cierra «Terminar»; Niveles empieza por el primero con el resto
 * con candado. Ganar un nivel lo cubren los unitarios del store: desde fuera no
 * se puede meter un gol sin depender del pulso del ratón.
 */
test('sin fin: la máquina marca y la partida sigue hasta que se termina', async ({ page }) => {
  await abrirJuego(page)
  await jugarPartida(page, { goles: 3, nivel: 'Imposible', sinFin: true })

  await expect(page.getByText('sin fin')).toBeVisible()
  // La máquina marca tres veces —lo que sería la partida entera— y no pasa nada.
  await expect(page.getByText('3', { exact: true }).first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Otra vez' })).toBeHidden()

  await page.getByRole('button', { name: 'Terminar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Partida terminada' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Otra vez' })).toBeVisible()
})

test('niveles: se empieza por el primero y el resto tiene candado', async ({ page }) => {
  await abrirJuego(page)
  await page.getByRole('button', { name: 'Niveles' }).click()

  await expect(page.getByRole('button', { name: /^Nivel 1,/ })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Nivel 2, bloqueado' })).toBeDisabled()
  // El nivel y los goles los manda la escalera.
  await expect(page.getByLabel(/^Goles/)).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Imposible' })).toBeDisabled()

  await page.getByRole('button', { name: 'Jugar' }).click()
  await expect(page.getByText(/Niveles · nivel 1/)).toBeVisible()
})
