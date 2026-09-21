import { expect, test } from '@playwright/test'
import { ASSETS_BASE, isAtSiteRoot, openHost } from './support/host'
import { installXREmulator } from './support/xr'

/**
 * El juego montado como lo monta el salón: dentro de un Canvas ajeno, con una
 * sesión que no es suya y sus ficheros bajo el prefijo del anfitrión.
 *
 * `scripts/scene-contract.test.ts` lee el código y comprueba que desde
 * `<GlideHockeyScene>` no se alcanza un Canvas, un XR ni DOM; esto es lo que
 * demuestra que la escena funciona de verdad montada en el Canvas de otro, y
 * que montarla y jugar no toca la sesión del anfitrión —que es lo que permite
 * pasar del juego al salón sin quitarse el visor—.
 */
test.describe('Montado dentro de otro anfitrión', () => {
  test('la escena se monta dentro del Canvas ajeno sin ensuciar la consola', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))

    await openHost(page)
    await page.waitForTimeout(2_000)

    // Un fallo de la escena no se ve desde fuera: `<GlideHockeyScene>` no pinta
    // DOM y el Canvas se queda igual de negro. Lo que lo dice es la consola, y
    // aquí manda la misma política de seguridad que en el salón.
    expect(errors).toEqual([])
  })

  test('el mando encuentra su perfil bajo el prefijo del anfitrión', async ({ page }) => {
    await installXREmulator(page)
    const host = await openHost(page)

    // La sesión y el store son del anfitrión, así que entrar al visor también.
    // Se reintenta porque el store no acepta la sesión hasta que el Canvas lo ha
    // conectado con three, un poco después del primer fotograma.
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.__glideHockeyHost.enterVR().then(
              () => true,
              () => false,
            ),
          ),
        { message: 'el anfitrión no pudo abrir la sesión inmersiva' },
      )
      .toBe(true)
    await page.evaluate(() => window.__xrTest.connectControllers())

    // Registrar un mando es leer su perfil; es lo que el contrato pide cablear
    // al anfitrión (`baseAssetPath`) y lo único que este juego sirve como
    // estático. Nada se pide desde la raíz, donde el salón no tiene nada.
    await expect
      .poll(() => host.requested.filter((p) => p.startsWith(`${ASSETS_BASE}webxr-profiles/`)), {
        message: 'el perfil del mando no se pidió bajo el prefijo del anfitrión',
      })
      .not.toEqual([])
    expect(host.requested.filter(isAtSiteRoot)).toEqual([])
    expect(await page.evaluate(() => window.__xrTest.hasSession())).toBe(true)
  })
})
