import { describe, expect, it, vi } from 'vitest'
import {
  FINAL_PULSE,
  GOAL_STRENGTH,
  PRESS_PULSE,
  pulseHand,
  pulsePressed,
  eventPulses,
  playPulses,
  frameEvents,
  type HapticSession,
  type HapticSource,
} from './haptics'
import { thresholdPulses } from './scoreboardSign'
import { OPPONENT_SKILLS } from './gameConfig'
import { advanceTable, startTable, type TableState } from './matchLoop'
import { HALF_LENGTH, HALF_WIDTH, type Vec2 } from './puckPhysics'
import { HAPTIC_RECIPES, pulsesFor } from './hapticFeedback'

function source(handedness: string, pulse?: (value: number, duration: number) => unknown) {
  return {
    handedness,
    gamepad: pulse ? { hapticActuators: [{ pulse }] } : { hapticActuators: [] },
  }
}

/**
 * Lo que se vio con el visor el 24/09: los dos mandos vibraban la jugada entera. Era el roce del
 * disco —un toque solapado cada 90 ms mientras se moviera— y, como nunca se sabía qué mano
 * llevaba el mazo, iba a las dos. Lo que queda: el golpe del mazo al disco, en su mano.
 */
describe('qué se siente de la mesa', () => {
  it('el golpe del mazo es un impacto en la mano que lo lleva, y solo en ella', () => {
    const pulsos = eventPulses({ type: 'hit', strength: 0.6 }, 'left')
    expect(pulsos).toEqual(pulsesFor({ type: 'impact', hand: 'left', strength: 0.6 }))
    expect(pulsos.every((p) => p.hand === 'left')).toBe(true)
  })

  it('cuanto más fuerte el choque, más fuerte el pulso', () => {
    const flojo = eventPulses({ type: 'hit', strength: 0.1 }, 'right')[0]
    const seco = eventPulses({ type: 'hit', strength: 1 }, 'right')[0]
    expect(seco.intensity).toBeGreaterThan(flojo.intensity)
  })

  it('una fuerza que no es número cuenta como un golpe entero, no llega al vibrador', () => {
    const [pulso] = eventPulses({ type: 'hit', strength: Number.NaN }, 'right')
    expect(pulso.intensity).toBe(HAPTIC_RECIPES.impact.max)
  })

  it('el gol es una llegada suave, más floja que cualquier golpe', () => {
    const [gol] = eventPulses({ type: 'goal' }, 'right')
    expect(gol).toEqual(pulsesFor({ type: 'arrival', hand: 'right', strength: GOAL_STRENGTH })[0])
    expect(gol.intensity).toBeLessThan(eventPulses({ type: 'hit', strength: 0 }, 'right')[0].intensity)
  })

  it('el final del partido, largo y en la mano del mazo', () => {
    expect(eventPulses({ type: 'end' }, 'left')).toEqual([
      { hand: 'left', intensity: FINAL_PULSE.intensity, ms: FINAL_PULSE.durationMs, delay: 0 },
    ])
  })

  it('el listón de medalla cruzado, el del cartel del objetivo, en la mano del mazo', () => {
    expect(eventPulses({ type: 'threshold', medal: 'silver' }, 'left')).toEqual(thresholdPulses('silver', 'left'))
    expect(eventPulses({ type: 'threshold', medal: 'gold' }, 'right')[0].hand).toBe('right')
  })

  it('sin mano en el mazo no vibra nada: nunca las dos «por si acaso»', () => {
    for (const suceso of [{ type: 'hit', strength: 1 }, { type: 'goal' }, { type: 'end' }, { type: 'threshold', medal: 'gold' }] as const) {
      expect(eventPulses(suceso, null), suceso.type).toEqual([])
    }
  })
})

describe('lo que de cada fotograma llega a la mano', () => {
  const skill = OPPONENT_SKILLS.medium
  /** El mazo del jugador aparcado en una esquina de su campo, lejos de donde pasa el disco. */
  const aparcado: Vec2 = { x: HALF_WIDTH - 0.08, z: HALF_LENGTH - 0.08 }

  it('el disco deslizando suelto y rebotando en las bandas: cero pulsos', () => {
    let mesa: TableState = startTable({ skill, lastScorer: null, seed: 7 })
    let rebotes = 0
    let fotogramasSueltos = 0
    let pulsos = 0
    for (let i = 0; i < 90 * 20; i++) {
      const antes = mesa.playerHits
      const fotograma = advanceTable(mesa, { delta: 1 / 90, pointer: aparcado, skill, playing: true })
      mesa = fotograma.table
      if (fotograma.bounced) rebotes += 1
      if (mesa.playerHits > antes || fotograma.goals.length > 0) continue
      fotogramasSueltos += 1
      for (const suceso of frameEvents(antes, fotograma)) pulsos += eventPulses(suceso, 'right').length
    }
    // Que el test no mida el vacío: el disco se movió y chocó contra las bandas.
    expect(rebotes).toBeGreaterThan(3)
    expect(fotogramasSueltos).toBeGreaterThan(90 * 15)
    expect(pulsos).toBe(0)
  })

  it('el golpe del jugador sí, con la fuerza del choque', () => {
    const antes = startTable({ skill, lastScorer: null })
    const sucesos = frameEvents(0, {
      table: { ...antes, playerHits: 1 },
      goals: [],
      impact: { strike: 3, bounce: 0 },
    })
    expect(sucesos).toHaveLength(1)
    expect(sucesos[0]).toMatchObject({ type: 'hit' })
    expect((sucesos[0] as { strength: number }).strength).toBeGreaterThan(0)
  })

  it('el golpe de la máquina no es de la mano del jugador', () => {
    const mesa = startTable({ skill, lastScorer: null })
    expect(frameEvents(0, { table: { ...mesa, opponentHits: 1 }, goals: [], impact: { strike: 4, bounce: 0 } })).toEqual([])
  })

  it('y el gol', () => {
    const mesa = startTable({ skill, lastScorer: null })
    expect(frameEvents(0, { table: mesa, goals: ['player'], impact: { strike: 0, bounce: 0 } })).toEqual([{ type: 'goal' }])
  })
})

describe('reproducir los pulsos', () => {
  it('pulsa solo el mando de esa mano', () => {
    const left = vi.fn()
    const right = vi.fn()
    const session: HapticSession = { inputSources: [source('left', left), source('right', right)] }

    expect(pulseHand(session, 'right', 0.5, 30)).toBe(true)
    expect(right).toHaveBeenCalledWith(0.5, 30)
    expect(left).not.toHaveBeenCalled()
  })

  it('la cola de un golpe sale con su retardo, por el reloj de quien llama', () => {
    const right = vi.fn()
    const session: HapticSession = { inputSources: [source('right', right)] }
    const programados: { hacer: () => void; ms: number }[] = []

    playPulses(session, eventPulses({ type: 'hit', strength: 1 }, 'right'), (hacer, ms) => programados.push({ hacer, ms }))

    expect(right).toHaveBeenCalledTimes(1)
    expect(programados).toHaveLength(1)
    expect(programados[0].ms).toBe(HAPTIC_RECIPES.impact.ms)
    programados[0].hacer()
    expect(right).toHaveBeenCalledTimes(2)
  })

  it('un mando sin vibrador, o que rechaza el pulso, no rompe nada', () => {
    const rejects = vi.fn(() => Promise.reject(new Error('sin permiso')))
    const throws = vi.fn(() => {
      throw new Error('desconectado')
    })
    const session: HapticSession = {
      inputSources: [source('left', throws), source('right', rejects), source('none')],
    }

    expect(pulseHand(session, 'left', 0.5, 30)).toBe(false)
    expect(pulseHand(session, 'right', 0.5, 30)).toBe(true)
  })

  it('sin sesión no hay a quién pulsar', () => {
    expect(pulseHand(null, 'left', 0.5, 30)).toBe(false)
  })
})

describe('un mando que dice tener vibrador pero no lo tiene', () => {
  it('se salta sin romper', () => {
    // `hapticActuators` está en el estándar pero no todos los navegadores lo
    // rellenan igual: unos lo dejan vacío y otros ponen un objeto sin `pulse`.
    const sinNada = { gamepad: undefined, handedness: 'left' }
    const sinLista = { gamepad: {}, handedness: 'right' }
    const sinPulse = { gamepad: { hapticActuators: [{}] }, handedness: 'none' }
    const session = {
      inputSources: [sinNada, sinLista, sinPulse],
    } as unknown as HapticSession

    expect(pulseHand(session, 'left', 0.5, 30)).toBe(false)
    expect(pulseHand(session, 'right', 0.5, 30)).toBe(false)
  })
})

/**
 * El toque que confirma un botón del visor.
 *
 * Dentro del visor el mando no se dibuja y lo que se pulsa es un rectángulo flotando: sin
 * este toque, el botón no da ninguna señal de haber oído nada. Va **al mando que ha
 * pulsado** y no a las dos manos, que contestarle a la otra sería contestarle a quien no ha
 * hecho nada.
 */
describe('el toque de un botón', () => {
  /** Un evento de puntero como el que llega de un mando del visor. */
  const desdeElMando = (source: HapticSource) => ({ nativeEvent: { inputSource: source } })

  it('vibra el mando que lo pulsa', () => {
    const pulse = vi.fn(() => Promise.resolve(true))

    expect(pulsePressed(desdeElMando(source('right', pulse)))).toBe(true)
    expect(pulse).toHaveBeenCalledWith(PRESS_PULSE.intensity, PRESS_PULSE.durationMs)
  })

  it('con el ratón no hay mando, y no pasa nada', () => {
    // Es el caso de escritorio: el mismo menú, sin nada que vibrar.
    expect(pulsePressed({ nativeEvent: {} })).toBe(false)
    expect(pulsePressed(null)).toBe(false)
  })

  it('un mando sin vibrador sigue siendo un mando', () => {
    expect(pulsePressed(desdeElMando(source('right')))).toBe(false)
  })

  it('un vibrador que falla no para la partida', () => {
    const roto: HapticSource = {
      handedness: 'right',
      gamepad: {
        hapticActuators: [
          {
            pulse: () => {
              throw new Error('sin vibrador')
            },
          },
        ],
      },
    }

    expect(pulsePressed(desdeElMando(roto))).toBe(false)
  })

  it('y uno que devuelve una promesa rota tampoco ensucia la consola', () => {
    const rechaza: HapticSource = {
      handedness: 'right',
      gamepad: { hapticActuators: [{ pulse: () => Promise.reject(new Error('no')) }] },
    }

    expect(pulsePressed(desdeElMando(rechaza))).toBe(true)
  })

  it('un toque de fuerza cero no es un toque', () => {
    const pulse = vi.fn(() => Promise.resolve(true))

    expect(
      pulsePressed(desdeElMando(source('right', pulse)), { ...PRESS_PULSE, intensity: 0 }),
    ).toBe(false)
    expect(pulse).not.toHaveBeenCalled()
  })
})
