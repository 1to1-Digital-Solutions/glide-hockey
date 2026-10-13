/**
 * De lo que pasa en la mesa a lo que se oye y se siente, en Godot.
 *
 * **Las reglas son las de la web**, pero dos de sus ficheros no entran en el motor: `haptics.ts`
 * importa `impactStrength` de `audioEngine.ts`, y ese abre un `AudioContext` del navegador, así que
 * el grafo entero queda fuera (`build.mjs --list-tests`). Lo poco que se usa de ellos se copia
 * aquí con su nombre en la web al lado; si `impactStrength` y los sucesos de la mano pasaran a un
 * fichero sin navegador, esto se borraría y la escena importaría el de la web.
 *
 * - **Qué se oye**: el golpe del mazo (dé quien lo dé) y el rebote en la banda, cada uno con la
 *   fuerza del choque, y el gol. Los efectos están renderizados de `audioEngine.ts` a tres
 *   fuerzas (`godot-kit.json`): se elige la más cercana a la del choque, como el volumen y el tono
 *   que la web calcula a cada golpe.
 * - **El roce del disco** (`roceDelDisco`): un bucle renderizado de la voz continua de la web a la
 *   velocidad máxima, al que se le baja el volumen y el tono con la velocidad de ahora, con las
 *   mismas cuentas que la web (`slideSound.ts`).
 * - **Qué se siente** (`sucesosDelFotograma` y `pulsosDelSuceso`): solo el golpe del mazo **del
 *   jugador** al disco, en la mano que lo lleva y con la fuerza del choque; el gol, suave; y el
 *   final del partido, largo. El roce y el rebote no los toca la mano, así que no vibran.
 */
import { thresholdPulses } from '@/lib/scoreboardSign'
import { MAX_PUCK_SPEED } from '@/lib/gameConfig'
import type { FrameResult } from '@/lib/matchLoop'
import type { Medal } from '@/lib/goal'
import { slideLevel, slidePitch } from '@/lib/slideSound'
import { pulsesFor, type HandSide, type HandPulse } from '@/lib/hapticFeedback'

/** A qué velocidad se renderizó el bucle del roce (`loops.slide` de `godot-kit.json`): la máxima. */
export const VELOCIDAD_DEL_BUCLE = MAX_PUCK_SPEED

/**
 * Cómo suena el roce a esta velocidad (m/s), respecto al bucle renderizado: el volumen, en la
 * proporción del de la web (`slideLevel`), y el tono, en la de su filtro (`slidePitch`). El bucle
 * es ruido pasado por ese filtro paso banda; reproducido más despacio, la banda baja en la misma
 * proporción y con la misma forma, que es lo que hace la web al mover el filtro. Por eso se
 * renderiza a la velocidad máxima: de ahí todo es bajar, y el volumen nunca pasa del que se afinó.
 */
export function roceDelDisco(speed: number): { volume: number; pitch: number } {
  return {
    volume: slideLevel(speed) / slideLevel(VELOCIDAD_DEL_BUCLE),
    pitch: slidePitch(speed) / slidePitch(VELOCIDAD_DEL_BUCLE),
  }
}

/** Cuánto de fuerte es un impacto, de 0 a 1, por su velocidad en m/s (`impactStrength`). */
export function impactStrength(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 0
  return Math.min(1, speed / MAX_PUCK_SPEED)
}

/** Las tres fuerzas a las que se renderizaron el golpe y el rebote (`godot-kit.json`). */
export const FUERZAS = { suave: 0.2, medio: 0.5, fuerte: 0.9 } as const

/** El efecto renderizado más cercano a una fuerza de 0 a 1. */
export function efectoDelChoque(sonido: 'strike' | 'bounce', fuerza: number): string {
  let mejor: keyof typeof FUERZAS = 'suave'
  for (const nombre of Object.keys(FUERZAS) as (keyof typeof FUERZAS)[]) {
    if (Math.abs(FUERZAS[nombre] - fuerza) < Math.abs(FUERZAS[mejor] - fuerza)) mejor = nombre
  }
  return `${sonido}-${mejor}`
}

/** Lo fuerte que llega el gol en la mano: la más suave de las llegadas (`FUERZA_DEL_GOL`). */
export const FUERZA_DEL_GOL = 0

/** El final del partido en la mano del mazo (`FINAL_PULSE`). */
export const PULSO_DEL_FINAL = { intensidad: 0.6, ms: 220 } as const

/** Lo que se siente de un suceso de la mesa (`SucesoEnLaMano`). */
export type SucesoEnLaMano =
  | { readonly tipo: 'hit'; readonly fuerza: number }
  | { readonly tipo: 'goal' }
  | { readonly tipo: 'end' }
  /** Se cruza un listón de medalla: lo celebra el cartel del objetivo. */
  | { readonly tipo: 'threshold'; readonly medalla: Medal }

/** Lo que de un fotograma de la mesa llega a la mano (`sucesosDelFotograma`). */
export function sucesosDelFotograma(golpesAntes: number, { table, goals, impact }: Pick<FrameResult, 'table' | 'goals' | 'impact'>): SucesoEnLaMano[] {
  const sucesos: SucesoEnLaMano[] = []
  if (table.playerHits > golpesAntes) sucesos.push({ tipo: 'hit', fuerza: impactStrength(impact.strike) })
  if (goals.length > 0) sucesos.push({ tipo: 'goal' })
  return sucesos
}

/** Los pulsos de un suceso en la mano que lleva el mazo; sin mano, ninguno (`pulsosDelSuceso`). */
export function pulsosDelSuceso(suceso: SucesoEnLaMano, mazo: HandSide | null): HandPulse[] {
  if (mazo == null) return []
  switch (suceso.tipo) {
    case 'hit':
      return pulsesFor({ type: 'impact', hand: mazo, strength: Number.isFinite(suceso.fuerza) ? suceso.fuerza : 1 })
    case 'goal':
      return pulsesFor({ type: 'arrival', hand: mazo, strength: FUERZA_DEL_GOL })
    case 'end':
      return [{ hand: mazo, intensity: PULSO_DEL_FINAL.intensidad, ms: PULSO_DEL_FINAL.ms, delay: 0 }]
    case 'threshold':
      return thresholdPulses(suceso.medalla, mazo)
  }
}
