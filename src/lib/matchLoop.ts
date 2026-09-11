import {
  GOAL_PAUSE_SECONDS,
  PLAYER_MALLET_SPEED,
  type OpponentSkill,
} from './gameConfig'
import { opponentStart, playerStart, stepOpponent } from './opponent'
import {
  NO_IMPACT,
  constrainMallet,
  isRallyOver,
  isStalled,
  rallySeconds,
  serve,
  stallSeconds,
  stepPuck,
  strongerImpact,
  type Body,
  type Impact,
  type Scorer,
  type Vec2,
} from './puckPhysics'

/**
 * El bucle de la partida: qué pasa en la mesa en un fotograma.
 *
 * Es una función pura del estado de la mesa y del tiempo transcurrido. La
 * escena (`components/game/Rink.tsx`) le pasa el reloj y coloca el resultado,
 * así que la partida entera se puede jugar en un test, sin navegador y sin
 * esperar en tiempo real a que caiga un gol.
 *
 * **El tiempo simulado es el tiempo de reloj.** Un fotograma avanza los
 * segundos que ha tardado en llegar, repartidos en pasos de `STEP_SECONDS`
 * exactos; lo que no llega a un paso se guarda para el fotograma siguiente. No
 * recortarlos es lo que hace que la partida dure lo mismo en una máquina que
 * pinta sesenta fotogramas por segundo que en una que pinta quince.
 *
 * El paso es **siempre del mismo tamaño**, y no el fotograma partido en trozos
 * iguales, porque la mesa es un sistema caótico: dos golpes que salen con una
 * diezmilésima de diferencia acaban en jugadas distintas. Con el paso atado al
 * ritmo de fotogramas la misma partida duraba once segundos a 60 fotogramas por
 * segundo, veinticuatro a 7 y a 56 no se acababa nunca, aunque en ninguno de los
 * tres fuera a cámara lenta. Con el paso fijo la partida es la misma en todas
 * las máquinas y lo único que cambia es cada cuánto se pinta.
 *
 * Lo único que sí se recorta es el fotograma disparatado: una pestaña que
 * vuelve de segundo plano entrega un `delta` de segundos, o de minutos, y con
 * él la partida avanzaría de golpe, con goles marcados sin que nadie los
 * viera. De ese fotograma se simula `MAX_FRAME_SECONDS` y el resto del tiempo
 * se da por no ocurrido. Son dos cosas distintas —«este fotograma llegó
 * tardísimo» y «esta máquina va lenta»— y solo la primera pide recortar.
 */

/**
 * Lo que avanza un paso de simulación, en segundos. Siempre el mismo.
 *
 * Es la resolución con la que se detectan los golpes: dentro de un paso los
 * mazos están donde los dejó el anterior, y el del jugador se mueve a 4,5 m/s.
 * En 1/60 s recorre 7,5 cm, poco más de la mitad de lo que mide el contacto
 * entre mazo y disco, así que no hay forma de que lo cruce sin tocarlo.
 */
const STEP_SECONDS = 1 / 60

/**
 * Tiempo máximo que se simula en un fotograma, en segundos.
 *
 * Es la frontera entre una máquina lenta y una pestaña que vuelve de segundo
 * plano: por debajo se simula el tiempo real y por encima se descarta lo que
 * sobra. Un cuarto de segundo son cuatro fotogramas por segundo —por ahí ya no
 * se está jugando— y es a la vez lo máximo que la mesa puede saltar de golpe.
 */
export const MAX_FRAME_SECONDS = 0.25

/**
 * Dónde va el mazo del jugador entre los que se le pasan a la física, que es
 * como esta dice cuál ha golpeado el disco (ver `stepPuck`).
 */
const PLAYER_MALLET = 0

/** Todo lo que hay que recordar de una partida entre fotograma y fotograma. */
export interface TableState {
  puck: Body
  /** El mazo del jugador, con la velocidad con la que golpea. */
  player: Body
  /** El mazo de la máquina, igual. */
  opponent: Body
  /** Segundos que queda por celebrar el gol antes de volver a sacar. */
  pause: number
  /** Cuánto lleva el disco muerto: pasado el plazo se saca de nuevo. */
  stalled: number
  /**
   * Cuánto lleva la jugada sin gol. Pasado el plazo se saca de nuevo: es lo
   * que corta los peloteos que el disco muerto no ve, porque en ellos el disco
   * no se para (`RALLY_SECONDS`).
   */
  rally: number
  /** Quién marcó el último gol: decide hacia dónde se saca. */
  pendingServe: Scorer | null
  /** Veces que el mazo del jugador ha golpeado el disco en esta partida. */
  playerHits: number
  /**
   * Tiempo de reloj que sobró del último fotograma sin llegar a un paso.
   *
   * Es lo que mantiene el paso fijo sin perder ni inventar segundos: se guarda
   * aquí y lo juega el fotograma siguiente. Nunca llega a `STEP_SECONDS`.
   */
  leftover: number
}

/** La mesa recién puesta: el disco en el centro y cada mazo en su sitio. */
export function startTable({
  skill,
  lastScorer,
}: {
  skill: OpponentSkill
  /** Quién marcó lo último que se jugó, para saber hacia dónde se saca. */
  lastScorer: Scorer | null
}): TableState {
  return {
    // Al empezar sale siempre hacia la máquina, gane quien gane el punto
    // anterior: el primer movimiento de la partida es del jugador (ver
    // `serve`).
    puck: serve(null),
    player: { position: playerStart(), velocity: { x: 0, z: 0 } },
    opponent: { position: opponentStart(skill), velocity: { x: 0, z: 0 } },
    pause: 0,
    stalled: 0,
    rally: 0,
    pendingServe: lastScorer,
    playerHits: 0,
    leftover: 0,
  }
}

export interface FrameInput {
  /** Segundos de reloj desde el fotograma anterior. */
  delta: number
  /** Dónde apunta el jugador. El mazo va detrás, no salta hasta ahí. */
  pointer: Vec2
  /**
   * Si el mazo va **cogido con la mano** (visor). Entonces no persigue al puntero: está
   * donde esté la mano, porque un mazo que va detrás de tu mano no se siente cogido, se
   * siente arrastrado. Con el ratón sigue persiguiendo, que es lo que le da peso en una
   * pantalla.
   */
  inHand?: boolean
  skill: OpponentSkill
  /**
   * Si el disco está en juego. Fuera de la partida los mazos siguen
   * respondiendo —así uno se coloca durante la cuenta atrás— pero el disco
   * espera en el centro.
   */
  playing: boolean
}

export interface FrameResult {
  table: TableState
  /**
   * Los goles del fotograma, en orden. Es una lista y no un gol porque un
   * fotograma son varios pasos de simulación; quien llama los lleva al
   * marcador uno a uno.
   */
  goals: readonly Scorer[]
  /**
   * Algún mazo ha golpeado el disco en este fotograma.
   *
   * Los dos siguientes son lo que el juego cuenta con sonido, y por eso son un
   * sí o un no y no una cuenta: los varios pasos de un fotograma caen todos en
   * la misma milésima, así que dos golpes ahí dentro no se oirían como dos
   * golpes sino como uno más fuerte.
   */
  struck: boolean
  /** El disco ha rebotado en alguna banda. */
  bounced: boolean
  /** Con qué fuerza: el golpe y el rebote más fuertes del fotograma, en m/s. */
  impact: Impact
}

/**
 * Cuántos segundos de reloj trae un fotograma.
 *
 * Cero si el reloj no dice nada aprovechable —un fotograma sin tiempo, o uno
 * con un `delta` que no es un número—, y como mucho `MAX_FRAME_SECONDS`.
 */
function frameSeconds(delta: number): number {
  if (!Number.isFinite(delta) || delta <= 0) return 0
  return Math.min(delta, MAX_FRAME_SECONDS)
}

/** La mesa tras un fotograma de `delta` segundos. */
export function advanceTable(
  table: TableState,
  input: FrameInput,
): FrameResult {
  const elapsed = frameSeconds(input.delta)
  if (elapsed === 0) return { table, goals: [], struck: false, bounced: false, impact: NO_IMPACT }

  // Se juegan los pasos enteros que caben en lo acumulado y lo que sobra espera
  // al fotograma siguiente. Como `elapsed` viene topado, el número de pasos
  // también lo está: un fotograma que llega tardísimo no arrastra al siguiente a
  // simular todavía más, que es la espiral de la muerte de un bucle así.
  const pending = table.leftover + elapsed
  const steps = Math.floor(pending / STEP_SECONDS)

  let current: TableState = {
    ...table,
    leftover: pending - steps * STEP_SECONDS,
  }
  const goals: Scorer[] = []
  let struck = false
  let bounced = false
  let impact: Impact = NO_IMPACT
  // Con el mazo en la mano, el camino que ha hecho la mano desde el fotograma
  // anterior se **reparte** entre los pasos de este, en vez de recorrerse entero
  // en el primero. Es lo que hace que la velocidad del mazo sea la de la mano y
  // no la de la máquina: metiendo el movimiento de un fotograma en un paso de
  // 1/60, el mazo iba `60/fps` veces más rápido de lo que iba la mano —a 45
  // fotogramas por segundo golpeaba un tercio más fuerte, a 90 un tercio más
  // flojo, y en los pasos sobrantes golpeaba con el mazo parado—.
  const manoDesde = table.player.position
  const repartido = steps * STEP_SECONDS
  for (let i = 0; i < steps; i++) {
    const step = advanceStep(current, input, STEP_SECONDS, camino(manoDesde, input, repartido / pending, (i + 1) / steps))
    current = step.table
    if (step.goal != null) goals.push(step.goal)
    struck = struck || step.struck
    bounced = bounced || step.bounced
    impact = strongerImpact(impact, step.impact)
  }

  return { table: current, goals, struck, bounced, impact }
}

/** Lo que deja un paso de simulación, además de la mesa. */
interface StepOutcome {
  table: TableState
  goal: Scorer | null
  struck: boolean
  bounced: boolean
  impact: Impact
}

/** Un paso en el que no pasa nada digno de contarse. */
const QUIET = { goal: null, struck: false, bounced: false, impact: NO_IMPACT } as const

/**
 * Hasta dónde ha llegado la mano en el paso `parte` de los de este fotograma.
 *
 * `avance` es la porción del fotograma que se llega a simular: lo que sobra sin
 * llenar un paso lo juega el fotograma siguiente, así que ese trozo de camino
 * tampoco se recorre todavía. Sin mazo en la mano no hay camino que repartir:
 * el puntero es el destino y el mazo va detrás a su propio ritmo.
 */
function camino(desde: Vec2, { pointer, inHand = false }: FrameInput, avance: number, parte: number): Vec2 {
  if (!inHand) return pointer
  const t = avance * parte
  return {
    x: desde.x + (pointer.x - desde.x) * t,
    z: desde.z + (pointer.z - desde.z) * t,
  }
}

/** Un paso de simulación: lo que de verdad mueve la mesa. */
function advanceStep(
  table: TableState,
  { skill, playing, inHand = false }: FrameInput,
  dt: number,
  /** A dónde va el mazo del jugador en este paso. */
  pointer: Vec2,
): StepOutcome {
  const player = movePlayer(table.player, pointer, dt, inHand)

  if (!playing) return { table: { ...table, player }, ...QUIET }

  if (table.pause > 0) {
    const pause = table.pause - dt
    return {
      table: {
        ...table,
        player,
        pause,
        puck: pause > 0 ? table.puck : serve(table.pendingServe),
      },
      ...QUIET,
    }
  }

  const opponent = stepOpponent({
    puck: table.puck,
    mallet: table.opponent.position,
    playerMallet: player.position,
    skill,
    dt,
  })

  const result = stepPuck({
    puck: table.puck,
    mallets: [player, opponent],
    dt,
  })
  const playerHits =
    table.playerHits + (result.struckBy.includes(PLAYER_MALLET) ? 1 : 0)
  // Golpe es golpe lo dé quien lo dé: el disco suena igual saliendo del mazo
  // del jugador que del de la máquina.
  const struck = result.struckBy.length > 0

  if (result.goal != null) {
    return {
      table: {
        ...table,
        player,
        opponent,
        puck: result.puck,
        pause: GOAL_PAUSE_SECONDS,
        stalled: 0,
        rally: 0,
        pendingServe: result.goal,
        playerHits,
      },
      goal: result.goal,
      struck,
      bounced: result.bounced,
      impact: result.impact,
    }
  }

  // Ninguno de los dos mazos cruza la línea de medio campo, así que un disco
  // parado donde el otro no llega deja la partida congelada. Se saca de nuevo,
  // como en la mesa de verdad.
  const stalled = stallSeconds(table.stalled, result.puck, dt)
  const rally = rallySeconds(table.rally, dt)
  // Se vuelve a sacar por dos motivos distintos —el disco muerto y la jugada
  // que no se acaba— y los dos empiezan una jugada nueva: las dos cuentas a cero.
  const reserve = isStalled(stalled) || isRallyOver(rally)

  return {
    table: {
      ...table,
      player,
      opponent,
      puck: reserve ? serve(table.pendingServe) : result.puck,
      stalled: reserve ? 0 : stalled,
      rally: reserve ? 0 : rally,
      playerHits,
    },
    goal: null,
    struck,
    bounced: result.bounced,
    impact: result.impact,
  }
}

/**
 * Acerca el mazo del jugador a donde apunta, sin pasarse de su velocidad.
 *
 * La velocidad resultante es la real y no la pretendida: es con la que golpea,
 * así que un mazo que llega al tope del recorrido tiene que dejar de empujar.
 *
 * **Cogido con la mano no persigue nada**: va donde va la mano, y el tope de velocidad
 * dejaría de ser un peso para pasar a ser un retardo entre la mano y lo que se ve en
 * ella. La velocidad sigue saliendo del movimiento real, así que un golpe fuerte pega
 * fuerte sin que haya que fingir nada.
 */
function movePlayer(mallet: Body, target: Vec2, dt: number, inHand: boolean): Body {
  const from = mallet.position
  const delta = { x: target.x - from.x, z: target.z - from.z }
  const distance = Math.hypot(delta.x, delta.z)
  const budget = PLAYER_MALLET_SPEED * dt

  const step =
    inHand || distance <= budget || distance === 0
      ? delta
      : { x: (delta.x / distance) * budget, z: (delta.z / distance) * budget }

  const position = constrainMallet(
    { x: from.x + step.x, z: from.z + step.z },
    'player',
  )

  return {
    position,
    velocity: {
      x: (position.x - from.x) / dt,
      z: (position.z - from.z) / dt,
    },
  }
}
