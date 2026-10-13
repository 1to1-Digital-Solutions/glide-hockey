import { expect, test } from '@playwright/test'

/**
 * The arcade's language reaches all the way inside the cabinet.
 *
 * There is no language selector here: it is chosen once on xrcade's front page and travels in
 * a cookie (see `lib/settings.ts`, the same file in the thirteen repos). What is checked is
 * the whole chain —cookie, server, hydration— because each piece can be fine on its own and
 * still not arrive: the `<html lang>` comes from the server, and what is read on screen is
 * painted by the browser.
 *
 * The rest of the tests run **without** a cookie, which is how the game is served by default:
 * in English. That is why they do not need touching when translating.
 */
test.describe('The language that comes from the arcade', () => {
  test('without a cookie, the game is in English', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Glide Hockey' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
    expect(await page.locator('html').getAttribute('lang')).toBe('en')

    // And the metadata: it is what the tab says and what is read when sharing the link, and
    // it comes from the server like the `lang`.
    expect(await page.locator('meta[name="description"]').getAttribute('content')).toContain(
      'browser',
    )
  })

  test('with the cookie in Spanish, the game speaks Spanish', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'xrcade_lang', value: 'es', url: baseURL! }])

    await page.goto('/')

    // The document's language comes from the server: if it were corrected on hydrating, React
    // would see two different trees and the player would see the change.
    expect(await page.locator('html').getAttribute('lang')).toBe('es')

    // The metadata comes from the server just like the `lang`: without it, the tab and what is
    // read when sharing the link would stay in English without anybody noticing.
    expect(await page.locator('meta[name="description"]').getAttribute('content')).toContain(
      'navegador',
    )
    // The name is not translated: it is the product's, and it has to read the same in the
    // hall's cabinet, in the tab and on the store page.
    await expect(page.getByRole('heading', { name: 'Glide Hockey' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Jugar', exact: true })).toBeVisible()
    await expect(page.getByText('Modo de juego')).toBeVisible()
    await expect(page.getByText('Tú contra la máquina', { exact: false })).toBeVisible()
  })

  test('a cookie with a language that does not exist does not leave the game untranslated', async ({
    page,
    context,
    baseURL,
  }) => {
    // The cookie is external input: anyone can edit it from the browser's tools, and what is
    // not understood falls back to the starting language.
    await context.addCookies([{ name: 'xrcade_lang', value: 'klingon', url: baseURL! }])

    await page.goto('/')

    expect(await page.locator('html').getAttribute('lang')).toBe('en')

    // And the metadata: it is what the tab says and what is read when sharing the link, and
    // it comes from the server like the `lang`.
    expect(await page.locator('meta[name="description"]').getAttribute('content')).toContain(
      'browser',
    )
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  })
})
