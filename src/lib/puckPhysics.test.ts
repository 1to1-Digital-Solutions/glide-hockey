import { describe, expect, it } from 'vitest'
import {
  GOAL_WIDTH,
  MALLET_RADIUS,
  MAX_PUCK_SPEED,
  PUCK_RADIUS,
} from './gameConfig'
import {
  HALF_LENGTH,
  HALF_WIDTH,
  STALL_SECONDS,
  STALL_SPEED,
  constrainMallet,
  fitsThroughGoal,
  isStalled,
  resolveMalletHit,
  serve,
  stallSeconds,
  stepPuck,
  type Body,
} from './puckPhysics'

/** Un mazo quieto donde se le diga. */
function still(x: number, z: number): Body {
  return { position: { x, z }, velocity: { x: 0, z: 0 } }
}

describe('el disco', () => {
  it('rebota en la banda lateral y vuelve hacia dentro', () => {
    const puck: Body = {
      position: { x: HALF_WIDTH - PUCK_RADIUS, z: 0 },
      velocity: { x: 3, z: 0 },
    }

    const { puck: after, bounced } = stepPuck({ puck, mallets: [], dt: 1 / 60 })

    expect(bounced).toBe(true)
    expect(after.velocity.x).toBeLessThan(0)
    expect(Math.abs(after.position.x)).toBeLessThanOrEqual(
      HALF_WIDTH - PUCK_RADIUS,
    )
  })

  it('entra en la portería de la máquina y eso es gol del jugador', () => {
    const puck: Body = { position: { x: 0, z: -0.9 }, velocity: { x: 0, z: -3 } }

    const { goal } = stepPuck({ puck, mallets: [], dt: 0.1 })

    expect(goal).toBe('player')
  })

  it('entrar por la propia portería es gol de la máquina', () => {
    const puck: Body = { position: { x: 0, z: 0.9 }, velocity: { x: 0, z: 3 } }

    const { goal } = stepPuck({ puck, mallets: [], dt: 0.1 })

    expect(goal).toBe('opponent')
  })

  it('rebota en el fondo si no cabe entero por el hueco', () => {
    // Justo por fuera del poste: el disco tocaría el hierro, así que no es gol.
    const x = GOAL_WIDTH / 2 - PUCK_RADIUS + 0.01
    const puck: Body = { position: { x, z: -0.9 }, velocity: { x: 0, z: -3 } }

    const { goal, puck: after } = stepPuck({ puck, mallets: [], dt: 0.1 })

    expect(goal).toBeNull()
    expect(after.velocity.z).toBeGreaterThan(0)
  })

  it('no atraviesa un mazo aunque en un fotograma recorra más que él', () => {
    // A tope de velocidad y con un paso largo, el disco saltaría de un lado al
    // otro del mazo sin tocarlo si la simulación no partiera el paso.
    const puck: Body = { position: { x: 0, z: -0.4 }, velocity: { x: 0, z: -6 } }

    const { puck: after, struck } = stepPuck({
      puck,
      mallets: [still(0, -0.8)],
      dt: 0.05,
    })

    expect(struck).toBe(true)
    expect(after.velocity.z).toBeGreaterThan(0)
    expect(after.position.z).toBeGreaterThan(-0.8)
  })

  it('se frena solo con el paso del tiempo', () => {
    const puck: Body = { position: { x: 0, z: 0 }, velocity: { x: 0, z: -2 } }

    const { puck: after } = stepPuck({ puck, mallets: [], dt: 0.5 })

    expect(Math.abs(after.velocity.z)).toBeLessThan(2)
  })

  it('ignora un salto de tiempo imposible en vez de teletransportarse', () => {
    const puck: Body = { position: { x: 0, z: 0 }, velocity: { x: 1, z: 1 } }

    const { puck: after } = stepPuck({ puck, mallets: [], dt: Number.NaN })

    expect(after).toBe(puck)
  })
})

describe('el golpe de un mazo', () => {
  it('devuelve el disco por donde vino', () => {
    const puck: Body = {
      position: { x: 0, z: PUCK_RADIUS + MALLET_RADIUS - 0.01 },
      velocity: { x: 0, z: -2 },
    }

    const hit = resolveMalletHit(puck, still(0, 0))

    expect(hit).not.toBeNull()
    expect(hit!.velocity.z).toBeGreaterThan(0)
  })

  it('lanza un disco parado si el mazo lo empuja', () => {
    const puck: Body = {
      position: { x: 0, z: PUCK_RADIUS + MALLET_RADIUS - 0.01 },
      velocity: { x: 0, z: 0 },
    }
    const mallet: Body = { position: { x: 0, z: 0 }, velocity: { x: 0, z: 4 } }

    const hit = resolveMalletHit(puck, mallet)

    expect(hit!.velocity.z).toBeGreaterThan(1)
  })

  it('no vuelve a golpear un disco que ya se está alejando', () => {
    const puck: Body = {
      position: { x: 0, z: PUCK_RADIUS + MALLET_RADIUS - 0.01 },
      velocity: { x: 0, z: 3 },
    }

    const hit = resolveMalletHit(puck, still(0, 0))

    expect(hit!.velocity).toEqual(puck.velocity)
  })

  it('nunca deja el disco por encima de la velocidad máxima', () => {
    const puck: Body = {
      position: { x: 0, z: PUCK_RADIUS + MALLET_RADIUS - 0.01 },
      velocity: { x: 0, z: -5 },
    }
    const mallet: Body = { position: { x: 0, z: 0 }, velocity: { x: 0, z: 20 } }

    const hit = resolveMalletHit(puck, mallet)

    expect(Math.hypot(hit!.velocity.x, hit!.velocity.z)).toBeLessThanOrEqual(
      MAX_PUCK_SPEED + 1e-9,
    )
  })

  it('no toca el disco si no llega a alcanzarlo', () => {
    const puck: Body = { position: { x: 0, z: 0.5 }, velocity: { x: 0, z: 0 } }

    expect(resolveMalletHit(puck, still(0, 0))).toBeNull()
  })
})

describe('los límites de un mazo', () => {
  it('no deja al jugador cruzar la línea de medio campo', () => {
    const inside = constrainMallet({ x: 0, z: -0.5 }, 'player')

    expect(inside.z).toBeGreaterThanOrEqual(MALLET_RADIUS)
  })

  it('no deja a la máquina cruzarla tampoco', () => {
    const inside = constrainMallet({ x: 0, z: 0.5 }, 'opponent')

    expect(inside.z).toBeLessThanOrEqual(-MALLET_RADIUS)
  })

  it('mantiene el mazo dentro de las bandas', () => {
    const inside = constrainMallet({ x: 99, z: -99 }, 'opponent')

    expect(inside.x).toBeLessThanOrEqual(HALF_WIDTH - MALLET_RADIUS)
    expect(inside.z).toBeGreaterThanOrEqual(-(HALF_LENGTH - MALLET_RADIUS))
  })
})

describe('el saque', () => {
  it('sale hacia la máquina al empezar la partida', () => {
    expect(serve(null).velocity.z).toBeLessThan(0)
  })

  it('sale hacia quien acaba de encajar el gol', () => {
    expect(serve('opponent').velocity.z).toBeGreaterThan(0)
    expect(serve('player').velocity.z).toBeLessThan(0)
  })

  it('deja el disco en el centro', () => {
    expect(serve(null).position).toEqual({ x: 0, z: 0 })
  })
})

describe('el hueco de la portería', () => {
  it('deja pasar el disco por el centro', () => {
    expect(fitsThroughGoal(0)).toBe(true)
  })

  it('no lo deja pasar rozando el poste', () => {
    expect(fitsThroughGoal(GOAL_WIDTH / 2 - PUCK_RADIUS + 0.001)).toBe(false)
  })
})

describe('el disco muerto', () => {
  it('no cuenta nada mientras el disco se mueva', () => {
    const puck: Body = { position: { x: 0, z: 0 }, velocity: { x: 0, z: -2 } }

    expect(stallSeconds(3, puck, 1)).toBe(0)
  })

  it('acumula el tiempo que lleva parado', () => {
    const puck: Body = { position: { x: 0, z: 0 }, velocity: { x: 0, z: 0 } }

    expect(stallSeconds(1, puck, 0.5)).toBe(1.5)
  })

  it('cuenta también el que se arrastra sin llegar a ningún sitio', () => {
    const lento: Body = {
      position: { x: 0, z: 0 },
      velocity: { x: STALL_SPEED / 2, z: 0 },
    }

    expect(stallSeconds(0, lento, 1)).toBe(1)
  })

  it('manda sacar de nuevo pasado el plazo, y no antes', () => {
    expect(isStalled(STALL_SECONDS - 0.01)).toBe(false)
    expect(isStalled(STALL_SECONDS)).toBe(true)
  })
})
