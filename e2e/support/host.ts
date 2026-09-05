import path from 'node:path'
import { expect, type Page } from '@playwright/test'
import { HOST_BUNDLE } from './globalSetup'

/** Donde el salón sirve los estáticos de este juego. */
export const ASSETS_BASE = '/juegos/air-hockey/'
/** Lo que el anfitrión NO sirve desde la raíz: en el salón, ahí no hay nada. */
const ASSET_ROOTS = ['/webxr-profiles/']
const PAGE_PATH = '/anfitrion-de-prueba'
const BUNDLE_PATH = '/anfitrion-de-prueba.js'
const PUBLIC_DIR = path.join(process.cwd(), 'public')

const HTML = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Anfitrión de prueba</title>
    <style>
      html, body, #juego { height: 100%; margin: 0; }
    </style>
  </head>
  <body>
    <div id="juego" data-assets-base="${ASSETS_BASE}"></div>
    <script src="${BUNDLE_PATH}"></script>
  </body>
</html>
`

export interface TestHost {
  /** Las rutas que la página ha pedido, en orden. */
  requested: string[]
}

export function isAtSiteRoot(pathname: string): boolean {
  return ASSET_ROOTS.some((root) => pathname.startsWith(root))
}

/**
 * Sirve una página que monta el juego como lo montaría el salón: bajo su
 * prefijo, con la misma política de seguridad que la web del juego, y con la
 * raíz de estáticos respondiendo 404.
 */
export async function openHost(page: Page): Promise<TestHost> {
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
        body: HTML,
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
