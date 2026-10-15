// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { markHandBusy, releaseHands, subscribeToHands as subscribe } from './busyHands'

/**
 * Which hand is holding something, which is what turns that controller's ray off.
 *
 * The frame loop writes it, ninety times a second, so what matters is that **it only
 * notifies when something changes**: one notification per frame would repaint the whole tree
 * ninety times a second for a boolean that has not moved.
 */

afterEach(() => releaseHands())

describe('marking a hand busy', () => {
  it('notifies on change, and not while it stays the same', () => {
    const listener = vi.fn()
    const remove = subscribe(listener)

    markHandBusy('left', true)
    markHandBusy('left', true)
    markHandBusy('left', true)

    expect(listener).toHaveBeenCalledTimes(1)
    remove()
  })

  it('each hand goes its own way', () => {
    const listener = vi.fn()
    const remove = subscribe(listener)

    markHandBusy('left', true)
    markHandBusy('right', true)

    expect(listener).toHaveBeenCalledTimes(2)
    remove()
  })

  it('releasing them all notifies once, and does not notify if they were already free', () => {
    const listener = vi.fn()
    const remove = subscribe(listener)

    releaseHands()
    expect(listener).not.toHaveBeenCalled()

    markHandBusy('left', true)
    markHandBusy('right', true)
    listener.mockClear()
    releaseHands()

    expect(listener).toHaveBeenCalledTimes(1)
    remove()
  })
})
