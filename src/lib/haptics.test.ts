import { describe, expect, it, vi } from 'vitest'
import {
  FINAL_PULSE,
  FUERZA_DEL_GOL,
  PRESS_PULSE,
  pulsarMano,
  pulsePressed,
  pulsosDelSuceso,
  reproducir,
  sucesosDelFotograma,
  type HapticSession,
  type HapticSource,
} from './haptics'
import { pulsosDelListon } from './cartelDelMarcador'
import { OPPONENT_SKILLS } from './gameConfig'
import { advanceTable, startTable, type TableState } from './matchLoop'
import { HALF_LENGTH, HALF_WIDTH, type Vec2 } from './puckPhysics'
import { RECETAS, pulsosDe } from './tactos'

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
    const pulsos = pulsosDelSuceso({ tipo: 'golpe', fuerza: 0.6 }, 'left')
    expect(pulsos).toEqual(pulsosDe({ tipo: 'impacto', mano: 'left', fuerza: 0.6 }))
    expect(pulsos.every((p) => p.mano === 'left')).toBe(true)
  })

  it('cuanto más fuerte el choque, más fuerte el pulso', () => {
    const flojo = pulsosDelSuceso({ tipo: 'golpe', fuerza: 0.1 }, 'right')[0]
    const seco = pulsosDelSuceso({ tipo: 'golpe', fuerza: 1 }, 'right')[0]
    expect(seco.intensidad).toBeGreaterThan(flojo.intensidad)
  })

  it('una fuerza que no es número cuenta como un golpe entero, no llega al vibrador', () => {
    const [pulso] = pulsosDelSuceso({ tipo: 'golpe', fuerza: Number.NaN }, 'right')
    expect(pulso.intensidad).toBe(RECETAS.impacto.maximo)
  })

  it('el gol es una llegada suave, más floja que cualquier golpe', () => {
    const [gol] = pulsosDelSuceso({ tipo: 'gol' }, 'right')
    expect(gol).toEqual(pulsosDe({ tipo: 'llegada', mano: 'right', fuerza: FUERZA_DEL_GOL })[0])
    expect(gol.intensidad).toBeLessThan(pulsosDelSuceso({ tipo: 'golpe', fuerza: 0 }, 'right')[0].intensidad)
  })

  it('el final del partido, largo y en la mano del mazo', () => {
    expect(pulsosDelSuceso({ tipo: 'final' }, 'left')).toEqual([
      { mano: 'left', intensidad: FINAL_PULSE.intensity, ms: FINAL_PULSE.durationMs, retardo: 0 },
    ])
  })

  it('el listón de medalla cruzado, el del cartel del objetivo, en la mano del mazo', () => {
    expect(pulsosDelSuceso({ tipo: 'liston', medalla: 'plata' }, 'left')).toEqual(pulsosDelListon('plata', 'left'))
    expect(pulsosDelSuceso({ tipo: 'liston', medalla: 'oro' }, 'right')[0].mano).toBe('right')
  })

  it('sin mano en el mazo no vibra nada: nunca las dos «por si acaso»', () => {
    for (const suceso of [{ tipo: 'golpe', fuerza: 1 }, { tipo: 'gol' }, { tipo: 'final' }, { tipo: 'liston', medalla: 'oro' }] as const) {
      expect(pulsosDelSuceso(suceso, null), suceso.tipo).toEqual([])
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
      for (const suceso of sucesosDelFotograma(antes, fotograma)) pulsos += pulsosDelSuceso(suceso, 'right').length
    }
    // Que el test no mida el vacío: el disco se movió y chocó contra las bandas.
    expect(rebotes).toBeGreaterThan(3)
    expect(fotogramasSueltos).toBeGreaterThan(90 * 15)
    expect(pulsos).toBe(0)
  })

  it('el golpe del jugador sí, con la fuerza del choque', () => {
    const antes = startTable({ skill, lastScorer: null })
    const sucesos = sucesosDelFotograma(0, {
      table: { ...antes, playerHits: 1 },
      goals: [],
      impact: { strike: 3, bounce: 0 },
    })
    expect(sucesos).toHaveLength(1)
    expect(sucesos[0]).toMatchObject({ tipo: 'golpe' })
    expect((sucesos[0] as { fuerza: number }).fuerza).toBeGreaterThan(0)
  })

  it('el golpe de la máquina no es de la mano del jugador', () => {
    const mesa = startTable({ skill, lastScorer: null })
    expect(sucesosDelFotograma(0, { table: { ...mesa, opponentHits: 1 }, goals: [], impact: { strike: 4, bounce: 0 } })).toEqual([])
  })

  it('y el gol', () => {
    const mesa = startTable({ skill, lastScorer: null })
    expect(sucesosDelFotograma(0, { table: mesa, goals: ['player'], impact: { strike: 0, bounce: 0 } })).toEqual([{ tipo: 'gol' }])
  })
})

describe('reproducir los pulsos', () => {
  it('pulsa solo el mando de esa mano', () => {
    const left = vi.fn()
    const right = vi.fn()
    const session: HapticSession = { inputSources: [source('left', left), source('right', right)] }

    expect(pulsarMano(session, 'right', 0.5, 30)).toBe(true)
    expect(right).toHaveBeenCalledWith(0.5, 30)
    expect(left).not.toHaveBeenCalled()
  })

  it('la cola de un golpe sale con su retardo, por el reloj de quien llama', () => {
    const right = vi.fn()
    const session: HapticSession = { inputSources: [source('right', right)] }
    const programados: { hacer: () => void; ms: number }[] = []

    reproducir(session, pulsosDelSuceso({ tipo: 'golpe', fuerza: 1 }, 'right'), (hacer, ms) => programados.push({ hacer, ms }))

    expect(right).toHaveBeenCalledTimes(1)
    expect(programados).toHaveLength(1)
    expect(programados[0].ms).toBe(RECETAS.impacto.ms)
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

    expect(pulsarMano(session, 'left', 0.5, 30)).toBe(false)
    expect(pulsarMano(session, 'right', 0.5, 30)).toBe(true)
  })

  it('sin sesión no hay a quién pulsar', () => {
    expect(pulsarMano(null, 'left', 0.5, 30)).toBe(false)
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

    expect(pulsarMano(session, 'left', 0.5, 30)).toBe(false)
    expect(pulsarMano(session, 'right', 0.5, 30)).toBe(false)
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
