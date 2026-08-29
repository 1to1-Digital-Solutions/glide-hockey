import { describe, expect, it, vi } from 'vitest'
import { createAirHockeyAudio } from './audioEngine'

/**
 * La Web Audio API no existe en jsdom, así que se le da una de mentira que
 * apunta lo que se le pide. Lo que se comprueba aquí no es cómo suena —eso hay
 * que oírlo— sino las decisiones que sí se pueden romper sin que nadie se
 * entere: cuándo se crea el contexto, que se reanude si el navegador lo paró,
 * que se suelte al cerrar y que los tres sonidos no sean el mismo.
 */
function fakeParam(): AudioParam {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  } as unknown as AudioParam
}

function fakeAudioContext(state: AudioContextState = 'running') {
  const filters: { type: string; frequency: number }[] = []
  const oscillators: { frequency: number }[] = []
  const resume = vi.fn()
  const close = vi.fn()

  const context = {
    state,
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    resume,
    close,
    createGain: () => ({ gain: fakeParam(), connect: vi.fn() }),
    createBiquadFilter: () => {
      const filter = {
        type: 'lowpass',
        frequency: { value: 0 },
        Q: { value: 0 },
        connect: vi.fn(),
      }
      // Se apunta al crear pero se lee por getter: así el filtro se inspecciona
      // ya configurado, no con los valores con los que nace.
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
    createBufferSource: () => ({
      buffer: null,
      playbackRate: { value: 1 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
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
    filters,
    oscillators,
    resume,
    close,
  }
}

describe('createAirHockeyAudio', () => {
  it('no toca el audio del navegador hasta que hay algo que sonar', () => {
    const fake = fakeAudioContext()
    const createContext = vi.fn(() => fake.context)

    const audio = createAirHockeyAudio(createContext)
    expect(createContext).not.toHaveBeenCalled()

    audio.play('strike')
    audio.play('bounce')
    // Un solo contexto para toda la partida: son un recurso escaso y el
    // navegador corta a la decena.
    expect(createContext).toHaveBeenCalledTimes(1)
  })

  it('reanuda el contexto que el navegador dejó en suspenso', () => {
    const fake = fakeAudioContext('suspended')

    createAirHockeyAudio(() => fake.context).play('strike')

    expect(fake.resume).toHaveBeenCalled()
  })

  it('los tres sonidos se filtran distinto, para que no suenen igual', () => {
    const fake = fakeAudioContext()
    const audio = createAirHockeyAudio(() => fake.context)

    audio.play('strike')
    audio.play('bounce')
    audio.play('goal')

    const usados = fake.filters.map(
      (filter) => `${filter.type}:${filter.frequency}`,
    )
    expect(new Set(usados).size).toBe(3)
  })

  it('el gol lleva melodía y los golpes solo cuerpo', () => {
    const fake = fakeAudioContext()
    const audio = createAirHockeyAudio(() => fake.context)

    // Un golpe es un tono y nada más: es el cuerpo del impacto.
    audio.play('strike')
    expect(fake.oscillators).toHaveLength(1)

    // El gol son dos notas distintas, y la segunda más aguda: es lo que se lee
    // como celebración y no como otro golpe.
    audio.play('goal')
    const [primera, segunda] = fake.oscillators.slice(1)
    expect(fake.oscillators).toHaveLength(3)
    expect(segunda.frequency).toBeGreaterThan(primera.frequency)
  })

  it('sin Web Audio se juega en silencio y no se reintenta a cada golpe', () => {
    const createContext = vi.fn(() => null)
    const audio = createAirHockeyAudio(createContext)

    expect(() => {
      audio.play('strike')
      audio.play('bounce')
      audio.play('goal')
      audio.close()
    }).not.toThrow()
    expect(createContext).toHaveBeenCalledTimes(1)
  })

  it('cerrar suelta el contexto y el siguiente sonido estrena otro', () => {
    const fake = fakeAudioContext()
    const createContext = vi.fn(() => fake.context)
    const audio = createAirHockeyAudio(createContext)

    audio.play('strike')
    audio.close()
    expect(fake.close).toHaveBeenCalled()

    audio.play('strike')
    expect(createContext).toHaveBeenCalledTimes(2)
  })
})
