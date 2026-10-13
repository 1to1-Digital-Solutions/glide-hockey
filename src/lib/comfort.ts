'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { DEFAULT_COMFORT, parseComfort, type Comfort } from './hitFeedback'
import { createStoredPreference } from './storage'
import type { TextKey } from './textos'

/**
 * Cuánto se nota el golpe recibido en esta cabina: apagado, suave o entero
 * (`lib/golpeRecibido.ts`).
 *
 * **Es del juego y no del salón.** El arcade no guarda nada parecido, y un gol
 * en contra no pide lo mismo que una babosa en la cara: cada cabina lo recuerda
 * con su prefijo. Lo leen los dos menús, que lo cambian, y la escena, que lo
 * aplica; por eso vive en el navegador y se mira suscrito, como el récord: el
 * menú de la web y el del visor enseñan siempre lo mismo.
 *
 * El movimiento reducido del sistema no pasa por aquí: lo mira el propio
 * `GolpeRecibido`, y manda por encima de lo que se elija.
 */
export const COMFORT_KEY = 'glide-hockey:confort'

const preferencia = createStoredPreference<Comfort>({
  key: COMFORT_KEY,
  // Lo guardado es entrada externa: solo cuenta un valor que exista.
  parse: parseComfort,
  serialize: (valor) => valor,
})

export const getComfort = preferencia.get
export const saveComfort = preferencia.save

/** El confort elegido y cómo cambiarlo, visto desde React. */
export function useComfort(): [Comfort, (valor: Comfort) => void] {
  const confort = useSyncExternalStore(preferencia.subscribe, preferencia.get, preferencia.getServer)
  const cambiar = useCallback((valor: Comfort) => preferencia.save(valor), [])
  return [confort, cambiar]
}

/** Con qué se entra, para quien lo pinte antes de leer nada. */
export const INITIAL_COMFORT: Comfort = DEFAULT_COMFORT

/**
 * Cómo se llama la fila y cada opción, en los dos menús. «Full» y no «Normal» en
 * inglés: la clave del diccionario es el propio texto inglés, y una que se
 * tradujera a sí misma no la distinguiría el guardián de lo que falta traducir.
 * Lo mismo que en gloop-pop, para que las dos cabinas digan lo mismo.
 */
export const COMFORT_LEGEND: TextKey = 'When hit'
export const COMFORT_LABELS: Record<Comfort, TextKey> = { off: 'Off', gentle: 'Gentle', normal: 'Full' }
