import { describe, expect, it } from 'vitest'
import {
  GOAL_PAUSE_SECONDS,
  MALLET_RESTITUTION,
  MAX_PUCK_SPEED,
  OPPONENT_SKILLS,
  PLAYER_MALLET_SPEED,
} from './gameConfig'
import {
  MAX_FRAME_SECONDS,
  advanceTable,
  startTable,
  type FrameInput,
  type TableState,
} from './matchLoop'
import { playerStart, tableSeed } from './opponent'
import { RALLY_SECONDS, type Scorer, type Vec2 } from './puckPhysics'

/**
 * El reloj de la partida y lo que la mesa hace con él.
 *
 * Lo que se vigila aquí es que **el tiempo simulado sea el de reloj**: una
 * partida tiene que durar lo mismo en una máquina que pinta sesenta fotogramas
 * por segundo que en una que pinta quince. Recortando el paso —que es lo que
 * hacía la escena— el juego se iba a cámara lenta en cuanto la máquina no daba,
 * y eso no se ve en un navegador rápido: solo se ve dándole fotogramas lentos,
 * que es lo que hacen estos tests.
 *
 * Los ritmos que se prueban incluyen a propósito **algunos que no son múltiplos
 * del paso de simulación** —7, 23, 45 y 56 fotogramas por segundo—. Midiendo
 * solo con 60, 30 y 15 se aprueba también un bucle que parte el fotograma en
 * trozos iguales, que no va a cámara lenta pero simula una partida distinta en
 * cada máquina: a 7 duraba el doble y a 56 no se acababa.
 */

const skill = OPPONENT_SKILLS.impossible

/** El jugador quieto donde sale: no hay ratón que mover en un test. */
const pointer: Vec2 = playerStart()

function frame(delta: number, extra: Partial<FrameInput> = {}): FrameInput {
  return { delta, pointer, skill, playing: true, ...extra }
}

/** Juega `seconds` segundos de reloj en fotogramas de `frameSeconds`. */
function play(
  table: TableState,
  {
    frameSeconds,
    seconds,
    input,
  }: {
    frameSeconds: number
    seconds: number
    input?: Partial<FrameInput>
  },
): { table: TableState; goals: Scorer[] } {
  let current = table
  const goals: Scorer[] = []

  for (let played = 0; played < seconds - 1e-9; played += frameSeconds) {
    const result = advanceTable(current, frame(frameSeconds, input))
    current = result.table
    goals.push(...result.goals)
  }

  return { table: current, goals }
}

/** A qué velocidad sale el disco suelto de `loosePuck`, en m/s. */
const LOOSE_SPEED = 0.8

/**
 * La mesa con el disco lanzado a lo ancho por la mitad del jugador.
 *
 * Ahí no lo alcanza nadie —la máquina no cruza la línea de medio campo y el
 * mazo del jugador se queda delante de su portería—, así que lo que se mide es
 * el reloj y nada más.
 */
function loosePuck(): TableState {
  return {
    ...startTable({ skill, lastScorer: null }),
    puck: { position: { x: -0.4, z: 0.2 }, velocity: { x: LOOSE_SPEED, z: 0 } },
  }
}

/** Cuánto se separan el que más ha avanzado y el que menos. */
function spread(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values)
}

describe('el disco avanza con el reloj, no con los fotogramas', () => {
  // De una máquina holgada a una que va ahogada, y ninguno de 45, 23 y 7 es
  // múltiplo del paso: son los que no caben justos en el fotograma.
  const RATES = [60, 45, 30, 23, 15, 7]

  /**
   * Lo más que dos ritmos pueden separarse: un paso de simulación sin jugar.
   *
   * El paso es fijo, así que lo que no llega a uno entero se guarda para el
   * fotograma siguiente y en un instante cualquiera un ritmo puede llevarle al
   * otro un paso de ventaja. Nunca más de uno: es un desfase, no una deriva, y
   * por eso no crece con los segundos jugados.
   */
  const ONE_STEP = LOOSE_SPEED / 60

  /** Lo que el disco ha avanzado a lo ancho en `seconds`, a cada ritmo. */
  function travelled(seconds: number): number[] {
    const start = loosePuck().puck.position.x
    return RATES.map((fps) => {
      const { table } = play(loosePuck(), { frameSeconds: 1 / fps, seconds })
      return table.puck.position.x - start
    })
  }

  it('recorre lo mismo en un segundo a cualquier ritmo de fotogramas', () => {
    const distances = travelled(1)

    // Que se haya movido de verdad: si el disco se quedara clavado, todos los
    // ritmos coincidirían en cero y el test no diría nada.
    for (const distance of distances) {
      expect(distance).toBeGreaterThan(0.5)
    }

    expect(spread(distances)).toBeLessThanOrEqual(ONE_STEP)
  })

  it('y el desfase no crece por muchos segundos que se jueguen', () => {
    // Seis veces más partida. Si el paso dependiera del fotograma, aquí es
    // donde la diferencia se multiplicaría en vez de quedarse donde estaba.
    expect(spread(travelled(6))).toBeLessThanOrEqual(ONE_STEP)
  })

  it('el mazo del jugador recorre lo mismo yendo hacia el puntero', () => {
    // Medio metro de camino y una décima de segundo: no le da tiempo a llegar,
    // que es lo que hace que se mida lo que avanza y no dónde acaba parado.
    const target: Vec2 = { x: 0.4, z: 0.2 }
    const start = startTable({ skill, lastScorer: null }).player.position

    const distances = [60, 40, 20, 10].map((fps) => {
      const { table } = play(startTable({ skill, lastScorer: null }), {
        frameSeconds: 1 / fps,
        seconds: 0.1,
        input: { pointer: target, playing: false },
      })
      const { x, z } = table.player.position
      return Math.hypot(x - start.x, z - start.z)
    })

    for (const distance of distances) {
      expect(distance).toBeGreaterThan(0.4)
    }
    expect(spread(distances)).toBeLessThanOrEqual(PLAYER_MALLET_SPEED / 60)
  })
})

describe('una partida entera', () => {
  /**
   * Segundos de reloj que tarda la máquina en marcar `goals` goles con el mazo
   * del jugador parado. Es la partida del test de navegador, jugada aquí sin
   * esperar en tiempo real.
   */
  function secondsToConcede(frameSeconds: number, goals: number): number {
    let table = startTable({ skill, lastScorer: null })
    let conceded = 0
    let clock = 0

    while (conceded < goals) {
      const result = advanceTable(table, frame(frameSeconds))
      table = result.table
      conceded += result.goals.length
      clock += frameSeconds

      if (clock > 120) throw new Error('la máquina no llegó a marcar')
    }

    return clock
  }

  it('dura lo mismo con fotogramas lentos que con fotogramas rápidos', () => {
    // 56 y 7 están aquí por lo que pasaba partiendo el fotograma en trozos
    // iguales: a 7 la misma partida duraba veinticuatro segundos y a 56 no
    // llegaba a acabarse nunca, sin ir a cámara lenta en ninguno de los dos.
    const durations = [60, 56, 45, 23, 15, 7].map((fps) =>
      secondsToConcede(1 / fps, 3),
    )

    // La partida es la misma, así que la diferencia es solo la de redondear al
    // fotograma en el que cae cada gol.
    expect(spread(durations)).toBeLessThan(0.5)
    // Y dura lo que dura una partida corta: si tardara un minuto, el test de
    // navegador que la juega se quedaría sin tiempo aunque todos los ritmos
    // coincidieran.
    expect(Math.max(...durations)).toBeLessThan(30)
  })
})

describe('la jugada que no se acaba', () => {
  /**
   * Fotogramas de navegador: unos 8 ms con algo de jitter, que es lo que
   * convierte una partida en otra distinta. El generador va con semilla para
   * que el test sea el mismo cada vez.
   */
  function jitteredFrames(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return 0.008 + (state / 4294967296 - 0.5) * 0.004
    }
  }

  /**
   * Segundos que tarda la máquina en marcar `goals` con el mazo del jugador
   * parado y fotogramas con jitter. Es la partida del test de navegador.
   */
  function secondsToConcedeJittered(seed: number, goals: number): number {
    const nextFrame = jitteredFrames(seed)
    let table = startTable({ skill, lastScorer: null })
    let conceded = 0
    let clock = 0

    while (conceded < goals) {
      const delta = nextFrame()
      const result = advanceTable(table, frame(delta))
      table = result.table
      conceded += result.goals.filter((g) => g === 'opponent').length
      clock += delta
      if (clock > 300) return clock
    }

    return clock
  }

  it('ninguna de doscientas partidas con el mazo parado se queda sin acabar', () => {
    // Antes de la regla de la jugada, un 4 % de estas partidas seguían vivas a
    // los 200 s: un peloteo entre el mazo de la máquina y una banda que se
    // repetía igual para siempre. Con tres goles y un tope de RALLY_SECONDS
    // por jugada, la más larga tiene que quedar muy por debajo del minuto.
    const durations = Array.from({ length: 200 }, (_, seed) =>
      secondsToConcedeJittered(seed + 1, 3),
    )

    expect(Math.max(...durations)).toBeLessThan(60)
  })

  it('pasado el plazo sin gol se saca de centro, y la cuenta vuelve a cero', () => {
    // El disco cruzando a lo ancho por donde nadie llega, con la jugada a punto
    // de caducar: el paso siguiente la corta.
    const almost: TableState = { ...loosePuck(), rally: RALLY_SECONDS - 1 / 120 }

    const served = advanceTable(almost, frame(1 / 60)).table

    expect(Math.hypot(served.puck.position.x, served.puck.position.z)).toBeLessThan(0.05)
    expect(served.rally).toBe(0)
    expect(served.stalled).toBe(0)
  })

  it('la jugada cuenta el tiempo jugado, no el de la celebración', () => {
    const shot: TableState = {
      ...startTable({ skill, lastScorer: null }),
      puck: { position: { x: 0, z: -0.7 }, velocity: { x: 0, z: -6 } },
      rally: 12,
    }

    const scored = play(shot, { frameSeconds: 1 / 60, seconds: 0.2 })
    expect(scored.goals).toEqual(['player'])
    expect(scored.table.rally).toBe(0)

    // Mientras se celebra el gol la jugada no corre.
    const celebrating = play(scored.table, {
      frameSeconds: 1 / 60,
      seconds: GOAL_PAUSE_SECONDS / 2,
    })
    expect(celebrating.table.rally).toBe(0)
  })

  it('fuera de la partida la jugada tampoco corre', () => {
    const idle = play(loosePuck(), {
      frameSeconds: 1 / 60,
      seconds: 2,
      input: { playing: false },
    })
    expect(idle.table.rally).toBe(0)
  })
})

describe('volver de segundo plano', () => {
  it('no adelanta la partida más de lo que se ve en un fotograma', () => {
    const table = startTable({ skill, lastScorer: null })

    // Media hora con la pestaña dormida, y el tope: la mesa acaba igual, porque
    // del fotograma enorme solo se juega el tope y el resto no ha pasado.
    const asleep = advanceTable(table, frame(1800))
    const capped = advanceTable(table, frame(MAX_FRAME_SECONDS))

    expect(asleep.table).toEqual(capped.table)
    expect(asleep.goals).toEqual(capped.goals)
    // Y ese tope es poco: lo más que el disco puede saltar es lo que recorre a
    // toda velocidad en un cuarto de segundo, no media partida.
    const jumped = Math.hypot(
      asleep.table.puck.position.x - table.puck.position.x,
      asleep.table.puck.position.z - table.puck.position.z,
    )
    expect(jumped).toBeLessThanOrEqual(MAX_PUCK_SPEED * MAX_FRAME_SECONDS)
  })

  it('un fotograma sin tiempo deja la mesa como estaba', () => {
    const table = startTable({ skill, lastScorer: null })

    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = advanceTable(table, frame(delta))
      expect(result.table).toBe(table)
      expect(result.goals).toEqual([])
    }
  })
})

describe('el gol', () => {
  /** La mesa con el disco entrando en la portería de la máquina. */
  function shotOnGoal(): TableState {
    return {
      ...startTable({ skill, lastScorer: null }),
      puck: { position: { x: 0, z: -0.7 }, velocity: { x: 0, z: -6 } },
    }
  }

  it('se anota, se celebra y luego se saca de centro', () => {
    const scored = play(shotOnGoal(), { frameSeconds: 1 / 60, seconds: 0.2 })

    expect(scored.goals).toEqual(['player'])
    expect(scored.table.pause).toBeGreaterThan(0)
    expect(scored.table.pendingServe).toBe('player')

    // Mientras dura la celebración el disco espera donde entró.
    const celebrating = play(scored.table, {
      frameSeconds: 1 / 60,
      seconds: GOAL_PAUSE_SECONDS / 2,
    })
    expect(celebrating.table.pause).toBeGreaterThan(0)
    expect(celebrating.table.puck.position).toEqual(scored.table.puck.position)

    // Y en cuanto se acaba, vuelve al centro y sale hacia la máquina, que es
    // quien lo ha encajado.
    let served = celebrating.table
    while (served.pause > 0) {
      served = advanceTable(served, frame(1 / 60)).table
    }
    expect(
      Math.hypot(served.puck.position.x, served.puck.position.z),
    ).toBeLessThan(0.05)
    expect(served.puck.velocity.z).toBeLessThan(0)
  })

  it('cuenta el mismo gol una sola vez aunque el fotograma sea largo', () => {
    const long = advanceTable(shotOnGoal(), frame(MAX_FRAME_SECONDS))

    expect(long.goals).toEqual(['player'])
  })
})

describe('fuera de la partida', () => {
  it('mueve los mazos pero deja el disco quieto', () => {
    const table = startTable({ skill, lastScorer: null })
    const target: Vec2 = { x: 0.3, z: 0.5 }

    const result = advanceTable(
      table,
      frame(1 / 60, { pointer: target, playing: false }),
    )

    expect(result.table.puck).toEqual(table.puck)
    expect(result.table.opponent).toEqual(table.opponent)
    expect(result.table.player.position.x).toBeGreaterThan(
      table.player.position.x,
    )
  })
})

/**
 * Lo que la mesa cuenta para que la escena lo ponga con sonido: el golpe del
 * mazo, el rebote en la banda y el gol (ver `components/game/Rink.tsx`).
 *
 * Se comprueba aquí, y no en la escena, porque es lo que decide si un sonido
 * llega a sonar: la escena solo traduce cada aviso a su ruido.
 */
describe('lo que suena en la mesa', () => {
  /** Disco entrando en el mazo del jugador, que espera parado donde sale. */
  function shotAtPlayer(): TableState {
    const { z } = playerStart()
    return {
      ...startTable({ skill, lastScorer: null }),
      puck: { position: { x: 0, z: z - 0.15 }, velocity: { x: 0, z: 3 } },
    }
  }

  /** Disco lanzado contra la banda de la derecha, lejos de los dos mazos. */
  function shotAtRail(): TableState {
    return {
      ...startTable({ skill, lastScorer: null }),
      puck: { position: { x: 0.45, z: 0.2 }, velocity: { x: 6, z: 0 } },
    }
  }

  it('el disco deslizándose por la mesa no suena a nada', () => {
    const quiet = advanceTable(loosePuck(), frame(1 / 60))

    expect(quiet.struck).toBe(false)
    expect(quiet.bounced).toBe(false)
    expect(quiet.goals).toEqual([])
  })

  it('avisa del golpe del mazo, y solo del golpe', () => {
    const hit = advanceTable(shotAtPlayer(), frame(1 / 60))

    expect(hit.struck).toBe(true)
    expect(hit.bounced).toBe(false)
    // Y el golpe es de verdad: el disco sale de vuelta hacia la máquina.
    expect(hit.table.puck.velocity.z).toBeLessThan(0)
  })

  it('avisa del rebote en la banda, y solo del rebote', () => {
    const rail = advanceTable(shotAtRail(), frame(1 / 60))
    expect(rail.bounced).toBe(true)
    expect(rail.struck).toBe(false)
    expect(rail.table.puck.velocity.x).toBeLessThan(0)
  })

  it('dice con qué fuerza: un disco a seis metros por segundo no roza la banda', () => {
    // Es lo que el sonido y la vibración escalan: un roce y un golpe seco ya
    // no suenan igual.
    const rail = advanceTable(shotAtRail(), frame(1 / 60))
    expect(rail.impact.bounce).toBeGreaterThan(5)
    expect(rail.impact.strike).toBe(0)

    const hit = advanceTable(shotAtPlayer(), frame(1 / 60))
    expect(hit.impact.strike).toBeGreaterThan(2.5)
    expect(hit.impact.bounce).toBe(0)

    const quiet = advanceTable(loosePuck(), frame(1 / 60))
    expect(quiet.impact).toEqual({ strike: 0, bounce: 0 })
  })

  it('el disco parado en el mazo no suena una vez por fotograma', () => {
    // Después del golpe el disco se separa: el contacto que queda es el rastro
    // del empujón anterior y volver a anunciarlo pondría el mazo a repiquetear
    // mientras el disco se despega.
    let table = advanceTable(shotAtPlayer(), frame(1 / 60)).table
    const avisos = [0, 1, 2].map(() => {
      const next = advanceTable(table, frame(1 / 60))
      table = next.table
      return next.struck
    })

    expect(avisos).toEqual([false, false, false])
  })

  it('fuera de la partida la mesa está muda', () => {
    const paused = advanceTable(
      shotAtRail(),
      frame(1 / 60, { playing: false }),
    )

    expect(paused.struck).toBe(false)
    expect(paused.bounced).toBe(false)
  })

  it('durante la celebración del gol tampoco suena nada', () => {
    const scored = play(
      {
        ...startTable({ skill, lastScorer: null }),
        puck: { position: { x: 0, z: -0.7 }, velocity: { x: 0, z: -6 } },
      },
      { frameSeconds: 1 / 60, seconds: 0.2 },
    )
    expect(scored.goals).toEqual(['player'])

    const celebrating = advanceTable(scored.table, frame(1 / 60))
    expect(celebrating.table.pause).toBeGreaterThan(0)
    expect(celebrating.struck).toBe(false)
    expect(celebrating.bounced).toBe(false)
  })
})

describe('el mazo cogido con la mano', () => {
  /**
   * Con el ratón el mazo persigue al puntero a una velocidad tope, y eso es lo que le da
   * peso en una pantalla. Cogido con la mano ese tope deja de ser peso y pasa a ser
   * retardo: la mano va por delante y el mazo detrás, que es exactamente lo que hacía que
   * no se sintiera cogido.
   */
  const lejos = { x: 0.3, z: 0.25 }

  it('va donde va la mano, sin quedarse por el camino', () => {
    const salida = startTable({ skill, lastScorer: null })
    const { table } = advanceTable(salida, {
      delta: 1 / 60,
      pointer: lejos,
      skill,
      playing: true,
      inHand: true,
    })

    expect(table.player.position.x).toBeCloseTo(lejos.x, 5)
    expect(table.player.position.z).toBeCloseTo(lejos.z, 5)
  })

  it('con el ratón sigue persiguiendo, que es lo que le da peso', () => {
    const salida = startTable({ skill, lastScorer: null })
    const { table } = advanceTable(salida, {
      delta: 1 / 60,
      pointer: lejos,
      skill,
      playing: true,
    })

    // En un fotograma no llega: se ha movido, pero mucho menos que la mano.
    const recorrido = Math.hypot(
      table.player.position.x - salida.player.position.x,
      table.player.position.z - salida.player.position.z,
    )
    expect(recorrido).toBeGreaterThan(0)
    expect(recorrido).toBeLessThan(0.1)
  })

  /**
   * Lo que sigue mide las dos cosas que se rompieron al meter el mazo en la mano, y que no
   * se pueden ver desde una pantalla porque con el ratón no pasan: allí el mazo persigue con
   * un tope de velocidad y todo esto se cumple solo.
   */
  const DISCO_QUIETO: Vec2 = { x: 0, z: 0.5 }
  /** Desde dónde arranca la mano, a la izquierda del disco y a su altura. */
  const ARRANQUE: Vec2 = { x: -0.45, z: 0.5 }

  /** Barre la mano en línea recta por encima del disco parado. */
  function manotazo({
    velocidad,
    fps,
    fase = 0,
  }: {
    /** A cuántos metros por segundo va la mano. */
    velocidad: number
    fps: number
    /** Un empujón inicial: mueve el barrido dentro del paso de simulación. */
    fase?: number
  }): { tocado: boolean; salida: number } {
    const dt = 1 / fps
    let mesa: TableState = {
      ...startTable({ skill, lastScorer: null }),
      puck: { position: DISCO_QUIETO, velocity: { x: 0, z: 0 } },
      player: { position: ARRANQUE, velocity: { x: 0, z: 0 } },
    }
    let x = ARRANQUE.x + fase
    for (let i = 0; i < Math.ceil(0.95 / velocidad / dt) + 3; i++) {
      x += velocidad * dt
      mesa = advanceTable(mesa, frame(dt, { pointer: { x, z: ARRANQUE.z }, inHand: true })).table
      if (mesa.playerHits > 0) {
        return { tocado: true, salida: Math.hypot(mesa.puck.velocity.x, mesa.puck.velocity.z) }
      }
    }
    return { tocado: false, salida: 0 }
  }

  /** Veinte barridos iguales, desplazados dentro del paso de simulación. */
  const FASES = Array.from({ length: 20 }, (_, i) => (i / 20) * 0.02)

  it('un manotazo rápido no atraviesa el disco sin tocarlo', () => {
    // El contacto entre mazo y disco mide 11,6 cm. Una mano a 9 m/s recorre 20 cm en un
    // paso de 1/60, así que el mazo aparecía al otro lado sin haberlo rozado: medido, a 45
    // fotogramas por segundo un barrido a 7 m/s fallaba **siempre** y a 9 el disco se
    // quedaba quieto siete de cada diez veces. Y dependía de la fase, así que el mismo
    // golpe unas veces entraba y otras no, que es lo que no se puede jugar.
    for (const fps of [45, 72, 90]) {
      for (const velocidad of [6, 9, 12]) {
        const fallos = FASES.filter((fase) => !manotazo({ velocidad, fps, fase }).tocado)
        expect(fallos, `${velocidad} m/s a ${fps} fotogramas`).toEqual([])
      }
    }
  })

  it('el mismo manotazo pega igual a 45, 72 y 90 fotogramas', () => {
    // El mazo recorría el camino de un fotograma entero dentro de un paso de 1/60, así que
    // su velocidad salía multiplicada por `60/fps`: a 45 pegaba un tercio más fuerte que a
    // 60 y a 90 un tercio más flojo. La misma mano tiene que pegar lo mismo en las tres.
    const velocidad = 1.5
    const salidas = [45, 72, 90].map((fps) => manotazo({ velocidad, fps }).salida)
    for (const salida of salidas) expect(salida).toBeCloseTo(salidas[0], 2)
    expect(salidas[0]).toBeGreaterThan(0)
  })

  it('y pega lo mismo caiga donde caiga dentro del paso', () => {
    const salidas = FASES.map((fase) => manotazo({ velocidad: 1.5, fps: 90, fase }).salida)
    expect(Math.max(...salidas) - Math.min(...salidas)).toBeLessThan(0.05)
  })

  it('la fuerza del golpe es la de la mano, ni más ni menos', () => {
    // Un choque elástico: el disco sale a `(1 + restitución)` veces lo que va la mano. Es
    // la cuenta que hace que mover despacio empuje y mover deprisa dispare.
    for (const velocidad of [0.6, 1.5, 3]) {
      const { salida } = manotazo({ velocidad, fps: 72 })
      const esperado = Math.min((1 + MALLET_RESTITUTION) * velocidad, MAX_PUCK_SPEED)
      expect(salida, `${velocidad} m/s`).toBeCloseTo(esperado, 1)
    }
  })

  it('un golpe con la mano pega con la velocidad de la mano', () => {
    // La velocidad sale del movimiento real, así que no hay que fingir nada: mover deprisa
    // pega fuerte y mover despacio, flojo.
    const salida = startTable({ skill, lastScorer: null })
    const { table } = advanceTable(salida, {
      delta: 1 / 60,
      pointer: lejos,
      skill,
      playing: true,
      inHand: true,
    })

    expect(Math.hypot(table.player.velocity.x, table.player.velocity.z)).toBeGreaterThan(4.5)
  })
})

describe('el reto: la misma semilla, la misma mesa', () => {
  /**
   * Veinte segundos de cada una de las tres primeras rondas con el mazo del
   * jugador parado: por dónde va el disco cada medio segundo y los goles que
   * caen. La máquina ataca y elige tiro en cada golpe, así que dos semillas
   * que eligieran lo mismo dejarían el mismo rastro y dos que no, no.
   */
  function rondas(semilla: number, runId = 1) {
    return [1, 2, 3].map((ronda) => {
      let table = startTable({ skill, lastScorer: null, seed: tableSeed(semilla, runId + ronda, ronda) })
      const rastro: string[] = []
      for (let paso = 1; paso <= 60 * 20; paso += 1) {
        const result = advanceTable(table, frame(1 / 60))
        table = result.table
        for (const gol of result.goals) rastro.push(gol)
        if (paso % 30 === 0) rastro.push(`${table.puck.position.x.toFixed(5)},${table.puck.position.z.toFixed(5)}`)
      }
      return rastro
    })
  }

  it('con la misma semilla la máquina tira igual en cada ronda', () => {
    expect(rondas(4_000_000_000)).toEqual(rondas(4_000_000_000))
  })

  it('aunque se hayan empezado otras partidas antes: la ronda manda, no el número de partida', () => {
    expect(rondas(20_260_925, 1)).toEqual(rondas(20_260_925, 40))
  })

  it('con otra semilla, otra partida', () => {
    expect(rondas(1)).not.toEqual(rondas(2))
  })

  it('sin reto, la semilla es el número de partida, como siempre', () => {
    expect(tableSeed(null, 7, 3)).toBe(7)
    expect(tableSeed(5, 7, 3)).not.toBe(tableSeed(5, 7, 4))
  })
})
