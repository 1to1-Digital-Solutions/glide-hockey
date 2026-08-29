import { describe, expect, it } from 'vitest'
import { GOAL_WIDTH, MALLET_RADIUS, OPPONENT_SKILLS, PUCK_RADIUS } from './gameConfig'
import {
  aimPoint,
  opponentStart,
  opponentTarget,
  playerStart,
  stepOpponent,
} from './opponent'
import { HALF_LENGTH, type Body } from './puckPhysics'

const easy = OPPONENT_SKILLS.easy
const impossible = OPPONENT_SKILLS.impossible

/** Un disco quieto donde se le diga. */
function still(x: number, z: number): Body {
  return { position: { x, z }, velocity: { x: 0, z: 0 } }
}

describe('a dónde quiere ir la máquina', () => {
  it('se planta entre el disco y su portería cuando está lejos', () => {
    const target = opponentTarget({
      puck: still(0.4, 0.6),
      mallet: { x: 0, z: -0.8 },
      playerMallet: playerStart(),
      skill: easy,
    })

    // A su altura de defensa, cubriendo el lado por el que viene el disco.
    expect(target.z).toBeLessThan(0)
    expect(target.x).toBeGreaterThan(0)
  })

  it('sale a golpear el disco cuando lo tiene cerca en su mitad', () => {
    const puck = still(0, -0.5)
    const target = opponentTarget({
      puck,
      mallet: { x: 0, z: -0.6 },
      playerMallet: playerStart(),
      skill: easy,
    })

    // Detrás del disco respecto a la portería del jugador: para empujarlo hacia
    // ella hay que ponerse al otro lado.
    expect(target.z).toBeLessThan(puck.position.z)
  })

  it('se adelanta a dónde va el disco, no a dónde está', () => {
    const movingRight: Body = {
      position: { x: 0, z: 0.6 },
      velocity: { x: 2, z: 0 },
    }

    const target = opponentTarget({
      puck: movingRight,
      mallet: { x: 0, z: -0.8 },
      playerMallet: playerStart(),
      skill: impossible,
    })

    expect(target.x).toBeGreaterThan(0)
  })

  it('defiende más adelante cuanto más alto es el nivel', () => {
    const puck = still(0, 0.6)
    const mallet = { x: 0, z: -0.8 }

    const playerMallet = playerStart()
    const flojo = opponentTarget({ puck, mallet, playerMallet, skill: easy })
    const duro = opponentTarget({ puck, mallet, playerMallet, skill: impossible })

    expect(duro.z).toBeGreaterThan(flojo.z)
  })
})

describe('cómo se mueve la máquina', () => {
  it('no se mueve más rápido de lo que le permite su nivel', () => {
    const mallet = { x: 0, z: -0.2 }
    const dt = 1 / 60

    const moved = stepOpponent({
      puck: still(0.5, 0.9),
      mallet,
      playerMallet: playerStart(),
      skill: easy,
      dt,
    })

    const travelled = Math.hypot(
      moved.position.x - mallet.x,
      moved.position.z - mallet.z,
    )
    expect(travelled).toBeLessThanOrEqual(easy.maxSpeed * dt + 1e-9)
  })

  it('nunca cruza la línea de medio campo persiguiendo el disco', () => {
    let mallet = opponentStart(impossible)

    for (let i = 0; i < 200; i++) {
      mallet = stepOpponent({
        puck: still(0, 0.9),
        mallet,
        playerMallet: playerStart(),
        skill: impossible,
        dt: 1 / 60,
      }).position
    }

    expect(mallet.z).toBeLessThanOrEqual(-MALLET_RADIUS)
  })

  it('informa de la velocidad con la que llega, que es la que golpea', () => {
    const moved = stepOpponent({
      puck: still(0, -0.5),
      mallet: { x: 0, z: -0.95 },
      playerMallet: playerStart(),
      skill: impossible,
      dt: 1 / 60,
    })

    expect(Math.hypot(moved.velocity.x, moved.velocity.z)).toBeGreaterThan(0)
  })

  it('se queda quieta ante un salto de tiempo imposible', () => {
    const mallet = { x: 0.1, z: -0.5 }

    const moved = stepOpponent({
      puck: still(0, 0),
      mallet,
      playerMallet: playerStart(),
      skill: easy,
      dt: 0,
    })

    expect(moved.position).toEqual(mallet)
    expect(moved.velocity).toEqual({ x: 0, z: 0 })
  })
})

describe('la posición de salida', () => {
  it('deja a la máquina en su mitad', () => {
    const start = opponentStart(impossible)

    expect(start.z).toBeLessThanOrEqual(-MALLET_RADIUS)
    expect(start.z).toBeGreaterThanOrEqual(-HALF_LENGTH)
  })
})

describe('a qué parte de la portería tira', () => {
  it('al lado que el jugador no está cubriendo', () => {
    expect(aimPoint({ x: 0.3, z: 0.7 }).x).toBeLessThan(0)
    expect(aimPoint({ x: -0.3, z: 0.7 }).x).toBeGreaterThan(0)
  })

  it('nunca al centro, aunque el jugador esté en el centro', () => {
    // Tirando siempre al medio, un mazo parado delante de la portería es un
    // tapón perfecto: el disco va y viene entre los dos y la jugada no acaba.
    expect(aimPoint({ x: 0, z: 0.7 }).x).not.toBe(0)
  })

  it('apunta a donde el disco cabe entero, no al poste', () => {
    const { x } = aimPoint({ x: 0, z: 0.7 })

    expect(Math.abs(x)).toBeLessThanOrEqual(GOAL_WIDTH / 2 - PUCK_RADIUS)
  })

  it('apunta a la portería del jugador y no a la suya', () => {
    expect(aimPoint({ x: 0, z: 0.7 }).z).toBe(HALF_LENGTH)
  })
})
