import { expect, type Page } from '@playwright/test'
import { type SceneProbe } from '@/lib/sceneProbe'

/**
 * What the browser tests share: getting to the menu, starting a match the way
 * someone with the mouse would, and watching what happens on the table.
 *
 * The last one is needed because the puck and the mallets are three objects:
 * from the DOM they can neither be selected nor read. The scene publishes them
 * only if a test asks for it (see `src/lib/sceneProbe.ts`).
 */

/** Opens the game and waits for the table to be mounted. */
export async function openGame(page: Page): Promise<void> {
  await page.goto('/')
  // The Canvas loads separately and only on the client: until it appears, what
  // there is is the loading screen.
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Glide Hockey' })).toBeVisible()
}

/**
 * Starts a test match with the level and the goals asked for. The menu opens on the challenge
 * —`run.spec.ts` checks it—, so the first thing is to choose practice.
 *
 * The level matters for how long a test takes to resolve: with the player's
 * mallet standing still, the machine scores every few seconds on Impossible and
 * every fifteen on Easy.
 */
export async function playMatch(
  page: Page,
  { goals, level, endless = false }: { goals: number; level: string; endless?: boolean },
): Promise<void> {
  await page.getByRole('button', { name: 'Practice', exact: true }).click()
  // The level and the goals are folded away behind «More options» (the menu's common template),
  // if it has not been unfolded already.
  const moreOptions = page.getByRole('button', { name: 'More options', exact: true })
  if ((await moreOptions.count()) > 0) await moreOptions.click()
  await page.getByRole('button', { name: level }).click()
  await page.locator('#goal-target').fill(String(goals))
  // After the goals: endless turns the slider off.
  if (endless) await page.getByRole('button', { name: 'Endless', exact: true }).click()
  await page.getByRole('button', { name: 'Play' }).click()

  // The countdown comes before the serve; the scoreboard is already on screen.
  await expect(page.getByText('Machine')).toBeVisible()
}

/**
 * Asks the game to publish what happens on the table.
 *
 * It has to be called **before** `openGame`: the scene only writes the slot
 * if it already exists when it paints the first frame (see `src/lib/sceneProbe.ts`).
 */
export async function watchTable(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__glideHockeyScene = null
  })
}

/**
 * Waits for the first frame of the match and returns what is seen on the table.
 *
 * The scene only publishes while there is a match: in the menu there is neither
 * a puck nor mallets to look at (see `GameWorld`).
 */
export async function waitForTable(page: Page): Promise<SceneProbe> {
  await expect
    .poll(() => page.evaluate(() => window.__glideHockeyScene != null), {
      message: 'the scene never got to publish what happens on the table',
    })
    .toBe(true)

  return readTable(page)
}

/** What the scene is publishing right now. */
export async function readTable(page: Page): Promise<SceneProbe> {
  const table = await page.evaluate(() => window.__glideHockeyScene)
  if (table == null) {
    throw new Error(
      'The table is not publishing anything: was watchTable called before opening the game?',
    )
  }
  return table
}

/**
 * Takes the mouse to where the puck is seen and says how many times the
 * player's mallet has hit it so far.
 *
 * It is the gesture of whoever plays: following the puck with the hand. Calling
 * it in a loop moves the mallet after it until it catches up, without depending
 * on when the machine returns it or on how fast the match runs on this machine.
 */
export async function chasePuck(page: Page): Promise<number> {
  const table = await readTable(page)
  await page.mouse.move(table.puckScreen.x, table.puckScreen.y)
  return table.playerHits
}
