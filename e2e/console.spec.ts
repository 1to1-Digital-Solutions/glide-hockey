import { expect, test } from '@playwright/test'
import { openGame } from './helpers'

/**
 * A clean console and no request leaving home.
 *
 * It is the test that catches what does not break the build and does break the
 * game mounted in the xrcade hall: a WebAssembly module the security policy
 * blocks, a font or a model some library downloads from a CDN, a three warning
 * about a deprecated API. All of that comes out through the console and the
 * network, and locally —with a laxer policy— it goes unnoticed (see `docs/xrcade.md`).
 */

/**
 * Warnings that come from inside the libraries and cannot be fixed from here.
 * Each one goes with its reason and with what emits it; without this list the
 * test could only watch for errors, and then the warnings that do belong to the
 * game would be lost (a repeated key in React, a badly configured material).
 *
 * They are compared by exact fragment: any new warning, even if it comes from
 * the same library, fails and has to be looked at.
 */
const THIRD_PARTY_WARNINGS = [
  // @react-three/fiber uses THREE.Clock in its render loop. It will go away when
  // the library moves to THREE.Timer; the game instantiates it nowhere.
  'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.',
  // The continuous integration runner has no graphics card and paints in
  // software with SwiftShader, which warns that reading pixels is costly for
  // it. The OpenGL driver emits it, not the page: on any machine with a GPU it
  // does not appear, and there is nothing to fix in the game. Without this
  // entry, the only place where this test runs on its own would always be red.
  'GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels',
]

test('the game starts without dirtying the console or going out to the network', async ({
  page,
}) => {
  const problems: string[] = []
  const outside: string[] = []

  page.on('console', (message) => {
    const type = message.type()
    if (type !== 'error' && type !== 'warning') return
    const text = message.text()
    if (THIRD_PARTY_WARNINGS.some((warning) => text.includes(warning))) return
    problems.push(`${type}: ${text}`)
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.hostname !== '127.0.0.1') outside.push(request.url())
  })

  await openGame(page)
  // A bit of a match: that is when the physics and the scene come into play,
  // which is where the three warnings would appear.
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByText('Machine')).toBeVisible()
  await page.waitForTimeout(4000)

  expect(problems).toEqual([])
  expect(outside).toEqual([])
})

test('the fonts are served from the site itself', async ({ page }) => {
  await openGame(page)

  // `next/font` downloads them at build time and self-hosts them. If a `<link>`
  // to Google Fonts ever slips in, the security policy blocks it in the hall
  // and the menu is left with the system font without a warning.
  const resources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => (entry as PerformanceResourceTiming).name),
  )
  const origin = new URL(page.url()).origin

  expect(resources.length).toBeGreaterThan(0)
  expect(resources.filter((url) => !url.startsWith(origin))).toEqual([])
})
