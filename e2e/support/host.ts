import path from 'node:path'
import { expect, type Page } from '@playwright/test'
import type { Objetivo } from '../../src/lib/objetivo'
import { HOST_BUNDLE } from './globalSetup'

/** Donde el salón sirve los estáticos de este juego. */
export const ASSETS_BASE = '/juegos/glide-hockey/'
/** Lo que el anfitrión NO sirve desde la raíz: en el salón, ahí no hay nada. */
const ASSET_ROOTS = ['/webxr-profiles/']
const PAGE_PATH = '/anfitrion-de-prueba'
const BUNDLE_PATH = '/anfitrion-de-prueba.js'
const PUBLIC_DIR = path.join(process.cwd(), 'public')

/** El HTML del anfitrión. */
function html(aLaCarta: boolean, reto?: number, objetivo?: Objetivo): string {
  const cabina = aLaCarta ? ` data-cabina="a-la-carta"` : ''
  const conReto = reto === undefined ? '' : ` data-reto="${reto}"`
  const conObjetivo = objetivo === undefined ? '' : ` data-objetivo='${JSON.stringify(objetivo)}'`
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Anfitrión de prueba</title>
    <style>
      html, body, #juego { height: 100%; margin: 0; }
    </style>
  </head>
  <body>
    <div id="juego" data-assets-base="${ASSETS_BASE}"${cabina}${conReto}${conObjetivo}></div>
    <script src="${BUNDLE_PATH}"></script>
  </body>
</html>
`
}

export interface TestHost {
  /** Las rutas que la página ha pedido, en orden. */
  requested: string[]
}

export function isAtSiteRoot(pathname: string): boolean {
  return ASSET_ROOTS.some((root) => pathname.startsWith(root))
}

export interface HostOptions {
  /**
   * Montar la escena solo cuando se pida (`enterHostBooth`), **como en el salón**: allí se
   * elige cabina con el visor ya puesto, así que la escena nace dentro de una sesión abierta
   * y sin haber pintado nada en la pantalla. Por defecto se monta con la página, que es lo
   * que le vale al resto de la suite.
   */
  aLaCarta?: boolean
  /** La semilla del reto que pasa el salón: la escena entra ya jugándolo (`reto`). */
  reto?: number
  /** Los listones de medalla que pasa el salón, para el cartel del objetivo (`objetivo`). */
  objetivo?: Objetivo
}

/**
 * Sirve una página que monta el juego como lo montaría el salón: bajo su
 * prefijo, con la misma política de seguridad que la web del juego, y con la
 * raíz de estáticos respondiendo 404.
 */
export async function openHost(
  page: Page,
  { aLaCarta = false, reto, objetivo }: HostOptions = {},
): Promise<TestHost> {
  const csp = (await page.request.get('/')).headers()['content-security-policy']
  expect(csp, 'el servidor no devolvió política de seguridad').toBeTruthy()

  const requested: string[] = []
  await page.route('**/*', async (route) => {
    const { pathname } = new URL(route.request().url())
    requested.push(pathname)
    if (pathname === PAGE_PATH) {
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        headers: { 'content-security-policy': csp },
        body: html(aLaCarta, reto, objetivo),
      })
    }
    if (pathname === BUNDLE_PATH) {
      return route.fulfill({ contentType: 'text/javascript; charset=utf-8', path: HOST_BUNDLE })
    }
    if (pathname.startsWith(ASSETS_BASE)) {
      return route.fulfill({ path: path.join(PUBLIC_DIR, pathname.slice(ASSETS_BASE.length)) })
    }
    if (isAtSiteRoot(pathname)) return route.fulfill({ status: 404, body: '' })
    return route.continue()
  })

  await page.goto(PAGE_PATH)
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect
    .poll(async () => (await canvas.boundingBox())?.width ?? 0, {
      timeout: 30_000,
      message: 'la escena no llegó a pintarse dentro del anfitrión',
    })
    .toBeGreaterThan(0)
  return { requested }
}

/** Entra en la cabina: monta la escena. Solo hace algo con `aLaCarta`. */
export async function enterHostBooth(page: Page): Promise<void> {
  await page.evaluate(() => window.__glideHockeyHost.entrarEnLaCabina())
}
