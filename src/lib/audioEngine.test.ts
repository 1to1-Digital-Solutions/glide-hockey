import { describe, expect, it, vi } from 'vitest'
import { MAX_PUCK_SPEED } from './gameConfig'
import { LOWPASS_OPEN, createGlideHockeyAudio, impactStrength, slideLevel, slidePitch } from './audioEngine'
import { STALL_SPEED } from './puckPhysics'

/**
 * The Web Audio API does not exist in jsdom, so it is given a fake one that
 * records what is asked of it. What is checked here is not how it sounds
 * —that has to be heard— but the decisions that can indeed break without
 * anybody noticing: when the context is created, that it resumes if the
 * browser stopped it, that it is released on close and that the three sounds
 * are not the same one.
 */
function fakeParam(): AudioParam {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  } as unknown as AudioParam
}

/**
 * @param rejection  What `resume()` and `close()` refuse with. The browser
 *   really rejects those two promises —the autoplay policy one, an already
 *   closed context the other—, so the double has to be able to do it: it is
 *   the case in which an unhandled failure dirties the game's console, which
 *   is what `e2e/console.spec.ts` watches.
 */
function fakeAudioContext(
  state: AudioContextState = 'running',
  rejection: Error | null = null,
) {
  const gains: { gain: AudioParam }[] = []
  const filters: { type: string; frequency: number }[] = []
  /** The real filters, to look at what is asked of them and what they connect to. */
  const bus: { type: string; frequency: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> }; Q: { value: number }; connect: ReturnType<typeof vi.fn> }[] = []
  /** The sources created, to be able to make one fail when it is stopped. */
  const sources: { stop: () => void }[] = []
  const oscillators: { frequency: number }[] = []
  /** How many times each thing that returns a promise has been requested. */
  const calls = { resume: 0, close: 0 }
  /** Rejected promises whose failure nobody has handled. */
  const unhandled: string[] = []

  /**
   * What a method that can fail returns, recording whether anybody handles it.
   *
   * By hand and **without `vi.fn`**: vitest's doubles chain a `then` onto the
   * promise the spied function returns to note down how it ended, and that
   * `then` handles the failure on its own. With one in between, this double
   * would say everything is handled whatever happens.
   *
   * It is watched on `then` and not on `catch` because `catch(fn)` is
   * `then(undefined, fn)` and looks it up on the promise itself: that way both
   * ways of handling a failure count.
   */
  const respond = (name: 'resume' | 'close') => () => {
    calls[name]++
    if (rejection == null) return Promise.resolve()

    unhandled.push(name)
    const promise = Promise.reject(rejection)
    const then = promise.then.bind(promise)
    promise.then = ((onFulfilled, onRejected) => {
      if (onRejected != null) {
        unhandled.splice(unhandled.indexOf(name), 1)
      }
      return then(onFulfilled, onRejected)
    }) as typeof promise.then
    return promise
  }

  const resume = respond('resume')
  const close = respond('close')

  const context = {
    state,
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    resume,
    close,
    createGain: () => {
      const gain = { gain: fakeParam(), connect: vi.fn() }
      // They are recorded in the order they are created: the master is the
      // first, because it is the one that hangs from the destination before
      // anything else.
      gains.push(gain)
      return gain
    },
    createBiquadFilter: () => {
      const filter = {
        type: 'lowpass',
        frequency: { value: 0, setTargetAtTime: vi.fn() },
        Q: { value: 0 },
        connect: vi.fn(),
        context: { currentTime: 0 },
      }
      bus.push(filter)
      // It is recorded on creation but read through a getter: that way the
      // filter is inspected already configured, not with the values it is
      // born with.
      filters.push({
        get type() {
          return filter.type
        },
        get frequency() {
          return filter.frequency.value
        },
      })
      return filter
    },
    createBufferSource: () => {
      const source = {
        buffer: null,
        loop: false,
        playbackRate: { value: 1 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      sources.push(source)
      return source
    },
    createOscillator: () => {
      let frequency = 0
      const oscillator = {
        type: 'sine',
        frequency: {
          setValueAtTime: (value: number) => {
            frequency = value
          },
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      oscillators.push({
        get frequency() {
          return frequency
        },
      })
      return oscillator
    },
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
  }

  return {
    context: context as unknown as AudioContext,
    /** The master node, which is where everything that sounds goes through. */
    master: () => gains[0].gain,
    filters,
    bus,
    oscillators,
    sources,
    calls,
    unhandled,
  }
}

describe('createGlideHockeyAudio', () => {
  it('does not touch the browser audio until there is something to sound', () => {
    const fake = fakeAudioContext()
    const createContext = vi.fn(() => fake.context)

    const audio = createGlideHockeyAudio(createContext)
    expect(createContext).not.toHaveBeenCalled()

    audio.play('strike')
    audio.play('bounce')
    // A single context for the whole match: they are a scarce resource and
    // the browser cuts off at around ten.
    expect(createContext).toHaveBeenCalledTimes(1)
  })

  it('resumes the context the browser left suspended', () => {
    const fake = fakeAudioContext('suspended')

    createGlideHockeyAudio(() => fake.context).play('strike')

    expect(fake.calls.resume).toBe(1)
  })

  it('the context that refuses to sound leaves no unhandled failures', () => {
    // A browser that does not yet accept the interaction rejects the
    // `resume()` of every strike. Without catching it, such a match leaves
    // dozens of loose failures in the console —and the clean console is what
    // `e2e/console.spec.ts` watches—, with the game working just as mute.
    const fake = fakeAudioContext('suspended', new Error('NotAllowedError'))
    const audio = createGlideHockeyAudio(() => fake.context)

    audio.play('strike')
    audio.close()

    expect(fake.calls).toEqual({ resume: 1, close: 1 })
    expect(fake.unhandled).toEqual([])
  })

  it('the three sounds are filtered differently, so that they do not sound alike', () => {
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    audio.play('strike')
    audio.play('bounce')
    audio.play('goal')

    // The first one is the bus low-pass, which belongs to all and not to one sound.
    const used = fake.filters.slice(1).map(
      (filter) => `${filter.type}:${filter.frequency}`,
    )
    expect(new Set(used).size).toBe(3)
  })

  it('the goal carries melody and the strikes only body', () => {
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    // A strike is one tone and nothing else: it is the body of the impact.
    audio.play('strike')
    expect(fake.oscillators).toHaveLength(1)

    // The goal is two different notes, and the second one higher: it is what
    // reads as a celebration and not as another strike.
    audio.play('goal')
    const [first, second] = fake.oscillators.slice(1)
    expect(fake.oscillators).toHaveLength(3)
    expect(second.frequency).toBeGreaterThan(first.frequency)
  })

  it('the end of the match sounds, and winning and losing do not sound alike', () => {
    // Finishing was silence: the last goal went in, it sounded like any other and the
    // end screen arrived without warning. With the headset on the scoreboard is where one
    // is not always looking.
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    audio.play('win')
    const winning = fake.oscillators.map((o) => o.frequency)
    audio.play('loss')
    const losing = fake.oscillators.slice(winning.length).map((o) => o.frequency)

    expect(winning.length).toBeGreaterThan(0)
    expect(losing.length).toBeGreaterThan(0)
    // Winning rises and losing falls, which is what the ear understands without having learnt it.
    expect(Math.max(...winning)).toBeGreaterThan(Math.min(...winning))
    expect(Math.min(...losing)).toBeLessThan(Math.min(...winning))
  })

  it('a closing strikes nothing: it goes without hiss', () => {
    // The noise of the impact in an ending would sound as if something had broken.
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    // **New** filters are counted per sound: the context already sets up its own for the
    // slide of the puck as soon as it opens, so the total says nothing by itself.
    const newFilters = (sound: 'goal' | 'win' | 'loss' | 'record') => {
      const before = fake.filters.length
      audio.play(sound)
      return fake.filters.length - before
    }

    expect(newFilters('goal')).toBeGreaterThan(0)
    expect(newFilters('win')).toBe(0)
    expect(newFilters('loss')).toBe(0)
    expect(newFilters('record')).toBe(0)
  })

  it('the beaten record sounds above everything and after the closing', () => {
    // It goes apart from the closing because it can be beaten winning or losing the match.
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    audio.play('win')
    const winning = fake.oscillators.map((o) => o.frequency)
    audio.play('record')
    const record = fake.oscillators.slice(winning.length).map((o) => o.frequency)

    expect(Math.min(...record)).toBeGreaterThan(Math.max(...winning))
  })

  it('the medal threshold: two notes going up, higher the better the medal is, and with no hiss', () => {
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)
    // The goal that crosses the threshold sounds first, and with it the context opens with its
    // bus filter.
    audio.play('goal')
    const notes = (['medal-bronze', 'medal-silver', 'medal-gold'] as const).map((sound) => {
      const before = { oscillators: fake.oscillators.length, filters: fake.filters.length }
      audio.play(sound)
      // It strikes nothing: no hiss, like the closings.
      expect(fake.filters.length - before.filters, sound).toBe(0)
      return fake.oscillators.slice(before.oscillators).map((o) => o.frequency)
    })

    for (const [first, second] of notes) expect(second).toBeGreaterThan(first)
    expect(notes.map((pair) => pair.length)).toEqual([2, 2, 2])
    expect(notes[1][0]).toBeGreaterThan(notes[0][0])
    expect(notes[2][0]).toBeGreaterThan(notes[1][0])
  })

  it('and it ignores the strength: it is a celebration, like the goal', () => {
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    audio.play('medal-gold', 0)
    audio.play('medal-gold', 1)

    const [weak, , strong] = fake.oscillators.map((o) => o.frequency)
    expect(weak).toBe(strong)
  })

  it('without Web Audio it is played in silence and it is not retried on every strike', () => {
    const createContext = vi.fn(() => null)
    const audio = createGlideHockeyAudio(createContext)

    expect(() => {
      audio.play('strike')
      audio.play('bounce')
      audio.play('goal')
      audio.close()
    }).not.toThrow()
    expect(createContext).toHaveBeenCalledTimes(1)
  })

  it('closing releases the context and the next sound opens a new one', () => {
    const fake = fakeAudioContext()
    const createContext = vi.fn(() => fake.context)
    const audio = createGlideHockeyAudio(createContext)

    audio.play('strike')
    audio.close()
    expect(fake.calls.close).toBe(1)

    audio.play('strike')
    expect(createContext).toHaveBeenCalledTimes(2)
  })
})

describe('the strength of the impact', () => {
  it('goes from 0 to 1 with the speed, and to the cap at the maximum speed of the puck', () => {
    expect(impactStrength(0)).toBe(0)
    expect(impactStrength(-1)).toBe(0)
    expect(impactStrength(Number.NaN)).toBe(0)
    expect(impactStrength(MAX_PUCK_SPEED / 2)).toBeCloseTo(0.5, 5)
    expect(impactStrength(MAX_PUCK_SPEED)).toBe(1)
    expect(impactStrength(MAX_PUCK_SPEED * 3)).toBe(1)
  })

  /** The volume peaks that were asked of each gain in one playback. */
  function peaks(play: (audio: ReturnType<typeof createGlideHockeyAudio>) => void): number[] {
    const fake = fakeAudioContext()
    const values: number[] = []
    const context = fake.context as unknown as { createGain: () => unknown }
    context.createGain = () => ({
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: (value: number) => {
          if (value > 0.001) values.push(value)
        },
      },
      connect: vi.fn(),
    })
    play(createGlideHockeyAudio(() => fake.context))
    return values
  }

  it('a brush sounds quieter than a sharp strike, but it does not go silent', () => {
    const sharp = Math.max(...peaks((audio) => audio.play('bounce', 1)))
    const brush = Math.max(...peaks((audio) => audio.play('bounce', 0)))
    const medium = Math.max(...peaks((audio) => audio.play('bounce', 0.5)))

    expect(brush).toBeGreaterThan(0)
    expect(brush).toBeLessThan(medium)
    expect(medium).toBeLessThan(sharp)
    // With no strength given, it sounds whole: it is what it did before.
    expect(Math.max(...peaks((audio) => audio.play('bounce')))).toBe(sharp)
  })

  it('the weak strike sounds a little lower', () => {
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)
    audio.play('strike', 1)
    audio.play('strike', 0)
    const [strong, weak] = fake.oscillators
    expect(weak.frequency).toBeLessThan(strong.frequency)
  })

  it('the goal ignores the strength: it is a celebration', () => {
    const whole = peaks((audio) => audio.play('goal', 1))
    const weak = peaks((audio) => audio.play('goal', 0))
    expect(weak).toEqual(whole)
  })
})

describe('the slide of the puck', () => {
  it('does not sound at rest and rises with the speed up to a background level, never to a whole strike', () => {
    expect(slideLevel(0)).toBe(0)
    expect(slideLevel(STALL_SPEED)).toBe(0)
    expect(slideLevel(1)).toBeGreaterThan(0)
    expect(slideLevel(3)).toBeGreaterThan(slideLevel(1))
    expect(slideLevel(MAX_PUCK_SPEED)).toBeLessThan(0.5)
    expect(slideLevel(MAX_PUCK_SPEED * 3)).toBe(slideLevel(MAX_PUCK_SPEED))
    expect(slideLevel(Number.NaN)).toBe(0)
  })

  it('the start is heard more than the top end: the curve is a root', () => {
    const start = slideLevel(1) - slideLevel(STALL_SPEED)
    const top = slideLevel(MAX_PUCK_SPEED) - slideLevel(MAX_PUCK_SPEED - 1)
    expect(start).toBeGreaterThan(top)
  })

  it('faster, higher', () => {
    expect(slidePitch(0)).toBeLessThan(slidePitch(3))
    expect(slidePitch(3)).toBeLessThan(slidePitch(MAX_PUCK_SPEED))
    expect(slidePitch(MAX_PUCK_SPEED * 2)).toBe(slidePitch(MAX_PUCK_SPEED))
  })

  it('does not open the context on its own: until the first strike there is nothing to slide', () => {
    const create = vi.fn(() => fakeAudioContext().context)
    const audio = createGlideHockeyAudio(create)

    audio.slide(3)
    expect(create).not.toHaveBeenCalled()

    audio.play('strike')
    audio.slide(3)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('a single looped voice that follows the speed smoothed, and stops on close', () => {
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)
    audio.play('strike')
    const filtersBefore = fake.filters.length

    audio.slide(2)
    audio.slide(4)
    audio.slide(0)

    // One voice: one filter more than those of the strike, even if it was called three times.
    expect(fake.filters.length).toBe(filtersBefore + 1)
    audio.close()
    // And closing does not leave the slide sounding in a context that no longer exists.
    audio.slide(3)
    expect(fake.filters.length).toBe(filtersBefore + 1)
  })
})


describe('the context the browser opens', () => {
  it('without Web Audio in the browser, it is played in silence', () => {
    // It is what happens in an old browser or with the audio banned by policy:
    // the game has to go on, not take the scene down with it.
    vi.stubGlobal('window', {})

    const audio = createGlideHockeyAudio()
    expect(() => audio.play('strike')).not.toThrow()

    vi.unstubAllGlobals()
  })

  it('with no window at all it does not break either', () => {
    vi.stubGlobal('window', undefined)

    const audio = createGlideHockeyAudio()
    expect(() => audio.play('strike')).not.toThrow()

    vi.unstubAllGlobals()
  })

  it('if opening the context fails, it is played in silence', () => {
    // No permission, no audio output or too many contexts open.
    class Broken {
      constructor() {
        throw new Error('no audio output')
      }
    }
    vi.stubGlobal('window', { AudioContext: Broken })

    const audio = createGlideHockeyAudio()
    expect(() => audio.play('strike')).not.toThrow()

    vi.unstubAllGlobals()
  })

  it('with Web Audio, it opens it and sounds', () => {
    const fake = fakeAudioContext()
    vi.stubGlobal('window', { AudioContext: function () { return fake.context } })

    const audio = createGlideHockeyAudio()
    audio.play('strike')

    expect(fake.oscillators.length).toBeGreaterThan(0)
    vi.unstubAllGlobals()
  })
})

describe('closing the player', () => {
  it('a voice already stopped does not prevent closing the context', () => {
    // The browser throws if the same source is stopped twice, and that happens
    // when leaving the match right after the slide goes silent on its own.
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)
    // The first strike is what opens the context; without it there is no slide to stop.
    audio.play('strike')
    audio.slide(5)

    // The last source created is the slide voice; the strike creates its own.
    const voice = fake.sources[fake.sources.length - 1]
    voice.stop = () => {
      throw new Error('already stopped')
    }

    expect(() => audio.close()).not.toThrow()
    expect(fake.calls.close).toBe(1)
  })
})

describe('impossible speeds', () => {
  it('a speed that is not a number does not raise the volume of the slide', () => {
    // It comes from the puck every frame: on coming back from a background tab
    // it can arrive as NaN, and with that the volume would go to anything.
    expect(slideLevel(Number.NaN)).toBe(slideLevel(0))
    expect(slidePitch(Number.NaN)).toBe(slidePitch(0))
  })

  it('and a strike with no known speed is the weakest, not the strongest', () => {
    expect(impactStrength(Number.NaN)).toBe(impactStrength(0))
  })
})

describe('the effects volume of the hall', () => {
  it('reaches the master node, which is where everything goes through', () => {
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    audio.play('goal')
    const full = fake.master().value

    audio.setVolume(0.5)

    expect(fake.master().value).toBeCloseTo(full / 2, 6)
  })

  it('is kept for when there is audio, if it is requested before opening it', () => {
    // The context does not open until the first sound, and the volume is
    // chosen before, on the hall's front page: requesting it with the audio
    // still closed cannot get lost.
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    audio.setVolume(0.5)
    audio.play('goal')

    const atHalf = fake.master().value
    audio.setVolume(1)

    expect(atHalf).toBeCloseTo(fake.master().value / 2, 6)
  })

  it('does not go beyond what the browser admits', () => {
    // What arrives are settings from outside: above one the gain saturates,
    // which is not sounding louder but sounding broken.
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    audio.play('goal')
    const full = fake.master().value

    audio.setVolume(4)
    expect(fake.master().value).toBeCloseTo(full, 6)

    audio.setVolume(-1)
    expect(fake.master().value).toBe(0)
  })
})

describe('the bus low-pass', () => {
  it('goes between the master and the output, open and flat until somebody closes it', () => {
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)
    audio.play('strike')

    const filter = fake.bus[0]
    expect(filter.type).toBe('lowpass')
    expect(filter.frequency.value).toBe(LOWPASS_OPEN)
    expect(filter.Q.value).toBeCloseTo(Math.SQRT1_2)
    expect(filter.connect).toHaveBeenCalledWith(fake.context.destination)
  })

  it('closes and opens smoothed, bounded to what can be heard', () => {
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)
    audio.play('strike')
    const filter = fake.bus[0]

    audio.setLowpass(500)
    expect(filter.frequency.setTargetAtTime).toHaveBeenLastCalledWith(500, 0, expect.any(Number))
    audio.setLowpass(1e6)
    expect(filter.frequency.setTargetAtTime).toHaveBeenLastCalledWith(LOWPASS_OPEN, 0, expect.any(Number))
    audio.setLowpass(0)
    expect(filter.frequency.setTargetAtTime).toHaveBeenLastCalledWith(20, 0, expect.any(Number))
  })

  it('with the audio not open yet, the requested cutoff is applied when it opens', () => {
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)
    audio.setLowpass(800)
    audio.play('strike')
    expect(fake.bus[0].frequency.value).toBe(800)
  })
})
