import { beforeEach, describe, expect, it } from 'vitest'
import { OPPONENT_SKILLS } from './gameConfig'
import {
  FONDO_DEL_CAMPO,
  HAZANAS_KEY,
  JUGADA_NUEVA,
  conHazanas,
  estrenarHazanas,
  hazanaDelGol,
  hazanasDelPartido,
  hazanasGuardadas,
  leerHazanas,
  tocar,
  type Jugada,
} from './feats'
import { advanceTable, startTable, type TableState } from './matchLoop'
import { gameStorage } from './storage'

/**
 * Las hazañas de Glide Hockey: cada una se provoca desde la lógica y otra jugada la roza sin
 * llegar; lo conseguido se guarda y no se vuelve a contar. Sin `vi` ni el navegador: corre también
 * en el motor de Godot, con su guardado.
 */

beforeEach(() => gameStorage()?.clear())

/** Una jugada contada toque a toque: quién y con el disco dónde. */
function jugada(...toques: ['player' | 'opponent', number][]): Jugada {
  return toques.reduce((antes, [quien, z]) => tocar(antes, quien, z), JUGADA_NUEVA)
}

describe('ganar sin encajar (GH_SHUTOUT)', () => {
  it('un partido ganado sin un gol en contra', () => {
    expect(hazanasDelPartido({ ganado: true, encajados: 0, sinFin: false })).toEqual(['GH_SHUTOUT'])
  })

  it('con uno encajado no, ni perdiendo, ni en la partida sin fin que se cierra a voluntad', () => {
    expect(hazanasDelPartido({ ganado: true, encajados: 1, sinFin: false })).toEqual([])
    expect(hazanasDelPartido({ ganado: false, encajados: 0, sinFin: false })).toEqual([])
    expect(hazanasDelPartido({ ganado: true, encajados: 0, sinFin: true })).toEqual([])
  })
})

describe('un solo toque desde el fondo (GH_LONG_SHOT)', () => {
  it('un toque con el disco en el fondo del campo propio y gol, sin que nadie más lo toque', () => {
    expect(hazanaDelGol(jugada(['opponent', -0.5], ['player', FONDO_DEL_CAMPO]), 'player')).toBe('GH_LONG_SHOT')
  })

  it('casi: desde un poco más adelante, con dos toques, o desviado por la máquina', () => {
    expect(hazanaDelGol(jugada(['player', FONDO_DEL_CAMPO - 0.01]), 'player')).toBeNull()
    expect(hazanaDelGol(jugada(['player', 0.8], ['player', 0.6]), 'player')).toBeNull()
    expect(hazanaDelGol(jugada(['player', 0.8], ['opponent', -0.3]), 'player')).toBeNull()
  })

  it('un gol sin que el jugador toque el disco no es suyo de ningún modo', () => {
    expect(hazanaDelGol(JUGADA_NUEVA, 'player')).toBeNull()
  })
})

describe('marcar en propia puerta (GH_OWN_GOAL)', () => {
  it('el gol en contra con el último toque del jugador', () => {
    expect(hazanaDelGol(jugada(['opponent', -0.4], ['player', 0.3]), 'opponent')).toBe('GH_OWN_GOAL')
  })

  it('casi: el último toque fue de la máquina', () => {
    expect(hazanaDelGol(jugada(['player', 0.3], ['opponent', -0.4]), 'opponent')).toBeNull()
  })

  it('sale de la mesa: el disco que el propio mazo mete en su portería', () => {
    const skill = OPPONENT_SKILLS.easy
    let table: TableState = {
      ...startTable({ skill, lastScorer: null }),
      puck: { position: { x: 0, z: 0.7 }, velocity: { x: 0, z: 0 } },
      player: { position: { x: 0, z: 0.5 }, velocity: { x: 0, z: 0 } },
    }
    const hazanas: string[] = []
    const goles: string[] = []
    // La mano empuja hacia su propia portería a 3 m/s, fotograma a fotograma.
    for (let i = 1; i <= 40; i++) {
      const frame = advanceTable(table, {
        delta: 1 / 60,
        pointer: { x: 0, z: Math.min(0.5 + i * 0.05, 0.93) },
        inHand: true,
        skill,
        playing: true,
      })
      table = frame.table
      hazanas.push(...frame.hazanas)
      goles.push(...frame.goals)
    }
    expect(goles).toEqual(['opponent'])
    expect(hazanas).toEqual(['GH_OWN_GOAL'])
    // Y la jugada siguiente empieza de cero.
    expect(table.jugada).toEqual(JUGADA_NUEVA)
  })
})

describe('lo que se guarda y lo que se cuenta al salón', () => {
  it('la primera vez se estrena y se guarda; la segunda ya no se cuenta', () => {
    expect(estrenarHazanas(['GH_OWN_GOAL', 'GH_SHUTOUT'])).toEqual(['GH_SHUTOUT', 'GH_OWN_GOAL'])
    expect(gameStorage()?.getItem(HAZANAS_KEY)).toBe('GH_SHUTOUT,GH_OWN_GOAL')
    expect(estrenarHazanas(['GH_SHUTOUT'])).toEqual([])
    expect(estrenarHazanas(['GH_SHUTOUT', 'GH_LONG_SHOT'])).toEqual(['GH_LONG_SHOT'])
    expect(hazanasGuardadas()).toEqual(['GH_SHUTOUT', 'GH_LONG_SHOT', 'GH_OWN_GOAL'])
  })

  it('sin nada nuevo no escribe', () => {
    expect(estrenarHazanas([])).toEqual([])
    expect(gameStorage()?.getItem(HAZANAS_KEY)).toBeNull()
  })

  it('lo guardado es entrada externa: lo que no es una hazaña del juego se ignora', () => {
    expect(leerHazanas(null)).toEqual([])
    expect(leerHazanas('GH_OWN_GOAL,xx,GH_OWN_GOAL,AX_ALGO')).toEqual(['GH_OWN_GOAL'])
  })

  it('el resultado solo lleva el campo cuando se estrena alguna', () => {
    const resultado = { mode: 'practice', points: 300, challenge: false }
    expect(conHazanas(resultado, [])).toEqual(resultado)
    expect(conHazanas(resultado, ['GH_SHUTOUT'])).toEqual({ ...resultado, feats: ['GH_SHUTOUT'] })
  })
})
