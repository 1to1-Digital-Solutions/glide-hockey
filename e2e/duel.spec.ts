import { expect, test } from '@playwright/test'
import { openGame } from './helpers'

/**
 * El duelo por turnos, de principio a fin.
 *
 * Las reglas —de quién es el turno, la misma semilla para los dos, quién gana— están probadas sin
 * navegador en `lib/duel.ts` y `lib/gameStore.ts`. Lo que se comprueba aquí es lo que solo pasa en
 * la página: que el marcador diga de quién es la partida, que al acabar la primera se pida pasar el
 * mando y un botón empiece la del otro, y que al final se sepa quién gana y quede apuntado.
 *
 * Se juega **sin tocar el mazo**, como el resto de partidas de navegador: con el jugador quieto la
 * máquina marca sus siete (el duelo va preconfigurado, Media y a 7). Los dos pierden, y el test
 * acepta empate o ganador: lo que se vigila es el recorrido, no el resultado.
 */

test('el duelo va preconfigurado: ni nivel, ni goles, ni sin fin', async ({ page }) => {
  await openGame(page)
  await page.getByRole('button', { name: 'Duel', exact: true }).click()

  await expect(page.getByText('whoever beats it by more wins')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Impossible', exact: true })).toHaveCount(0)
  await expect(page.locator('#goal-target')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Endless', exact: true })).toHaveCount(0)
})

test('juega uno, se pasa el mando, juega el otro y se sabe quién gana', async ({ page }) => {
  test.setTimeout(420_000)
  await openGame(page)
  await page.getByRole('button', { name: 'Duel', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  // El marcador de la izquierda es de quien tiene el mando, no «Tú».
  await expect(page.getByText('Player 1', { exact: true })).toBeVisible()
  await expect(page.getByText(/Medium · to 7 goals/)).toBeVisible()

  await expect(page.getByRole('heading', { name: /^Player 1: \d+–\d+$/ })).toBeVisible({ timeout: 180_000 })
  await expect(page.getByText('Pass the controller to Player 2.')).toBeVisible()

  await page.getByRole('button', { name: 'Player 2 to play', exact: true }).click()
  await expect(page.getByText('Player 2', { exact: true })).toBeVisible()

  await expect(page.getByRole('heading', { name: /^(Player [12] wins|Tie)$/ })).toBeVisible({ timeout: 180_000 })
  await expect(page.getByText(/^Player 1: \d+–\d+ \((\+|−)?\d+\)$/)).toBeVisible()
  await expect(page.getByText(/^Player 2: \d+–\d+ \((\+|−)?\d+\)$/)).toBeVisible()
  // Lo apuntado entre los dos: un duelo, ganado por uno o empatado.
  await expect(page.getByText(/^Duels won: (1–0 · tied: 0|0–1 · tied: 0|0–0 · tied: 1)$/)).toBeVisible()

  // Otro duelo lo vuelve a empezar el primero.
  await page.getByRole('button', { name: 'New duel', exact: true }).click()
  await expect(page.getByText('Player 1', { exact: true })).toBeVisible()
})
