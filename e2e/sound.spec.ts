import { expect, test, type Page } from '@playwright/test'
import { openGame, playMatch } from './helpers'

/**
 * Enters the game with the effects turned off from the arcade's settings.
 *
 * There is no longer a mute button in the game: the volume is chosen once in
 * xrcade and travels in the browser's storage, which is the same origin when
 * the game is mounted inside the arcade. It is written before loading the
 * page, which is how whoever comes from there arrives.
 */
async function enterInSilence(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('xrcade:volume:sfx', '0')
  })
}

/**
 * That the game really sounds, and that silenced nothing sounds.
 *
 * The tests of `src/lib` test the synthesizer with a fake context and the hook
 * with a fake player, so neither of the two touches the only wire left: the
 * table asking for the sound on every frame (`components/game/Rink.tsx`). That
 * one can only be checked in a real browser, and it is precisely the one that
 * breaks in silence —the game keeps playing the same, only mute—.
 *
 * Nothing is heard: one looks at what the game asks of the Web Audio API, which
 * is what can be observed without a sound card and without depending on the
 * machine.
 */

/** What the game has asked of the Web Audio API. */
interface AudioUsage {
  /** Open contexts. More than one is a leak: they are a scarce resource. */
  contexts: number
  /** Sounds released: every hit, bounce or goal starts at least one tone. */
  sounds: number
}

declare global {
  interface Window {
    __glideHockeyAudio?: AudioUsage
  }
}

/**
 * Counts what is asked of the audio, without changing what it does.
 *
 * It has to be called **before** opening the game: it wraps `AudioContext` and
 * the game keeps its own as soon as it sounds for the first time.
 */
async function countTheAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const usage: AudioUsage = { contexts: 0, sounds: 0 }
    window.__glideHockeyAudio = usage

    const Original = window.AudioContext
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof Original>) {
        super(...args)
        usage.contexts++
      }

      createOscillator(): OscillatorNode {
        usage.sounds++
        return super.createOscillator()
      }
    }
  })
}

const readTheAudio = (page: Page) =>
  page.evaluate(() => window.__glideHockeyAudio)

test('the match sounds: the table asks the browser for its sounds', async ({
  page,
}) => {
  await countTheAudio(page)
  await openGame(page)

  // Just after reaching the menu no context has been opened: the browser would
  // leave suspended one created before anybody touched anything.
  expect(await readTheAudio(page)).toEqual({ contexts: 0, sounds: 0 })

  // A match to many goals against the slowest machine: it does not need to
  // end, only for the puck to move and collide with something.
  await playMatch(page, { goals: 15, level: 'Easy' })

  await expect
    .poll(async () => (await readTheAudio(page))?.sounds ?? 0, {
      timeout: 30_000,
      message: 'the table did not ask for a single sound in the whole rally',
    })
    .toBeGreaterThan(0)

  // And with a single context for the whole match, however many hits there are.
  expect((await readTheAudio(page))?.contexts).toBe(1)

  // One for the whole scene, besides, and not one per match: the table is
  // brand new in every match and in every round of the challenge
  // (`key={runId}` in `GameWorld`). With the audio hanging from it, the round
  // won closed the context on the same frame the goal that won it sounded.
  const soundedSoFar = (await readTheAudio(page))?.sounds ?? 0
  await page.getByRole('button', { name: 'Leave the game' }).click()
  await page.getByRole('button', { name: 'Leave', exact: true }).click()
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByText('Machine')).toBeVisible()

  await expect
    .poll(async () => (await readTheAudio(page))?.sounds ?? 0, {
      timeout: 30_000,
      message: 'the second match was played mute',
    })
    .toBeGreaterThan(soundedSoFar)

  expect((await readTheAudio(page))?.contexts).toBe(1)
})

test('in silence the audio of the browser is not even opened', async ({
  page,
}) => {
  await countTheAudio(page)
  await enterInSilence(page)
  await openGame(page)

  await playMatch(page, { goals: 15, level: 'Easy' })

  // Enough for something to have already sounded in a match with sound: the
  // puck leaves the centre and reaches the back of the table in under two
  // seconds.
  await page.waitForTimeout(5000)

  expect(await readTheAudio(page)).toEqual({ contexts: 0, sounds: 0 })
})
