import { describe, expect, it } from 'vitest'

import { MAX_EXPIRY, MIN_EXPIRY, scriptProblems, type HintScript } from './hints'
import { GOAL_WIDTH, MALLET_RADIUS, PUCK_RADIUS, TABLE_CENTER_Z } from './gameConfig'
import {
  AYUDAS_QUE_OCUPAN_LA_MESA,
  CALCO_Y,
  DISCO_AL_SACAR,
  EMPUJE,
  GUION_DE_AYUDAS,
  HITO_ANTES_DE_QUE_SE_MUEVA_EL_DISCO,
  HUELLA,
  HUELLAS,
  HUELLAS_Y,
  MANDO_JUNTO_AL_MAZO,
  MARCA_DE_PORTERIA,
  enElCampoDelJugador,
  mandoJuntoAlMazo,
  mazoFantasmaEn,
  recogidaDelEmpuje,
  recorridoDelEmpuje,
  sobreLaMesa,
  type AyudaDelMazo,
  type HechoDeLasAyudas,
} from './guionDeAyudas'
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

const HITOS: readonly HechoDeLasAyudas[] = ['tanda', 'grab', 'hit', 'goal']

/**
 * El guion visto como lo ve el motor.
 *
 * `as const` en el guion deja cada ayuda con su tipo exacto —la que no espera a nada no tiene
 * ni el campo `desde`—, que es justo lo que hace que un `desde` mal escrito no compile. Para
 * recorrerlas todas hace falta mirarlas con el tipo común.
 */
const GUION: HintScript<HechoDeLasAyudas> = GUION_DE_AYUDAS

describe('el guion no deja ninguna ayuda puesta', () => {
  it('lo dice el guardián común, que devuelve frases y no un sí', () => {
    expect(scriptProblems(GUION_DE_AYUDAS)).toEqual([])
  })

  it('y cada plazo cae dentro de lo que una ayuda puede durar', () => {
    for (const ayuda of GUION_DE_AYUDAS) {
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
    for (const id of AYUDAS_QUE_OCUPAN_LA_MESA) {
      const ayuda = GUION_DE_AYUDAS.find((una) => una.id === id)
      expect(ayuda, `«${id}» no está en el guion`).toBeDefined()
      expect(ayuda!.until, id).toBe(HITO_ANTES_DE_QUE_SE_MUEVA_EL_DISCO)
    }
  })

  it('y la que se queda jugando va calcada, no levantada', () => {
    const calcadas = GUION_DE_AYUDAS.map((ayuda) => ayuda.id).filter(
      (id): id is AyudaDelMazo => !AYUDAS_QUE_OCUPAN_LA_MESA.includes(id),
    )
    expect(calcadas).toContain('porteria')
    // Un calco se separa sesgando la profundidad, no levantándose: si esto creciera, dejaría de
    // ser un calco y volvería al problema de tapar.
    expect(CALCO_Y).toBeLessThanOrEqual(0.005)
    expect(HUELLAS_Y).toBeLessThanOrEqual(0.01)
  })
})

describe('las huellas dicen dónde ponerse', () => {
  it('detrás del borde cercano de la mesa, no encima de ella', () => {
    // El borde cercano queda a 20 cm de los pies de quien entra. Una huella pasada de ahí
    // pediría meterse dentro de la mesa.
    const bordeCercano = TABLE_CENTER_Z + HALF_LENGTH
    for (const huella of HUELLAS) {
      expect(huella.z - HUELLA.largo / 2, 'una huella se mete debajo de la mesa').toBeGreaterThan(
        bordeCercano,
      )
    }
  })

  it('son dos, a la par y sin pisarse', () => {
    // A la par y no escalonadas: es la postura del air hockey, y la postura es la mitad del
    // mensaje.
    expect(HUELLAS).toHaveLength(2)
    const [izquierda, derecha] = HUELLAS
    expect(izquierda.z).toBe(derecha.z)
    expect(Math.abs(derecha.x - izquierda.x)).toBeGreaterThan(HUELLA.ancho)
  })

  it('y centradas en la mesa, que es donde se juega de frente', () => {
    const centro = HUELLAS.reduce((suma, huella) => suma + huella.x, 0) / HUELLAS.length
    expect(centro).toBeCloseTo(0, 6)
  })
})

describe('el mazo fantasma enseña el empujón', () => {
  it('empieza por detrás de donde nace el mazo y acaba tocando el disco', () => {
    // Que termine tocándolo es la mitad de la lección: un fantasma que se para a medio camino
    // enseña a mover el mazo, no a golpear.
    const { desde, hasta } = recorridoDelEmpuje()
    expect(desde).toBeGreaterThan(playerStart().z)
    expect(hasta).toBeCloseTo(DISCO_AL_SACAR.z + PUCK_RADIUS + MALLET_RADIUS, 6)
  })

  it('y no se sale de la mesa ni se pasa al campo contrario', () => {
    // Un fantasma que cruza la línea enseñaría un movimiento que el juego no deja hacer.
    for (let i = 0; i <= 40; i += 1) {
      const donde = mazoFantasmaEn(i / 40)
      expect(enElCampoDelJugador(donde), `en el ${i / 40} está fuera`).toBe(true)
      expect(Math.abs(donde.z), `en el ${i / 40} se sale por el fondo`).toBeLessThanOrEqual(
        HALF_LENGTH,
      )
    }
  })

  it('va despacio hacia atrás y empuja deprisa: eso es un golpe y no un vaivén', () => {
    // Con los dos tramos iguales lo que se enseñaba era un limpiaparabrisas.
    expect(EMPUJE.recogida).toBeGreaterThan(0.5)
    const recogiendo = EMPUJE.recogida
    const empujando = 1 - EMPUJE.recogida
    expect(recogiendo).toBeGreaterThan(empujando)
  })

  it('la vuelta entera: del disco, atrás del todo, y de vuelta al disco', () => {
    expect(recogidaDelEmpuje(0)).toBeCloseTo(0, 6)
    expect(recogidaDelEmpuje(EMPUJE.recogida)).toBeCloseTo(1, 6)
    expect(recogidaDelEmpuje(1)).toBeCloseTo(0, 6)
    // Y es continua por los dos tramos: un salto se vería como un tirón.
    expect(recogidaDelEmpuje(EMPUJE.recogida / 2)).toBeCloseTo(0.5, 6)
    expect(recogidaDelEmpuje((1 + EMPUJE.recogida) / 2)).toBeCloseTo(0.5, 6)
  })

  it('y un avance fuera de la vuelta no lo saca de la mesa', () => {
    // El reloj del pase no debería darlo, pero un número raro aquí dejaría el fantasma
    // disparado a tomar por saco en vez de quieto en un extremo.
    expect(recogidaDelEmpuje(-3)).toBe(0)
    expect(recogidaDelEmpuje(4)).toBe(0)
    expect(enElCampoDelJugador(mazoFantasmaEn(-3))).toBe(true)
    expect(enElCampoDelJugador(mazoFantasmaEn(9))).toBe(true)
  })

  it('y dura lo que dura mirar, no lo que dura una partida', () => {
    expect(EMPUJE.periodo).toBeGreaterThan(0.8)
    expect(EMPUJE.periodo).toBeLessThan(3)
  })
})

describe('el mando va junto al mazo fantasma, con el agarre de cara', () => {
  it('a un palmo del mazo, del lado de la mano que juega, sobre la mesa y en su campo', () => {
    const { posicion } = mandoJuntoAlMazo()
    const mazo = playerStart()
    const palmo = Math.hypot(posicion.x - mazo.x, posicion.z - mazo.z)
    expect(palmo).toBeGreaterThanOrEqual(0.15)
    expect(palmo).toBeLessThanOrEqual(0.3)
    expect(posicion.x).toBeGreaterThan(mazo.x)
    expect(enElCampoDelJugador(posicion)).toBe(true)
    // Por encima del tablero, a la altura de la mano: no calcado ni flotando lejos.
    expect(posicion.y).toBeGreaterThan(0.05)
    expect(posicion.y).toBeLessThan(0.2)
    expect(MANDO_JUNTO_AL_MAZO.escala).toBeGreaterThanOrEqual(1)
  })

  it('no se mete en el camino del fantasma: entre los dos queda aire', () => {
    const { posicion } = mandoJuntoAlMazo()
    // El mando (≈12 cm de largo, crecido) apunta hacia el fantasma; su punta no llega al aro.
    const largo = 0.12 * MANDO_JUNTO_AL_MAZO.escala
    expect(posicion.x - largo).toBeGreaterThan(MALLET_RADIUS)
  })

  it('girado hasta que el costado del agarre mira a los ojos', () => {
    const { posicion, giro } = mandoJuntoAlMazo()
    // El agarre del mando derecho está en su costado −X; girado `giro` sobre la vertical
    // queda en (−cos, 0, sen). Hacia los ojos: del mando al origen, en planta.
    const agarre = { x: -Math.cos(giro), z: Math.sin(giro) }
    const hacia = { x: -posicion.x, z: -(posicion.z + TABLE_CENTER_Z) }
    const n = Math.hypot(hacia.x, hacia.z)
    expect(agarre.x * (hacia.x / n) + agarre.z * (hacia.z / n)).toBeCloseTo(1, 9)
  })

  it('para un zurdo, el izquierdo en espejo: al otro lado del mazo y con su agarre (+X) de cara', () => {
    expect(mandoJuntoAlMazo()).toEqual(mandoJuntoAlMazo('right'))
    const { posicion, giro } = mandoJuntoAlMazo('left')
    const mazo = playerStart()
    const derecho = mandoJuntoAlMazo('right')
    expect(posicion.x - mazo.x).toBeCloseTo(-(derecho.posicion.x - mazo.x), 12)
    expect([posicion.y, posicion.z]).toEqual([derecho.posicion.y, derecho.posicion.z])
    expect(enElCampoDelJugador(posicion)).toBe(true)
    // El agarre del izquierdo está en su +X: girado `giro`, queda en (cos, 0, −sen).
    const agarre = { x: Math.cos(giro), z: -Math.sin(giro) }
    const hacia = { x: -posicion.x, z: -(posicion.z + TABLE_CENTER_Z) }
    const n = Math.hypot(hacia.x, hacia.z)
    expect(agarre.x * (hacia.x / n) + agarre.z * (hacia.z / n)).toBeCloseTo(1, 9)
  })
})

describe('la marca de la portería dice adónde va el disco', () => {
  it('ocupa el hueco entero y no se sale de la mesa', () => {
    expect(MARCA_DE_PORTERIA.ancho).toBe(GOAL_WIDTH)
    expect(MARCA_DE_PORTERIA.ancho / 2).toBeLessThanOrEqual(HALF_WIDTH)
    const dentro = MARCA_DE_PORTERIA.z + MARCA_DE_PORTERIA.fondo / 2
    const fuera = MARCA_DE_PORTERIA.z - MARCA_DE_PORTERIA.fondo / 2
    expect(sobreLaMesa({ x: MARCA_DE_PORTERIA.ancho / 2, z: dentro })).toBe(true)
    expect(sobreLaMesa({ x: 0, z: fuera })).toBe(true)
  })

  it('en el campo contrario, que es adónde hay que mandarlo', () => {
    expect(MARCA_DE_PORTERIA.z).toBeLessThan(0)
    expect(enElCampoDelJugador({ x: 0, z: MARCA_DE_PORTERIA.z })).toBe(false)
  })
})

describe('el metro con el que se miden', () => {
  it('lo de fuera de la mesa queda fuera, con margen o sin él', () => {
    expect(sobreLaMesa({ x: 0, z: 0 })).toBe(true)
    expect(sobreLaMesa({ x: HALF_WIDTH + 0.2, z: 0 })).toBe(false)
    expect(sobreLaMesa({ x: HALF_WIDTH + 0.2, z: 0 }, 0.3)).toBe(true)
    expect(sobreLaMesa({ x: 0, z: HALF_LENGTH + 0.2 })).toBe(false)
  })
})
