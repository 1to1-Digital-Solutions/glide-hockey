import { expect, test } from '@playwright/test'
import { observarLaMesa } from './helpers'
import { ASSETS_BASE, enterHostBooth, isAtSiteRoot, openHost } from './support/host'
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

  test('con un reto, la escena montada dentro de la sesión entra jugando y avisa al acabar', async ({ page }) => {
    // Como en el salón: se entra en la sesión y después se elige cabina. La escena nace dentro de
    // una sesión abierta, y eso no puede tomarse como «se entró al visor con una partida de
    // escritorio a medias», que la descartaría y dejaría el reto en el menú.
    test.setTimeout(120_000)
    await observarLaMesa(page)
    await installXREmulator(page)
    await openHost(page, { aLaCarta: true, reto: 20260925 })
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
    await enterHostBooth(page)

    // Sin tocar «jugar»: la mesa se pone sola, que es lo que dice que hay partida.
    await expect
      .poll(() => page.evaluate(() => window.__glideHockeyScene != null), {
        timeout: 15_000,
        message: 'el reto no llegó a poner la mesa',
      })
      .toBe(true)

    // El saque espera al mazo en la mano: se coge, y se aparta a una banda para que la máquina
    // marque sola. Sin tutorial, que en el reto no se da: aquí está pendiente (no se ha visto
    // nunca) y, si saliera, los goles de la máquina no contarían y el reto no acabaría.
    await page.evaluate(() => {
      window.__xrTest.placeController('right', 0, 0.95, -0.48)
      window.__xrTest.squeeze('right', true)
    })
    await page.waitForTimeout(600)
    await page.evaluate(() => window.__xrTest.placeController('right', 0.32, 0.95, -0.4))

    // La máquina gana la primera ronda y el reto se acaba: un aviso, del reto.
    await expect
      .poll(() => page.evaluate(() => window.__terminadas.map(({ modo, puntos, reto }) => ({ modo, puntos, reto }))), {
        timeout: 90_000,
        message: 'la escena no avisó del final del reto',
      })
      .toEqual([{ modo: 'challenge', puntos: 0, reto: true }])
    // El mazo aparcado en la banda puede desviar un tiro de la máquina a su propia portería: es
    // la hazaña oculta, y es la única que esta partida puede dar (`lib/hazanas.ts`).
    const [aviso] = await page.evaluate(() => window.__terminadas)
    expect([undefined, ['GH_OWN_GOAL']]).toContainEqual(aviso?.hazanas)
  })
})
