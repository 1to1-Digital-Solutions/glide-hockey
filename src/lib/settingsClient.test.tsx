import { act, renderHook } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_LANG,
  DEFAULT_VOLUMES,
  DEFAULT_VOLUME_SETTINGS,
  GRAB_MODE_KEY,
  HAND_KEY,
  LANG_COOKIE,
  PLAY_HEIGHT_KEY,
  PLAY_HEIGHT_OFFSET_KEY,
  SCENERY_KEY,
  TURN_MODE_KEY,
  VOLUME_KEYS,
} from './settings'
import {
  currentLang,
  setHand,
  setLang,
  setScenery,
  setVolume,
  settingsStorage,
  useGrabMode,
  useHand,
  useLang,
  usePlayHeight,
  usePlayHeightOffset,
  useScenery,
  useTurnMode,
  useVolumes,
} from './settingsClient'

/**
 * The hall's settings seen from the browser: that what changes on the
 * front page reaches what is already painted inside the cabinet.
 *
 * What is really tested is the notice. Saving is easy; what breaks
 * silently is nobody finding out: `localStorage` does not notify the tab that
 * writes and a cookie never notifies anyone, so without our own event the
 * game would keep sounding —or speaking— as it was until the next load.
 *
 * The snapshot is cached on purpose (`useSyncExternalStore` compares by
 * identity), and that is exactly what can go stale: that is why there is a test
 * that changing the volume invalidates what is cached even if nobody is
 * listening yet.
 */

beforeEach(() => {
  // The store caches what it read, so emptying `localStorage` directly would leave
  // the previous snapshot standing: we go back to the defaults the way they are changed.
  window.localStorage.clear()
  setVolume('sfx', DEFAULT_VOLUMES.sfx)
  setVolume('ambience', DEFAULT_VOLUMES.ambience)
  document.cookie = `${LANG_COOKIE}=; Path=/; Max-Age=0`
})

describe('where it is saved', () => {
  it('is the storage of this window', () => {
    expect(settingsStorage()).toBe(window.localStorage)
  })

  it('there is nowhere if the browser has it blocked', () => {
    // Private window, or site cookies blocked: `localStorage` does not
    // return nothing, it blows up when looked at. The game has to go on.
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage blocked')
      },
    })

    try {
      expect(settingsStorage()).toBeNull()
    } finally {
      // `restoreMocks` does not undo a `defineProperty`, and without this the rest of
      // the file's tests would be left without storage.
      if (original !== undefined) Object.defineProperty(window, 'localStorage', original)
    }
  })
})

describe('the volumes', () => {
  it('start at the defaults', () => {
    const { result } = renderHook(() => useVolumes())

    expect(result.current).toEqual(DEFAULT_VOLUME_SETTINGS)
  })

  it('reach what is already painted as soon as they change', () => {
    // Without our own event this would stay at 100: `localStorage` does not notify the
    // tab that writes, and it is the same tab that mounts the game inside
    // the hall.
    const { result } = renderHook(() => useVolumes())

    act(() => setVolume('sfx', 30))

    expect(result.current.sfx).toBe(30)
    expect(window.localStorage.getItem(VOLUME_KEYS.sfx)).toBe('30')
  })

  it('do not go outside 0 to 100, nor accept decimals', () => {
    const { result } = renderHook(() => useVolumes())

    act(() => setVolume('ambience', 140))
    expect(result.current.ambience).toBe(100)

    act(() => setVolume('ambience', -20))
    expect(result.current.ambience).toBe(0)

    act(() => setVolume('ambience', 42.6))
    expect(result.current.ambience).toBe(43)
  })

  it('also find out about what another tab changes', () => {
    const { result } = renderHook(() => useVolumes())

    act(() => {
      window.localStorage.setItem(VOLUME_KEYS.ambience, '15')
      window.dispatchEvent(new Event('storage'))
    })

    expect(result.current.ambience).toBe(15)
  })

  it('stop listening when nobody is watching them any more', () => {
    // The game is mounted and unmounted on every visit inside the hall: without
    // releasing the listener, every entry would leave one more stuck to the window.
    const first = renderHook(() => useVolumes())
    const second = renderHook(() => useVolumes())

    first.unmount()
    act(() => setVolume('sfx', 20))
    expect(second.result.current.sfx).toBe(20)

    second.unmount()
    // With nobody subscribed any more, a change cannot blow up by notifying an
    // unmounted component.
    expect(() => setVolume('sfx', 10)).not.toThrow()
  })

  it('do not keep what was read before even if nobody is listening', () => {
    // The snapshot is cached, and it is invalidated on writing and not in the listener:
    // there may not be one yet and even so the next read has to
    // see the new value.
    setVolume('sfx', 55)

    const { result } = renderHook(() => useVolumes())

    expect(result.current.sfx).toBe(55)
  })
})

describe('what is painted on the server', () => {
  it('is the default volumes, so that hydration squares', () => {
    // There is no `localStorage` to look at there. If the server painted something
    // other than the browser's first render, React would see two different trees.
    setVolume('sfx', 15)

    function Volume() {
      return <output>{useVolumes().sfx}</output>
    }

    expect(renderToString(<Volume />)).toContain(String(DEFAULT_VOLUMES.sfx))
  })

  it('and the default language, since the cookie is read by `requestLang`', () => {
    function Language() {
      return <output>{useLang()}</output>
    }

    setLang('es')

    expect(renderToString(<Language />)).toContain(DEFAULT_LANG)
  })
})

describe('the language', () => {
  it('starts at the default', () => {
    expect(currentLang()).toBe(DEFAULT_LANG)

    const { result } = renderHook(() => useLang())
    expect(result.current).toBe(DEFAULT_LANG)
  })

  it('with none chosen, the system one: a headset in Spanish starts in Spanish', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['es-ES', 'en'])

    expect(currentLang()).toBe('es')

    setLang('en')
    expect(currentLang()).toBe('en')
  })

  it('travels in a cookie, so that the server paints already translated', () => {
    setLang('es')

    expect(document.cookie).toContain(`${LANG_COOKIE}=es`)
    expect(currentLang()).toBe('es')
  })

  it('without `Secure` while served unencrypted, or it would not be saved locally', () => {
    // The other side of this same decision —with `https:` the cookie does carry it—
    // is tested in `settingsClient.https.test.tsx`, which sets the window up on
    // https: `window.location` cannot be changed halfway through a file.
    setLang('es')

    expect(document.cookie).not.toContain('Secure')
  })

  it('reaches what is already painted, since a cookie notifies nobody', () => {
    const { result } = renderHook(() => useLang())

    act(() => setLang('es'))

    expect(result.current).toBe('es')
  })
})

describe('at what height the game is played', () => {
  it('starts standing, which is how it was played before this existed', () => {
    const { result } = renderHook(() => usePlayHeight())

    expect(result.current).toBe('standing')
  })

  it('what is chosen in the hall reaches the cabinet without reloading', () => {
    // It is what makes it worth anything: whoever asks for it is **inside** the
    // hall, with the headset on, and the game mounted on this same page.
    // Reloading to find out would mean closing the immersive session.
    const { result } = renderHook(() => usePlayHeight())

    act(() => {
      window.localStorage.setItem(PLAY_HEIGHT_KEY, 'eyes')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('eyes')
  })

  it('a height that does not exist leaves the world where it was', () => {
    // Storage tampered with or from another version: the scene does not move.
    const { result } = renderHook(() => usePlayHeight())

    act(() => {
      window.localStorage.setItem(PLAY_HEIGHT_KEY, 'de-rodillas')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('standing')
  })
})

describe("the hall's fine height", () => {
  it('without the key the world does not move', () => {
    const { result } = renderHook(() => usePlayHeightOffset())

    expect(result.current).toBe(0)
  })

  it('with −15 the world goes down 0.15 m, and it reaches the cabinet without reloading', () => {
    const { result } = renderHook(() => usePlayHeightOffset())

    act(() => {
      window.localStorage.setItem(PLAY_HEIGHT_OFFSET_KEY, '-15')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBeCloseTo(-0.15, 10)
  })

  it('on the server it is zero', () => {
    function Height() {
      return <>{usePlayHeightOffset()}</>
    }

    expect(renderToString(<Height />)).toBe('0')
  })
})

describe('how what is picked up is held', () => {
  it('starts holding the trigger, as the tutorial teaches', () => {
    const { result } = renderHook(() => useGrabMode())

    expect(result.current).toBe('hold')
  })

  it('what is chosen in the hall reaches the cabinet without reloading', () => {
    const { result } = renderHook(() => useGrabMode())

    act(() => {
      window.localStorage.setItem(GRAB_MODE_KEY, 'toggle')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('toggle')
  })

  it('a grab that does not exist leaves the usual one', () => {
    const { result } = renderHook(() => useGrabMode())

    act(() => {
      window.localStorage.setItem(GRAB_MODE_KEY, 'con-la-boca')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('hold')
  })
})

describe('when the stage is turned with the stick', () => {
  it('with nothing saved, seated only', () => {
    const { result } = renderHook(() => useTurnMode())

    expect(result.current).toBe('auto')
  })

  it('what is chosen in the hall reaches the cabinet without reloading', () => {
    const { result } = renderHook(() => useTurnMode())

    act(() => {
      window.localStorage.setItem(TURN_MODE_KEY, 'stick')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('stick')
  })

  it('a turn that does not exist leaves the usual one', () => {
    const { result } = renderHook(() => useTurnMode())

    act(() => {
      window.localStorage.setItem(TURN_MODE_KEY, 'con-la-cabeza')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('auto')
  })
})

describe('what is seen around with the headset', () => {
  it('starts with the drawn place', () => {
    const { result } = renderHook(() => useScenery())

    expect(result.current).toBe('place')
  })

  it('what is chosen in the hall reaches the cabinet without reloading', () => {
    // What the hall's panel does: it writes the key and notifies through the event. The game is
    // mounted on this same page and the headset is still on, so it arrives this way or not at all.
    const { result } = renderHook(() => useScenery())

    act(() => {
      window.localStorage.setItem(SCENERY_KEY, 'room')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('room')
  })

  it("what the game's menu chooses writes the hall's key and is seen at once", () => {
    // A single preference: the game's button and the hall's panel read and write the same thing.
    const { result } = renderHook(() => useScenery())

    act(() => setScenery('room'))
    expect(result.current).toBe('room')
    expect(window.localStorage.getItem(SCENERY_KEY)).toBe('room')

    // Going back to the default deletes the key, like the volumes.
    act(() => setScenery('place'))
    expect(result.current).toBe('place')
    expect(window.localStorage.getItem(SCENERY_KEY)).toBeNull()
  })

  it('a scenery that does not exist leaves the drawn place', () => {
    const { result } = renderHook(() => useScenery())

    act(() => {
      window.localStorage.setItem(SCENERY_KEY, 'passthrough')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('place')
  })

  it('with the storage full, what was chosen lasts as long as the visit lasts', () => {
    // If the write fails and the read goes to the storage, the button lights up and the
    // stage does not change: the choice is lost in the same frame.
    const { result } = renderHook(() => useScenery())
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    act(() => setScenery('room'))
    expect(save).toHaveBeenCalled()
    expect(window.localStorage.getItem(SCENERY_KEY)).toBeNull()
    expect(result.current).toBe('room')

    // Returning to the default does get saved (deleting takes no room), and then the saved one rules.
    act(() => setScenery('place'))
    expect(result.current).toBe('place')

    // And if the storage recovers, what is saved rules again over what is remembered.
    save.mockRestore()
    act(() => setScenery('room'))
    act(() => {
      window.localStorage.removeItem(SCENERY_KEY)
      window.dispatchEvent(new Event('storage'))
    })
    expect(result.current).toBe('place')
  })

  it('on the server the default is painted, so that hydration squares', () => {
    // The web menu shows which one is chosen: if the server read something other than the
    // browser's first render, React would see two different trees.
    window.localStorage.setItem(SCENERY_KEY, 'room')

    function Scenery() {
      return <output>{useScenery()}</output>
    }

    expect(renderToString(<Scenery />)).toContain('place')
  })
})

describe('which hand the game is played with', () => {
  beforeEach(() => {
    // Also empties whatever a locked-down storage test left remembered in memory.
    setHand('right')
  })

  it('with nothing saved, the right one', () => {
    const { result } = renderHook(() => useHand())

    expect(result.current).toBe('right')
  })

  it('the left one saved in the hall is the left one', () => {
    window.localStorage.setItem(HAND_KEY, 'left')

    const { result } = renderHook(() => useHand())

    expect(result.current).toBe('left')
  })

  it('what is changed in the hall reaches the cabinet without reloading', () => {
    // The hall's panel writes the key and notifies through the event; another tab, via `storage`.
    const { result } = renderHook(() => useHand())

    act(() => {
      window.localStorage.setItem(HAND_KEY, 'left')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })
    expect(result.current).toBe('left')

    act(() => {
      window.localStorage.removeItem(HAND_KEY)
      window.dispatchEvent(new Event('storage'))
    })
    expect(result.current).toBe('right')
  })

  it('a hand that does not exist leaves the right one', () => {
    const { result } = renderHook(() => useHand())

    act(() => {
      window.localStorage.setItem(HAND_KEY, 'zurda')
      window.dispatchEvent(new Event('xrcade:ajustes'))
    })

    expect(result.current).toBe('right')
  })

  it("choosing it here writes the hall's key and is seen at once", () => {
    const { result } = renderHook(() => useHand())

    act(() => setHand('left'))
    expect(result.current).toBe('left')
    expect(window.localStorage.getItem(HAND_KEY)).toBe('left')

    act(() => setHand('right'))
    expect(result.current).toBe('right')
    expect(window.localStorage.getItem(HAND_KEY)).toBeNull()
  })

  it('with the storage full, what was chosen lasts as long as the visit lasts', () => {
    const { result } = renderHook(() => useHand())
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    act(() => setHand('left'))
    expect(window.localStorage.getItem(HAND_KEY)).toBeNull()
    expect(result.current).toBe('left')

    save.mockRestore()
  })

  it('on the server it is painted with the right one, so that hydration squares', () => {
    window.localStorage.setItem(HAND_KEY, 'left')

    function Hand() {
      return <output>{useHand()}</output>
    }

    expect(renderToString(<Hand />)).toContain('right')
  })
})
