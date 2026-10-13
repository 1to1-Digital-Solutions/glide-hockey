import { expect, test } from '@playwright/test'
import { abrirJuego, observarLaMesa } from './helpers'
import { TUTORIAL_SEEN_KEY } from '../src/lib/tutorial'
import { enterVR, installXREmulator } from './support/xr'

/**
 * Aprender jugando el reto no cuesta nada: **con el tutorial pendiente, los goles de la máquina
 * no cuentan**.
 *
 * El reto es lo que abre el menú, y quien estrena el juego lo juega mientras el tutorial le pide
 * coger el mazo, empujar el disco y marcar. En Fácil y a tres goles, la máquina ganaba la ronda
 * —y el reto entero— antes de que nadie hubiera marcado su primer gol. Aquí se entra con el
 * tutorial sin ver, se coge el mazo y se encajan tres: entran en la mesa (`goalsAgainst`), pero el
 * marcador sigue a cero, la partida sigue viva y el tutorial, sin acabar.
 */
test('con el tutorial pendiente, tres goles en contra dejan el reto intacto', async ({ page }) => {
  test.setTimeout(180_000)
  await installXREmulator(page)
  await observarLaMesa(page)
  await abrirJuego(page)
  await enterVR(page)

  // El menú abre en el reto: se juega tal cual, sin tocar el modo.
  await expect(page.getByRole('button', { name: 'Challenge', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const jugar = page.getByRole('button', { name: 'Play', exact: true })
  for (let intento = 0; intento < 8 && (await jugar.count()) > 0; intento += 1) {
    await jugar.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
  }
  await expect(jugar).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.__glideHockeyScene != null), { timeout: 20_000 }).toBe(true)

  // El saque espera al mazo en la mano: se coge.
  await page.evaluate(() => {
    window.__xrTest.placeController('right', 0, 0.95, -0.48)
    window.__xrTest.squeeze('right', true)
  })
  await page.waitForTimeout(600)

  // Tres fallos de los gordos: tres goles en propia puerta. Con el disco en la mitad propia, la
  // mano se pone entre el disco y el medio campo y lo empuja hacia la portería de quien juega
  // (la máquina, en Fácil, puede tardar minutos en marcar sola). La mano va 1,25 m por delante
  // de donde queda el mazo en la mesa.
  const aLaMesa = 1.25
  const mano = (x: number, z: number) =>
    page.evaluate(({ x, z }) => window.__xrTest.placeController('right', x, 0.95, z), { x, z: z - aLaMesa })
  const golesEnContra = () => page.evaluate(() => window.__glideHockeyScene?.goalsAgainst ?? 0)
  const limite = Date.now() + 150_000
  while ((await golesEnContra()) < 3 && Date.now() < limite) {
    // Aparcado en la esquina de la banda, pegado a la propia portería: desde ahí no se le da al
    // disco hacia la otra.
    await mano(0.5, 0.95)
    await page.waitForTimeout(500)
    // Solo con el disco casi parado en la mitad propia: si viene o va, el mazo de
    // camino podría devolverlo hacia la otra y marcar, y eso cerraría el tutorial.
    const disco = await page.evaluate(() => window.__glideHockeyScene?.puck ?? null)
    await page.waitForTimeout(200)
    const luego = await page.evaluate(() => window.__glideHockeyScene?.puck ?? null)
    if (disco == null || luego == null || Math.hypot(luego.x - disco.x, luego.z - disco.z) > 0.03) continue
    if (disco.z < 0.12) continue
    // Por fuera del disco hasta ponerse entre él y el medio campo, y de ahí a la propia portería.
    await mano(0.5, disco.z - 0.2)
    await page.waitForTimeout(350)
    await mano(disco.x, disco.z - 0.18)
    await page.waitForTimeout(300)
    await mano(disco.x * 0.2, 0.99)
    await page.waitForTimeout(600)
  }
  expect(await golesEnContra(), 'no entraron los tres goles en propia puerta').toBeGreaterThanOrEqual(3)

  // Ninguno contó: el marcador a cero y la partida viva.
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'Machine' })).toHaveText(/Machine\s*0$/)
  await expect(page.getByText('Game over')).toHaveCount(0)
  await expect(jugar).toHaveCount(0)
  expect(await page.evaluate((clave) => window.localStorage.getItem(clave), TUTORIAL_SEEN_KEY)).toBeNull()
})
