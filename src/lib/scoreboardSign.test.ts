import { describe, expect, it } from 'vitest'
import {
  GAP_ABOVE_SCOREBOARD,
  REMAINING_TEMPLATE,
  BACK_SCOREBOARD,
  CHALLENGE_MISSION,
  BACK_NEONS,
  THRESHOLD_SOUND,
  TUTORIAL_TO_ONE_SIDE,
  scoreboardTopEdge,
  withNowItCountsNotice,
  givesMedal,
  medalPhrase,
  scoreboardOmits,
  remainingText,
  signRun,
  signPose,
  thresholdPulses,
  signPlacement,
  tutorialPlacement,
  type GameInPlay,
  type SignProportion,
} from './scoreboardSign'
import { challengeRound } from './challenge'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from './gameConfig'
import { GAME_MODE_LABELS, GAME_MODE_ORDER } from './gameMode'
import { MEDALS, goalSign, medalToCelebrate, type Goal } from './goal'
import { eyesAt, pointOnPanel } from './panelReading'
import { HALF_LENGTH } from './puckPhysics'
import { BASE_GOAL_POINTS, goalPoints } from './scoring'
import { HAPTIC_RECIPES } from './hapticFeedback'
import { softTranslator } from './textos'
import { REFERENCE_EYE_HEIGHT } from './uiHeight'

/**
 * El cartel del objetivo en la mesa: que cuelgue encima del marcador del fondo, de cara a quien
 * juega, y que cuente la partida que toca.
 */

/** Lo que mide el cartel por metro de distancia: 24° de ancho por 4,5° de alto, como el de verdad. */
const PROPORCION: SignProportion = {
  width: 2 * Math.tan((12 * Math.PI) / 180),
  height: 2 * Math.tan((2.25 * Math.PI) / 180),
}

const OJOS = eyesAt(REFERENCE_EYE_HEIGHT)

describe('dónde cuelga el cartel', () => {
  const sitio = signPlacement(PROPORCION)
  const pose = signPose(sitio)
  const alto = PROPORCION.height * sitio.distance

  it('el marcador del fondo está sobre la portería de la máquina, echado hacia quien juega', () => {
    expect(BACK_SCOREBOARD.center[2]).toBeLessThan(-HALF_LENGTH)
    expect(BACK_SCOREBOARD.center[0]).toBe(0)
    expect(BACK_SCOREBOARD.tilt).toBeLessThan(0)
    // Su canto de arriba, en el espacio de quien juega: algo más atrás que su centro.
    const canto = scoreboardTopEdge()
    expect(canto.y).toBeCloseTo(TABLE_HEIGHT + BACK_SCOREBOARD.center[1] + (BACK_SCOREBOARD.height / 2) * Math.cos(BACK_SCOREBOARD.tilt))
    expect(canto.z).toBeLessThan(TABLE_CENTER_Z + BACK_SCOREBOARD.center[2])
  })

  it('encima del marcador y centrado: su canto de abajo, a un dedo del de arriba del marcador', () => {
    const canto = scoreboardTopEdge()
    const abajo = pointOnPanel(pose, 0, -alto / 2)

    expect(sitio.position[0]).toBeCloseTo(0)
    expect(abajo.x).toBeCloseTo(canto.x)
    expect(abajo.y).toBeCloseTo(canto.y + GAP_ABOVE_SCOREBOARD)
    expect(abajo.z).toBeCloseTo(canto.z)
  })

  it('cuelga del espacio de la mesa, que es de donde cuelga la interfaz', () => {
    expect(pose.position[1]).toBeCloseTo(sitio.position[1] + TABLE_HEIGHT)
    expect(pose.position[2]).toBeCloseTo(sitio.position[2] + TABLE_CENTER_Z)
    expect(pose.rotation).toBe(sitio.rotation)
  })

  it('mira a los ojos de quien juega: se lee de frente y a la distancia que dice', () => {
    const [x, y, z] = pose.position
    const haciaLosOjos = { x: OJOS.x - x, y: OJOS.y - y, z: OJOS.z - z }
    const distancia = Math.hypot(haciaLosOjos.x, haciaLosOjos.y, haciaLosOjos.z)
    expect(sitio.distance).toBeCloseTo(distancia)

    // La normal del panel sale de dos puntos suyos: un paso a la derecha y otro hacia arriba.
    const centro = pointOnPanel(pose, 0, 0)
    const derecha = pointOnPanel(pose, 1, 0)
    const arriba = pointOnPanel(pose, 0, 1)
    const u = { x: derecha.x - centro.x, y: derecha.y - centro.y, z: derecha.z - centro.z }
    const v = { x: arriba.x - centro.x, y: arriba.y - centro.y, z: arriba.z - centro.z }
    const normal = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x }
    const coseno = (normal.x * haciaLosOjos.x + normal.y * haciaLosOjos.y + normal.z * haciaLosOjos.z) / distancia
    expect(coseno).toBeCloseTo(1, 5)
    expect(sitio.rotation[3]).toBe('YXZ')
  })

  it('al fondo de la mesa: a algo más de dos metros, más allá de la portería de la máquina', () => {
    expect(sitio.distance).toBeGreaterThan(2)
    expect(sitio.distance).toBeLessThan(2.6)
    expect(pose.position[2]).toBeLessThan(TABLE_CENTER_Z - HALF_LENGTH)
  })
})

const OBJETIVO: Goal = {
  medals: { bronze: 1500, silver: 8000, gold: 20000 },
  better: 'higher',
  unit: 'points in the challenge',
  record: 2300,
  mode: 'challenge',
}

const en = softTranslator('en')
const es = softTranslator('es')

/** Un reto a medias: lo que hay que decir de él, con lo que cambie. */
function reto(cambios: Partial<GameInPlay> = {}): GameInPlay {
  return { goal: OBJETIVO, gameMode: 'challenge', gameState: 'playing', round: 1, goles: 0, points: 0, streak: 0, record: 0, ...cambios }
}

describe('la partida que se le cuenta al cartel', () => {
  it('en el menú no se cuelga nada', () => {
    expect(signRun(reto({ gameState: 'menu' }), en)).toBeNull()
  })

  it('en la primera cuenta atrás: la misión y los listones', () => {
    const partida = signRun(reto({ gameState: 'countdown' }), en)

    expect(partida?.phase).toBe('before')
    expect(goalSign(partida!, en)).toMatchObject({
      title: 'Win games until you lose one',
      detail: 'Bronze 1,500 · Silver 8,000 · Gold 20,000',
    })
    expect(goalSign(signRun(reto({ gameState: 'countdown' }), es)!, es).title).toBe('Gana partidos hasta perder uno')
    expect(es(CHALLENGE_MISSION)).not.toBe(CHALLENGE_MISSION)
  })

  it('con el disco en juego: el listón que falta, lo que se lleva y lo que queda', () => {
    const partida = signRun(reto({ points: 340, goles: 4, streak: 2 }), es)

    expect(partida).toMatchObject({ phase: 'playing', points: 340, remaining: 'Ronda 1 · a 3 goles · gol +140' })
    expect(goalSign(partida!, es)).toMatchObject({ title: 'Bronce a 1500 · llevas 340', detail: 'Ronda 1 · a 3 goles · gol +140' })
    expect(medalToCelebrate(partida!)).toBeNull()
  })

  it('la cuenta atrás de las rondas siguientes ya es jugar: no vuelve a la misión', () => {
    expect(signRun(reto({ gameState: 'countdown', round: 2, goles: 4, points: 500 }), en)?.phase).toBe('playing')
    // Ni la de la primera, si ya ha caído algún gol.
    expect(signRun(reto({ gameState: 'countdown', goles: 1 }), en)?.phase).toBe('playing')
  })

  it('cruzado un listón, la medalla es de quien juega y el cartel va a por el siguiente', () => {
    const partida = signRun(reto({ round: 4, points: 1650, goles: 14 }), en)

    expect(medalToCelebrate(partida!)).toBe('bronze')
    expect(goalSign(partida!, en).title).toBe('Silver at 8,000 · you have 1,650')
  })

  it('al acabar: lo conseguido y lo que faltó', () => {
    const partida = signRun(reto({ gameState: 'finished', round: 4, points: 1650, goles: 17 }), es)

    expect(partida?.phase).toBe('end')
    expect(goalSign(partida!, es)).toMatchObject({
      title: 'Bronce · 1650 points in the challenge',
      detail: 'Te han faltado 6350 para la plata',
    })
  })

  it('fuera del reto, dentro del salón: dice bajito que no cuenta para medalla', () => {
    for (const gameMode of GAME_MODE_ORDER.filter((mode) => mode !== 'challenge')) {
      const partida = signRun(reto({ gameMode, points: 900 }), es)

      expect(goalSign(partida!, es)).toMatchObject({ title: `${es(GAME_MODE_LABELS[gameMode])} · no cuenta para medalla`, subdued: true })
      expect(medalToCelebrate(partida!)).toBeNull()
    }
  })

  it('si el salón dice que las medallas salen de otro modo, el reto tampoco cuenta', () => {
    const partida = signRun(reto({ goal: { ...OBJETIVO, mode: 'levels' } }), en)

    expect(goalSign(partida!, en).title).toBe('Challenge · does not count for a medal')
  })

  it('con el juego abierto suelto: en el reto, la misión y el récord guardado aquí', () => {
    const partida = signRun(reto({ goal: undefined, gameState: 'countdown', record: 3100 }), en)

    expect(goalSign(partida!, en)).toMatchObject({ title: 'Win games until you lose one', detail: 'Your record 3,100' })
    // Sin récord guardado no hay segunda línea.
    const sinRecord = signRun(reto({ goal: null, gameState: 'countdown' }), en)
    expect(goalSign(sinRecord!, en).detail).toBeNull()
  })

  it('con el juego abierto suelto y fuera del reto no se cuelga nada', () => {
    expect(signRun(reto({ goal: null, gameMode: 'practice', record: 12 }), en)).toBeNull()
  })
})

describe('lo que queda', () => {
  it('la ronda, a cuántos goles se juega y lo que vale el próximo gol', () => {
    expect(REMAINING_TEMPLATE).toContain('{points}')
    expect(remainingText(1, 0, en)).toBe(`Round 1 · to 3 goals · goal +${BASE_GOAL_POINTS}`)
    expect(remainingText(2, 0, es)).toBe('Ronda 2 · a 5 goles · gol +100')
  })

  it('el próximo gol vale más con la racha que se lleva y con el nivel de la ronda', () => {
    const cuarta = challengeRound(4)
    expect(remainingText(1, 3, en)).toBe(`Round 1 · to 3 goals · goal +${goalPoints({ difficulty: 'easy', streak: 4 })}`)
    expect(remainingText(4, 0, en)).toBe(`Round 4 · to ${cuarta.goalTarget} goals · goal +${goalPoints({ difficulty: cuarta.difficulty, streak: 1 })}`)
    expect(goalPoints({ difficulty: cuarta.difficulty, streak: 1 })).toBeGreaterThan(BASE_GOAL_POINTS)
  })

  it('y con la vuelta a la escalera, pasada la ronda quince', () => {
    const vuelta = challengeRound(16)
    expect(vuelta.lap).toBe(2)
    expect(remainingText(16, 0, en)).toBe(`Round 16 · to 3 goals · goal +${BASE_GOAL_POINTS * vuelta.multiplier}`)
  })
})

describe('lo que el menú dice de cada modo', () => {
  it('solo el reto da medalla, con salón y sin él', () => {
    for (const objetivo of [OBJETIVO, null, undefined]) {
      expect(GAME_MODE_ORDER.filter((mode) => givesMedal(objetivo, mode))).toEqual(['challenge'])
    }
    expect(medalPhrase(null, 'challenge')).toBe('Counts for a medal')
    expect(medalPhrase(OBJETIVO, 'practice')).toBe('Does not count for a medal')
    expect(es(medalPhrase(null, 'challenge'))).toBe('Cuenta para medalla')
    expect(es(medalPhrase(null, 'duel'))).toBe('No cuenta para medalla')
  })

  it('si el salón saca las medallas de otro modo, aquí no las da ninguno', () => {
    const otro = { ...OBJETIVO, mode: 'levels' }
    expect(GAME_MODE_ORDER.filter((mode) => givesMedal(otro, mode))).toEqual([])
  })
})

describe('lo que el marcador calla', () => {
  it('en el reto que cuenta: los puntos siempre, y la ronda mientras se juega', () => {
    expect(scoreboardOmits(signRun(reto({ gameState: 'countdown' }), en))).toEqual({ points: true, round: true })
    expect(scoreboardOmits(signRun(reto({ points: 300 }), en))).toEqual({ points: true, round: true })
    // Al acabar el cartel dice lo que faltó: la ronda en que se quedó vuelve al marcador.
    expect(scoreboardOmits(signRun(reto({ gameState: 'finished' }), en))).toEqual({ points: true, round: false })
  })

  it('con el juego abierto suelto, igual: el cartel del reto dice lo que se lleva', () => {
    expect(scoreboardOmits(signRun(reto({ goal: null }), en))).toEqual({ points: true, round: true })
  })

  it('donde el cartel no cuenta la partida, o no hay cartel, no calla nada', () => {
    expect(scoreboardOmits(signRun(reto({ gameMode: 'practice' }), en))).toEqual({ points: false, round: false })
    expect(scoreboardOmits(null)).toEqual({ points: false, round: false })
  })
})

describe('el listón cruzado', () => {
  it('tiene su sonido, uno por medalla', () => {
    expect(new Set(MEDALS.map((medalla) => THRESHOLD_SOUND[medalla])).size).toBe(MEDALS.length)
  })

  it('se siente en la mano del mazo, más fuerte cuanto mejor es la medalla', () => {
    const fuerza = (medalla: (typeof MEDALS)[number]) => thresholdPulses(medalla, 'left')[0]

    expect(fuerza('bronze').hand).toBe('left')
    expect(fuerza('silver').intensity).toBeGreaterThan(fuerza('bronze').intensity)
    expect(fuerza('gold').intensity).toBeGreaterThan(fuerza('silver').intensity)
    expect(thresholdPulses('gold', 'right')).toHaveLength(1)
  })

  it('sale detrás del pulso del gol que lo cruzó, que si no lo cortaría', () => {
    expect(thresholdPulses('bronze', 'right')[0].delay).toBeGreaterThanOrEqual(HAPTIC_RECIPES.arrival.ms)
  })

  it('sin el mazo en la mano no vibra nada', () => {
    expect(thresholdPulses('gold', null)).toEqual([])
  })
})

describe('lo que se aparta del cartel', () => {
  it('el tutorial va a un lado, a la misma distancia y a la misma altura que tenía de frente', () => {
    const deFrente = tutorialPlacement(0)
    expect(deFrente[0]).toBe(0)
    expect(deFrente[1]).toBeCloseTo(0.72, 10)
    expect(deFrente[2]).toBeCloseTo(0, 10)

    const [x, y, z] = tutorialPlacement()
    const ojos = eyesAt(REFERENCE_EYE_HEIGHT)
    // En el espacio de quien juega: a la derecha, a 1,2 m en horizontal y un dedo sobre los ojos.
    expect(x).toBeGreaterThan(0)
    expect(Math.hypot(x - ojos.x, z + TABLE_CENTER_Z - ojos.z)).toBeCloseTo(TUTORIAL_TO_ONE_SIDE.distance, 10)
    expect(y + TABLE_HEIGHT - ojos.y).toBeCloseTo(TUTORIAL_TO_ONE_SIDE.aboveEyes, 10)
    expect((Math.atan2(x, -(z + TABLE_CENTER_Z)) * 180) / Math.PI).toBeCloseTo(TUTORIAL_TO_ONE_SIDE.azimuth, 10)
  })

  it('las dos tiras de neón, de arriba abajo, y la de abajo más corta', () => {
    const [arriba, abajo] = BACK_NEONS.strips
    expect(arriba.y - abajo.y).toBeCloseTo(0.3, 10)
    expect(abajo.width).toBeLessThan(arriba.width)
    expect(BACK_NEONS.thickness).toBeGreaterThan(0)
  })
})

describe('al cerrar el tutorial, el cartel avisa de que ya cuenta', () => {
  const vista = { title: 'Win games until you lose one', detail: 'Bronze 1500', bar: null, medal: null, subdued: false }
  const es = softTranslator('es')

  it('en el reto, la línea grande lo dice en el idioma de quien juega', () => {
    expect(withNowItCountsNotice(vista, 'challenge', true, es)).toEqual({ ...vista, title: 'Ahora cuenta para medalla' })
    expect(withNowItCountsNotice(vista, 'challenge', true, softTranslator('en'))?.title).toBe('Now it counts for a medal')
  })

  it('pasado el aviso, fuera del reto, con el cartel discreto o sin cartel, lo de siempre', () => {
    expect(withNowItCountsNotice(vista, 'challenge', false, es)).toBe(vista)
    expect(withNowItCountsNotice(vista, 'practice', true, es)).toBe(vista)
    const discreto = { ...vista, subdued: true }
    expect(withNowItCountsNotice(discreto, 'challenge', true, es)).toBe(discreto)
    expect(withNowItCountsNotice(null, 'challenge', true, es)).toBeNull()
  })
})
