/**
 * La vibración de los mandos: qué se siente en la mano con lo que pasa en la mesa.
 *
 * **Solo vibra el golpe del mazo al disco**, en la mano que lleva el mazo y con la fuerza del
 * choque. El roce del disco vibraba cada fotograma con pulsos solapados y, sin saber qué mano
 * llevaba el mazo, en las dos: con el visor puesto los mandos zumbaban la jugada entera
 * (24/09/2026). Ahora, como en todo el salón (`.claude/rules/xr.md`, «Cada contacto se siente en
 * la mano que toca, y nada más»), deslizar no vibra, rebotar en la banda tampoco —lo toca el
 * disco, no la mano— y las recetas son las comunes de `tactos.ts`.
 *
 * Sale de los mismos sucesos que el sonido (`audioEngine.ts`) pero **no** obedece al silencio:
 * silenciar apaga el altavoz, no la mano. Es lógica pura y con tests; quien pulsa de verdad los
 * mandos es `useGameHaptics`, que pone la sesión, la mano del mazo y los relojes.
 */

import { impactStrength } from './audioEngine'
import { pulsosDelListon } from './cartelDelMarcador'
import { type FrameResult } from './matchLoop'
import type { Medalla } from './objetivo'
import { pulsosDe, type Mano, type Pulso } from './tactos'

export type Handedness = Mano

/** Un toque suelto: fuerza de 0 a 1 y cuánto dura. */
export interface HapticPulse {
  intensity: number
  durationMs: number
}

/** Lo que pasa en la mesa y puede sentirse en la mano. */
export type SucesoEnLaMano =
  /** El mazo del jugador golpea el disco; `fuerza` (0–1) sale de la velocidad del choque. */
  | { readonly tipo: 'golpe'; readonly fuerza: number }
  /** Entra un gol, a favor o en contra. */
  | { readonly tipo: 'gol' }
  /** Se acaba el partido. */
  | { readonly tipo: 'final' }
  /** Se cruza un listón de medalla: lo celebra el cartel del objetivo. */
  | { readonly tipo: 'liston'; readonly medalla: Medalla }

/**
 * Lo fuerte que llega el gol, como `llegada` de `tactos.ts`: la más suave de las suyas.
 *
 * El disco entra lejos, en la otra punta de la mesa: se avisa sin que se confunda con un golpe
 * que haya dado la mano. A CALIBRAR CON EL VISOR.
 */
export const FUERZA_DEL_GOL = 0

/**
 * El final del partido: no es un contacto, es lo único que dice que se acabó sin mirar el
 * marcador. Largo y en la mano del mazo —no en las dos: eso queda para el golpe que recibe el
 * cuerpo—. A CALIBRAR CON EL VISOR.
 */
export const FINAL_PULSE: HapticPulse = { intensity: 0.6, durationMs: 220 }

/**
 * Lo que de un fotograma de la mesa llega a la mano.
 *
 * **Solo el golpe del mazo del jugador** —el de la máquina lo da ella— y el gol. El disco que
 * resbala o rebota en la banda no lo toca la mano, así que no vibra. El golpe se reconoce porque
 * sube la cuenta de golpes del jugador (`playerHits`): `struck` dice que golpeó *algún* mazo.
 *
 * @param golpesAntes Los golpes del jugador que llevaba la mesa antes de este fotograma.
 */
export function sucesosDelFotograma(
  golpesAntes: number,
  { table, goals, impact }: Pick<FrameResult, 'table' | 'goals' | 'impact'>,
): SucesoEnLaMano[] {
  const sucesos: SucesoEnLaMano[] = []
  if (table.playerHits > golpesAntes) sucesos.push({ tipo: 'golpe', fuerza: impactStrength(impact.strike) })
  if (goals.length > 0) sucesos.push({ tipo: 'gol' })
  return sucesos
}

/**
 * Los pulsos que tocan con un suceso de la mesa, en la mano que lleva el mazo.
 *
 * **Sin mano no hay pulso**: el mazo suelto no lo toca nadie, y mandarlo a las dos manos «por si
 * acaso» es lo que dejaba los dos mandos vibrando.
 */
export function pulsosDelSuceso(suceso: SucesoEnLaMano, mazo: Mano | null): Pulso[] {
  if (mazo == null) return []
  switch (suceso.tipo) {
    case 'golpe':
      // Una fuerza que no es número —un fotograma perdido— cuenta como un golpe entero: mejor
      // eso que pasarle `NaN` al vibrador.
      return pulsosDe({
        tipo: 'impacto',
        mano: mazo,
        fuerza: Number.isFinite(suceso.fuerza) ? suceso.fuerza : 1,
      })
    case 'gol':
      return pulsosDe({ tipo: 'llegada', mano: mazo, fuerza: FUERZA_DEL_GOL })
    case 'final':
      return [{ mano: mazo, intensidad: FINAL_PULSE.intensity, ms: FINAL_PULSE.durationMs, retardo: 0 }]
    case 'liston':
      return pulsosDelListon(suceso.medalla, mazo)
  }
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
 * Da un toque en el mando de esa mano. Devuelve si vibró: un mando sin vibrador, o uno que
 * rechace el pulso, no es un error, es un mando distinto.
 */
export function pulsarMano(
  session: HapticSession | null | undefined,
  mano: Mano,
  intensidad: number,
  ms: number,
): boolean {
  if (session == null) return false
  let pulsado = false
  for (const source of session.inputSources) {
    if (source.handedness !== mano) continue
    const actuator = actuatorOf(source)
    if (actuator == null) continue
    try {
      const played: unknown = actuator.pulse(intensidad, ms)
      if (typeof (played as Promise<unknown> | undefined)?.catch === 'function') {
        void (played as Promise<unknown>).catch(() => {})
      }
      pulsado = true
    } catch {
      // Un vibrador que falla no puede parar la partida.
    }
  }
  return pulsado
}

/**
 * Reproduce una lista de pulsos: los de `retardo` 0 en el acto y el resto con `programar`, que es
 * quien lleva el reloj (y quien los cancela al desmontar). Cada pulso mira la sesión en su momento.
 */
export function reproducir(
  session: HapticSession | null | undefined,
  pulsos: readonly Pulso[],
  programar: (hacer: () => void, ms: number) => void,
): void {
  for (const { mano, intensidad, ms, retardo } of pulsos) {
    const hacer = () => {
      pulsarMano(session, mano, intensidad, ms)
    }
    if (retardo > 0) programar(hacer, retardo)
    else hacer()
  }
}

/**
 * Fuerza y duración del toque que confirma un botón del visor.
 *
 * Corto y flojo: no es un golpe del juego, es el «te he oído» de un botón. Los mismos
 * números en los trece, que cambiar de cabina no cambie lo que se siente al pulsar.
 */
export const PRESS_PULSE: HapticPulse = { intensity: 0.25, durationMs: 18 }

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
