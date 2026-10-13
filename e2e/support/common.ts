import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import pkg from '../../package.json'
import type { Goal, GoalSignView } from '../../src/lib/goal'

/**
 * What the e2e of the seventeen do the same way, to test the UX of all of them with the same recipe.
 *
 * It is the same file in every game. Each game came to have its own `lookAt` (in degrees
 * or in radians, with the turn to one side or the other), its test host with or without a goal and its
 * run hooks with other names; that way there was no means of taking the same screenshot of the
 * seventeen. What belongs to each game stays in its place —how it mounts the host (`host.ts`) and what
 * each hook does in its scene (`lib/testRun.ts`)—, and here goes what is called the same in all of them.
 *
 * **The gaze**: `lookToward(page, turn, pitch)` in **degrees**, with the turn positive to the left
 * (like `rotation.y` of three) and the pitch positive upwards. It is the convention of the `lookAt` of
 * each game's emulator (`xr-emulator.src.ts`).
 *
 * **The run hook**: the test creates `window.__run<Game>` before loading the page
 * (`requestRun`) and the scene leaves there what can be asked of it. What is common is `start`, `score`,
 * `end` and `sign` (`CommonRun`); each game can hang more things of its own from the same object.
 */

/** What every game leaves in its run hook, if the test has requested it. */
export interface CommonRun {
  /** Starts a run of the record's mode, with no tutorial or countdown left to wait for. */
  start: () => void
  /** Sets what the run in progress has so far, in the record's unit (strokes, if lower is better). */
  score: (points: number) => void
  /** Ends the run in progress as if it had ended by playing: it counts for the hall. */
  end: () => void
  /** What the goal sign says now, or `null` if it is not visible. */
  sign: () => GoalSignView | null
}

/** What each game's host (`host.ts`) says about its record, to put the goal together. */
export interface Trial {
  /** The record's mode, as the game calls it in `onFinish`. */
  mode: string
  better: 'higher' | 'lower'
}

/** The game's id: the `name` of its package. */
export const GAME = pkg.name

/** The name of the run hook: `__run` and the id in PascalCase (`__runAxeThrowing`). */
export function runHook(game: string = GAME): string {
  return `__run${game
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')}`
}

/** Requests the run hook: it has to be called **before** `page.goto`. */
export async function requestRun(page: Page): Promise<void> {
  await page.addInitScript((hook) => {
    const win = window as unknown as Record<string, unknown>
    win[hook] ??= {}
  }, runHook())
}

/** Calls one of the common things of the run hook. */
export async function inRun<K extends keyof CommonRun>(
  page: Page,
  what: K,
  ...callArgs: Parameters<CommonRun[K]>
): Promise<ReturnType<CommonRun[K]>> {
  return page.evaluate(
    ([hook, name, args]) => {
      const run = (window as unknown as Record<string, Record<string, (...a: unknown[]) => unknown> | undefined>)[hook]
      const call = run?.[name]
      if (typeof call !== 'function') throw new Error(`the scene has not left «${name}» in ${hook}`)
      return call(...args)
    },
    [runHook(), what, callArgs] as [string, string, unknown[]],
  ) as Promise<ReturnType<CommonRun[K]>>
}

/** Whether the scene has already left the common things in the hook. */
export async function runReady(page: Page): Promise<boolean> {
  return page.evaluate((hook) => {
    const run = (window as unknown as Record<string, Record<string, unknown> | undefined>)[hook]
    return ['start', 'score', 'end', 'sign'].every((name) => typeof run?.[name] === 'function')
  }, runHook())
}

/** Turns the head of the emulated headset, in degrees: to the left and upwards as positive. */
export async function lookToward(page: Page, turn: number, pitch = 0): Promise<void> {
  await page.evaluate(
    ([y, p]) => (window as unknown as { __xrTest: { lookAt: (y: number, p?: number) => void } }).__xrTest.lookAt(y, p),
    [turn, pitch] as const,
  )
}

/**
 * A trial goal with low thresholds, to cross them with the hook without playing: bronze at 10,
 * silver at 20 and gold at 30 (for lower, the other way round), and with no record, which is the first time.
 */
export function trialGoal({ mode, better }: Trial): Goal {
  return {
    medals: better === 'higher' ? { bronze: 10, silver: 20, gold: 30 } : { bronze: 30, silver: 20, gold: 10 },
    better,
    unit: better === 'higher' ? 'points in challenge' : 'strokes',
    record: null,
    mode,
  }
}

/** Where the common screenshots land: `test-results/capturas/<game>-<what>.png`. */
export const SCREENSHOTS_DIR = path.join(process.cwd(), 'test-results', 'capturas')

/** Saves what is seen now with the game's name in front, to look at the seventeen together. */
export async function takeScreenshot(page: Page, what: string): Promise<string> {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  const filePath = path.join(SCREENSHOTS_DIR, `${GAME}-${what}.png`)
  await page.screenshot({ path: filePath })
  return filePath
}
