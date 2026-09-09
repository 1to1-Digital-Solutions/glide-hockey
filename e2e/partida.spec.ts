import { expect, test } from '@playwright/test'
import { abrirJuego, jugarPartida } from './helpers'

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
  await abrirJuego(page)
  await jugarPartida(page, { goles: 3, nivel: 'Impossible' })

  // A tres goles y con el mazo parado, la máquina llega antes.
  await expect(
    page.getByRole('heading', { name: 'Game lost' }),
  ).toBeVisible()

  await expect(page.getByText('Conceded')).toBeVisible()
  // El resumen enseña el marcador con el que se acabó.
  await expect(page.getByText('Final score: 0–3.')).toBeVisible()
})

test('desde el resumen se vuelve al menú', async ({ page }) => {
  await abrirJuego(page)
  await jugarPartida(page, { goles: 3, nivel: 'Impossible' })

  await expect(
    page.getByRole('heading', { name: 'Game lost' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Back to the menu' }).click()

  await expect(page.getByRole('heading', { name: 'Air Hockey' })).toBeVisible()
})

test('dejar la partida devuelve al menú sin esperar al final', async ({
  page,
}) => {
  await abrirJuego(page)
  await jugarPartida(page, { goles: 15, nivel: 'Easy' })

  await page.getByRole('button', { name: 'Leave the game' }).click()

  await expect(page.getByRole('heading', { name: 'Air Hockey' })).toBeVisible()
})

test('el reto no deja elegir nivel ni goles', async ({ page }) => {
  await abrirJuego(page)
  await page.getByRole('button', { name: 'Challenge' }).click()

  await expect(page.getByLabel(/^Goals/)).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Impossible' })).toBeDisabled()
})
