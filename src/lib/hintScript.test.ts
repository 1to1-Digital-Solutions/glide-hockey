import { describe, expect, it } from 'vitest'

import { MAX_EXPIRY, MIN_EXPIRY, scriptProblems, type HintScript } from './hints'
import { GOAL_WIDTH, MALLET_RADIUS, PUCK_RADIUS, TABLE_CENTER_Z } from './gameConfig'
import {
  HINTS_ON_THE_TABLE,
  DECAL_Y,
  PUCK_AT_SERVE,
  PUSH,
  HINT_SCRIPT,
  MILESTONE_BEFORE_PUCK_MOVES,
  FOOTPRINT,
  FOOTPRINTS,
  FOOTPRINTS_Y,
  CONTROLLER_BESIDE_MALLET,
  GOAL_MARK,
  inPlayerHalf,
  controllerBesideMallet,
  ghostMalletAt,
  pushReturn,
  pushTravel,
  onTheTable,
  type MalletHint,
  type HintFact,
} from './hintScript'
import { playerStart } from './opponent'
import { HALF_LENGTH, HALF_WIDTH } from './puckPhysics'
import { TUTORIAL_STEPS } from './tutorial'

/**
 * El guion de las ayudas, medido.
 *
 * Lo que se comprueba aquí es lo que no se ve mirando la escena: que ninguna ayuda se quede
 * puesta, que lo que se levanta de la mesa haya desaparecido antes de que el disco salga, y que
 * lo que se pinta caiga donde se dice que cae. Cómo se ve —si el fantasma se lee como un
 * empujón o como un borrón— es de visor, y está apuntado en `docs/pendiente-de-visor.md`.
 */

const HITOS: readonly HintFact[] = ['round', 'grab', 'hit', 'goal']

/**
 * El guion visto como lo ve el motor.
 *
 * `as const` en el guion deja cada ayuda con su tipo exacto —la que no espera a nada no tiene
 * ni el campo `desde`—, que es justo lo que hace que un `desde` mal escrito no compile. Para
 * recorrerlas todas hace falta mirarlas con el tipo común.
 */
const GUION: HintScript<HintFact> = HINT_SCRIPT

describe('el guion no deja ninguna ayuda puesta', () => {
  it('lo dice el guardián común, que devuelve frases y no un sí', () => {
    expect(scriptProblems(HINT_SCRIPT)).toEqual([])
  })

  it('y cada plazo cae dentro de lo que una ayuda puede durar', () => {
    for (const ayuda of HINT_SCRIPT) {
      expect(ayuda.expiresAfter, ayuda.id).toBeGreaterThanOrEqual(MIN_EXPIRY)
      expect(ayuda.expiresAfter, ayuda.id).toBeLessThanOrEqual(MAX_EXPIRY)
    }
  })

  it('los hitos que nombra son hitos que alguien apunta', () => {
    // Un hito inventado dejaría la ayuda encendida para siempre: nadie lo pondría nunca a
    // cierto, y el plazo sería lo único que la apagaría.
    for (const ayuda of GUION) {
      expect(HITOS, `«${ayuda.id}» se apaga con un hito que no existe`).toContain(ayuda.until)
      if (ayuda.from !== undefined) {
        expect(HITOS, `«${ayuda.id}» espera a un hito que no existe`).toContain(ayuda.from)
      }
    }
  })

  it('y tres de los cuatro son los del tutorial, no una lista aparte', () => {
    // Los apuntan los mismos sitios que ya saben lo que pasa. Una segunda lista acabaría
    // discrepando de la primera, y entonces la ayuda y la lección irían por su cuenta.
    for (const paso of TUTORIAL_STEPS) expect(HITOS).toContain(paso)
  })
})

describe('lo que se levanta de la mesa se quita antes de que algo corra por ella', () => {
  it('todas las que la ocupan se apagan con el hito que precede al saque', () => {
    // Es la regla que no hay que volver a comprobar con el visor: un calco no puede tapar nada
    // que resbale por encima, pero lo que se levanta está en la recta que va de los ojos al
    // disco. La cuenta atrás se para hasta que el mazo va en la mano, así que ese hito llega
    // siempre antes que el saque.
    for (const id of HINTS_ON_THE_TABLE) {
      const ayuda = HINT_SCRIPT.find((una) => una.id === id)
      expect(ayuda, `«${id}» no está en el guion`).toBeDefined()
      expect(ayuda!.until, id).toBe(MILESTONE_BEFORE_PUCK_MOVES)
    }
  })

  it('y la que se queda jugando va calcada, no levantada', () => {
    const calcadas = HINT_SCRIPT.map((ayuda) => ayuda.id).filter(
      (id): id is MalletHint => !HINTS_ON_THE_TABLE.includes(id),
    )
    expect(calcadas).toContain('goal')
    // Un calco se separa sesgando la profundidad, no levantándose: si esto creciera, dejaría de
    // ser un calco y volvería al problema de tapar.
    expect(DECAL_Y).toBeLessThanOrEqual(0.005)
    expect(FOOTPRINTS_Y).toBeLessThanOrEqual(0.01)
  })
})

describe('las huellas dicen dónde ponerse', () => {
  it('detrás del borde cercano de la mesa, no encima de ella', () => {
    // El borde cercano queda a 20 cm de los pies de quien entra. Una huella pasada de ahí
    // pediría meterse dentro de la mesa.
    const bordeCercano = TABLE_CENTER_Z + HALF_LENGTH
    for (const huella of FOOTPRINTS) {
      expect(huella.z - FOOTPRINT.length / 2, 'una huella se mete debajo de la mesa').toBeGreaterThan(
        bordeCercano,
      )
    }
  })

  it('son dos, a la par y sin pisarse', () => {
    // A la par y no escalonadas: es la postura del air hockey, y la postura es la mitad del
    // mensaje.
    expect(FOOTPRINTS).toHaveLength(2)
    const [izquierda, derecha] = FOOTPRINTS
    expect(izquierda.z).toBe(derecha.z)
    expect(Math.abs(derecha.x - izquierda.x)).toBeGreaterThan(FOOTPRINT.width)
  })

  it('y centradas en la mesa, que es donde se juega de frente', () => {
    const centro = FOOTPRINTS.reduce((suma, huella) => suma + huella.x, 0) / FOOTPRINTS.length
    expect(centro).toBeCloseTo(0, 6)
  })
})

describe('el mazo fantasma enseña el empujón', () => {
  it('empieza por detrás de donde nace el mazo y acaba tocando el disco', () => {
    // Que termine tocándolo es la mitad de la lección: un fantasma que se para a medio camino
    // enseña a mover el mazo, no a golpear.
    const { from: desde, to: hasta } = pushTravel()
    expect(desde).toBeGreaterThan(playerStart().z)
    expect(hasta).toBeCloseTo(PUCK_AT_SERVE.z + PUCK_RADIUS + MALLET_RADIUS, 6)
  })

  it('y no se sale de la mesa ni se pasa al campo contrario', () => {
    // Un fantasma que cruza la línea enseñaría un movimiento que el juego no deja hacer.
    for (let i = 0; i <= 40; i += 1) {
      const donde = ghostMalletAt(i / 40)
      expect(inPlayerHalf(donde), `en el ${i / 40} está fuera`).toBe(true)
      expect(Math.abs(donde.z), `en el ${i / 40} se sale por el fondo`).toBeLessThanOrEqual(
        HALF_LENGTH,
      )
    }
  })

  it('va despacio hacia atrás y empuja deprisa: eso es un golpe y no un vaivén', () => {
    // Con los dos tramos iguales lo que se enseñaba era un limpiaparabrisas.
    expect(PUSH.returnAt).toBeGreaterThan(0.5)
    const recogiendo = PUSH.returnAt
    const empujando = 1 - PUSH.returnAt
    expect(recogiendo).toBeGreaterThan(empujando)
  })

  it('la vuelta entera: del disco, atrás del todo, y de vuelta al disco', () => {
    expect(pushReturn(0)).toBeCloseTo(0, 6)
    expect(pushReturn(PUSH.returnAt)).toBeCloseTo(1, 6)
    expect(pushReturn(1)).toBeCloseTo(0, 6)
    // Y es continua por los dos tramos: un salto se vería como un tirón.
    expect(pushReturn(PUSH.returnAt / 2)).toBeCloseTo(0.5, 6)
    expect(pushReturn((1 + PUSH.returnAt) / 2)).toBeCloseTo(0.5, 6)
  })

  it('y un avance fuera de la vuelta no lo saca de la mesa', () => {
    // El reloj del pase no debería darlo, pero un número raro aquí dejaría el fantasma
    // disparado a tomar por saco en vez de quieto en un extremo.
    expect(pushReturn(-3)).toBe(0)
    expect(pushReturn(4)).toBe(0)
    expect(inPlayerHalf(ghostMalletAt(-3))).toBe(true)
    expect(inPlayerHalf(ghostMalletAt(9))).toBe(true)
  })

  it('y dura lo que dura mirar, no lo que dura una partida', () => {
    expect(PUSH.period).toBeGreaterThan(0.8)
    expect(PUSH.period).toBeLessThan(3)
  })
})

describe('el mando va junto al mazo fantasma, con el agarre de cara', () => {
  it('a un palmo del mazo, del lado de la mano que juega, sobre la mesa y en su campo', () => {
    const { position: posicion } = controllerBesideMallet()
    const mazo = playerStart()
    const palmo = Math.hypot(posicion.x - mazo.x, posicion.z - mazo.z)
    expect(palmo).toBeGreaterThanOrEqual(0.15)
    expect(palmo).toBeLessThanOrEqual(0.3)
    expect(posicion.x).toBeGreaterThan(mazo.x)
    expect(inPlayerHalf(posicion)).toBe(true)
    // Por encima del tablero, a la altura de la mano: no calcado ni flotando lejos.
    expect(posicion.y).toBeGreaterThan(0.05)
    expect(posicion.y).toBeLessThan(0.2)
    expect(CONTROLLER_BESIDE_MALLET.scale).toBeGreaterThanOrEqual(1)
  })

  it('no se mete en el camino del fantasma: entre los dos queda aire', () => {
    const { position: posicion } = controllerBesideMallet()
    // El mando (≈12 cm de largo, crecido) apunta hacia el fantasma; su punta no llega al aro.
    const largo = 0.12 * CONTROLLER_BESIDE_MALLET.scale
    expect(posicion.x - largo).toBeGreaterThan(MALLET_RADIUS)
  })

  it('girado hasta que el costado del agarre mira a los ojos', () => {
    const { position: posicion, rotation: giro } = controllerBesideMallet()
    // El agarre del mando derecho está en su costado −X; girado `giro` sobre la vertical
    // queda en (−cos, 0, sen). Hacia los ojos: del mando al origen, en planta.
    const agarre = { x: -Math.cos(giro), z: Math.sin(giro) }
    const hacia = { x: -posicion.x, z: -(posicion.z + TABLE_CENTER_Z) }
    const n = Math.hypot(hacia.x, hacia.z)
    expect(agarre.x * (hacia.x / n) + agarre.z * (hacia.z / n)).toBeCloseTo(1, 9)
  })

  it('para un zurdo, el izquierdo en espejo: al otro lado del mazo y con su agarre (+X) de cara', () => {
    expect(controllerBesideMallet()).toEqual(controllerBesideMallet('right'))
    const { position: posicion, rotation: giro } = controllerBesideMallet('left')
    const mazo = playerStart()
    const derecho = controllerBesideMallet('right')
    expect(posicion.x - mazo.x).toBeCloseTo(-(derecho.position.x - mazo.x), 12)
    expect([posicion.y, posicion.z]).toEqual([derecho.position.y, derecho.position.z])
    expect(inPlayerHalf(posicion)).toBe(true)
    // El agarre del izquierdo está en su +X: girado `giro`, queda en (cos, 0, −sen).
    const agarre = { x: Math.cos(giro), z: -Math.sin(giro) }
    const hacia = { x: -posicion.x, z: -(posicion.z + TABLE_CENTER_Z) }
    const n = Math.hypot(hacia.x, hacia.z)
    expect(agarre.x * (hacia.x / n) + agarre.z * (hacia.z / n)).toBeCloseTo(1, 9)
  })
})

describe('la marca de la portería dice adónde va el disco', () => {
  it('ocupa el hueco entero y no se sale de la mesa', () => {
    expect(GOAL_MARK.width).toBe(GOAL_WIDTH)
    expect(GOAL_MARK.width / 2).toBeLessThanOrEqual(HALF_WIDTH)
    const dentro = GOAL_MARK.z + GOAL_MARK.depth / 2
    const fuera = GOAL_MARK.z - GOAL_MARK.depth / 2
    expect(onTheTable({ x: GOAL_MARK.width / 2, z: dentro })).toBe(true)
    expect(onTheTable({ x: 0, z: fuera })).toBe(true)
  })

  it('en el campo contrario, que es adónde hay que mandarlo', () => {
    expect(GOAL_MARK.z).toBeLessThan(0)
    expect(inPlayerHalf({ x: 0, z: GOAL_MARK.z })).toBe(false)
  })
})

describe('el metro con el que se miden', () => {
  it('lo de fuera de la mesa queda fuera, con margen o sin él', () => {
    expect(onTheTable({ x: 0, z: 0 })).toBe(true)
    expect(onTheTable({ x: HALF_WIDTH + 0.2, z: 0 })).toBe(false)
    expect(onTheTable({ x: HALF_WIDTH + 0.2, z: 0 }, 0.3)).toBe(true)
    expect(onTheTable({ x: 0, z: HALF_LENGTH + 0.2 })).toBe(false)
  })
})
