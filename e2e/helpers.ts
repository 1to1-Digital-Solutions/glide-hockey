import { expect, type Page } from '@playwright/test'

/**
 * Lo que comparten los tests de navegador: llegar al menú y empezar una
 * partida como lo haría alguien con el ratón.
 */

/** Abre el juego y espera a que la mesa esté montada. */
export async function abrirJuego(page: Page): Promise<void> {
  await page.goto('/')
  // El Canvas se carga aparte y solo en cliente: hasta que aparece, lo que hay
  // es la pantalla de carga.
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Air Hockey' })).toBeVisible()
}

/**
 * Empieza una partida de prueba con el nivel y los goles que se pidan.
 *
 * El nivel importa para lo que tarda un test en resolverse: con el mazo del
 * jugador parado, la máquina marca cada pocos segundos en Imposible y cada
 * quince en Fácil.
 */
export async function jugarPartida(
  page: Page,
  { goles, nivel }: { goles: number; nivel: string },
): Promise<void> {
  await page.getByRole('button', { name: nivel }).click()
  await page.getByLabel(/^Goles/).fill(String(goles))
  await page.getByRole('button', { name: 'Jugar' }).click()

  // La cuenta atrás va antes del saque; el marcador ya está en pantalla.
  await expect(page.getByText('Máquina')).toBeVisible()
}
