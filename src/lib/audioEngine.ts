/**
 * Los sonidos del juego, **sintetizados en el momento**.
 *
 * Ni un fichero de audio, y no por ahorrar: un juego de xrcade no puede pedir
 * nada a otro origen y todo lo que sirva tiene que copiarlo el anfitrión a su
 * `public/` con `npx glide-hockey-assets` (ver `docs/xrcade.md`). Un golpe de
 * mazo y un rebote en la banda son ruido con una envolvente cortísima —lo que
 * hace la Web Audio API sin descargar nada—, así que aquí no se echa de menos
 * un `.wav`, y de paso no hay ficheros que copiar ni versión que sincronizar.
 *
 * Cada sonido son dos capas: **ruido filtrado**, que es lo que le da el
 * material (el plástico duro del mazo, la madera sorda de la banda), y uno o
 * más **tonos**, que son el cuerpo del golpe y, en el gol, la melodía. Con las
 * dos, un golpe suena a golpe; solo con la primera, a estática.
 *
 * **El contexto se crea con el primer sonido, no al montar la escena.** Los
 * navegadores arrancan en suspenso cualquier `AudioContext` creado sin que
 * nadie haya tocado nada, y la mesa se monta antes de que el jugador pulse
 * «Jugar»: creándolo aquí, el primer golpe llega con el permiso ya dado. El
 * `resume()` de cada sonido cubre el otro caso, que es volver al juego después
 * de que el sistema lo suspendiera por dejar de mirar.
 *
 * Que no haya Web Audio —o que el navegador se niegue a dar un contexto— deja
 * el juego mudo y nada más: el sonido cuenta lo que pasa, no decide nada.
 */

/** Lo que suena en una partida: los tres golpes, y cómo acaba. */
import { MAX_PUCK_SPEED } from './gameConfig'
import { STALL_SPEED } from './puckPhysics'

export type GameSound = 'strike' | 'bounce' | 'goal' | 'win' | 'loss' | 'record'

/**
 * Cuánto se oye el disco deslizándose, de 0 a 1, según su velocidad en m/s.
 *
 * Nada por debajo de la velocidad a la que el disco cuenta como parado
 * (`STALL_SPEED`): un disco quieto no roza. De ahí sube con la raíz de la
 * velocidad —el oído nota más el arranque que la punta— hasta el tope a la
 * velocidad máxima. Es un sonido de fondo: nunca llega al volumen de un golpe.
 */
export function slideLevel(speed: number): number {
  if (!Number.isFinite(speed) || speed <= STALL_SPEED) return 0
  const t = Math.min(1, (speed - STALL_SPEED) / (MAX_PUCK_SPEED - STALL_SPEED))
  return SLIDE_MAX_LEVEL * Math.sqrt(t)
}

/**
 * A qué frecuencia se filtra el roce según la velocidad: más rápido, más agudo.
 * Es lo que hace que la velocidad se oiga y no solo el volumen.
 */
export function slidePitch(speed: number): number {
  const s = Number.isFinite(speed) ? Math.min(1, Math.max(0, speed / MAX_PUCK_SPEED)) : 0
  return SLIDE_PITCH_MIN + (SLIDE_PITCH_MAX - SLIDE_PITCH_MIN) * s
}

/** Tope del roce respecto a un golpe entero, y su banda de frecuencias en Hz. */
const SLIDE_MAX_LEVEL = 0.28
const SLIDE_PITCH_MIN = 380
const SLIDE_PITCH_MAX = 1900
/** Segundos que tarda el roce en seguir a la velocidad: sin saltos entre fotogramas. */
const SLIDE_SMOOTHING = 0.05
/**
 * Cuánto de fuerte es un impacto, de 0 a 1, a partir de su velocidad en m/s.
 * El tope es la velocidad máxima del disco: un golpe a esa velocidad es el
 * sonido entero; un disco que roza la banda a un palmo por segundo, apenas se
 * oye. Es lo que apaga el caso feo de un disco atrapado en una esquina
 * repiqueteando a volumen completo.
 */
export function impactStrength(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 0
  return Math.min(1, speed / MAX_PUCK_SPEED)
}

/** Cuánto suena un golpe de fuerza cero: nunca del todo mudo si lo hubo. */
const MIN_LEVEL = 0.2
/** Cuánto sube de tono un golpe fuerte respecto a uno flojo. */
const PITCH_SPREAD = 0.2
/** Reproductor de los sonidos del juego. */
export interface GlideHockeyAudio {
  /**
   * Suelta un sonido. `strength` (0 a 1) es la fuerza del impacto: escala el
   * volumen y un poco el tono del golpe y del rebote; el gol no la mira, que es
   * una celebración y no un impacto. Si no hay con qué, no hace nada.
   */
  play: (sound: GameSound, strength?: number) => void
  /**
   * El disco deslizándose: un roce continuo cuyo volumen y tono siguen la
   * velocidad (m/s). Se llama cada fotograma; a 0 se apaga. No abre el contexto
   * por su cuenta: hasta el primer golpe no hay nada que roce.
   */
  slide: (speed: number) => void
  /** Suelta el contexto. Sin esto queda un audio abierto por escena montada. */
  close: () => void
  /**
   * Cuánto de todo esto se oye, de 0 a 1: el volumen de efectos de los ajustes
   * del arcade. Multiplica al maestro del juego y no lo sustituye —`MASTER_GAIN`
   * dice cuánto pega este juego frente a los demás—, y se puede llamar con el
   * audio aún sin abrir: se aplica al abrirlo.
   */
  setVolume: (factor: number) => void
  /**
   * El corte del paso bajo del bus, en hercios: el «oído tapado» de un golpe
   * recibido (`components/xr/GolpeRecibido.tsx`). Abierto del todo no quita
   * nada que se oiga. Se puede llamar con el audio aún sin abrir: se aplica al
   * abrirlo, igual que el volumen.
   */
  setLowpass: (hz: number) => void
}

/**
 * Volumen general, de 0 a 1.
 *
 * **El mismo número en los trece juegos**, y ese es el punto: el volumen de efectos se elige
 * una vez en el arcade y saltar de cabina no puede cambiar lo que se oye. Estaba en 0,28 en
 * ocho, 0,40 en tres y 0,45 en dos —con este mismo comentario en todos—, así que la misma
 * posición del deslizador sonaba tres o cuatro decibelios distinta según el juego.
 *
 * Por debajo de la mitad a propósito: se juega con un visor puesto y el sonido va a un palmo
 * de las orejas. Si un juego suena flojo o fuerte comparado con los demás, lo que hay que
 * mover es **su receta**, no este número: moverlo aquí vuelve a descuadrar los trece.
 */
const MASTER_GAIN = 0.35

/**
 * El paso bajo del bus, abierto: por encima de lo que se oye, así que no quita
 * nada. Q de Butterworth, el más plano: con más, el corte haría un pico que se
 * oiría como un silbido al cerrarse.
 */
export const LOWPASS_OPEN = 20000
const LOWPASS_Q = Math.SQRT1_2

/**
 * Lo que tarda el corte en llegar a donde se le pide, en segundos. Se le pide
 * uno nuevo cada fotograma mientras dura el golpe, y un salto seco de
 * frecuencia en cada uno crepitaría.
 */
const LOWPASS_SMOOTHING = 0.01

/** Valor al que se apaga una envolvente. Cero no vale: las rampas
 * exponenciales de la Web Audio API lo prohíben. */
const SILENCE = 0.0001

/** Segundos de ruido que se generan una vez y se reaprovechan en cada golpe. */
const NOISE_SECONDS = 1

/** La capa de ruido de un sonido: qué material se está oyendo. */
interface NoiseLayer {
  /** Qué se deja pasar: agudos (el mazo) o una banda estrecha (la madera). */
  filter: BiquadFilterType
  frequency: number
  /** Cuánto se estrecha el filtro. Alto = más «tonal», bajo = más ruido. */
  q: number
  peak: number
  /** Subida, en segundos. Instantánea chasca; alargarla ablanda el golpe. */
  attack: number
  /** Cuánto dura hasta apagarse, en segundos. */
  seconds: number
}

/** Un tono: el cuerpo del golpe, o una nota de la melodía del gol. */
interface ToneLayer {
  type: OscillatorType
  /** De qué frecuencia a cuál, en Hz. Iguales es una nota tenida. */
  from: number
  to: number
  peak: number
  /** Cuándo entra, en segundos desde el principio del sonido. */
  delay: number
  seconds: number
}

interface SoundRecipe {
  /**
   * El siseo del golpe. Opcional porque los cierres no lo llevan: un final no golpea nada,
   * y el ruido de un impacto ahí sonaría a que se ha roto algo.
   */
  noise?: NoiseLayer
  tones: readonly ToneLayer[]
}

/**
 * Cómo suena cada cosa.
 *
 * Los tres tienen que distinguirse **sin mirar el marcador**, así que se
 * separan por registro y por duración, no por volumen: el mazo es un chasquido
 * agudo y cortísimo, la banda un golpe más sordo y un pelo más largo, y el gol
 * lo único con melodía —dos notas que suben una quinta— porque es lo único que
 * hay que celebrar.
 */
/** Lo que suena igual de fuerte pase lo que pase: no son impactos. */
const SIN_FUERZA = new Set<GameSound>(['goal', 'win', 'loss', 'record'])

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
    // Do y sol: una quinta hacia arriba, que es lo que se lee como «bien».
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
   * Ganar el partido. Antes terminar era silencio: se metía el último gol, sonaba como
   * cualquier otro y aparecía la pantalla de fin sin avisar. Con el visor puesto es peor
   * todavía, porque el marcador está donde uno no siempre está mirando.
   *
   * Sube y dura, que es lo que separa un final de un gol: la misma quinta del gol pero
   * resuelta una octava arriba, y tres notas en vez de dos.
   */
  win: {
    tones: [
      { type: 'triangle', from: 523.25, to: 523.25, peak: 0.3, delay: 0, seconds: 0.2 },
      { type: 'triangle', from: 659.25, to: 659.25, peak: 0.3, delay: 0.13, seconds: 0.2 },
      { type: 'triangle', from: 784, to: 1046.5, peak: 0.34, delay: 0.26, seconds: 0.42 },
      { type: 'sine', from: 1046.5, to: 1046.5, peak: 0.16, delay: 0.26, seconds: 0.48 },
    ],
  },
  /** Perderlo: lo contrario, cayendo y grave. Sin ruido: un final no golpea nada. */
  loss: {
    tones: [
      { type: 'triangle', from: 329.63, to: 329.63, peak: 0.3, delay: 0, seconds: 0.24 },
      { type: 'triangle', from: 261.63, to: 196, peak: 0.32, delay: 0.16, seconds: 0.5 },
      { type: 'sine', from: 130.81, to: 98, peak: 0.24, delay: 0.16, seconds: 0.55 },
    ],
  },
  /**
   * Y la marca batida, por encima del cierre y no en su lugar: se puede batir ganando o
   * perdiendo el partido, y hay que oír las dos cosas. Cae cuando el cierre se apaga.
   */
  record: {
    tones: [
      { type: 'sine', from: 1318.5, to: 1318.5, peak: 0.26, delay: 0.42, seconds: 0.12 },
      { type: 'sine', from: 1568, to: 1568, peak: 0.26, delay: 0.52, seconds: 0.12 },
      { type: 'sine', from: 1760, to: 1975.5, peak: 0.28, delay: 0.62, seconds: 0.34 },
    ],
  },
}

/**
 * Descarta lo que devuelva el contexto.
 *
 * `resume()` y `close()` devuelven promesas **que se rechazan**: la primera
 * cuando el navegador no da por buena todavía la interacción del jugador
 * —política de reproducción automática—, la segunda si el contexto ya estaba
 * cerrado. Sin recogerlo, cada sonido de una partida así deja un rechazo sin
 * atender en la consola, y la consola limpia es lo que vigila
 * `e2e/consola.spec.ts`. No hay nada que hacer con el fallo: significa que no
 * suena, que es exactamente lo que se acepta aquí.
 */
/**
 * La misma receta, con la fuerza del impacto: el volumen entre un quinto y el
 * entero, y el tono un poco más grave cuanto más flojo. La duración no cambia:
 * es lo que dice qué se ha oído.
 */
function scaled(recipe: SoundRecipe, strength: number): SoundRecipe {
  // Quien llama ya pasa la fuerza por `impactStrength`, que descarta lo que no
  // es número; el 1 de aquí es el resguardo de que esta receta valga sola.
  /* v8 ignore next */
  const s = Math.min(1, Math.max(0, Number.isFinite(strength) ? strength : 1))
  const level = MIN_LEVEL + (1 - MIN_LEVEL) * s
  const pitch = 1 - PITCH_SPREAD / 2 + PITCH_SPREAD * s
  return {
    // Solo escalan las recetas de impacto, y todas llevan siseo: `SIN_FUERZA` deja fuera a
    // las que no lo tienen. El resguardo está por si esta receta se usa suelta.
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

/** El contexto del navegador, si es que lo hay. */
function browserAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || window.AudioContext == null) return null
  try {
    return new window.AudioContext()
  } catch {
    // Sin permiso, sin salida de audio o con demasiados contextos abiertos: se
    // juega en silencio, que es mejor que llevarse la escena por delante.
    return null
  }
}

/** Ruido blanco del que se corta un trozo distinto en cada golpe. */
function noiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * NOISE_SECONDS)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1
  return buffer
}

/** Sube al pico y se desploma: la forma de cualquier golpe. */
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
 * Crea el reproductor. Recibe de dónde sale el contexto para poder probarlo
 * sin navegador, que es donde corren los tests de la lógica del juego.
 */
export function createGlideHockeyAudio(
  createContext: () => AudioContext | null = browserAudioContext,
): GlideHockeyAudio {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  /** El paso bajo entre el maestro y la salida, y el corte que se le ha pedido. */
  let lowpass: BiquadFilterNode | null = null
  let corte = LOWPASS_OPEN
  let noise: AudioBuffer | null = null
  /** La voz del roce, una para toda la partida: ruido en bucle, filtro y volumen. */
  let slideVoice: { filter: BiquadFilterNode; gain: GainNode; source: AudioBufferSourceNode } | null = null
  // Que ya se haya intentado y no haya salido: sin esto, un navegador sin Web
  // Audio se lleva un intento de crear contexto por cada golpe de la partida,
  // y de esos hay decenas.
  let unavailable = false
  /** Lo que dicen los ajustes del arcade. 1 hasta que alguien diga otra cosa. */
  let volumen = 1

  function ready(): AudioContext | null {
    if (context != null || unavailable) return context
    context = createContext()
    if (context == null) {
      unavailable = true
      return null
    }
    master = context.createGain()
    master.gain.value = MASTER_GAIN * volumen
    // Todo lo que suena pasa por el maestro, así que el filtro va detrás de él:
    // un solo nodo tapa el juego entero.
    lowpass = context.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = corte
    lowpass.Q.value = LOWPASS_Q
    master.connect(lowpass)
    lowpass.connect(context.destination)
    noise = noiseBuffer(context)
    return context
  }

  function play(sound: GameSound, strength = 1): void {
    const ctx = ready()
    if (ctx == null || master == null || noise == null) return
    // Suspendido: el navegador lo para al dejar de mirar la pestaña y no se
    // recupera solo. Sin esto, volver al juego después de un rato es jugar mudo.
    if (ctx.state === 'suspended') ignore(ctx.resume())

    const now = ctx.currentTime
    // El gol y los cierres no miran la fuerza: son celebraciones, no impactos.
    const recipe = SIN_FUERZA.has(sound) ? RECIPES[sound] : scaled(RECIPES[sound], strength)
    // Un cierre no golpea nada: sin siseo, que ahí sonaría a que se ha roto algo.
    if (recipe.noise != null) playNoise(ctx, master, noise, now, recipe.noise)
    for (const tone of recipe.tones) playTone(ctx, master, now, tone)
  }

  /** Monta la voz del roce sobre el contexto que ya hay. */
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
    // Sin contexto no se roza: el primer golpe es quien lo abre.
    if (context == null) return
    const voice = slideReady(context)
    // Solo sería nulo con el contexto abierto y sin maestro ni ruido montados,
    // que es un estado que no llega a darse: los tres se crean a la vez.
    /* v8 ignore next */
    if (voice == null) return
    const now = context.currentTime
    // Suavizado y no un salto: la velocidad cambia cada fotograma y un volumen
    // que salte con ella crepita.
    voice.gain.gain.setTargetAtTime(slideLevel(speed), now, SLIDE_SMOOTHING)
    voice.filter.frequency.setTargetAtTime(slidePitch(speed), now, SLIDE_SMOOTHING)
  }

  function close(): void {
    if (slideVoice != null) {
      try {
        slideVoice.source.stop()
      } catch {
        // Ya parada: el contexto se cierra igual.
      }
    }
    slideVoice = null
    if (context != null) ignore(context.close())
    context = null
    master = null
    lowpass = null
    noise = null
  }

  /** Ver `setVolume` en la interfaz. */
  function setVolume(factor: number): void {
    volumen = Math.min(1, Math.max(0, factor))
    if (master != null) master.gain.value = MASTER_GAIN * volumen
  }

  /** Ver `setLowpass` en la interfaz. */
  function setLowpass(hz: number): void {
    corte = Math.min(LOWPASS_OPEN, Math.max(20, hz))
    // El nodo sabe de qué contexto es: con el audio aún sin abrir no hay nodo y
    // el corte se aplica al abrirlo.
    if (lowpass != null) lowpass.frequency.setTargetAtTime(corte, lowpass.context.currentTime, LOWPASS_SMOOTHING)
  }

  return { play, slide, close, setVolume, setLowpass }
}

/** La capa de ruido: el material del golpe. */
function playNoise(
  ctx: AudioContext,
  master: GainNode,
  buffer: AudioBuffer,
  now: number,
  layer: NoiseLayer,
): void {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  // Cada golpe corta el ruido por otro sitio y con otro tono: en una partida
  // hay decenas, y dos idénticos seguidos delatan que es el mismo sonido
  // repetido en vez de dos golpes distintos.
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
 * Un tono. El del gol es una nota y no se desafina: la variación aleatoria se
 * queda en el ruido, que es donde no hay afinación que romper.
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
