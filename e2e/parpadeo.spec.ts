import { expect, test } from '@playwright/test'
import { installXREmulator, enterVR } from './support/xr'

/**
 * El parpadeo al entrar, convertido en un número.
 *
 * Es lo que más se ha reportado del visor y lo que nunca se ha podido ver desde una pantalla.
 * Se quitó una causa posible —la demostración repintando el árbol entero— y en dos juegos
 * desapareció; en este siguió. Adivinar la siguiente cuesta otra tanda con las gafas puestas.
 *
 * Aquí no se mira: se cuenta. Si al abrir la sesión el mundo se monta **dos veces**, eso es
 * el parpadeo —React tira el árbol y lo reconstruye—, y sale en este número. Si se monta una
 * sola vez, el parpadeo no es un remontaje y hay que buscarlo en otro sitio, que también es
 * saber algo: sin esto, esa pregunta no se podía ni hacer.
 */

/** Cuántas veces se ha montado cada trozo, según `lib/montajes.ts`. */
async function montajes(page: import('@playwright/test').Page) {
  return page.evaluate(() => window.__montajes ?? {})
}

/** Cuántos programas de shader lleva compilados el renderer. */
async function programas(page: import('@playwright/test').Page) {
  return page.evaluate(() => window.__programas ?? 0)
}

test('el mundo se monta una sola vez al abrir la página', async ({ page }) => {
  await page.addInitScript(() => {
    window.__montajes = {}
  })
  await page.goto('/')
  await expect.poll(async () => (await montajes(page)).mundo ?? 0).toBeGreaterThan(0)

  expect((await montajes(page)).mundo, 'el mundo se montó más de una vez').toBe(1)
})

test('y entrar en el visor no lo vuelve a montar', async ({ page }) => {
  await page.addInitScript(() => {
    window.__montajes = {}
  })
  await installXREmulator(page)
  await page.goto('/')
  await expect.poll(async () => (await montajes(page)).mundo ?? 0).toBeGreaterThan(0)

  await enterVR(page)
  await page.waitForTimeout(1500)

  expect(
    (await montajes(page)).mundo,
    'entrar en la sesión remonta el mundo: eso es el parpadeo',
  ).toBe(1)
})

test('y no deja shaders sin compilar para el primer fotograma de la sesión', async ({ page }) => {
  // La otra mitad del parpadeo, y la que sí dio algo: al abrir la sesión se compilaban tres
  // programas nuevos —los materiales que solo existen dentro del visor—, y compilar bloquea
  // el hilo. `Calentar` los compila con `compileAsync` en cuanto la sesión arranca; lo que se
  // vigila aquí es que **al cabo de un momento ya no queden nuevos**, es decir, que no se
  // sigan compilando a medida que se pinta.
  await page.addInitScript(() => {
    window.__montajes = {}
  })
  await installXREmulator(page)
  await page.goto('/')
  await expect.poll(() => programas(page)).toBeGreaterThan(0)

  await enterVR(page)
  await page.waitForTimeout(2000)
  const alEntrar = await programas(page)

  // Y a partir de aquí, ninguno más: si el número sigue subiendo mientras se juega, hay
  // materiales que se compilan tarde y cada uno es un tirón.
  await page.waitForTimeout(3000)
  expect(await programas(page), 'se siguen compilando shaders con la sesión abierta').toBe(
    alEntrar,
  )
})
