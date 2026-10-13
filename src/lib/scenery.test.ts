import { afterEach, describe, expect, it } from 'vitest'

import { SCENERIES, readScenery } from './settings'
import { OWN_SCENERY_KEY, SCENERY_HINTS, SCENERY_LABELS, forgetOwnScenery } from './scenery'

/**
 * How the hall's scenery is offered in this game.
 *
 * The preference and the rule of the backdrop are tested with the bridge (`settings.test.ts` and
 * `settingsClient.test.tsx`). What is left here is what belongs to glide-hockey: that the game's
 * own key does not rule and goes away.
 */

afterEach(() => {
  window.localStorage.clear()
})

describe('the game\'s own key', () => {
  it('is the game\'s, written by hand', () => {
    // If it drifted, the real one would be left undeleted and one that does not exist would be deleted.
    expect(OWN_SCENERY_KEY).toBe('glide-hockey:scenery')
  })

  it('does not rule: with it set to «your room» and the hall\'s one unset, the arcade room is seen', () => {
    window.localStorage.setItem(OWN_SCENERY_KEY, 'room')

    expect(readScenery(window.localStorage)).toBe('place')
  })

  it('is deleted without moving it to the hall\'s one', () => {
    window.localStorage.setItem(OWN_SCENERY_KEY, 'room')

    forgetOwnScenery(window.localStorage)

    expect(window.localStorage.getItem(OWN_SCENERY_KEY)).toBeNull()
    expect(window.localStorage.getItem('xrcade:scenery')).toBeNull()
  })

  it('does not touch what was chosen in the hall', () => {
    window.localStorage.setItem(OWN_SCENERY_KEY, 'place')
    window.localStorage.setItem('xrcade:scenery', 'room')

    forgetOwnScenery(window.localStorage)

    expect(readScenery(window.localStorage)).toBe('room')
  })

  it('without storage, or with one that throws, it does not blow up', () => {
    const broken = {
      removeItem() {
        throw new Error('storage blocked')
      },
    }

    expect(() => forgetOwnScenery(null)).not.toThrow()
    expect(() => forgetOwnScenery(broken)).not.toThrow()
  })
})

describe('how it is offered', () => {
  it('both places have a name and an explanation', () => {
    for (const scenery of SCENERIES) {
      expect(SCENERY_LABELS[scenery]).not.toBe('')
      expect(SCENERY_HINTS[scenery]).not.toBe('')
    }
  })

  it('warns that your own room is only seen with the headset', () => {
    // In the browser the option is there and does nothing: without saying so, it
    // reads as the game being broken.
    expect(SCENERY_HINTS.room).toMatch(/[Hh]eadset/)
  })
})
