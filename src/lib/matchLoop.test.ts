import { describe, expect, it } from 'vitest'
import {
  GOAL_PAUSE_SECONDS,
  MAX_PUCK_SPEED,
  OPPONENT_SKILLS,
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
    puck: { position: { x: -0.4, z: 0.2 }, velocity: { x: 0.8, z: 0 } },
  }
}

describe('el disco avanza con el reloj, no con los fotogramas', () => {
  // 60, 30, 15 y 7 por segundo: de una máquina holgada a una que va ahogada.
  const RATES = [60, 30, 15, 7]

  it('recorre lo mismo en un segundo a cualquier ritmo de fotogramas', () => {
    const start = loosePuck().puck.position.x

    const travelled = RATES.map((fps) => {
      const { table } = play(loosePuck(), {
        frameSeconds: 1 / fps,
        seconds: 1,
      })
      return table.puck.position.x - start
    })

    // Que se haya movido de verdad: si el disco se quedara clavado, todos los
    // ritmos coincidirían en cero y el test no diría nada.
    for (const distance of travelled) {
      expect(distance).toBeGreaterThan(0.5)
    }

    // Un milímetro entre el más rápido y el más lento. No es cero porque el
    // fotograma se reparte en pasos que no siempre caben justos.
    expect(Math.max(...travelled) - Math.min(...travelled)).toBeLessThan(0.001)
  })

  it('el mazo del jugador recorre lo mismo yendo hacia el puntero', () => {
    // Medio metro de camino y una décima de segundo: no le da tiempo a llegar,
    // que es lo que hace que se mida lo que avanza y no dónde acaba parado.
    const target: Vec2 = { x: 0.4, z: 0.2 }
    const start = startTable({ skill, lastScorer: null }).player.position

    const travelled = [60, 20, 10].map((fps) => {
      const { table } = play(startTable({ skill, lastScorer: null }), {
        frameSeconds: 1 / fps,
        seconds: 0.1,
        input: { pointer: target, playing: false },
      })
      const { x, z } = table.player.position
      return Math.hypot(x - start.x, z - start.z)
    })

    for (const distance of travelled) {
      expect(distance).toBeGreaterThan(0.4)
    }
    expect(Math.max(...travelled) - Math.min(...travelled)).toBeLessThan(0.001)
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
    const fast = secondsToConcede(1 / 60, 3)
    const slow = secondsToConcede(1 / 15, 3)

    // La partida es la misma, así que la diferencia es solo la de redondear al
    // fotograma en el que cae cada gol.
    expect(Math.abs(slow - fast)).toBeLessThan(0.5)
    // Y dura lo que dura una partida corta: si tardara un minuto, el test de
    // navegador que la juega se quedaría sin tiempo aunque los dos ritmos
    // coincidieran.
    expect(fast).toBeLessThan(30)
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
