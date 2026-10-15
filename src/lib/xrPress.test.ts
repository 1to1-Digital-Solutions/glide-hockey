import { describe, expect, it, vi } from 'vitest'
import { PRESS_DEBOUNCE_MS, pressCounts, pressTime } from './xrPress'

describe('when a press in the headset counts', () => {
  it('the first always counts', () => {
    expect(pressCounts(1000, null)).toBe(true)
  })

  it('an immediate second one is the other pointer of the same gesture', () => {
    expect(pressCounts(1000, 1000 - PRESS_DEBOUNCE_MS + 1)).toBe(false)
  })

  it('past the window it counts again', () => {
    expect(pressCounts(1000, 1000 - PRESS_DEBOUNCE_MS)).toBe(true)
  })

  it('a disabled button does not respond', () => {
    expect(pressCounts(1000, null, true)).toBe(false)
  })

  it('without a clock it counts, which is preferable to a mute menu', () => {
    expect(pressCounts(null, 500)).toBe(true)
  })
})

describe('when it was pressed', () => {
  it('in the browser, the precision clock', () => {
    expect(pressTime()).toBeCloseTo(performance.now(), -2)
  })

  it('with no clock to trust, it is not known, and then the press counts', () => {
    // When in doubt a button responds: a whole menu that does not react leaves
    // no trace in the console to explain it.
    vi.stubGlobal('performance', undefined)
    expect(pressTime()).toBeNull()
    expect(pressCounts(pressTime(), 0, false)).toBe(true)
    vi.unstubAllGlobals()
  })
})
