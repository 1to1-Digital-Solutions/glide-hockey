import { describe, expect, it } from 'vitest'
import {
  AIRE_SOBRE_EL_MARCADOR,
  LO_QUE_QUEDA,
  MARCADOR_DEL_FONDO,
  MISION_DEL_RETO,
  NEONES_DEL_FONDO,
  SONIDO_DEL_LISTON,
  TUTORIAL_A_UN_LADO,
  cantoDeArribaDelMarcador,
  conElAvisoDeQueCuenta,
  daMedalla,
  fraseDeLaMedalla,
  loQueCallaElMarcador,
  loQueQueda,
  partidaDelCartel,
  poseDelCartel,
  pulsosDelListon,
  sitioDelCartel,
  sitioDelTutorial,
  type LoQueSeJuega,
  type ProporcionDelCartel,
} from './cartelDelMarcador'
import { challengeRound } from './challenge'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from './gameConfig'
import { GAME_MODE_LABELS, GAME_MODE_ORDER } from './gameMode'
import { MEDALLAS, cartelDeObjetivo, medallaQueCelebra, type Objetivo } from './objetivo'
import { eyesAt, pointOnPanel } from './panelReading'
import { HALF_LENGTH } from './puckPhysics'
import { BASE_GOAL_POINTS, goalPoints } from './scoring'
import { RECETAS } from './tactos'
import { traductorSuave } from './textos'
import { REFERENCE_EYE_HEIGHT } from './uiHeight'

/**
 * El cartel del objetivo en la mesa: que cuelgue encima del marcador del fondo, de cara a quien
 * juega, y que cuente la partida que toca.
 */

/** Lo que mide el cartel por metro de distancia: 24° de ancho por 4,5° de alto, como el de verdad. */
const PROPORCION: ProporcionDelCartel = {
  ancho: 2 * Math.tan((12 * Math.PI) / 180),
  alto: 2 * Math.tan((2.25 * Math.PI) / 180),
}

const OJOS = eyesAt(REFERENCE_EYE_HEIGHT)

describe('dónde cuelga el cartel', () => {
  const sitio = sitioDelCartel(PROPORCION)
  const pose = poseDelCartel(sitio)
  const alto = PROPORCION.alto * sitio.distancia

  it('el marcador del fondo está sobre la portería de la máquina, echado hacia quien juega', () => {
    expect(MARCADOR_DEL_FONDO.centro[2]).toBeLessThan(-HALF_LENGTH)
    expect(MARCADOR_DEL_FONDO.centro[0]).toBe(0)
    expect(MARCADOR_DEL_FONDO.inclinacion).toBeLessThan(0)
    // Su canto de arriba, en el espacio de quien juega: algo más atrás que su centro.
    const canto = cantoDeArribaDelMarcador()
    expect(canto.y).toBeCloseTo(TABLE_HEIGHT + MARCADOR_DEL_FONDO.centro[1] + (MARCADOR_DEL_FONDO.alto / 2) * Math.cos(MARCADOR_DEL_FONDO.inclinacion))
    expect(canto.z).toBeLessThan(TABLE_CENTER_Z + MARCADOR_DEL_FONDO.centro[2])
  })

  it('encima del marcador y centrado: su canto de abajo, a un dedo del de arriba del marcador', () => {
    const canto = cantoDeArribaDelMarcador()
    const abajo = pointOnPanel(pose, 0, -alto / 2)

    expect(sitio.position[0]).toBeCloseTo(0)
    expect(abajo.x).toBeCloseTo(canto.x)
    expect(abajo.y).toBeCloseTo(canto.y + AIRE_SOBRE_EL_MARCADOR)
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
    expect(sitio.distancia).toBeCloseTo(distancia)

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
    expect(sitio.distancia).toBeGreaterThan(2)
    expect(sitio.distancia).toBeLessThan(2.6)
    expect(pose.position[2]).toBeLessThan(TABLE_CENTER_Z - HALF_LENGTH)
  })
})

const OBJETIVO: Objetivo = {
  medallas: { bronce: 1500, plata: 8000, oro: 20000 },
  mejorEs: 'mas',
  unidad: 'points in the challenge',
  record: 2300,
  modo: 'challenge',
}

const en = traductorSuave('en')
const es = traductorSuave('es')

/** Un reto a medias: lo que hay que decir de él, con lo que cambie. */
function reto(cambios: Partial<LoQueSeJuega> = {}): LoQueSeJuega {
  return { objetivo: OBJETIVO, gameMode: 'challenge', gameState: 'playing', round: 1, goles: 0, points: 0, streak: 0, record: 0, ...cambios }
}

describe('la partida que se le cuenta al cartel', () => {
  it('en el menú no se cuelga nada', () => {
    expect(partidaDelCartel(reto({ gameState: 'menu' }), en)).toBeNull()
  })

  it('en la primera cuenta atrás: la misión y los listones', () => {
    const partida = partidaDelCartel(reto({ gameState: 'countdown' }), en)

    expect(partida?.fase).toBe('antes')
    expect(cartelDeObjetivo(partida!, en)).toMatchObject({
      titulo: 'Win games until you lose one',
      detalle: 'Bronze 1,500 · Silver 8,000 · Gold 20,000',
    })
    expect(cartelDeObjetivo(partidaDelCartel(reto({ gameState: 'countdown' }), es)!, es).titulo).toBe('Gana partidos hasta perder uno')
    expect(es(MISION_DEL_RETO)).not.toBe(MISION_DEL_RETO)
  })

  it('con el disco en juego: el listón que falta, lo que se lleva y lo que queda', () => {
    const partida = partidaDelCartel(reto({ points: 340, goles: 4, streak: 2 }), es)

    expect(partida).toMatchObject({ fase: 'jugando', puntos: 340, queda: 'Ronda 1 · a 3 goles · gol +140' })
    expect(cartelDeObjetivo(partida!, es)).toMatchObject({ titulo: 'Bronce a 1500 · llevas 340', detalle: 'Ronda 1 · a 3 goles · gol +140' })
    expect(medallaQueCelebra(partida!)).toBeNull()
  })

  it('la cuenta atrás de las rondas siguientes ya es jugar: no vuelve a la misión', () => {
    expect(partidaDelCartel(reto({ gameState: 'countdown', round: 2, goles: 4, points: 500 }), en)?.fase).toBe('jugando')
    // Ni la de la primera, si ya ha caído algún gol.
    expect(partidaDelCartel(reto({ gameState: 'countdown', goles: 1 }), en)?.fase).toBe('jugando')
  })

  it('cruzado un listón, la medalla es de quien juega y el cartel va a por el siguiente', () => {
    const partida = partidaDelCartel(reto({ round: 4, points: 1650, goles: 14 }), en)

    expect(medallaQueCelebra(partida!)).toBe('bronce')
    expect(cartelDeObjetivo(partida!, en).titulo).toBe('Silver at 8,000 · you have 1,650')
  })

  it('al acabar: lo conseguido y lo que faltó', () => {
    const partida = partidaDelCartel(reto({ gameState: 'finished', round: 4, points: 1650, goles: 17 }), es)

    expect(partida?.fase).toBe('final')
    expect(cartelDeObjetivo(partida!, es)).toMatchObject({
      titulo: 'Bronce · 1650 points in the challenge',
      detalle: 'Te han faltado 6350 para la plata',
    })
  })

  it('fuera del reto, dentro del salón: dice bajito que no cuenta para medalla', () => {
    for (const gameMode of GAME_MODE_ORDER.filter((mode) => mode !== 'challenge')) {
      const partida = partidaDelCartel(reto({ gameMode, points: 900 }), es)

      expect(cartelDeObjetivo(partida!, es)).toMatchObject({ titulo: `${es(GAME_MODE_LABELS[gameMode])} · no cuenta para medalla`, discreto: true })
      expect(medallaQueCelebra(partida!)).toBeNull()
    }
  })

  it('si el salón dice que las medallas salen de otro modo, el reto tampoco cuenta', () => {
    const partida = partidaDelCartel(reto({ objetivo: { ...OBJETIVO, modo: 'levels' } }), en)

    expect(cartelDeObjetivo(partida!, en).titulo).toBe('Challenge · does not count for a medal')
  })

  it('con el juego abierto suelto: en el reto, la misión y el récord guardado aquí', () => {
    const partida = partidaDelCartel(reto({ objetivo: undefined, gameState: 'countdown', record: 3100 }), en)

    expect(cartelDeObjetivo(partida!, en)).toMatchObject({ titulo: 'Win games until you lose one', detalle: 'Your record 3,100' })
    // Sin récord guardado no hay segunda línea.
    const sinRecord = partidaDelCartel(reto({ objetivo: null, gameState: 'countdown' }), en)
    expect(cartelDeObjetivo(sinRecord!, en).detalle).toBeNull()
  })

  it('con el juego abierto suelto y fuera del reto no se cuelga nada', () => {
    expect(partidaDelCartel(reto({ objetivo: null, gameMode: 'practice', record: 12 }), en)).toBeNull()
  })
})

describe('lo que queda', () => {
  it('la ronda, a cuántos goles se juega y lo que vale el próximo gol', () => {
    expect(LO_QUE_QUEDA).toContain('{points}')
    expect(loQueQueda(1, 0, en)).toBe(`Round 1 · to 3 goals · goal +${BASE_GOAL_POINTS}`)
    expect(loQueQueda(2, 0, es)).toBe('Ronda 2 · a 5 goles · gol +100')
  })

  it('el próximo gol vale más con la racha que se lleva y con el nivel de la ronda', () => {
    const cuarta = challengeRound(4)
    expect(loQueQueda(1, 3, en)).toBe(`Round 1 · to 3 goals · goal +${goalPoints({ difficulty: 'easy', streak: 4 })}`)
    expect(loQueQueda(4, 0, en)).toBe(`Round 4 · to ${cuarta.goalTarget} goals · goal +${goalPoints({ difficulty: cuarta.difficulty, streak: 1 })}`)
    expect(goalPoints({ difficulty: cuarta.difficulty, streak: 1 })).toBeGreaterThan(BASE_GOAL_POINTS)
  })

  it('y con la vuelta a la escalera, pasada la ronda quince', () => {
    const vuelta = challengeRound(16)
    expect(vuelta.lap).toBe(2)
    expect(loQueQueda(16, 0, en)).toBe(`Round 16 · to 3 goals · goal +${BASE_GOAL_POINTS * vuelta.multiplier}`)
  })
})

describe('lo que el menú dice de cada modo', () => {
  it('solo el reto da medalla, con salón y sin él', () => {
    for (const objetivo of [OBJETIVO, null, undefined]) {
      expect(GAME_MODE_ORDER.filter((mode) => daMedalla(objetivo, mode))).toEqual(['challenge'])
    }
    expect(fraseDeLaMedalla(null, 'challenge')).toBe('Counts for a medal')
    expect(fraseDeLaMedalla(OBJETIVO, 'practice')).toBe('Does not count for a medal')
    expect(es(fraseDeLaMedalla(null, 'challenge'))).toBe('Cuenta para medalla')
    expect(es(fraseDeLaMedalla(null, 'duel'))).toBe('No cuenta para medalla')
  })

  it('si el salón saca las medallas de otro modo, aquí no las da ninguno', () => {
    const otro = { ...OBJETIVO, modo: 'levels' }
    expect(GAME_MODE_ORDER.filter((mode) => daMedalla(otro, mode))).toEqual([])
  })
})

describe('lo que el marcador calla', () => {
  it('en el reto que cuenta: los puntos siempre, y la ronda mientras se juega', () => {
    expect(loQueCallaElMarcador(partidaDelCartel(reto({ gameState: 'countdown' }), en))).toEqual({ puntos: true, ronda: true })
    expect(loQueCallaElMarcador(partidaDelCartel(reto({ points: 300 }), en))).toEqual({ puntos: true, ronda: true })
    // Al acabar el cartel dice lo que faltó: la ronda en que se quedó vuelve al marcador.
    expect(loQueCallaElMarcador(partidaDelCartel(reto({ gameState: 'finished' }), en))).toEqual({ puntos: true, ronda: false })
  })

  it('con el juego abierto suelto, igual: el cartel del reto dice lo que se lleva', () => {
    expect(loQueCallaElMarcador(partidaDelCartel(reto({ objetivo: null }), en))).toEqual({ puntos: true, ronda: true })
  })

  it('donde el cartel no cuenta la partida, o no hay cartel, no calla nada', () => {
    expect(loQueCallaElMarcador(partidaDelCartel(reto({ gameMode: 'practice' }), en))).toEqual({ puntos: false, ronda: false })
    expect(loQueCallaElMarcador(null)).toEqual({ puntos: false, ronda: false })
  })
})

describe('el listón cruzado', () => {
  it('tiene su sonido, uno por medalla', () => {
    expect(new Set(MEDALLAS.map((medalla) => SONIDO_DEL_LISTON[medalla])).size).toBe(MEDALLAS.length)
  })

  it('se siente en la mano del mazo, más fuerte cuanto mejor es la medalla', () => {
    const fuerza = (medalla: (typeof MEDALLAS)[number]) => pulsosDelListon(medalla, 'left')[0]

    expect(fuerza('bronce').mano).toBe('left')
    expect(fuerza('plata').intensidad).toBeGreaterThan(fuerza('bronce').intensidad)
    expect(fuerza('oro').intensidad).toBeGreaterThan(fuerza('plata').intensidad)
    expect(pulsosDelListon('oro', 'right')).toHaveLength(1)
  })

  it('sale detrás del pulso del gol que lo cruzó, que si no lo cortaría', () => {
    expect(pulsosDelListon('bronce', 'right')[0].retardo).toBeGreaterThanOrEqual(RECETAS.llegada.ms)
  })

  it('sin el mazo en la mano no vibra nada', () => {
    expect(pulsosDelListon('oro', null)).toEqual([])
  })
})

describe('lo que se aparta del cartel', () => {
  it('el tutorial va a un lado, a la misma distancia y a la misma altura que tenía de frente', () => {
    const deFrente = sitioDelTutorial(0)
    expect(deFrente[0]).toBe(0)
    expect(deFrente[1]).toBeCloseTo(0.72, 10)
    expect(deFrente[2]).toBeCloseTo(0, 10)

    const [x, y, z] = sitioDelTutorial()
    const ojos = eyesAt(REFERENCE_EYE_HEIGHT)
    // En el espacio de quien juega: a la derecha, a 1,2 m en horizontal y un dedo sobre los ojos.
    expect(x).toBeGreaterThan(0)
    expect(Math.hypot(x - ojos.x, z + TABLE_CENTER_Z - ojos.z)).toBeCloseTo(TUTORIAL_A_UN_LADO.distancia, 10)
    expect(y + TABLE_HEIGHT - ojos.y).toBeCloseTo(TUTORIAL_A_UN_LADO.sobreLosOjos, 10)
    expect((Math.atan2(x, -(z + TABLE_CENTER_Z)) * 180) / Math.PI).toBeCloseTo(TUTORIAL_A_UN_LADO.azimut, 10)
  })

  it('las dos tiras de neón, de arriba abajo, y la de abajo más corta', () => {
    const [arriba, abajo] = NEONES_DEL_FONDO.tiras
    expect(arriba.y - abajo.y).toBeCloseTo(0.3, 10)
    expect(abajo.ancho).toBeLessThan(arriba.ancho)
    expect(NEONES_DEL_FONDO.grueso).toBeGreaterThan(0)
  })
})

describe('al cerrar el tutorial, el cartel avisa de que ya cuenta', () => {
  const vista = { titulo: 'Win games until you lose one', detalle: 'Bronze 1500', barra: null, medalla: null, discreto: false }
  const es = traductorSuave('es')

  it('en el reto, la línea grande lo dice en el idioma de quien juega', () => {
    expect(conElAvisoDeQueCuenta(vista, 'challenge', true, es)).toEqual({ ...vista, titulo: 'Ahora cuenta para medalla' })
    expect(conElAvisoDeQueCuenta(vista, 'challenge', true, traductorSuave('en'))?.titulo).toBe('Now it counts for a medal')
  })

  it('pasado el aviso, fuera del reto, con el cartel discreto o sin cartel, lo de siempre', () => {
    expect(conElAvisoDeQueCuenta(vista, 'challenge', false, es)).toBe(vista)
    expect(conElAvisoDeQueCuenta(vista, 'practice', true, es)).toBe(vista)
    const discreto = { ...vista, discreto: true }
    expect(conElAvisoDeQueCuenta(discreto, 'challenge', true, es)).toBe(discreto)
    expect(conElAvisoDeQueCuenta(null, 'challenge', true, es)).toBeNull()
  })
})
