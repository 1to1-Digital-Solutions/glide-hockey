import { expect, test, type Page } from '@playwright/test'
import { constrainMallet, type Vec2 } from '@/lib/puckPhysics'
import {
  openGame,
  waitForTable,
  playMatch,
  readTable,
  watchTable,
  chasePuck,
} from './helpers'

/**
 * Moving the mallet with the mouse, which is the game's main interaction.
 *
 * From the DOM none of this can be seen: the mallet and the puck are three
 * objects inside a canvas. They are watched through where the scene publishes
 * them when a test asks for it (see `src/lib/sceneProbe.ts`), and not through
 * the scoreboard: waiting for a goal to fall would turn these tests into a bet
 * on aim and on how fast the machine they run on goes.
 *
 * It is played on Easy and to fifteen goals so that the match does not end on
 * its own while it is being watched.
 */

/** Distance between two points of the table, in metres. */
function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/**
 * How far the mallet is allowed to stay from the point that was aimed at.
 *
 * The mouse moves to a whole pixel and the table measures two metres spread
 * over a few hundred pixels, so between projecting the puck and aiming there
 * again millimetres are lost. Three centimetres is less than half a mallet:
 * there is no way to meet it by staying still at the other end of the table.
 */
const TOLERANCE = 0.03

/**
 * Aims with the mouse at the puck and waits for the mallet to reach it.
 *
 * The puck is the only point of the table of which the test knows at once the
 * pixel it is seen at and the coordinates it corresponds to, so it is the only
 * way to check that the mallet goes **where it is aimed** and not just
 * anywhere. The mallet does not cross the halfway line, hence the `constrainMallet`.
 */
async function takeTheMalletToThePuck(page: Page): Promise<Vec2> {
  const table = await readTable(page)
  // With the match just started the puck waits for the serve at the centre of
  // the table. If it were far from there, half a match has been played before
  // looking, and then neither is the mallet where it is believed to be nor
  // does the pixel aimed at have to fall on the table.
  expect(
    distance(table.puck, { x: 0, z: 0 }),
    'the puck was no longer leaving from the centre',
  ).toBeLessThan(0.3)

  const target = constrainMallet(table.puck, 'player')
  await page.mouse.move(table.puckScreen.x, table.puckScreen.y)

  await expect
    .poll(
      async () => distance((await readTable(page)).playerMallet, target),
      { message: 'the mallet did not go where the mouse was aiming' },
    )
    .toBeLessThan(TOLERANCE)

  return target
}

test('the mouse moves the mallet of the player to where it aims', async ({ page }) => {
  await watchTable(page)
  await openGame(page)
  await playMatch(page, { goals: 15, level: 'Easy' })

  const start = await waitForTable(page)
  // The mallet starts in front of its goal, half a table from the centre: if it
  // were already where it is going to be sent, arriving would prove nothing.
  expect(
    distance(start.playerMallet, constrainMallet(start.puck, 'player')),
  ).toBeGreaterThan(0.4)

  await takeTheMalletToThePuck(page)
})

test('the mallet hits the puck when it is chased with the mouse', async ({
  page,
}) => {
  await watchTable(page)
  await openGame(page)
  await playMatch(page, { goals: 15, level: 'Easy' })
  await waitForTable(page)

  // First it is checked that the mouse really is in charge. Without this, a
  // mallet nailed in front of its goal would end up touching the puck on the
  // rebound and the test would pass a game in which the mouse moves nothing.
  await takeTheMalletToThePuck(page)

  // And now it is chased, which is what whoever plays does. No goal and no
  // number of hits is waited for: it is enough for the mallet to reach the puck
  // once and for the physics to count the hit.
  await expect
    .poll(() => chasePuck(page), {
      // Each lap reads where the puck is seen and takes the mouse there: the
      // closer together they are, the less it gets away.
      intervals: [20],
      timeout: 60_000,
      message: 'the mallet never got to hit the puck by chasing it with the mouse',
    })
    .toBeGreaterThan(0)
})
