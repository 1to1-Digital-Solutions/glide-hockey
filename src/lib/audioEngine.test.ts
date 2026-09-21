import { describe, expect, it, vi } from 'vitest'
import { MAX_PUCK_SPEED } from './gameConfig'
import { createGlideHockeyAudio, impactStrength, slideLevel, slidePitch } from './audioEngine'
import { STALL_SPEED } from './puckPhysics'

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
    setTargetAtTime: vi.fn(),
  } as unknown as AudioParam
}

/**
 * @param rechaza  Con qué se niegan `resume()` y `close()`. El navegador
 *   rechaza esas dos promesas de verdad —la política de reproducción
 *   automática una, un contexto ya cerrado la otra—, así que el doble tiene que
 *   poder hacerlo: es el caso en el que un fallo sin recoger ensucia la consola
 *   del juego, que es lo que vigila `e2e/consola.spec.ts`.
 */
function fakeAudioContext(
  state: AudioContextState = 'running',
  rechaza: Error | null = null,
) {
  const gains: { gain: AudioParam }[] = []
  const filters: { type: string; frequency: number }[] = []
  /** Las fuentes creadas, para poder hacer que una falle al pararla. */
  const sources: { stop: () => void }[] = []
  const oscillators: { frequency: number }[] = []
  /** Cuántas veces se ha pedido cada cosa que devuelve una promesa. */
  const llamadas = { resume: 0, close: 0 }
  /** Promesas rechazadas cuyo fallo no ha recogido nadie. */
  const sinRecoger: string[] = []

  /**
   * Lo que devuelve un método que puede fallar, apuntando si alguien lo recoge.
   *
   * A mano y **sin `vi.fn`**: los dobles de vitest encadenan un `then` a la
   * promesa que devuelve la función espiada para anotar cómo acabó, y ese `then`
   * recoge el fallo por su cuenta. Con uno de por medio, este doble diría que
   * todo está recogido pase lo que pase.
   *
   * Se mira sobre `then` y no sobre `catch` porque `catch(fn)` es
   * `then(undefined, fn)` y lo busca en la propia promesa: así cuentan las dos
   * formas de atender un fallo.
   */
  const responde = (nombre: 'resume' | 'close') => () => {
    llamadas[nombre]++
    if (rechaza == null) return Promise.resolve()

    sinRecoger.push(nombre)
    const promesa = Promise.reject(rechaza)
    const then = promesa.then.bind(promesa)
    promesa.then = ((alCumplir, alFallar) => {
      if (alFallar != null) {
        sinRecoger.splice(sinRecoger.indexOf(nombre), 1)
      }
      return then(alCumplir, alFallar)
    }) as typeof promesa.then
    return promesa
  }

  const resume = responde('resume')
  const close = responde('close')

  const context = {
    state,
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    resume,
    close,
    createGain: () => {
      const gain = { gain: fakeParam(), connect: vi.fn() }
      // Se apuntan en el orden en que se crean: el maestro es el primero,
      // porque es el que se cuelga del destino antes que nada.
      gains.push(gain)
      return gain
    },
    createBiquadFilter: () => {
      const filter = {
        type: 'lowpass',
        frequency: { value: 0, setTargetAtTime: vi.fn() },
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
    /** El nodo maestro, que es por donde pasa todo lo que suena. */
    maestro: () => gains[0].gain,
    filters,
    oscillators,
    sources,
    llamadas,
    sinRecoger,
  }
}

describe('createGlideHockeyAudio', () => {
  it('no toca el audio del navegador hasta que hay algo que sonar', () => {
    const fake = fakeAudioContext()
    const createContext = vi.fn(() => fake.context)

    const audio = createGlideHockeyAudio(createContext)
    expect(createContext).not.toHaveBeenCalled()

    audio.play('strike')
    audio.play('bounce')
    // Un solo contexto para toda la partida: son un recurso escaso y el
    // navegador corta a la decena.
    expect(createContext).toHaveBeenCalledTimes(1)
  })

  it('reanuda el contexto que el navegador dejó en suspenso', () => {
    const fake = fakeAudioContext('suspended')

    createGlideHockeyAudio(() => fake.context).play('strike')

    expect(fake.llamadas.resume).toBe(1)
  })

  it('el contexto que se niega a sonar no deja fallos sin recoger', () => {
    // Un navegador que no da todavía por buena la interacción rechaza el
    // `resume()` de cada golpe. Sin recogerlo, una partida así deja decenas de
    // fallos sueltos en la consola —y la consola limpia es lo que vigila
    // `e2e/consola.spec.ts`—, con el juego funcionando igual de mudo.
    const fake = fakeAudioContext('suspended', new Error('NotAllowedError'))
    const audio = createGlideHockeyAudio(() => fake.context)

    audio.play('strike')
    audio.close()

    expect(fake.llamadas).toEqual({ resume: 1, close: 1 })
    expect(fake.sinRecoger).toEqual([])
  })

  it('los tres sonidos se filtran distinto, para que no suenen igual', () => {
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

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
    const audio = createGlideHockeyAudio(() => fake.context)

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

  it('el final del partido suena, y ganar y perder no suenan igual', () => {
    // Terminar era silencio: se metía el último gol, sonaba como cualquier otro y la
    // pantalla de fin llegaba sin avisar. Con el visor puesto el marcador está donde uno
    // no siempre está mirando.
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    audio.play('win')
    const ganar = fake.oscillators.map((o) => o.frequency)
    audio.play('loss')
    const perder = fake.oscillators.slice(ganar.length).map((o) => o.frequency)

    expect(ganar.length).toBeGreaterThan(0)
    expect(perder.length).toBeGreaterThan(0)
    // Ganar sube y perder baja, que es lo que el oído entiende sin haberlo aprendido.
    expect(Math.max(...ganar)).toBeGreaterThan(Math.min(...ganar))
    expect(Math.min(...perder)).toBeLessThan(Math.min(...ganar))
  })

  it('un cierre no golpea nada: va sin siseo', () => {
    // El ruido del impacto en un final sonaría a que se ha roto algo.
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    // Se cuentan filtros **nuevos** por sonido: el contexto ya monta el suyo para el roce
    // del disco en cuanto se abre, así que el total no dice nada por sí solo.
    const nuevos = (sonido: 'goal' | 'win' | 'loss' | 'record') => {
      const antes = fake.filters.length
      audio.play(sonido)
      return fake.filters.length - antes
    }

    expect(nuevos('goal')).toBeGreaterThan(0)
    expect(nuevos('win')).toBe(0)
    expect(nuevos('loss')).toBe(0)
    expect(nuevos('record')).toBe(0)
  })

  it('la marca batida suena por encima de todo y después del cierre', () => {
    // Va aparte del cierre porque se puede batir ganando o perdiendo el partido.
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    audio.play('win')
    const ganar = fake.oscillators.map((o) => o.frequency)
    audio.play('record')
    const record = fake.oscillators.slice(ganar.length).map((o) => o.frequency)

    expect(Math.min(...record)).toBeGreaterThan(Math.max(...ganar))
  })

  it('sin Web Audio se juega en silencio y no se reintenta a cada golpe', () => {
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

  it('cerrar suelta el contexto y el siguiente sonido estrena otro', () => {
    const fake = fakeAudioContext()
    const createContext = vi.fn(() => fake.context)
    const audio = createGlideHockeyAudio(createContext)

    audio.play('strike')
    audio.close()
    expect(fake.llamadas.close).toBe(1)

    audio.play('strike')
    expect(createContext).toHaveBeenCalledTimes(2)
  })
})

describe('la fuerza del impacto', () => {
  it('va de 0 a 1 con la velocidad, y a tope a la velocidad máxima del disco', () => {
    expect(impactStrength(0)).toBe(0)
    expect(impactStrength(-1)).toBe(0)
    expect(impactStrength(Number.NaN)).toBe(0)
    expect(impactStrength(MAX_PUCK_SPEED / 2)).toBeCloseTo(0.5, 5)
    expect(impactStrength(MAX_PUCK_SPEED)).toBe(1)
    expect(impactStrength(MAX_PUCK_SPEED * 3)).toBe(1)
  })

  /** Los picos de volumen que se le pidieron a cada ganancia en una reproducción. */
  function picos(play: (audio: ReturnType<typeof createGlideHockeyAudio>) => void): number[] {
    const fake = fakeAudioContext()
    const valores: number[] = []
    const context = fake.context as unknown as { createGain: () => unknown }
    context.createGain = () => ({
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: (value: number) => {
          if (value > 0.001) valores.push(value)
        },
      },
      connect: vi.fn(),
    })
    play(createGlideHockeyAudio(() => fake.context))
    return valores
  }

  it('un roce suena más bajo que un golpe seco, pero no se calla', () => {
    const seco = Math.max(...picos((audio) => audio.play('bounce', 1)))
    const roce = Math.max(...picos((audio) => audio.play('bounce', 0)))
    const medio = Math.max(...picos((audio) => audio.play('bounce', 0.5)))

    expect(roce).toBeGreaterThan(0)
    expect(roce).toBeLessThan(medio)
    expect(medio).toBeLessThan(seco)
    // Sin fuerza dicha, suena entero: es lo que hacía antes.
    expect(Math.max(...picos((audio) => audio.play('bounce')))).toBe(seco)
  })

  it('el golpe flojo suena un poco más grave', () => {
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)
    audio.play('strike', 1)
    audio.play('strike', 0)
    const [fuerte, flojo] = fake.oscillators
    expect(flojo.frequency).toBeLessThan(fuerte.frequency)
  })

  it('el gol no mira la fuerza: es una celebración', () => {
    const entero = picos((audio) => audio.play('goal', 1))
    const flojo = picos((audio) => audio.play('goal', 0))
    expect(flojo).toEqual(entero)
  })
})

describe('el roce del disco', () => {
  it('no suena parado y sube con la velocidad hasta un fondo, nunca a golpe entero', () => {
    expect(slideLevel(0)).toBe(0)
    expect(slideLevel(STALL_SPEED)).toBe(0)
    expect(slideLevel(1)).toBeGreaterThan(0)
    expect(slideLevel(3)).toBeGreaterThan(slideLevel(1))
    expect(slideLevel(MAX_PUCK_SPEED)).toBeLessThan(0.5)
    expect(slideLevel(MAX_PUCK_SPEED * 3)).toBe(slideLevel(MAX_PUCK_SPEED))
    expect(slideLevel(Number.NaN)).toBe(0)
  })

  it('el arranque se oye más que la punta: la curva es una raíz', () => {
    const arranque = slideLevel(1) - slideLevel(STALL_SPEED)
    const punta = slideLevel(MAX_PUCK_SPEED) - slideLevel(MAX_PUCK_SPEED - 1)
    expect(arranque).toBeGreaterThan(punta)
  })

  it('más rápido, más agudo', () => {
    expect(slidePitch(0)).toBeLessThan(slidePitch(3))
    expect(slidePitch(3)).toBeLessThan(slidePitch(MAX_PUCK_SPEED))
    expect(slidePitch(MAX_PUCK_SPEED * 2)).toBe(slidePitch(MAX_PUCK_SPEED))
  })

  it('no abre el contexto por su cuenta: hasta el primer golpe no hay nada que roce', () => {
    const create = vi.fn(() => fakeAudioContext().context)
    const audio = createGlideHockeyAudio(create)

    audio.slide(3)
    expect(create).not.toHaveBeenCalled()

    audio.play('strike')
    audio.slide(3)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('una sola voz en bucle que sigue la velocidad suavizada, y se para al cerrar', () => {
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)
    audio.play('strike')
    const filtrosAntes = fake.filters.length

    audio.slide(2)
    audio.slide(4)
    audio.slide(0)

    // Una voz: un filtro más que los del golpe, aunque se haya llamado tres veces.
    expect(fake.filters.length).toBe(filtrosAntes + 1)
    audio.close()
    // Y cerrar no deja el roce sonando en un contexto que ya no existe.
    audio.slide(3)
    expect(fake.filters.length).toBe(filtrosAntes + 1)
  })
})


describe('el contexto que abre el navegador', () => {
  it('sin Web Audio en el navegador, se juega en silencio', () => {
    // Es lo que pasa en un navegador viejo o con el audio vetado por política:
    // el juego tiene que seguir, no llevarse la escena por delante.
    vi.stubGlobal('window', {})

    const audio = createGlideHockeyAudio()
    expect(() => audio.play('strike')).not.toThrow()

    vi.unstubAllGlobals()
  })

  it('sin ventana ninguna tampoco rompe', () => {
    vi.stubGlobal('window', undefined)

    const audio = createGlideHockeyAudio()
    expect(() => audio.play('strike')).not.toThrow()

    vi.unstubAllGlobals()
  })

  it('si abrir el contexto falla, se juega en silencio', () => {
    // Sin permiso, sin salida de audio o con demasiados contextos abiertos.
    class Rota {
      constructor() {
        throw new Error('sin salida de audio')
      }
    }
    vi.stubGlobal('window', { AudioContext: Rota })

    const audio = createGlideHockeyAudio()
    expect(() => audio.play('strike')).not.toThrow()

    vi.unstubAllGlobals()
  })

  it('con Web Audio, lo abre y suena', () => {
    const fake = fakeAudioContext()
    vi.stubGlobal('window', { AudioContext: function () { return fake.context } })

    const audio = createGlideHockeyAudio()
    audio.play('strike')

    expect(fake.oscillators.length).toBeGreaterThan(0)
    vi.unstubAllGlobals()
  })
})

describe('cerrar el reproductor', () => {
  it('una voz ya parada no impide cerrar el contexto', () => {
    // El navegador lanza si se para dos veces la misma fuente, y eso pasa al
    // salir de la partida justo después de que el roce se apague solo.
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)
    // El primer golpe es quien abre el contexto; sin él no hay roce que parar.
    audio.play('strike')
    audio.slide(5)

    // La última fuente creada es la voz del roce; el golpe crea la suya.
    const voz = fake.sources[fake.sources.length - 1]
    voz.stop = () => {
      throw new Error('ya parada')
    }

    expect(() => audio.close()).not.toThrow()
    expect(fake.llamadas.close).toBe(1)
  })
})

describe('velocidades imposibles', () => {
  it('una velocidad que no es número no sube el volumen del roce', () => {
    // Sale del disco cada fotograma: al volver de una pestaña en segundo plano
    // puede llegar como NaN, y con eso el volumen se iría a lo que sea.
    expect(slideLevel(Number.NaN)).toBe(slideLevel(0))
    expect(slidePitch(Number.NaN)).toBe(slidePitch(0))
  })

  it('y un golpe sin velocidad conocida es el más flojo, no el más fuerte', () => {
    expect(impactStrength(Number.NaN)).toBe(impactStrength(0))
  })
})

describe('el volumen de los efectos del arcade', () => {
  it('llega al nodo maestro, que es por donde pasa todo', () => {
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    audio.play('goal')
    const completo = fake.maestro().value

    audio.setVolume(0.5)

    expect(fake.maestro().value).toBeCloseTo(completo / 2, 6)
  })

  it('se guarda para cuando haya audio, si se pide antes de abrirlo', () => {
    // El contexto no se abre hasta el primer sonido, y el volumen se elige
    // antes, en la portada del arcade: pedirlo con el audio aún cerrado no
    // puede perderse.
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    audio.setVolume(0.5)
    audio.play('goal')

    const aMitad = fake.maestro().value
    audio.setVolume(1)

    expect(aMitad).toBeCloseTo(fake.maestro().value / 2, 6)
  })

  it('no se sale de lo que el navegador admite', () => {
    // Lo que llega son ajustes de fuera: por encima de uno la ganancia satura,
    // que no es sonar más alto sino sonar roto.
    const fake = fakeAudioContext()
    const audio = createGlideHockeyAudio(() => fake.context)

    audio.play('goal')
    const completo = fake.maestro().value

    audio.setVolume(4)
    expect(fake.maestro().value).toBeCloseTo(completo, 6)

    audio.setVolume(-1)
    expect(fake.maestro().value).toBe(0)
  })
})
