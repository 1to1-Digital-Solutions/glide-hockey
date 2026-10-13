import { expect, test } from '@playwright/test'
import { openGame, playMatch } from './helpers'

/**
 * Una partida de verdad, de principio a fin.
 *
 * Es lo único que comprueba las piezas juntas: la física, la máquina, el estado
 * y el marcador. Cada una tiene sus tests unitarios, pero que el disco entre en
 * una portería y eso suba el marcador de la pantalla no lo demuestra ninguno.
 *
 * Se juega **sin tocar el mazo**: con el jugador quieto, la máquina acaba
 * marcando, y ahí se ve el recorrido entero sin depender de la puntería de un
 * test. En Imposible, además, tarda unos segundos en vez de un minuto.
 */
test('la máquina marca y la partida termina', async ({ page }) => {
  await openGame(page)
  await playMatch(page, { goles: 3, nivel: 'Impossible' })

  // A tres goles y con el mazo parado, la máquina llega antes.
  await expect(
    page.getByRole('heading', { name: 'Game lost' }),
  ).toBeVisible()

  await expect(page.getByText('Conceded')).toBeVisible()
  // El resumen enseña el marcador con el que se acabó.
  await expect(page.getByText('Final score: 0–3.')).toBeVisible()
})

test('desde el resumen se vuelve al menú', async ({ page }) => {
  await openGame(page)
  await playMatch(page, { goles: 3, nivel: 'Impossible' })

  await expect(
    page.getByRole('heading', { name: 'Game lost' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Back to the menu' }).click()

  await expect(page.getByRole('heading', { name: 'Glide Hockey' })).toBeVisible()
})

test('dejar la partida devuelve al menú sin esperar al final', async ({
  page,
}) => {
  await openGame(page)
  await playMatch(page, { goles: 15, nivel: 'Easy' })

  // Pregunta antes: el botón se pulsa sin querer y salir pierde los goles.
  await page.getByRole('button', { name: 'Leave the game' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: 'Leave', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Glide Hockey' })).toBeVisible()
})

test('el menú abre en el reto: no pregunta nivel ni goles, y Jugar sin tocar nada lo empieza', async ({ page }) => {
  await openGame(page)

  await expect(page.getByRole('button', { name: 'Challenge' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Counts for a medal.', { exact: false })).toBeVisible()
  await expect(page.getByLabel(/^Goals/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Impossible' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Play', exact: true }).click()

  await expect(page.getByText(/Challenge · round 1/)).toBeVisible()
  // El objetivo, dicho de frente desde el primer segundo: la misión, y después lo que se lleva
  // y lo que queda. Sin salón no hay listones: la marca a batir es el récord de aquí.
  const objetivo = page.locator('[data-objetivo]')
  await expect(objetivo).toHaveText(/^Win games until you lose one/)
  await expect(objetivo).toHaveText(/Round 1 · to 3 goals · goal \+100/, { timeout: 30_000 })
})

test('la práctica sigue a un toque, y ahí no hay objetivo que colgar', async ({ page }) => {
  await openGame(page)
  await page.getByRole('button', { name: 'Practice', exact: true }).click()

  await expect(page.getByText('Does not count for a medal.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  await expect(page.getByText('Machine')).toBeVisible()
  await expect(page.locator('[data-objetivo]')).toHaveCount(0)
})
