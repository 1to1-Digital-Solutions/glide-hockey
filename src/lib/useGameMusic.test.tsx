import { type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameContext, useGameStoreValue } from './gameStore'
import { MUSIC_VOLUME, musicUrl } from './music'
import { MUSIC_FADE_MS } from './musicFade'
import { useGameMusic } from './useGameMusic'
import { DEFAULT_VOLUMES, volumeFactor } from './settings'
import { setVolume } from './settingsClient'

/**
 * The background music, seen from the scene.
 *
 * What is tested is what only happens here: that it is not downloaded if one
 * enters with the music off, that the mute silences it, that it stops when
 * the scene is removed and that, if the browser rejects the first attempt
 * —which is the normal thing, because it demands a gesture—, it tries again
 * as soon as there is one.
 *
 * The audio element is a fake because jsdom plays nothing. The store is the
 * real one: the music turns on and off the way the two menus do it, saving
 * it in the browser.
 */

/** The players created, in order, to look at what was asked of them. */
const players: {
  src: string
  loop: boolean
  volume: number
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
}[] = []

/** Whether the browser allows sound without a previous gesture. */
let allowsAutoplay = true

class FakeAudio {
  loop = false
  volume = 1
  play = vi.fn(() => (allowsAutoplay ? Promise.resolve() : Promise.reject(new Error('gesture'))))
  pause = vi.fn()

  constructor(public src: string) {
    players.push(this as unknown as (typeof players)[number])
  }
}

beforeEach(() => {
  // The volumes come from the hall's settings, which cache what was read so
  // that `useSyncExternalStore` does not repaint endlessly: just emptying
  // `localStorage` would leave the cache with the value of the previous
  // test. They are reset through the API, which is what invalidates it.
  setVolume('sfx', DEFAULT_VOLUMES.sfx)
  setVolume('ambience', DEFAULT_VOLUMES.ambience)
  players.length = 0
  allowsAutoplay = true
  vi.stubGlobal('Audio', FakeAudio)
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

function Harness({ children }: { children: ReactNode }) {
  return <GameContext.Provider value={useGameStoreValue()}>{children}</GameContext.Provider>
}

const renderMusic = () => renderHook(() => useGameMusic(), { wrapper: Harness })


/**
 * Waits for the fade to finish.
 *
 * The music no longer comes in or leaves abruptly (`lib/musicFade.ts`), so the final volume
 * and the `pause()` arrive when the ramp ends and not on the same line. It really waits and
 * does not use fake clocks because the ramp goes by frames: faking the clock without faking
 * `requestAnimationFrame` would leave it stopped, and faking both is more machinery than the
 * seven hundred milliseconds it costs to wait for it.
 */
async function afterFade() {
  await act(async () => {
    await new Promise((done) => setTimeout(done, MUSIC_FADE_MS + 120))
  })
}

describe('the background music', () => {
  // Each test unmounts its own: the preference notifies everyone who is
  // listening, so a hook of a previous test that stayed mounted would react
  // to the changes of the next one and would create extra players.

  it('plays looped and quietly, from wherever it is served', async () => {
    const hook = renderMusic()
    await afterFade()

    expect(players).toHaveLength(1)
    expect(players[0].src).toBe(musicUrl())
    expect(players[0].loop).toBe(true)
    expect(players[0].volume).toBeCloseTo(MUSIC_VOLUME * volumeFactor(DEFAULT_VOLUMES.ambience))
    expect(players[0].play).toHaveBeenCalled()
    hook.unmount()
  })

  it('entering with the music off nothing is downloaded', () => {
    act(() => setVolume('ambience', 0))
    const hook = renderMusic()

    expect(players).toHaveLength(0)
    hook.unmount()
  })

  it('turning the effects off does not silence it: they are two separate channels', () => {
    // The mute used to rule over everything. Now the hall's settings separate
    // «sonidos interactivos» from «sonidos ambientales» on purpose: some want
    // to hear the background and not the game, and some prefer the opposite.
    const hook = renderMusic()
    act(() => setVolume('sfx', true ? 0 : DEFAULT_VOLUMES.sfx))

    expect(players[0].pause).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('turning it off stops it, and turning it back on resumes it with the same player', async () => {
    const hook = renderMusic()
    act(() => setVolume('ambience', 0))
    await afterFade()
    expect(players[0].pause).toHaveBeenCalled()

    act(() => setVolume('ambience', DEFAULT_VOLUMES.ambience))
    // The same element: creating it again would request the file once more.
    expect(players).toHaveLength(1)
    expect(players[0].play).toHaveBeenCalledTimes(2)
    hook.unmount()
  })

  it('removing the scene takes the music with it', async () => {
    const hook = renderMusic()
    hook.unmount()
    // Fading it down, not cutting it: the hall brings its own back right after.
    await afterFade()

    expect(players[0].pause).toHaveBeenCalled()
  })

  it('if the browser rejects it, it tries again on the first gesture', async () => {
    allowsAutoplay = false
    const hook = renderMusic()
    expect(players[0].play).toHaveBeenCalledTimes(1)

    allowsAutoplay = true
    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'))
    })

    expect(players[0].play).toHaveBeenCalledTimes(2)
    hook.unmount()
  })
})
