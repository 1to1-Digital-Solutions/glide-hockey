import { describe, expect, it } from 'vitest'
import {
  GOAL_PAUSE_SECONDS,
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
import { playerStart } from './opponent'
import { type Scorer, type Vec2 } from './puckPhysics'

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
