import { type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GameContext, useGameStoreValue } from './gameStore'
import { useGameAudio } from './useGameAudio'
import { DEFAULT_VOLUMES } from './settings'
import { setVolume } from './settingsClient'

/**
 * What is checked here is the only thing the hook adds on top of the player
 * (which has its tests in `audioEngine.test.ts`): that there is **a single
 * audio context**, that it appears with the first sound and not before, and
 * that it is released both on muting and on removing the scene.
 *
 * The player is a fake because the Web Audio API does not exist in jsdom. The
 * store, on the other hand, is the real one: the mute is changed the way the
 * two menus change it —saving it in the browser— and that way the way back is
 * tested too, which is what makes the game go silent.
 */
const audio = vi.hoisted(() => ({
  create: vi.fn(),
  play: vi.fn(),
  slide: vi.fn(),
  close: vi.fn(),
  setVolume: vi.fn(),
  setLowpass: vi.fn(),
}))

vi.mock('./audioEngine', () => ({ createGlideHockeyAudio: audio.create }))

/** The game around the hook: the real store, with its context. */
function Harness({ children }: { children: ReactNode }) {
  return (
    <GameContext.Provider value={useGameStoreValue()}>
      {children}
    </GameContext.Provider>
  )
}

/** Mutes or turns back on, as the menu would. */
function setMuted(muted: boolean) {
  act(() => setVolume('sfx', muted ? 0 : DEFAULT_VOLUMES.sfx))
}

const renderAudio = () => renderHook(() => useGameAudio(), { wrapper: Harness })

/** Which sounds have been requested, in order. */
const played = () => audio.play.mock.calls.map(([sound]) => sound)

describe('useGameAudio', () => {
  beforeEach(() => {
  // The volumes come from the hall's settings, which cache what was read so
  // that `useSyncExternalStore` does not repaint endlessly: just emptying
  // `localStorage` would leave the cache with the value of the previous
  // test. They are reset through the API, which is what invalidates it.
  setVolume('sfx', DEFAULT_VOLUMES.sfx)
  setVolume('ambience', DEFAULT_VOLUMES.ambience)
    window.localStorage.clear()
    // `restoreMocks` leaves the doubles without implementation before each test.
    audio.create.mockImplementation(() => ({
      play: audio.play,
      slide: audio.slide,
      close: audio.close,
      setVolume: audio.setVolume,
      setLowpass: audio.setLowpass,
    }))
  })

  it('mounting the table does not open the browser audio yet', () => {
    renderAudio()

    expect(audio.create).not.toHaveBeenCalled()
  })

  it('a single player for the whole match', () => {
    const { result } = renderAudio()

    result.current.play('strike')
    result.current.play('bounce')
    result.current.play('goal')

    expect(audio.create).toHaveBeenCalledTimes(1)
    expect(played()).toEqual(['strike', 'bounce', 'goal'])
  })

  it('muted nothing sounds, nor is the audio opened', () => {
    setMuted(true)
    const { result } = renderAudio()

    result.current.play('strike')
    result.current.play('goal')

    expect(audio.create).not.toHaveBeenCalled()
    expect(audio.play).not.toHaveBeenCalled()
  })

  it('muting releases the audio of the device, it does not just silence it', () => {
    const { result } = renderAudio()
    result.current.play('strike')

    setMuted(true)

    expect(audio.close).toHaveBeenCalled()
  })

  it('the sound turns off and on without reloading the game', () => {
    const view = renderAudio()
    view.result.current.play('strike')

    setMuted(true)
    view.result.current.play('bounce')
    expect(played()).toEqual(['strike'])

    setMuted(false)
    view.result.current.play('goal')
    expect(played()).toEqual(['strike', 'goal'])
    // The one released on muting does not come back: another has to be opened.
    expect(audio.create).toHaveBeenCalledTimes(2)
  })

  it('removing the scene takes its audio with it', () => {
    const view = renderAudio()
    view.result.current.play('strike')

    view.unmount()

    expect(audio.close).toHaveBeenCalled()
  })

  it('the slide goes through the same player and does not open it before the first strike', () => {
    const { result } = renderAudio()

    result.current.slide(3)
    expect(audio.create).not.toHaveBeenCalled()

    result.current.play('strike')
    result.current.slide(3)
    expect(audio.create).toHaveBeenCalledTimes(1)
    expect(audio.slide).toHaveBeenCalledWith(3)
  })

  it('muted, the slide does not sound either', () => {
    setMuted(true)
    const { result } = renderAudio()

    result.current.play('strike')
    result.current.slide(3)
    expect(audio.slide).not.toHaveBeenCalled()
  })

  it('the hit filter reaches the open bus, and without open audio it opens nothing', () => {
    const { result } = renderAudio()
    result.current.filter(500)
    expect(audio.create).not.toHaveBeenCalled()

    result.current.play('strike')
    result.current.filter(700)
    expect(audio.setLowpass).toHaveBeenCalledWith(700)
  })
})
