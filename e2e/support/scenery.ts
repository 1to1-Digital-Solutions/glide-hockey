import { expect, type Page } from '@playwright/test'
import { SCENERY_KEY, type Scenery } from '../../src/lib/settings'

/**
 * What it takes to check from outside that the game obeys the hall's scenery.
 *
 * **What is checked.** The hall always enters `immersive-ar` if the headset has it, so the
 * session type does not say what was chosen: `xrcade:scenery` does. A game that decided its
 * stage from something else —its own setting, or the session type— would enter with no stage
 * even though the drawn place had been chosen in the hall, and the failure would only show
 * with the headset on.
 *
 * **How it is seen without looking.** The stage is dozens of meshes and in a session they are
 * painted twice, once per eye, so removing it shows in the **draw calls per frame**. They are
 * counted by wrapping the WebGL context, like each game's draw call budget, so that no counter
 * goes into the code that is played.
 *
 * **And that changing it does not hitch.** Changing the scenery is done with the headset on, so
 * it has to be instant. What spoils it does not show in the calls but in the shaders:
 * mounting or unmounting a light changes how many there are, and adding or removing the fog
 * changes whether there is any, and both force three to recompile the materials of everything
 * that is lit. That is why every program that is linked, and with how many lights of each type
 * it was compiled, is also recorded from the same WebGL context.
 *
 * It is the same file in every game: what changes from one to another —how the session is
 * entered and how much its stage weighs— goes in its `scenery.spec.ts`.
 */

declare global {
  interface Window {
    /** Draw calls of each frame, the last 240. */
    __drawCallsPerFrame?: number[]
    /** How many shader programs have been linked since the page loaded. */
    __linkedPrograms?: number
    /** The light combinations something lit has been painted with in the session. */
    __shaderLights?: string[]
    /** How many draw calls the page had made when each shader was linked. See below. */
    __linkedAt?: number[]
    /** Which material each linked shader belongs to (`MeshStandardMaterial`, `MeshDepthMaterial`…). */
    __shaderTypes?: string[]
  }
}

/** Starts counting draw calls per frame. Before opening the page. */
export async function installDrawCallCounter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const frames: number[] = []
    window.__drawCallsPerFrame = frames
    let calls = 0
    const gl = WebGL2RenderingContext.prototype
    for (const name of ['drawElements', 'drawElementsInstanced', 'drawArrays', 'drawArraysInstanced'] as const) {
      const original = gl[name] as (...args: unknown[]) => unknown
      ;(gl as unknown as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
        calls++
        return original.apply(this, args)
      }
    }
    const closeFrame = () => {
      frames.push(calls)
      if (frames.length > 240) frames.shift()
      calls = 0
      requestAnimationFrame(closeFrame)
    }
    requestAnimationFrame(closeFrame)
  })
}

/**
 * The median of calls per frame, with the last thing that changed already settled.
 *
 * The median and not the mean: the frame in which the stage is mounted or removed, or in which
 * a material is compiled, is out of the ordinary and says nothing about what is painted after.
 */
export async function medianDrawCalls(page: Page, count = 30): Promise<number> {
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    window.__drawCallsPerFrame!.length = 0
  })
  await expect
    .poll(() => page.evaluate(() => window.__drawCallsPerFrame!.length), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(count)
  const calls = await page.evaluate(() =>
    window.__drawCallsPerFrame!.filter((c) => c > 0).sort((a, b) => a - b),
  )
  return calls[Math.floor(calls.length / 2)] ?? 0
}

/**
 * Starts recording the shader programs that are linked, **when** each one is linked and with
 * how many lights the scene paints. Before opening the page.
 *
 * **Linking is the hitch.** three compiles a program the first time it paints a material with a
 * combination of lights, fog and environment, and compiles it again if a material is disposed
 * when it unmounts and shows up again. Counting `linkProgram` says how many times it has happened,
 * without looking inside the game.
 *
 * **Counting links is not enough for the lights.** three keeps in each material one program per
 * light combination, so alternating between two only compiles the first time each one shows
 * up; and the one of the drawn place is already compiled on the screen, before entering. So the
 * lights are looked at in what is **used** to paint: each lit shader has written in the
 * declaration of its uniforms how many lights of each type there are (`pointLights[ 1 ]`, also
 * when they are zero); which program it belongs to is recorded, and every time something is
 * painted with that program with the session open, that combination counts.
 *
 * **Only with the session open**, because before entering the games that reflect a room paint
 * it in a separate scene (`RoomEnvironment`, with its own light) to get the reflection map, and
 * that scene is not the game's.
 *
 * **And when each one is linked, counted in draw calls.** Counting them is not enough to see
 * the prewarm: the same programs are linked with it and without it, and what changes is *when*.
 * Without prewarming, each material links its own the first time its turn to be painted comes,
 * so they come out one by one spread over the first frames —and each of those blocks the thread,
 * which with the headset on is a hitch—. Prewarming, they are linked **all in the same batch**,
 * before painting. The draw calls are the clock because they do not stop: two shaders with the
 * same number were linked with nothing painted in between.
 */
export async function watchPrograms(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__linkedPrograms = 0
    const linkedAt: number[] = []
    window.__linkedAt = linkedAt
    const types: string[] = []
    window.__shaderTypes = types
    const lights = new Set<string>()
    window.__shaderLights = []
    const shaderLights = new WeakMap<WebGLShader, string>()
    const programLights = new WeakMap<WebGLProgram, string>()
    const shaderType = new WeakMap<WebGLShader, string>()
    const programType = new WeakMap<WebGLProgram, string>()
    const gl = WebGL2RenderingContext.prototype

    // The clock each compilation is dated with. Its own and not the one of `installDrawCallCounter`:
    // the two can be used on their own, and chaining wrappers of the same method is harmless.
    let draws = 0
    for (const name of ['drawElements', 'drawElementsInstanced', 'drawArrays', 'drawArraysInstanced'] as const) {
      const original = gl[name] as (...args: unknown[]) => unknown
      ;(gl as unknown as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
        draws++
        return original.apply(this, args)
      }
    }

    const link = gl.linkProgram
    gl.linkProgram = function (this: WebGL2RenderingContext, program: WebGLProgram) {
      window.__linkedPrograms = (window.__linkedPrograms ?? 0) + 1
      linkedAt.push(draws)
      types.push(programType.get(program) ?? 'unknown')
      return link.call(this, program)
    }

    const source = gl.shaderSource
    gl.shaderSource = function (this: WebGL2RenderingContext, shader: WebGLShader, text: string) {
      const type = /#define SHADER_TYPE (\w+)/.exec(text)?.[1]
      if (type !== undefined) shaderType.set(shader, type)
      if (text.includes('directionalLights[')) {
        const types = ['directionalLights', 'pointLights', 'spotLights', 'rectAreaLights', 'hemisphereLights']
        shaderLights.set(
          shader,
          types.map((type) => `${type} ${text.match(new RegExp(`${type}\\[ (\\d+) \\]`))?.[1] ?? '?'}`).join(', '),
        )
      }
      return source.call(this, shader, text)
    }

    const attach = gl.attachShader
    gl.attachShader = function (this: WebGL2RenderingContext, program: WebGLProgram, shader: WebGLShader) {
      const ownLights = shaderLights.get(shader)
      if (ownLights !== undefined) programLights.set(program, ownLights)
      const ownType = shaderType.get(shader)
      if (ownType !== undefined) programType.set(program, ownType)
      return attach.call(this, program, shader)
    }

    const use = gl.useProgram
    gl.useProgram = function (this: WebGL2RenderingContext, program: WebGLProgram | null) {
      const headset = (window as { __xrTest?: { hasSession(): boolean } }).__xrTest
      const ownLights = program == null ? undefined : programLights.get(program)
      if (ownLights !== undefined && headset?.hasSession() === true && !lights.has(ownLights)) {
        lights.add(ownLights)
        window.__shaderLights = [...lights]
      }
      return use.call(this, program)
    }
  })
}

/** How many shader programs have been linked since the page loaded. */
export async function linkedPrograms(page: Page): Promise<number> {
  return page.evaluate(() => window.__linkedPrograms ?? 0)
}

/**
 * How many draw calls the page had made when each shader was linked, in order.
 *
 * Two shaders with the same number were compiled **in one batch**, with nothing painted in
 * between: that is what the prewarm does. Different numbers are stray compilations,
 * each one in the middle of a frame.
 */
export async function linkTimes(page: Page): Promise<number[]> {
  return page.evaluate(() => [...(window.__linkedAt ?? [])])
}

/**
 * Which material each linked shader belongs to, in the same order as `linkTimes`.
 *
 * It serves to tell what is painted from what is not: `MeshDepthMaterial` is the shadow
 * map, and three only compiles that one when there is something **visible** that casts, so the
 * prewarm does not reach it —`compile()` walks the whole scene but only prepares the
 * pass that is seen—.
 */
export async function shaderTypes(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window.__shaderTypes ?? [])])
}

/**
 * Of those stamps, how many shaders fall in the largest batch and how many are left stray.
 *
 * It is the way to read the prewarm without depending on how many materials each game has:
 * prewarming, the batch takes almost everything; without prewarming, there is no batch —each
 * shader goes on its own— and everything is left stray.
 */
export function inBatches(stamps: readonly number[]): { largestBatch: number; stray: number } {
  const byStamp = new Map<number, number>()
  for (const stamp of stamps) byStamp.set(stamp, (byStamp.get(stamp) ?? 0) + 1)
  const largestBatch = Math.max(0, ...byStamp.values())
  return { largestBatch, stray: stamps.length - largestBatch }
}

/**
 * With how many different light combinations something lit has been painted with the session open.
 * If the scene does not change lights when the scenery changes, it is one.
 */
export async function lightCombinations(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__shaderLights ?? [])
}

/**
 * Lets the change go through: the notice arrives, React paints again and the next frame compiles
 * whatever it has to compile.
 */
export async function letSettle(page: Page, count = 30): Promise<void> {
  await medianDrawCalls(page, count)
}

/** Leaves something written in storage before the page loads. */
export async function storeBeforeOpen(page: Page, key: string, value: string): Promise<void> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [key, value] as const)
}

/**
 * What the hall's panel does when the scenery changes: write the key and notify.
 *
 * Without reloading on purpose: with the headset on, reloading is leaving the session, so the
 * change has to arrive through the event or it does not arrive.
 */
export async function chooseInSalon(page: Page, scenery: Scenery): Promise<void> {
  await page.evaluate(
    ([key, value]) => {
      window.localStorage.setItem(key, value)
      window.dispatchEvent(new Event('xrcade:ajustes'))
    },
    [SCENERY_KEY, scenery] as const,
  )
}

/** What is stored under a key, or `null`. */
export async function readKey(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => window.localStorage.getItem(k), key)
}
