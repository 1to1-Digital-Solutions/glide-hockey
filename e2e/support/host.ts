import path from 'node:path'
import { expect, type Page } from '@playwright/test'
import type { HostAnchor } from '../../src/lib/hostAnchor'
import type { Goal } from '../../src/lib/goal'
import type { Trial } from './common'
import { HOST_BUNDLE } from './globalSetup'

/**
 * This game's record for the common screenshots (`screenshots.spec.ts`): the challenge, as
 * `onFinish` reports it, and higher is better.
 */
export const ENSAYO: Trial = { mode: 'challenge', better: 'higher' }

/** Where the hall serves the static files of this game. */
export const ASSETS_BASE = '/juegos/glide-hockey/'
/** What the host does NOT serve from the root: in the hall, there is nothing there. */
const ASSET_ROOTS = ['/webxr-profiles/']
const PAGE_PATH = '/test-host'
const BUNDLE_PATH = '/test-host.js'
const PUBLIC_DIR = path.join(process.cwd(), 'public')

/** The host's HTML. */
function html(anchor: HostAnchor | undefined, onDemand: boolean, challenge?: number, goal?: Goal): string {
  const anchorAttr = anchor === undefined ? '' : ` data-anchor='${JSON.stringify(anchor)}'`
  const cabinet = onDemand ? ` data-cabinet="on-demand"` : ''
  const withChallenge = challenge === undefined ? '' : ` data-challenge="${challenge}"`
  const withGoal = goal === undefined ? '' : ` data-goal='${JSON.stringify(goal)}'`
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Test host</title>
    <style>
      html, body, #game { height: 100%; margin: 0; }
    </style>
  </head>
  <body>
    <div id="game" data-assets-base="${ASSETS_BASE}"${anchorAttr}${cabinet}${withChallenge}${withGoal}></div>
    <script src="${BUNDLE_PATH}"></script>
  </body>
</html>
`
}

export interface TestHost {
  /** The paths the page has requested, in order. */
  requested: string[]
}

export function isAtSiteRoot(pathname: string): boolean {
  return ASSET_ROOTS.some((root) => pathname.startsWith(root))
}

export interface HostOptions {
  /**
   * Mount the scene only when asked (`enterHostBooth`), **as in the hall**: there a cabinet
   * is chosen with the headset already on, so the scene is born inside an open session and
   * without having painted anything on the screen. By default it is mounted with the page,
   * which is what suits the rest of the suite.
   */
  onDemand?: boolean
  /** The seed of the challenge the hall passes: the scene comes in already playing it (`challenge`). */
  challenge?: number
  /** The medal thresholds the hall passes, for the goal sign (`goal`). */
  goal?: Goal
}

/**
 * Serves a page that mounts the game the way the hall would mount it: under its
 * prefix, with the same security policy as the game's web page, and with the
 * static root answering 404.
 */
/**
 * @param anchor Where and with what heading the host wants the world to be planted. Without it, the
 *   game anchors to the gaze, which is what it does on its own web page.
 */
export async function openHost(
  page: Page,
  anchor?: HostAnchor,
  { onDemand = false, challenge, goal: hallGoal }: HostOptions = {},
): Promise<TestHost> {
  const csp = (await page.request.get('/')).headers()['content-security-policy']
  expect(csp, 'the server returned no security policy').toBeTruthy()

  const requested: string[] = []
  await page.route('**/*', async (route) => {
    const { pathname } = new URL(route.request().url())
    requested.push(pathname)
    if (pathname === PAGE_PATH) {
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        headers: { 'content-security-policy': csp },
        body: html(anchor, onDemand, challenge, hallGoal),
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
      message: 'the scene never got painted inside the host',
    })
    .toBeGreaterThan(0)
  return { requested }
}

/**
 * Enters the headset from the host and turns the controllers on. It is retried because the store
 * does not accept the session until the Canvas has connected it with three, a little after the
 * first frame.
 */
export async function enterHostVR(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.__glideHockeyHost.enterVR().then(
            () => true,
            () => false,
          ),
        ),
      { message: 'the host could not open the immersive session' },
    )
    .toBe(true)
  await page.evaluate(() => window.__xrTest.connectControllers())
}

/** Enters the cabinet: mounts the scene. It only does something with `onDemand`. */
export async function enterHostBooth(page: Page): Promise<void> {
  await page.evaluate(() => window.__glideHockeyHost.enterCabinet())
}
