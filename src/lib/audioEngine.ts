/**
 * The sounds of the game, **synthesised on the spot**.
 *
 * Not a single audio file, and not to save anything: an xrcade game cannot
 * request anything from another origin and whatever it serves has to be copied
 * by the host into its `public/` with `npx glide-hockey-assets` (see
 * `docs/xrcade.md`). A mallet strike and a bounce off the rail are noise with
 * a very short envelope —what the Web Audio API does without downloading
 * anything—, so a `.wav` is not missed here, and on top of that there are no
 * files to copy nor a version to keep in sync.
 *
 * Each sound is two layers: **filtered noise**, which is what gives it the
 * material (the hard plastic of the mallet, the dull wood of the rail), and
 * one or more **tones**, which are the body of the strike and, in the goal,
 * the melody. With both, a strike sounds like a strike; with only the first,
 * like static.
 *
 * **The context is created with the first sound, not when the scene mounts.**
 * Browsers start suspended any `AudioContext` created before anybody has
 * touched anything, and the table mounts before the player presses «Jugar»:
 * creating it here, the first strike arrives with the permission already
 * given. The `resume()` of each sound covers the other case, which is coming
 * back to the game after the system suspended it because nobody was looking.
 *
 * Having no Web Audio —or the browser refusing to give a context— leaves the
 * game mute and nothing else: the sound tells what happens, it decides nothing.
 */

/** What sounds in a match: the three strikes, and how it ends. */
import { MAX_PUCK_SPEED } from './gameConfig'
import { SLIDE_PITCH_MIN, SLIDE_SMOOTHING, slideLevel, slidePitch } from './slideSound'

export type GameSound =
  | 'strike'
  | 'bounce'
  | 'goal'
  | 'win'
  | 'loss'
  | 'record'
  /** A medal threshold is crossed (`THRESHOLD_SOUND` of `scoreboardSign.ts`). */
  | 'medal-bronze'
  | 'medal-silver'
  | 'medal-gold'

// The slide of the puck: how loud and at what pitch, depending on the speed. Kept apart because
// the Godot port uses it as is to modulate its loop, and this file, which opens the browser's
// audio, cannot go into the engine.
export { slideLevel, slidePitch } from './slideSound'
/**
 * How strong an impact is, from 0 to 1, from its speed in m/s.
 * The cap is the puck's maximum speed: a strike at that speed is the whole
 * sound; a puck that brushes the rail at a hand's width per second can barely
 * be heard. It is what silences the ugly case of a puck trapped in a corner
 * rattling at full volume.
 */
export function impactStrength(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 0
  return Math.min(1, speed / MAX_PUCK_SPEED)
}

/** How loud a strike of zero strength is: never fully mute if there was one. */
const MIN_LEVEL = 0.2
/** How much higher in pitch a strong strike is compared with a weak one. */
const PITCH_SPREAD = 0.2
/** Player of the game's sounds. */
export interface GlideHockeyAudio {
  /**
   * Fires a sound. `strength` (0 to 1) is the strength of the impact: it scales
   * the volume and slightly the pitch of the strike and of the bounce; the goal
   * ignores it, being a celebration and not an impact. With nothing to play it
   * with, it does nothing.
   */
  play: (sound: GameSound, strength?: number) => void
  /**
   * The puck sliding: a continuous rub whose volume and pitch follow the speed
   * (m/s). It is called every frame; at 0 it goes silent. It does not open the
   * context on its own: until the first strike there is nothing to slide.
   */
  slide: (speed: number) => void
  /** Releases the context. Without this one audio stays open per mounted scene. */
  close: () => void
  /**
   * How much of all this is heard, from 0 to 1: the effects volume of the hall's
   * settings. It multiplies the game's master and does not replace it
   * —`MASTER_GAIN` says how loud this game is against the others—, and it can be
   * called with the audio not open yet: it is applied when it opens.
   */
  setVolume: (factor: number) => void
  /**
   * The cutoff of the bus low-pass, in hertz: the «muffled ear» of a hit taken
   * (`components/xr/HitFeedback.tsx`). Fully open it removes nothing that can
   * be heard. It can be called with the audio not open yet: it is applied when
   * it opens, just like the volume.
   */
  setLowpass: (hz: number) => void
}

/**
 * Overall volume, from 0 to 1.
 *
 * **The same number in the thirteen games**, and that is the point: the effects volume is
 * chosen once in the hall and hopping to another cabinet cannot change what is heard. It was
 * 0.28 in eight, 0.40 in three and 0.45 in two —with this very comment in all of them—, so the
 * same slider position sounded three or four decibels different depending on the game.
 *
 * Below half on purpose: it is played with a headset on and the sound is a hand's width from
 * the ears. If a game sounds weak or loud compared with the others, what has to move is
 * **its recipe**, not this number: moving it here throws the thirteen out of line again.
 */
const MASTER_GAIN = 0.35

/**
 * The bus low-pass, open: above what can be heard, so it removes nothing.
 * Butterworth Q, the flattest: with more, the cutoff would make a peak that
 * would be heard as a whistle as it closes.
 */
export const LOWPASS_OPEN = 20000
const LOWPASS_Q = Math.SQRT1_2

/**
 * How long the cutoff takes to reach where it is asked to go, in seconds. A
 * new one is requested every frame while the hit lasts, and a hard jump in
 * frequency on each one would crackle.
 */
const LOWPASS_SMOOTHING = 0.01

/** Value an envelope fades out to. Zero will not do: the exponential
 * ramps of the Web Audio API forbid it. */
const SILENCE = 0.0001

/** Seconds of noise generated once and reused on every strike. */
const NOISE_SECONDS = 1

/** The noise layer of a sound: which material is being heard. */
interface NoiseLayer {
  /** What is let through: highs (the mallet) or a narrow band (the wood). */
  filter: BiquadFilterType
  frequency: number
  /** How narrow the filter gets. High = more «tonal», low = more noise. */
  q: number
  peak: number
  /** Rise, in seconds. Instant it clicks; lengthening it softens the strike. */
  attack: number
  /** How long it lasts until it fades out, in seconds. */
  seconds: number
}

/** A tone: the body of the strike, or a note of the goal's melody. */
interface ToneLayer {
  type: OscillatorType
  /** From which frequency to which, in Hz. Equal is a held note. */
  from: number
  to: number
  peak: number
  /** When it comes in, in seconds from the start of the sound. */
  delay: number
  seconds: number
}

interface SoundRecipe {
  /**
   * The hiss of the strike. Optional because the closings do not carry it: an ending strikes
   * nothing, and the noise of an impact there would sound as if something had broken.
   */
  noise?: NoiseLayer
  tones: readonly ToneLayer[]
}

/**
 * How each thing sounds.
 *
 * The three have to be told apart **without looking at the scoreboard**, so
 * they are separated by register and by duration, not by volume: the mallet is
 * a sharp and very short click, the rail a duller strike and a touch longer,
 * and the goal the only one with melody —two notes going up a fifth— because
 * it is the only thing to celebrate.
 */
/** What sounds just as loud whatever happens: they are not impacts. */
const NO_STRENGTH = new Set<GameSound>(['goal', 'win', 'loss', 'record', 'medal-bronze', 'medal-silver', 'medal-gold'])

/** How long it waits for the goal that crossed the threshold to fade out, in seconds. */
const MEDAL_DELAY = 0.5

/**
 * The threshold crossed: two short notes going up, a fifth, higher the better the medal is
 * —C, E and G, those of the chord a win is played with—. Short on purpose, since the match
 * goes on, and with no hiss: it strikes nothing.
 */
function medalRecipe(base: number): SoundRecipe {
  return {
    tones: [base, base * 1.5].map((hz, index) => ({
      type: 'sine' as const,
      from: hz,
      to: hz,
      peak: 0.3,
      delay: MEDAL_DELAY + index * 0.09,
      seconds: index === 0 ? 0.09 : 0.2,
    })),
  }
}

const RECIPES: Record<GameSound, SoundRecipe> = {
  strike: {
    noise: {
      filter: 'highpass',
      frequency: 2200,
      q: 0.9,
      peak: 0.8,
      attack: 0.001,
      seconds: 0.085,
    },
    tones: [
      {
        type: 'triangle',
        from: 320,
        to: 120,
        peak: 0.5,
        delay: 0,
        seconds: 0.07,
      },
    ],
  },
  bounce: {
    noise: {
      filter: 'bandpass',
      frequency: 780,
      q: 1.4,
      peak: 0.6,
      attack: 0.001,
      seconds: 0.11,
    },
    tones: [
      { type: 'sine', from: 190, to: 90, peak: 0.42, delay: 0, seconds: 0.1 },
    ],
  },
  goal: {
    noise: {
      filter: 'highpass',
      frequency: 1500,
      q: 0.7,
      peak: 0.35,
      attack: 0.002,
      seconds: 0.12,
    },
    // C and G: a fifth going up, which is what reads as «good».
    tones: [
      {
        type: 'triangle',
        from: 523.25,
        to: 523.25,
        peak: 0.4,
        delay: 0,
        seconds: 0.16,
      },
      {
        type: 'triangle',
        from: 784,
        to: 784,
        peak: 0.45,
        delay: 0.13,
        seconds: 0.34,
      },
    ],
  },
  /**
   * Winning the match. Finishing used to be silence: the last goal went in, it sounded like
   * any other and the end screen appeared without warning. With the headset on it is even
   * worse, because the scoreboard is where one is not always looking.
   *
   * It rises and it lasts, which is what separates an ending from a goal: the same fifth as
   * the goal but resolved an octave up, and three notes instead of two.
   */
  win: {
    tones: [
      { type: 'triangle', from: 523.25, to: 523.25, peak: 0.3, delay: 0, seconds: 0.2 },
      { type: 'triangle', from: 659.25, to: 659.25, peak: 0.3, delay: 0.13, seconds: 0.2 },
      { type: 'triangle', from: 784, to: 1046.5, peak: 0.34, delay: 0.26, seconds: 0.42 },
      { type: 'sine', from: 1046.5, to: 1046.5, peak: 0.16, delay: 0.26, seconds: 0.48 },
    ],
  },
  /** Losing it: the opposite, falling and low. No noise: an ending strikes nothing. */
  loss: {
    tones: [
      { type: 'triangle', from: 329.63, to: 329.63, peak: 0.3, delay: 0, seconds: 0.24 },
      { type: 'triangle', from: 261.63, to: 196, peak: 0.32, delay: 0.16, seconds: 0.5 },
      { type: 'sine', from: 130.81, to: 98, peak: 0.24, delay: 0.16, seconds: 0.55 },
    ],
  },
  /**
   * And the record beaten, on top of the closing and not instead of it: it can be beaten
   * winning or losing the match, and both things have to be heard. It lands when the closing
   * fades out.
   */
  record: {
    tones: [
      { type: 'sine', from: 1318.5, to: 1318.5, peak: 0.26, delay: 0.42, seconds: 0.12 },
      { type: 'sine', from: 1568, to: 1568, peak: 0.26, delay: 0.52, seconds: 0.12 },
      { type: 'sine', from: 1760, to: 1975.5, peak: 0.28, delay: 0.62, seconds: 0.34 },
    ],
  },
  'medal-bronze': medalRecipe(523.25),
  'medal-silver': medalRecipe(659.25),
  'medal-gold': medalRecipe(784),
}

/**
 * Discards whatever the context returns.
 *
 * `resume()` and `close()` return promises **that reject**: the first when the
 * browser does not yet accept the player's interaction —autoplay policy—, the
 * second if the context was already closed. Without catching it, every sound
 * of such a match leaves an unhandled rejection in the console, and the clean
 * console is what `e2e/console.spec.ts` watches. There is nothing to do with
 * the failure: it means it does not sound, which is exactly what is accepted
 * here.
 */
/**
 * The same recipe, with the strength of the impact: the volume between a fifth
 * and the whole, and the pitch a little lower the weaker it is. The duration
 * does not change: it is what tells what has been heard.
 */
function scaled(recipe: SoundRecipe, strength: number): SoundRecipe {
  // The caller already passes the strength through `impactStrength`, which
  // discards what is not a number; the 1 here is the guard that lets this
  // recipe stand on its own.
  /* v8 ignore next */
  const s = Math.min(1, Math.max(0, Number.isFinite(strength) ? strength : 1))
  const level = MIN_LEVEL + (1 - MIN_LEVEL) * s
  const pitch = 1 - PITCH_SPREAD / 2 + PITCH_SPREAD * s
  return {
    // Only the impact recipes scale, and all of them carry hiss: `NO_STRENGTH` leaves out
    // those that have none. The guard is there in case this recipe is used on its own.
    /* v8 ignore next */
    noise: recipe.noise && {
      ...recipe.noise,
      peak: recipe.noise.peak * level,
      frequency: recipe.noise.frequency * pitch,
    },
    tones: recipe.tones.map((tone) => ({
      ...tone,
      peak: tone.peak * level,
      from: tone.from * pitch,
      to: tone.to * pitch,
    })),
  }
}

function ignore(promise: Promise<void>): void {
  promise.catch(() => {})
}

/** The browser's context, if there is one. */
function browserAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || window.AudioContext == null) return null
  try {
    return new window.AudioContext()
  } catch {
    // No permission, no audio output or too many contexts open: it is played
    // in silence, which is better than taking the scene down with it.
    return null
  }
}

/** White noise from which a different piece is cut on every strike. */
function noiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * NOISE_SECONDS)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1
  return buffer
}

/** Rises to the peak and collapses: the shape of any strike. */
function envelope(
  param: AudioParam,
  start: number,
  { peak, attack, seconds }: { peak: number; attack: number; seconds: number },
): void {
  param.setValueAtTime(SILENCE, start)
  param.exponentialRampToValueAtTime(peak, start + attack)
  param.exponentialRampToValueAtTime(SILENCE, start + seconds)
}

/**
 * Creates the player. It receives where the context comes from so that it can
 * be tested without a browser, which is where the game logic tests run.
 */
export function createGlideHockeyAudio(
  createContext: () => AudioContext | null = browserAudioContext,
): GlideHockeyAudio {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  /** The low-pass between the master and the output, and the cutoff requested of it. */
  let lowpass: BiquadFilterNode | null = null
  let cutoff = LOWPASS_OPEN
  let noise: AudioBuffer | null = null
  /** The slide voice, one for the whole match: looped noise, filter and volume. */
  let slideVoice: { filter: BiquadFilterNode; gain: GainNode; source: AudioBufferSourceNode } | null = null
  // That it has already been tried and did not work: without this, a browser
  // without Web Audio gets one attempt at creating a context per strike of
  // the match, and there are dozens of those.
  let unavailable = false
  /** What the hall's settings say. 1 until somebody says otherwise. */
  let volume = 1

  function ready(): AudioContext | null {
    if (context != null || unavailable) return context
    context = createContext()
    if (context == null) {
      unavailable = true
      return null
    }
    master = context.createGain()
    master.gain.value = MASTER_GAIN * volume
    // Everything that sounds goes through the master, so the filter goes after
    // it: a single node muffles the whole game.
    lowpass = context.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = cutoff
    lowpass.Q.value = LOWPASS_Q
    master.connect(lowpass)
    lowpass.connect(context.destination)
    noise = noiseBuffer(context)
    return context
  }

  function play(sound: GameSound, strength = 1): void {
    const ctx = ready()
    if (ctx == null || master == null || noise == null) return
    // Suspended: the browser stops it when the tab is no longer looked at and
    // it does not recover on its own. Without this, coming back to the game
    // after a while is playing mute.
    if (ctx.state === 'suspended') ignore(ctx.resume())

    const now = ctx.currentTime
    // The goal and the closings ignore the strength: they are celebrations, not impacts.
    const recipe = NO_STRENGTH.has(sound) ? RECIPES[sound] : scaled(RECIPES[sound], strength)
    // A closing strikes nothing: no hiss, which there would sound as if something had broken.
    if (recipe.noise != null) playNoise(ctx, master, noise, now, recipe.noise)
    for (const tone of recipe.tones) playTone(ctx, master, now, tone)
  }

  /** Sets up the slide voice on the context that already exists. */
  function slideReady(ctx: AudioContext) {
    if (slideVoice != null || master == null || noise == null) return slideVoice
    const source = ctx.createBufferSource()
    source.buffer = noise
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = SLIDE_PITCH_MIN
    filter.Q.value = 0.9
    const gain = ctx.createGain()
    gain.gain.value = 0
    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    source.start()
    slideVoice = { filter, gain, source }
    return slideVoice
  }

  function slide(speed: number): void {
    // Without a context nothing slides: the first strike is what opens it.
    if (context == null) return
    const voice = slideReady(context)
    // It would only be null with the context open and neither master nor noise
    // set up, which is a state that never happens: the three are created at once.
    /* v8 ignore next */
    if (voice == null) return
    const now = context.currentTime
    // Smoothed and not a jump: the speed changes every frame and a volume
    // that jumps with it crackles.
    voice.gain.gain.setTargetAtTime(slideLevel(speed), now, SLIDE_SMOOTHING)
    voice.filter.frequency.setTargetAtTime(slidePitch(speed), now, SLIDE_SMOOTHING)
  }

  function close(): void {
    if (slideVoice != null) {
      try {
        slideVoice.source.stop()
      } catch {
        // Already stopped: the context closes all the same.
      }
    }
    slideVoice = null
    if (context != null) ignore(context.close())
    context = null
    master = null
    lowpass = null
    noise = null
  }

  /** See `setVolume` in the interface. */
  function setVolume(factor: number): void {
    volume = Math.min(1, Math.max(0, factor))
    if (master != null) master.gain.value = MASTER_GAIN * volume
  }

  /** See `setLowpass` in the interface. */
  function setLowpass(hz: number): void {
    cutoff = Math.min(LOWPASS_OPEN, Math.max(20, hz))
    // The node knows which context it belongs to: with the audio not open yet
    // there is no node and the cutoff is applied when it opens.
    if (lowpass != null) lowpass.frequency.setTargetAtTime(cutoff, lowpass.context.currentTime, LOWPASS_SMOOTHING)
  }

  return { play, slide, close, setVolume, setLowpass }
}

/** The noise layer: the material of the strike. */
function playNoise(
  ctx: AudioContext,
  master: GainNode,
  buffer: AudioBuffer,
  now: number,
  layer: NoiseLayer,
): void {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  // Each strike cuts the noise at another place and with another pitch: in a
  // match there are dozens, and two identical ones in a row give away that it
  // is the same sound repeated instead of two different strikes.
  source.playbackRate.value = 0.92 + Math.random() * 0.16

  const filter = ctx.createBiquadFilter()
  filter.type = layer.filter
  filter.frequency.value = layer.frequency
  filter.Q.value = layer.q

  const gain = ctx.createGain()
  envelope(gain.gain, now, layer)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  source.start(now, Math.random() * (NOISE_SECONDS - layer.seconds))
  source.stop(now + layer.seconds)
}

/**
 * A tone. The goal's is a note and does not go out of tune: the random
 * variation stays in the noise, which is where there is no tuning to break.
 */
function playTone(
  ctx: AudioContext,
  master: GainNode,
  now: number,
  { type, from, to, peak, delay, seconds }: ToneLayer,
): void {
  const start = now + delay
  const oscillator = ctx.createOscillator()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(from, start)
  if (to !== from) {
    oscillator.frequency.exponentialRampToValueAtTime(to, start + seconds)
  }

  const gain = ctx.createGain()
  envelope(gain.gain, start, { peak, attack: 0.004, seconds })

  oscillator.connect(gain)
  gain.connect(master)
  oscillator.start(start)
  oscillator.stop(start + seconds)
}
