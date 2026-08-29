import {
  GOAL_WIDTH,
  MALLET_RADIUS,
  MALLET_RESTITUTION,
  MAX_PUCK_SPEED,
  PUCK_FRICTION,
  PUCK_RADIUS,
  SERVE_SPEED,
  TABLE_LENGTH,
  TABLE_WIDTH,
  WALL_RESTITUTION,
} from './gameConfig'

/**
 * La física del disco: rebotes, golpes y goles.
 *
 * Es un plano, no un mundo en 3D. El disco no despega de la mesa, así que la
 * simulación son dos coordenadas —`x` a lo ancho, `z` a lo largo— y la escena
 * solo las sube a la altura de la superficie. Eso es lo que permite que todo
 * esto sean funciones puras que se pueden probar sin abrir el navegador, y lo
 * que evita meter un motor de física: los que usa el ecosistema de R3F van en
 * WebAssembly y la política de seguridad del salón de xrcade los bloquea (ver
 * `docs/xrcade.md`).
 *
 * El origen es el centro de la mesa. El jugador defiende el fondo de `z`
 * positivo, que es el que tiene delante; la máquina, el de `z` negativo.
 */

export interface Vec2 {
  x: number
  z: number
}

/** Un objeto redondo que se mueve por la mesa. */
export interface Body {
  position: Vec2
  velocity: Vec2
}

/** Quién ha metido el gol. */
export type Scorer = 'player' | 'opponent'

/** De quién es cada mitad de la mesa. */
export type Side = 'player' | 'opponent'

export const HALF_WIDTH = TABLE_WIDTH / 2
export const HALF_LENGTH = TABLE_LENGTH / 2

/**
 * Cuánto puede avanzar el disco dentro de un paso de simulación.
 *
 * A tope de velocidad recorre 10 cm por fotograma, más que el radio del disco:
 * en un solo paso se plantaría al otro lado de un mazo sin haberlo tocado. Con
 * los pasos cortos el golpe se detecta siempre, y de paso el rebote en la banda
 * cae donde toca en vez de un fotograma después.
 */
const MAX_STEP_DISTANCE = 0.02

/** Sub-pasos por fotograma. El tope corta un `dt` disparatado —una pestaña que
 * vuelve de segundo plano— en vez de colgar el bucle. */
const MAX_SUBSTEPS = 24

function magnitude(v: Vec2): number {
  return Math.hypot(v.x, v.z)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Recorta la velocidad al tope del juego conservando la dirección. */
function capSpeed(velocity: Vec2): Vec2 {
  const speed = magnitude(velocity)
  if (speed <= MAX_PUCK_SPEED || speed === 0) return velocity
  const scale = MAX_PUCK_SPEED / speed
  return { x: velocity.x * scale, z: velocity.z * scale }
}

/**
 * Si el disco cabe entero por el hueco de la portería.
 *
 * Se exige que quepa entero y no que lo roce: por el borde justo, el disco
 * pasaría por donde la escena dibuja el poste, y un gol que se ve entrar por
 * dentro del hierro no se acepta como gol.
 */
export function fitsThroughGoal(x: number): boolean {
  return Math.abs(x) <= GOAL_WIDTH / 2 - PUCK_RADIUS
}

/** Mantiene un mazo dentro de la mesa y de su propia mitad. */
export function constrainMallet(position: Vec2, side: Side): Vec2 {
  const sideLimit = HALF_WIDTH - MALLET_RADIUS
  // El mazo no cruza la línea de medio campo: es la regla del juego de mesa y,
  // sin ella, la máquina defendería dentro de la portería contraria. Se mide
  // por el borde del mazo, así que su centro se queda a un radio del centro.
  const centerLimit = MALLET_RADIUS
  const backLimit = HALF_LENGTH - MALLET_RADIUS

  return {
    x: clamp(position.x, -sideLimit, sideLimit),
    z:
      side === 'player'
        ? clamp(position.z, centerLimit, backLimit)
        : clamp(position.z, -backLimit, -centerLimit),
  }
}

/**
 * Resuelve el golpe de un mazo contra el disco.
 *
 * El mazo tiene masa infinita —lo lleva una mano, no la física—, así que el
 * choque se resuelve en su sistema de referencia: solo cambia la velocidad del
 * disco, y lo hace reflejando la componente que los acerca. Sumar la velocidad
 * del mazo es lo que convierte un golpe seco en un disparo y un acompañamiento
 * en un pase.
 *
 * Devuelve `null` si no se tocan.
 */
export function resolveMalletHit(puck: Body, mallet: Body): Body | null {
  const contact = PUCK_RADIUS + MALLET_RADIUS
  const offset = {
    x: puck.position.x - mallet.position.x,
    z: puck.position.z - mallet.position.z,
  }
  const distance = magnitude(offset)
  if (distance >= contact) return null

  // Centros exactamente superpuestos: no hay dirección de choque que deducir,
  // así que se le da una hacia la portería contraria al mazo y se sigue. Pasa
  // al empezar la partida si alguien deja el mazo sobre el punto de saque.
  const normal =
    distance > 0
      ? { x: offset.x / distance, z: offset.z / distance }
      : { x: 0, z: mallet.position.z <= 0 ? 1 : -1 }

  const position = {
    x: mallet.position.x + normal.x * contact,
    z: mallet.position.z + normal.z * contact,
  }

  const relative = {
    x: puck.velocity.x - mallet.velocity.x,
    z: puck.velocity.z - mallet.velocity.z,
  }
  const approach = relative.x * normal.x + relative.z * normal.z
  // Ya se estaban separando: el contacto es el resto de un golpe anterior y
  // volver a reflejar aquí lo dejaría vibrando pegado al mazo.
  if (approach >= 0) return { position, velocity: puck.velocity }

  const impulse = (1 + MALLET_RESTITUTION) * approach
  return {
    position,
    velocity: capSpeed({
      x: puck.velocity.x - impulse * normal.x,
      z: puck.velocity.z - impulse * normal.z,
    }),
  }
}

export interface StepInput {
  puck: Body
  /** Los mazos que pueden golpearlo, con la velocidad que llevan. */
  mallets: readonly Body[]
  /** Segundos transcurridos desde el paso anterior. */
  dt: number
}

export interface StepResult {
  puck: Body
  /** Quién ha marcado en este paso, o `null` si la jugada sigue. */
  goal: Scorer | null
  /** El disco ha rebotado en una banda. */
  bounced: boolean
  /**
   * Qué mazos lo han golpeado, por su posición en `mallets`.
   *
   * Se dice cuál y no solo que hubo golpe porque los dos mazos golpean el mismo
   * disco y quien llama necesita saber de quién fue: es lo que separa un
   * contraataque del jugador de un despeje de la máquina.
   */
  struckBy: readonly number[]
}

/**
 * Avanza la simulación `dt` segundos.
 *
 * En cuanto hay gol se para: el disco se queda donde entró y quien llama decide
 * qué hacer con la jugada (celebrarla y sacar de centro, ver `serve`).
 */
export function stepPuck({ puck, mallets, dt }: StepInput): StepResult {
  if (!Number.isFinite(dt) || dt <= 0) {
    return { puck, goal: null, bounced: false, struckBy: [] }
  }

  const speed = magnitude(puck.velocity)
  const steps = clamp(
    Math.ceil((speed * dt) / MAX_STEP_DISTANCE),
    1,
    MAX_SUBSTEPS,
  )
  const subDt = dt / steps

  let current = puck
  let bounced = false
  const struckBy: number[] = []

  for (let i = 0; i < steps; i++) {
    const moved = advance(current, subDt)
    current = moved.puck
    bounced = bounced || moved.bounced
    if (moved.goal != null) {
      return { puck: current, goal: moved.goal, bounced, struckBy }
    }

    for (let index = 0; index < mallets.length; index++) {
      const hit = resolveMalletHit(current, mallets[index])
      if (hit == null) continue
      // Un contacto que no cambia la velocidad es el rastro del golpe anterior:
      // el disco ya se estaba separando y aquí solo se le recoloca. Anotarlo
      // como golpe contaría un mismo empujón tantas veces como fotogramas
      // tarden en despegarse.
      const pushed =
        hit.velocity.x !== current.velocity.x ||
        hit.velocity.z !== current.velocity.z
      if (pushed && !struckBy.includes(index)) struckBy.push(index)
      current = hit
    }
  }

  return { puck: current, goal: null, bounced, struckBy }
}

/** Un sub-paso: rozamiento, avance y choque contra las bandas. */
function advance(
  puck: Body,
  dt: number,
): { puck: Body; goal: Scorer | null; bounced: boolean } {
  // Decaimiento exponencial y no una resta: así frenar no depende de cada
  // cuánto se llame, que es lo que pasaría con una pérdida fija por paso.
  const drag = Math.exp(-PUCK_FRICTION * dt)
  let velocity = { x: puck.velocity.x * drag, z: puck.velocity.z * drag }
  let x = puck.position.x + velocity.x * dt
  let z = puck.position.z + velocity.z * dt
  let bounced = false

  const sideLimit = HALF_WIDTH - PUCK_RADIUS
  if (x < -sideLimit || x > sideLimit) {
    x = clamp(x, -sideLimit, sideLimit)
    velocity = { x: -velocity.x * WALL_RESTITUTION, z: velocity.z }
    bounced = true
  }

  const endLimit = HALF_LENGTH - PUCK_RADIUS
  if (z < -endLimit || z > endLimit) {
    if (fitsThroughGoal(x)) {
      // Fondo de la máquina (z negativo) es gol del jugador, y al revés.
      return {
        puck: { position: { x, z }, velocity },
        goal: z < 0 ? 'player' : 'opponent',
        bounced,
      }
    }
    z = clamp(z, -endLimit, endLimit)
    velocity = { x: velocity.x, z: -velocity.z * WALL_RESTITUTION }
    bounced = true
  }

  return { puck: { position: { x, z }, velocity }, goal: null, bounced }
}

/**
 * Velocidad por debajo de la cual el disco se da por muerto, en m/s.
 *
 * No es cero: un disco que se arrastra a diez centímetros por segundo en una
 * esquina donde nadie llega es, a efectos de la partida, un disco parado.
 */
export const STALL_SPEED = 0.35

/** Segundos que puede quedarse así antes de volver a sacar de centro. */
export const STALL_SECONDS = 4

/**
 * Cuánto lleva el disco parado tras `dt` segundos.
 *
 * Se acumula mientras vaya lento y se pone a cero en cuanto alguien lo mueve.
 * Hace falta porque los dos mazos tienen prohibido cruzar la línea de medio
 * campo: un disco que se queda quieto en la mitad de la máquina, más allá de
 * donde ella sale a buscarlo, no lo puede tocar nadie y la partida se congela
 * sin que nada falle. Las mesas de verdad tienen la misma regla.
 */
export function stallSeconds(previous: number, puck: Body, dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return previous
  const speed = magnitude(puck.velocity)
  return speed < STALL_SPEED ? previous + dt : 0
}

/** Si toca sacar de nuevo porque el disco lleva demasiado tiempo muerto. */
export function isStalled(seconds: number): boolean {
  return seconds >= STALL_SECONDS
}

/**
 * El disco puesto en el centro para sacar.
 *
 * Sale hacia quien acaba de encajar el gol —hacia el jugador si marcó la
 * máquina—, que es como se saca en la mesa: el que va perdiendo el punto tiene
 * la primera opción. Al empezar la partida no ha marcado nadie y el disco sale
 * hacia la máquina, para que el primer movimiento sea del jugador.
 */
export function serve(lastScorer: Scorer | null): Body {
  const towardsPlayer = lastScorer === 'opponent'
  return {
    position: { x: 0, z: 0 },
    velocity: { x: 0, z: towardsPlayer ? SERVE_SPEED : -SERVE_SPEED },
  }
}
