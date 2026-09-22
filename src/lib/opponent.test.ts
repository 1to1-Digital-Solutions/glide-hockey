import { describe, expect, it } from 'vitest'
import {
  GOAL_WIDTH,
  MALLET_RADIUS,
  OPPONENT_SKILLS,
  PUCK_RADIUS,
  type OpponentSkill,
} from './gameConfig'
import {
  aimPoint,
  goalGaps,
  openPost,
  opponentStart,
  opponentTarget,
  planFor,
  playerStart,
  stepOpponent,
  unitHash,
  type AimSeed,
  type OpponentPlan,
} from './opponent'
import { HALF_LENGTH, HALF_WIDTH, fitsThroughGoal, type Body } from './puckPhysics'

const easy = OPPONENT_SKILLS.easy
const medium = OPPONENT_SKILLS.medium
const impossible = OPPONENT_SKILLS.impossible

/** Un disco quieto donde se le diga. */
function still(x: number, z: number): Body {
  return { position: { x, z }, velocity: { x: 0, z: 0 } }
}

/** El primer golpe de la primera jugada de la partida `match`. */
function seed(match: number, rally = 0, hit = 0): AimSeed {
  return { match, rally, hit }
}

/**
 * Una semilla que hace que esa dificultad elija ese plan.
 *
 * Los tests que miran **adónde** tira no quieren depender de qué plan le toca a
 * un número concreto: se busca el primero que da el plan que se quiere mirar.
 */
function seedFor(skill: OpponentSkill, plan: OpponentPlan): AimSeed {
  for (let hit = 0; hit < 200; hit += 1) {
    const candidata = seed(1, 0, hit)
    if (planFor(skill, candidata) === plan) return candidata
  }
  throw new Error(`no hay ninguna semilla que dé el plan «${plan}»`)
}

describe('a dónde quiere ir la máquina', () => {
  it('se planta entre el disco y su portería cuando está lejos', () => {
    const target = opponentTarget(
      {
        puck: still(0.4, 0.6),
        mallet: { x: 0, z: -0.8 },
        playerMallet: playerStart(),
        skill: easy,
      },
      seed(1),
    )

    // A su altura de defensa, cubriendo el lado por el que viene el disco.
    expect(target.z).toBeLessThan(0)
    expect(target.x).toBeGreaterThan(0)
  })

  it('sale a golpear el disco cuando lo tiene cerca en su mitad', () => {
    const puck = still(0, -0.5)
    const target = opponentTarget(
      {
        puck,
        mallet: { x: 0, z: -0.6 },
        playerMallet: playerStart(),
        skill: easy,
      },
      seed(1),
    )

    // Detrás del disco respecto a la portería del jugador: para empujarlo hacia
    // ella hay que ponerse al otro lado.
    expect(target.z).toBeLessThan(puck.position.z)
  })

  it('se adelanta a dónde va el disco, no a dónde está', () => {
    const movingRight: Body = {
      position: { x: 0, z: 0.6 },
      velocity: { x: 2, z: 0 },
    }

    const target = opponentTarget(
      {
        puck: movingRight,
        mallet: { x: 0, z: -0.8 },
        playerMallet: playerStart(),
        skill: impossible,
      },
      seed(1),
    )

    expect(target.x).toBeGreaterThan(0)
  })

  it('defiende más adelante cuanto más alto es el nivel', () => {
    const puck = still(0, 0.6)
    const mallet = { x: 0, z: -0.8 }

    const playerMallet = playerStart()
    const flojo = opponentTarget({ puck, mallet, playerMallet, skill: easy }, seed(1))
    const duro = opponentTarget({ puck, mallet, playerMallet, skill: impossible }, seed(1))

    expect(duro.z).toBeGreaterThan(flojo.z)
  })

  it('se coloca detrás del disco en la línea del tiro, y esa línea la elige el plan', () => {
    // El mismo disco y el mismo mazo con dos planes distintos dejan a la máquina
    // en dos sitios distintos: es lo que hace que el golpe salga hacia otro lado.
    const comun = {
      puck: still(0, -0.5),
      mallet: { x: 0, z: -0.6 },
      playerMallet: { x: 0.2, z: 0.85 },
      skill: impossible,
    }

    const alHueco = opponentTarget(comun, seedFor(impossible, 'gap'))
    const cruzado = opponentTarget(comun, seedFor(impossible, 'cross'))

    expect(alHueco.x).not.toBeCloseTo(cruzado.x, 4)
  })
})

describe('cómo se mueve la máquina', () => {
  it('no se mueve más rápido de lo que le permite su nivel', () => {
    const mallet = { x: 0, z: -0.2 }
    const dt = 1 / 60

    const moved = stepOpponent(
      {
        puck: still(0.5, 0.9),
        mallet,
        playerMallet: playerStart(),
        skill: easy,
        dt,
      },
      seed(1),
    )

    const travelled = Math.hypot(
      moved.position.x - mallet.x,
      moved.position.z - mallet.z,
    )
    expect(travelled).toBeLessThanOrEqual(easy.maxSpeed * dt + 1e-9)
  })

  it('nunca cruza la línea de medio campo persiguiendo el disco', () => {
    let mallet = opponentStart(impossible)

    for (let i = 0; i < 200; i++) {
      mallet = stepOpponent(
        {
          puck: still(0, 0.9),
          mallet,
          playerMallet: playerStart(),
          skill: impossible,
          dt: 1 / 60,
        },
        seed(1),
      ).position
    }

    expect(mallet.z).toBeLessThanOrEqual(-MALLET_RADIUS)
  })

  it('informa de la velocidad con la que llega, que es la que golpea', () => {
    const moved = stepOpponent(
      {
        puck: still(0, -0.5),
        mallet: { x: 0, z: -0.95 },
        playerMallet: playerStart(),
        skill: impossible,
        dt: 1 / 60,
      },
      seed(1),
    )

    expect(Math.hypot(moved.velocity.x, moved.velocity.z)).toBeGreaterThan(0)
  })

  it('se queda quieta ante un salto de tiempo imposible', () => {
    const mallet = { x: 0.1, z: -0.5 }

    const moved = stepOpponent(
      {
        puck: still(0, 0),
        mallet,
        playerMallet: playerStart(),
        skill: easy,
        dt: 0,
      },
      seed(1),
    )

    expect(moved.position).toEqual(mallet)
    expect(moved.velocity).toEqual({ x: 0, z: 0 })
  })

  it('ni siquiera con la mezcla de tiros se pasa de su velocidad ni se sale de su mitad', () => {
    // El azar sembrado cambia **adónde** apunta, no lo que puede hacer: si un
    // plan la sacara de su campo o la acelerara, dejaría de ser un rival y
    // pasaría a ser una trampa. Se recorren las tres opciones.
    for (const plan of ['gap', 'cross', 'bank'] as const) {
      const semilla = seedFor(impossible, plan)
      let mallet = opponentStart(impossible)
      for (let i = 0; i < 300; i++) {
        const paso = stepOpponent(
          {
            puck: still(0, -0.4),
            mallet,
            playerMallet: { x: 0.25, z: 0.8 },
            skill: impossible,
            dt: 1 / 60,
          },
          semilla,
        )
        const recorrido = Math.hypot(paso.position.x - mallet.x, paso.position.z - mallet.z)
        expect(recorrido, plan).toBeLessThanOrEqual(impossible.maxSpeed / 60 + 1e-9)
        mallet = paso.position
        expect(mallet.z, plan).toBeLessThanOrEqual(-MALLET_RADIUS)
        expect(Math.abs(mallet.x), plan).toBeLessThanOrEqual(HALF_WIDTH - MALLET_RADIUS + 1e-9)
      }
    }
  })
})

describe('la posición de salida', () => {
  it('deja a la máquina en su mitad', () => {
    const start = opponentStart(impossible)

    expect(start.z).toBeLessThanOrEqual(-MALLET_RADIUS)
    expect(start.z).toBeGreaterThanOrEqual(-HALF_LENGTH)
  })
})

describe('el hueco que deja el mazo del jugador', () => {
  it('se mide del borde del mazo al punto por el que entra el disco', () => {
    // Un mazo pegado al poste izquierdo no deja hueco por ese lado, y el derecho
    // queda entero: eso es lo que se lee, no en qué mitad está su centro.
    const reach = GOAL_WIDTH / 2 - PUCK_RADIUS
    const pegado = goalGaps({ x: -reach, z: 0.9 })

    expect(pegado.left).toBe(0)
    expect(pegado.right).toBeGreaterThan(0)
  })

  it('con el mazo en el centro los dos huecos son el mismo', () => {
    const { left, right } = goalGaps({ x: 0, z: 0.9 })
    expect(left).toBeCloseTo(right, 10)
  })

  it('el poste abierto es el del hueco mayor, y empatados el de la izquierda', () => {
    expect(openPost({ x: 0.3, z: 0.9 })).toBe(-1)
    expect(openPost({ x: -0.3, z: 0.9 })).toBe(1)
    expect(openPost({ x: 0, z: 0.9 })).toBe(-1)
  })
})

describe('el plan de cada golpe', () => {
  it('es el mismo para la misma semilla y otro para otra', () => {
    const misma = planFor(impossible, seed(7, 3, 2))
    expect(planFor(impossible, seed(7, 3, 2))).toBe(misma)

    // Y con otra partida, otra tirada: que salga otro plan en alguna de las diez
    // primeras es lo que dice que la semilla llega hasta aquí.
    const otras = Array.from({ length: 10 }, (_, i) => planFor(impossible, seed(8 + i, 3, 2)))
    expect(otras.some((plan) => plan !== misma)).toBe(true)
  })

  it('en fácil casi siempre va al hueco: es lo que hace que se le pueda leer', () => {
    const planes = Array.from({ length: 200 }, (_, i) => planFor(easy, seed(1, 0, i)))
    const alHueco = planes.filter((plan) => plan === 'gap').length

    expect(alHueco / planes.length).toBeGreaterThan(0.85)
    // Y nunca a la banda: un rebote no se ve venir, y en Fácil eso no es rival.
    expect(planes).not.toContain('bank')
  })

  it('en imposible los tres planes aparecen y ninguno manda', () => {
    const planes = Array.from({ length: 300 }, (_, i) => planFor(impossible, seed(1, 0, i)))
    for (const plan of ['gap', 'cross', 'bank'] as const) {
      const cuantas = planes.filter((candidato) => candidato === plan).length
      expect(cuantas / planes.length, plan).toBeGreaterThan(0.15)
      expect(cuantas / planes.length, plan).toBeLessThan(0.5)
    }
  })
})

describe('a qué parte de la portería tira', () => {
  const frente = { x: 0.3, z: 0.7 }

  it('al hueco que el jugador no está cubriendo', () => {
    const alHueco = seedFor(medium, 'gap')
    expect(aimPoint({ x: 0.3, z: 0.7 }, medium, alHueco).x).toBeLessThan(0)
    expect(aimPoint({ x: -0.3, z: 0.7 }, medium, alHueco).x).toBeGreaterThan(0)
  })

  it('nunca al centro, aunque el jugador esté en el centro', () => {
    // Tirando siempre al medio, un mazo parado delante de la portería es un
    // tapón perfecto: el disco va y viene entre los dos y la jugada no acaba.
    for (const plan of ['gap', 'cross', 'bank'] as const) {
      expect(aimPoint({ x: 0, z: 0.7 }, impossible, seedFor(impossible, plan)).x).not.toBe(0)
    }
  })

  it('apunta a donde el disco cabe entero, no al poste', () => {
    for (const plan of ['gap', 'cross'] as const) {
      const { x } = aimPoint(frente, impossible, seedFor(impossible, plan))
      expect(fitsThroughGoal(x), plan).toBe(true)
    }
  })

  it('el cruzado va al poste contrario que el tiro al hueco', () => {
    const alHueco = aimPoint(frente, impossible, seedFor(impossible, 'gap'))
    const cruzado = aimPoint(frente, impossible, seedFor(impossible, 'cross'))

    expect(Math.sign(cruzado.x)).toBe(-Math.sign(alHueco.x))
    expect(Math.abs(cruzado.x)).toBeCloseTo(Math.abs(alHueco.x), 10)
  })

  it('el tiro a la banda apunta fuera de la mesa: es el espejo del poste', () => {
    // No es un sitio, es una dirección: la recta al espejo es la que, tras
    // rebotar en la banda, pasa por el poste.
    const banda = aimPoint(frente, impossible, seedFor(impossible, 'bank'))
    const alHueco = aimPoint(frente, impossible, seedFor(impossible, 'gap'))

    // Al otro lado que el tiro al hueco, y más allá de la banda.
    expect(Math.sign(banda.x)).toBe(-Math.sign(alHueco.x))
    expect(Math.abs(banda.x)).toBeGreaterThan(HALF_WIDTH)

    // Y el rebote lo lleva al poste libre: reflejado en la banda, el espejo
    // vuelve a caer exactamente donde apunta el tiro al hueco.
    const banda_x = Math.sign(banda.x) * (HALF_WIDTH - PUCK_RADIUS)
    expect(2 * banda_x - banda.x).toBeCloseTo(alHueco.x, 10)
  })

  it('apunta a la portería del jugador y no a la suya', () => {
    for (const plan of ['gap', 'cross', 'bank'] as const) {
      expect(aimPoint(frente, impossible, seedFor(impossible, plan)).z).toBe(HALF_LENGTH)
    }
  })

  it('en cien jugadas de dificultad media ninguna esquina se lleva más del 70 %', () => {
    // El número que dice si el rival se puede memorizar. Con el mazo del jugador
    // quieto —que es el caso peor: el lado abierto no cambia— ninguno de los
    // sitios a los que tira puede llevarse la mayoría aplastante de los golpes,
    // o a la tercera partida se sabe dónde va a ir el disco.
    const quieto = { x: 0.2, z: 0.85 }
    const destinos = Array.from({ length: 100 }, (_, jugada) =>
      aimPoint(quieto, medium, seed(11, jugada, 0)).x.toFixed(4),
    )

    const cuenta = new Map<string, number>()
    for (const destino of destinos) cuenta.set(destino, (cuenta.get(destino) ?? 0) + 1)

    expect(Math.max(...cuenta.values()) / destinos.length).toBeLessThanOrEqual(0.7)
    // Y los tres destinos salen: que no se lleve el 70 % no puede ser porque
    // reparta entre dos y se olvide del tercero.
    expect(cuenta.size).toBe(3)
  })
})

describe('el hash que elige el plan', () => {
  it('devuelve siempre lo mismo para los mismos números, y entre 0 y 1', () => {
    for (let i = 0; i < 50; i += 1) {
      const valor = unitHash(i, i * 7, i * 13)
      expect(unitHash(i, i * 7, i * 13)).toBe(valor)
      expect(valor).toBeGreaterThanOrEqual(0)
      expect(valor).toBeLessThan(1)
    }
  })

  it('reparte parejo: es lo que hace que las proporciones del guion se cumplan', () => {
    const muestras = Array.from({ length: 4000 }, (_, i) => unitHash(3, i, 0))
    const cuartos = [0, 0, 0, 0]
    for (const muestra of muestras) cuartos[Math.min(3, Math.floor(muestra * 4))] += 1

    for (const cuarto of cuartos) {
      expect(cuarto / muestras.length).toBeGreaterThan(0.21)
      expect(cuarto / muestras.length).toBeLessThan(0.29)
    }
  })

  it('cambiar cualquiera de los tres números cambia el resultado', () => {
    const base = unitHash(1, 2, 3)
    expect(unitHash(2, 2, 3)).not.toBe(base)
    expect(unitHash(1, 3, 3)).not.toBe(base)
    expect(unitHash(1, 2, 4)).not.toBe(base)
  })
})
