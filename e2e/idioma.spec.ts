import { expect, test } from '@playwright/test'

/**
 * El idioma del arcade llega hasta dentro de la cabina.
 *
 * No hay selector de idioma aquí: se elige una vez en la portada de xrcade y viaja en una
 * cookie (ver `lib/ajustes.ts`, el mismo fichero en los trece repos). Lo que se comprueba
 * es la cadena entera —cookie, servidor, hidratación— porque cada trozo puede estar bien
 * por su cuenta y aun así no llegar: el `<html lang>` sale del servidor, y lo que se lee
 * en pantalla lo pinta el navegador.
 *
 * El resto de los tests corren **sin** cookie, que es como se sirve el juego por defecto:
 * en inglés. Por eso no hace falta tocarlos al traducir.
 */
test.describe('El idioma que viene del arcade', () => {
  test('sin cookie, el juego está en inglés', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Air Hockey' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
    expect(await page.locator('html').getAttribute('lang')).toBe('en')
  })

  test('con la cookie en español, el juego habla español', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'xrcade_lang', value: 'es', url: baseURL! }])

    await page.goto('/')

    // El idioma del documento sale del servidor: si se corrigiera al hidratar, React
    // vería dos árboles distintos y el jugador vería el cambio.
    expect(await page.locator('html').getAttribute('lang')).toBe('es')
    await expect(page.getByRole('button', { name: 'Jugar', exact: true })).toBeVisible()
    await expect(page.getByText('Modo de juego')).toBeVisible()
    await expect(page.getByText('Tú contra la máquina', { exact: false })).toBeVisible()
  })

  test('una cookie con un idioma que no existe no deja el juego sin traducir', async ({
    page,
    context,
    baseURL,
  }) => {
    // La cookie es entrada externa: cualquiera puede editarla desde las herramientas del
    // navegador, y lo que no se entiende cae al idioma de partida.
    await context.addCookies([{ name: 'xrcade_lang', value: 'klingon', url: baseURL! }])

    await page.goto('/')

    expect(await page.locator('html').getAttribute('lang')).toBe('en')
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  })
})
