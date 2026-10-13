import { describe, expect, it } from 'vitest'

import {
  DEFAULT_GRAB_MODE,
  DEFAULT_HAND,
  DEFAULT_LANG,
  DEFAULT_PLAY_HEIGHT,
  DEFAULT_PLAY_HEIGHT_OFFSET,
  DEFAULT_SCENERY,
  DEFAULT_TURN_MODE,
  DEFAULT_VOLUMES,
  DEFAULT_VOLUME_SETTINGS,
  GRAB_MODES,
  GRAB_MODE_KEY,
  HANDS,
  HAND_KEY,
  HAND_ORDER,
  LANGS,
  LANG_COOKIE,
  MAX_PLAY_HEIGHT_OFFSET,
  PLAY_HEIGHTS,
  PLAY_HEIGHT_KEY,
  PLAY_HEIGHT_OFFSET_KEY,
  SCENERIES,
  SCENERY_KEY,
  TURN_MODES,
  TURN_MODE_KEY,
  VOLUME_KEYS,
  asLang,
  chosenLang,
  langFor,
  langFromCookies,
  langFromSystem,
  parseGrabMode,
  parseHand,
  parseLang,
  parsePlayHeight,
  parsePlayHeightOffset,
  parseScenery,
  parseTurnMode,
  parseVolume,
  playHeightOffsetMeters,
  readGrabMode,
  readHand,
  readPlayHeight,
  readPlayHeightOffset,
  readScenery,
  readTurnMode,
  readVolumes,
  showsPlace,
  volumeFactor,
  writeGrabMode,
  writeHand,
  writePlayHeight,
  writeScenery,
  writeTurnMode,
  writeVolume,
} from './settings'

/**
 * The contract this game shares with xrcade and with the other games of the hall.
 *
 * The file is a **deliberate copy** —its header explains it—, so what
 * is tested here is not the logic on its own but the bridge: if a key
 * or a starting value departed from the hall's, picking Spanish or turning
 * the ambience down on the front page would stop showing inside the cabinet, and
 * silently. That is why the keys are written by hand in the expectations: a
 * comparison against the constant itself would not see the change.
 *
 * Everything that comes in comes from outside —a cookie and a storage that
 * anyone can edit from the browser's tools—, so the
 * other half of what is checked is that none of that leaves the game in a
 * state that does not exist.
 */

/** A fake storage, which can also refuse to work. */
function fakeStorage(initial: Record<string, string> = {}, broken = false): Storage {
  const data = new Map(Object.entries(initial))
  const blowUp = () => {
    if (broken) throw new Error('storage blocked')
  }

  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key: string) => {
      blowUp()
      return data.get(key) ?? null
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      blowUp()
      data.delete(key)
    },
    setItem: (key: string, value: string) => {
      blowUp()
      data.set(key, value)
    },
  }
}

describe('the keys of the hall', () => {
  it('are exactly the ones xrcade writes', () => {
    // Written by hand on purpose: it is the bridge between repositories, and against the
    // constant itself this would always pass.
    expect(LANG_COOKIE).toBe('xrcade_lang')
    expect(VOLUME_KEYS).toEqual({
      sfx: 'xrcade:volume:sfx',
      ambience: 'xrcade:volume:ambience',
    })
  })

  it('comes in in English and with the ambience below the effects', () => {
    expect(DEFAULT_LANG).toBe('en')
    expect(DEFAULT_VOLUMES).toEqual({ sfx: 100, ambience: 60 })
    expect(DEFAULT_VOLUME_SETTINGS).toEqual(DEFAULT_VOLUMES)
    expect(LANGS).toEqual(['en', 'es'])
  })
})

describe('the language that arrives from outside', () => {
  it('is valid if it is one of the ones there are', () => {
    expect(parseLang('es')).toBe('es')
    expect(parseLang('en')).toBe('en')
  })

  it('falls back to the starting one if it is anything else', () => {
    // A cookie edited by hand, or the one of a version that spoke another language.
    expect(parseLang('fr')).toBe(DEFAULT_LANG)
    expect(parseLang('')).toBe(DEFAULT_LANG)
    expect(parseLang(null)).toBe(DEFAULT_LANG)
    expect(parseLang(undefined)).toBe(DEFAULT_LANG)
  })
})

describe('the language written in a cookie header', () => {
  it('finds it wherever it is among the others', () => {
    expect(langFromCookies(`${LANG_COOKIE}=es`)).toBe('es')
    expect(langFromCookies(`otra=1; ${LANG_COOKIE}=es; ultima=2`)).toBe('es')
    // With spaces around it, which is how it arrives from `document.cookie`.
    expect(langFromCookies(` ${LANG_COOKIE}=es ; otra=1`)).toBe('es')
  })

  it('does not mistake a cookie that only starts the same', () => {
    expect(langFromCookies(`${LANG_COOKIE}_otra=es`)).toBe(DEFAULT_LANG)
  })

  it('decodes the value before looking at it', () => {
    expect(langFromCookies(`${LANG_COOKIE}=${encodeURIComponent('es')}`)).toBe('es')
  })

  it('without cookies, in the starting language', () => {
    expect(langFromCookies('')).toBe(DEFAULT_LANG)
    expect(langFromCookies(null)).toBe(DEFAULT_LANG)
    expect(langFromCookies(undefined)).toBe(DEFAULT_LANG)
  })
})

describe('the language not chosen: the system one', () => {
  it('tells what is chosen from what is not', () => {
    expect(chosenLang(`${LANG_COOKIE}=es`)).toBe('es')
    expect(chosenLang(`${LANG_COOKIE}=klingon`)).toBeNull()
    expect(chosenLang('otra=1')).toBeNull()
    expect(chosenLang(null)).toBeNull()
    expect(asLang('en')).toBe('en')
    expect(asLang(undefined)).toBeNull()
  })

  it('reads the server header by its weight, and only the language', () => {
    expect(langFromSystem('es-ES,es;q=0.9,en;q=0.8')).toBe('es')
    expect(langFromSystem('fr;q=0.9,en-GB;q=0.8,es;q=0.95')).toBe('es')
    expect(langFromSystem('es-MX')).toBe('es')
    expect(langFromSystem('es;q=0,en')).toBe('en')
    expect(langFromSystem('es;q=nada,en')).toBe('en')
    expect(langFromSystem('fr-FR,de')).toBeNull()
    expect(langFromSystem('')).toBeNull()
  })

  it('and the browser list, already sorted', () => {
    expect(langFromSystem(['de-DE', 'es-ES', 'en'])).toBe('es')
    expect(langFromSystem(['EN_us'])).toBe('en')
    expect(langFromSystem([])).toBeNull()
    expect(langFromSystem(null)).toBeNull()
  })

  it('the choice rules; with none, the system; with nothing of the hall, the starting one', () => {
    expect(langFor(`${LANG_COOKIE}=en`, ['es-ES'])).toBe('en')
    expect(langFor('', ['es-ES'])).toBe('es')
    expect(langFor(undefined, 'fr')).toBe(DEFAULT_LANG)
  })
})

describe('a volume read from storage', () => {
  it('is valid if it is an integer from 0 to 100', () => {
    expect(parseVolume('0', 60)).toBe(0)
    expect(parseVolume('37', 60)).toBe(37)
    expect(parseVolume('100', 60)).toBe(100)
  })

  it('falls back to the starting one if it is not', () => {
    expect(parseVolume(null, 60)).toBe(60)
    expect(parseVolume('', 60)).toBe(60)
    expect(parseVolume('alto', 60)).toBe(60)
    expect(parseVolume('37.5', 60)).toBe(60)
    expect(parseVolume('-5', 60)).toBe(60)
    // Three digits that go over 100: it gets in by its shape and out by its range.
    expect(parseVolume('101', 60)).toBe(60)
    expect(parseVolume('999', 60)).toBe(60)
    // Four digits are no longer the shape of a volume.
    expect(parseVolume('1000', 60)).toBe(60)
  })
})

describe('the volumes of the hall', () => {
  it('come from storage when there is something stored', () => {
    const storage = fakeStorage({
      [VOLUME_KEYS.sfx]: '40',
      [VOLUME_KEYS.ambience]: '0',
    })

    expect(readVolumes(storage)).toEqual({ sfx: 40, ambience: 0 })
  })

  it('are the starting ones when there is nothing, nor anywhere to store it', () => {
    expect(readVolumes(fakeStorage())).toEqual(DEFAULT_VOLUME_SETTINGS)
    expect(readVolumes(null)).toEqual(DEFAULT_VOLUME_SETTINGS)
  })

  it('survive a browser with blocked storage', () => {
    // A private window, or a browser with site cookies blocked: you
    // play with the starting values instead of leaving the game unable to start.
    expect(readVolumes(fakeStorage({}, true))).toEqual(DEFAULT_VOLUME_SETTINGS)
  })
})

describe('storing a volume', () => {
  it('writes it when it departs from the starting value', () => {
    const storage = fakeStorage()

    expect(writeVolume(storage, 'sfx', 40)).toBe(true)
    expect(storage.getItem(VOLUME_KEYS.sfx)).toBe('40')
  })

  it('forgets it when it is the starting one again', () => {
    // That way the storage holds something only when someone has decided something, and
    // deleting it returns the hall to how it came.
    const storage = fakeStorage({ [VOLUME_KEYS.ambience]: '10' })

    expect(writeVolume(storage, 'ambience', DEFAULT_VOLUMES.ambience)).toBe(true)
    expect(storage.getItem(VOLUME_KEYS.ambience)).toBeNull()
  })

  it('says no with nowhere to store, and does not blow up', () => {
    expect(writeVolume(null, 'sfx', 40)).toBe(false)
    expect(writeVolume(fakeStorage({}, true), 'sfx', 40)).toBe(false)
  })
})

describe('the volume the audio understands', () => {
  it('goes from 0 to 1', () => {
    expect(volumeFactor(0)).toBe(0)
    expect(volumeFactor(50)).toBe(0.5)
    expect(volumeFactor(100)).toBe(1)
  })

  it('does not go out of range even if it gets an impossible number', () => {
    expect(volumeFactor(-20)).toBe(0)
    expect(volumeFactor(400)).toBe(1)
  })
})

describe('at what height you play', () => {
  it('the key and the starting height are the ones xrcade writes', () => {
    // Written by hand on purpose, like the rest: it is the bridge between
    // repositories, and against the constant itself this would always pass.
    expect(PLAY_HEIGHT_KEY).toBe('xrcade:play-height')
    expect(DEFAULT_PLAY_HEIGHT).toBe('standing')
    expect(PLAY_HEIGHTS).toEqual(['standing', 'eyes'])
  })

  it('only a height that exists counts', () => {
    expect(parsePlayHeight('eyes')).toBe('eyes')
    expect(parsePlayHeight('standing')).toBe('standing')
    // Tampered storage or storage from another version: you play standing, which is
    // how you played before this existed.
    for (const junk of ['sentado', '', null, undefined]) {
      expect(parsePlayHeight(junk)).toBe('standing')
    }
  })

  it('is read from where the hall leaves it', () => {
    expect(readPlayHeight(fakeStorage({ [PLAY_HEIGHT_KEY]: 'eyes' }))).toBe('eyes')
    expect(readPlayHeight(fakeStorage())).toBe('standing')
  })

  it('with nowhere to look you play standing, and it does not blow up', () => {
    expect(readPlayHeight(null)).toBe('standing')
    expect(readPlayHeight(fakeStorage({}, true))).toBe('standing')
  })

  it('is stored on departing from standing, and forgotten on going back', () => {
    // That way the storage holds something only when someone has decided something.
    const storage = fakeStorage()

    expect(writePlayHeight(storage, 'eyes')).toBe(true)
    expect(storage.getItem(PLAY_HEIGHT_KEY)).toBe('eyes')

    expect(writePlayHeight(storage, 'standing')).toBe(true)
    expect(storage.getItem(PLAY_HEIGHT_KEY)).toBeNull()
  })

  it('says no with nowhere to store, and does not blow up', () => {
    expect(writePlayHeight(null, 'eyes')).toBe(false)
    expect(writePlayHeight(fakeStorage({}, true), 'eyes')).toBe(false)
  })
})

describe('how what you pick up is held', () => {
  it('the key and the starting grab are the ones xrcade writes', () => {
    expect(GRAB_MODE_KEY).toBe('xrcade:grab')
    expect(DEFAULT_GRAB_MODE).toBe('hold')
    expect(GRAB_MODES).toEqual(['hold', 'toggle'])
  })

  it('only a grab that exists counts', () => {
    expect(parseGrabMode('toggle')).toBe('toggle')
    expect(parseGrabMode('hold')).toBe('hold')
    for (const junk of ['mantener', '', null, undefined]) {
      expect(parseGrabMode(junk)).toBe('hold')
    }
  })

  it('is read from where the hall leaves it', () => {
    expect(readGrabMode(fakeStorage({ [GRAB_MODE_KEY]: 'toggle' }))).toBe('toggle')
    expect(readGrabMode(fakeStorage())).toBe('hold')
  })

  it('with nowhere to look you grab by holding, and it does not blow up', () => {
    expect(readGrabMode(null)).toBe('hold')
    expect(readGrabMode(fakeStorage({}, true))).toBe('hold')
  })

  it('is stored on departing from holding, and forgotten on going back', () => {
    const storage = fakeStorage()

    expect(writeGrabMode(storage, 'toggle')).toBe(true)
    expect(storage.getItem(GRAB_MODE_KEY)).toBe('toggle')

    expect(writeGrabMode(storage, 'hold')).toBe(true)
    expect(storage.getItem(GRAB_MODE_KEY)).toBeNull()
  })

  it('says no with nowhere to store, and does not blow up', () => {
    expect(writeGrabMode(null, 'toggle')).toBe(false)
    expect(writeGrabMode(fakeStorage({}, true), 'toggle')).toBe(false)
  })
})

describe('when the stage is turned with the stick', () => {
  it('the key and the starting turn are the ones xrcade will write', () => {
    expect(TURN_MODE_KEY).toBe('xrcade:giro')
    expect(DEFAULT_TURN_MODE).toBe('auto')
    expect(TURN_MODES).toEqual(['auto', 'stick'])
  })

  it('only a turn that exists counts', () => {
    expect(parseTurnMode('stick')).toBe('stick')
    expect(parseTurnMode('auto')).toBe('auto')
    for (const junk of ['siempre', '', null, undefined]) {
      expect(parseTurnMode(junk)).toBe('auto')
    }
  })

  it('is read from where the hall leaves it, and without it it is only seated', () => {
    // A hall older than the setting writes nothing: that has to remain a game that
    // can be played, not a failure.
    expect(readTurnMode(fakeStorage({ [TURN_MODE_KEY]: 'stick' }))).toBe('stick')
    expect(readTurnMode(fakeStorage())).toBe('auto')
  })

  it('with nowhere to look it turns only seated, and it does not blow up', () => {
    expect(readTurnMode(null)).toBe('auto')
    expect(readTurnMode(fakeStorage({}, true))).toBe('auto')
  })

  it('is stored on departing from the starting one, and forgotten on going back', () => {
    const storage = fakeStorage()

    expect(writeTurnMode(storage, 'stick')).toBe(true)
    expect(storage.getItem(TURN_MODE_KEY)).toBe('stick')

    expect(writeTurnMode(storage, 'auto')).toBe(true)
    expect(storage.getItem(TURN_MODE_KEY)).toBeNull()
  })

  it('says no with nowhere to store, and does not blow up', () => {
    expect(writeTurnMode(null, 'stick')).toBe(false)
    expect(writeTurnMode(fakeStorage({}, true), 'stick')).toBe(false)
  })
})

describe('what is seen around you with the headset', () => {
  it('the key, the values and the starting one are the ones xrcade writes', () => {
    // Written by hand, like the rest: it is the bridge between repositories, and against the
    // constant itself this would always pass. A key that departed from the hall's would leave the
    // cabinet with its stage even though the room had been chosen in the hall.
    expect(SCENERY_KEY).toBe('xrcade:scenery')
    expect(SCENERIES).toEqual(['place', 'room'])
    expect(DEFAULT_SCENERY).toBe('place')
  })

  it('only a scenery that exists counts', () => {
    expect(parseScenery('room')).toBe('room')
    expect(parseScenery('place')).toBe('place')
    // `passthrough` and `scene` included: they are the names stick-rush uses to talk about the
    // scenery inside its code, and written in the hall's key they mean nothing.
    for (const junk of ['ROOM', 'passthrough', 'scene', '', null, undefined]) {
      expect(parseScenery(junk)).toBe('place')
    }
  })

  it('is read from where the hall leaves it', () => {
    expect(readScenery(fakeStorage({ [SCENERY_KEY]: 'room' }))).toBe('room')
    expect(readScenery(fakeStorage())).toBe('place')
  })

  it('with nowhere to look the drawn place is seen, and it does not blow up', () => {
    expect(readScenery(null)).toBe('place')
    expect(readScenery(fakeStorage({}, true))).toBe('place')
  })

  it('is stored on choosing the room, and forgotten on going back to the drawn place', () => {
    const storage = fakeStorage()

    expect(writeScenery(storage, 'room')).toBe(true)
    expect(storage.getItem(SCENERY_KEY)).toBe('room')

    expect(writeScenery(storage, 'place')).toBe(true)
    expect(storage.getItem(SCENERY_KEY)).toBeNull()
  })

  it('says no with nowhere to store, and does not blow up', () => {
    expect(writeScenery(null, 'room')).toBe(false)
    expect(writeScenery(fakeStorage({}, true), 'room')).toBe(false)
  })

  describe('when the stage is rendered', () => {
    it('with the drawn place chosen, always', () => {
      expect(showsPlace('immersive-ar', 'place')).toBe(true)
    })

    it('with the room chosen and in augmented reality, no: the room is seen', () => {
      expect(showsPlace('immersive-ar', 'room')).toBe(false)
    })

    it('with the room chosen but in virtual reality, yes: there is no room behind', () => {
      // A headset without passthrough: removing the stage would leave the player staring at black.
      expect(showsPlace('immersive-vr', 'room')).toBe(true)
    })

    it('with the room chosen and outside the headset, too: the screen has no camera', () => {
      expect(showsPlace(null, 'room')).toBe(true)
      expect(showsPlace(undefined, 'room')).toBe(true)
    })
  })
})

describe('which hand you play with', () => {
  it('the key, the values and the starting one are the ones xrcade writes', () => {
    // Written by hand, like the rest: it is the bridge between repositories. The values are WebXR's
    // (`XRHandedness`), which is how `@react-three/xr` is asked for that hand's controller.
    expect(HAND_KEY).toBe('xrcade:hand')
    expect(HANDS).toEqual(['right', 'left'])
    expect(DEFAULT_HAND).toBe('right')
    // And they are shown as hands are when seen from the front.
    expect(HAND_ORDER).toEqual(['left', 'right'])
  })

  it('only a hand that exists counts', () => {
    expect(parseHand('left')).toBe('left')
    expect(parseHand('right')).toBe('right')
    for (const junk of ['zurdo', 'LEFT', 'none', '', null, undefined]) {
      expect(parseHand(junk)).toBe('right')
    }
  })

  it('is read from where the hall leaves it, and with nothing stored it is the right one', () => {
    expect(readHand(fakeStorage({ [HAND_KEY]: 'left' }))).toBe('left')
    expect(readHand(fakeStorage())).toBe('right')
  })

  it('is stored on choosing the left one, and forgotten on going back to the right one', () => {
    const storage = fakeStorage()

    expect(writeHand(storage, 'left')).toBe(true)
    expect(storage.getItem(HAND_KEY)).toBe('left')

    expect(writeHand(storage, 'right')).toBe(true)
    expect(storage.getItem(HAND_KEY)).toBeNull()
  })

  it('with no storage, or a blocked one, you play with the right one and it does not blow up', () => {
    expect(readHand(null)).toBe('right')
    expect(readHand(fakeStorage({}, true))).toBe('right')
    expect(writeHand(null, 'left')).toBe(false)
    expect(writeHand(fakeStorage({}, true), 'left')).toBe(false)
  })
})

describe('the fine height of the hall', () => {
  it('the key and the starting zero are the ones xrcade writes', () => {
    // Written by hand, like the rest: it is the bridge between repositories.
    expect(PLAY_HEIGHT_OFFSET_KEY).toBe('xrcade:play-height-offset')
    expect(DEFAULT_PLAY_HEIGHT_OFFSET).toBe(0)
    expect(MAX_PLAY_HEIGHT_OFFSET).toBe(30)
  })

  it('without the key the world does not move', () => {
    expect(readPlayHeightOffset(fakeStorage())).toBe(0)
    expect(playHeightOffsetMeters(readPlayHeightOffset(fakeStorage()))).toBe(0)
  })

  it('with −15 the world goes down fifteen centimetres', () => {
    const cm = readPlayHeightOffset(fakeStorage({ [PLAY_HEIGHT_OFFSET_KEY]: '-15' }))

    expect(cm).toBe(-15)
    expect(playHeightOffsetMeters(cm)).toBeCloseTo(-0.15, 9)
    expect(readPlayHeightOffset(fakeStorage({ [PLAY_HEIGHT_OFFSET_KEY]: '30' }))).toBe(30)
  })

  it('a broken value or one beyond the limit leaves the world without fine-tuning', () => {
    for (const junk of ['31', '-31', '12.5', 'arriba', '', '+5', '1000', null, undefined]) {
      expect(parsePlayHeightOffset(junk)).toBe(0)
    }
  })

  it('with nowhere to look there is no fine-tuning, and it does not blow up', () => {
    expect(readPlayHeightOffset(null)).toBe(0)
    expect(readPlayHeightOffset(fakeStorage({}, true))).toBe(0)
  })
})
