/**
 * La vibración de los mandos: qué golpe corresponde a cada cosa que pasa en la
 * mesa y a qué mano va.
 *
 * Con el visor puesto, un golpe del mazo que no se siente en la mano es un
 * clic, no un golpe; y con el juego en silencio la vibración es lo único que
 * dice sin mirar si el disco tocó banda o entró. Por eso sale de los mismos
 * sucesos que el sonido (`audioEngine.ts`) pero **no** obedece al silencio.
 *
 * Es lógica pura y con tests: quién pulsa de verdad los mandos es
 * `useGameHaptics`, que solo pone la sesión y la mano que lleva el mazo.
 */

import { type ThreeEvent } from '@react-three/fiber'
import { type GameSound } from './audioEngine'

export type Handedness = 'left' | 'right'

/** A qué manos va un golpe: solo a la que lleva el mazo, o a las dos. */
export type PulseHands = 'mallet' | 'both'

export interface HapticPulse {
  /** Intensidad, de 0 a 1. */
  intensity: number
  durationMs: number
  hands: PulseHands
}

/** El mazo que golpea el disco: corto y fuerte, en la mano que lo lleva. */
export const STRIKE_PULSE: HapticPulse = { intensity: 0.7, durationMs: 45, hands: 'mallet' }
/** El disco que rebota en la banda: un toque, para que se note sin molestar. */
export const BOUNCE_PULSE: HapticPulse = { intensity: 0.25, durationMs: 20, hands: 'mallet' }
/** El gol, a favor o en contra: largo y en las dos manos, como una celebración. */
export const GOAL_PULSE: HapticPulse = { intensity: 0.5, durationMs: 120, hands: 'both' }

const PULSES: Record<GameSound, HapticPulse> = {
  strike: STRIKE_PULSE,
  bounce: BOUNCE_PULSE,
  goal: GOAL_PULSE,
}

/** El golpe que corresponde a cada suceso de la mesa. */
export function pulseFor(sound: GameSound): HapticPulse {
  return PULSES[sound]
}

/**
 * La mano del mando que ha movido el mazo, leída del evento de puntero: dentro
 * del visor @react-three/xr cuelga el `XRInputSource` del evento nativo. Con el
 * ratón no hay mano.
 */
export function handednessOf(event: ThreeEvent<PointerEvent>): Handedness | null {
  const source = (event as { nativeEvent?: { inputSource?: { handedness?: string } } }).nativeEvent
    ?.inputSource
  const hand = source?.handedness
  return hand === 'left' || hand === 'right' ? hand : null
}

/** Lo que este módulo necesita de un `XRInputSource`: la mano y su vibrador. */
export interface HapticSource {
  handedness: XRHandedness | string
  gamepad?: { hapticActuators?: readonly { pulse?: unknown }[] } | null
}

/** Lo que necesita de una sesión de WebXR: por dónde llegan los mandos. */
export interface HapticSession {
  inputSources: Iterable<HapticSource>
}

interface HapticActuator {
  pulse(value: number, duration: number): Promise<boolean> | boolean | void
}

function actuatorOf(source: HapticSource): HapticActuator | undefined {
  const actuator = source.gamepad?.hapticActuators?.[0]
  return typeof actuator?.pulse === 'function' ? (actuator as HapticActuator) : undefined
}

/**
 * A qué manos llega un golpe. Mientras no se sepa qué mano lleva el mazo —antes
 * del primer movimiento con un mando— el golpe del mazo va a las dos: mejor
 * sentirlo de más que no sentirlo.
 */
export function handsFor(pulse: HapticPulse, mallet: Handedness | null): readonly string[] {
  if (pulse.hands === 'both' || mallet == null) return ['left', 'right']
  return [mallet]
}

/**
 * Da el golpe en los mandos que toque. Devuelve cuántos vibraron: un mando sin
 * vibrador, o uno que rechace el pulso, no es un error, es un mando distinto.
 */
export function pulseSession(
  session: HapticSession | null | undefined,
  pulse: HapticPulse,
  mallet: Handedness | null,
): number {
  if (session == null) return 0
  const hands = handsFor(pulse, mallet)
  let pulsed = 0
  for (const source of session.inputSources) {
    if (!hands.includes(source.handedness)) continue
    const actuator = actuatorOf(source)
    if (actuator == null) continue
    try {
      const played: unknown = actuator.pulse(pulse.intensity, pulse.durationMs)
      if (typeof (played as Promise<unknown> | undefined)?.catch === 'function') {
        void (played as Promise<unknown>).catch(() => {})
      }
      pulsed += 1
    } catch {
      // Un vibrador que falla no puede parar la partida.
    }
  }
  return pulsed
}

/**
 * Fuerza y duración del toque que confirma un botón del visor.
 *
 * Corto y flojo: no es un golpe del juego, es el «te he oído» de un botón. Los mismos
 * números en los trece, que cambiar de cabina no cambie lo que se siente al pulsar.
 */
export const PRESS_PULSE: HapticPulse = { intensity: 0.25, durationMs: 18, hands: 'both' }

/** De qué mando viene el evento, si es que viene de uno. */
function inputSourceOf(event: unknown): HapticSource | undefined {
  return (event as { nativeEvent?: { inputSource?: HapticSource } } | null)?.nativeEvent
    ?.inputSource
}

/**
 * Vibra **el mando que ha pulsado**, si puede.
 *
 * Aparte de `pulseSession`, que reparte por manos: un botón lo pulsa una mano concreta y
 * contestarle a la otra sería contestarle a quien no ha hecho nada. Con el ratón no hay
 * mando y no pasa nada, que es el caso de escritorio.
 */
export function pulsePressed(event: unknown, pulse: HapticPulse = PRESS_PULSE): boolean {
  const source = inputSourceOf(event)
  const actuator = source == null ? undefined : actuatorOf(source)
  if (actuator == null || pulse.intensity <= 0) return false
  try {
    const played: unknown = actuator.pulse(pulse.intensity, pulse.durationMs)
    if (typeof (played as Promise<unknown> | undefined)?.catch === 'function') {
      void (played as Promise<unknown>).catch(() => {})
    }
    return true
  } catch {
    // Un vibrador que falla no puede parar la partida.
    return false
  }
}
