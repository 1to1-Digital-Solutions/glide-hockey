'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { CONFORT_DE_PARTIDA, parseConfort, type Confort } from './golpeRecibido'
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
export const CONFORT_KEY = 'glide-hockey:confort'

const preferencia = createStoredPreference<Confort>({
  key: CONFORT_KEY,
  // Lo guardado es entrada externa: solo cuenta un valor que exista.
  parse: parseConfort,
  serialize: (valor) => valor,
})

export const getConfort = preferencia.get
export const saveConfort = preferencia.save

/** El confort elegido y cómo cambiarlo, visto desde React. */
export function useConfort(): [Confort, (valor: Confort) => void] {
  const confort = useSyncExternalStore(preferencia.subscribe, preferencia.get, preferencia.getServer)
  const cambiar = useCallback((valor: Confort) => preferencia.save(valor), [])
  return [confort, cambiar]
}

/** Con qué se entra, para quien lo pinte antes de leer nada. */
export const CONFORT_INICIAL: Confort = CONFORT_DE_PARTIDA

/**
 * Cómo se llama la fila y cada opción, en los dos menús. «Full» y no «Normal» en
 * inglés: la clave del diccionario es el propio texto inglés, y una que se
 * tradujera a sí misma no la distinguiría el guardián de lo que falta traducir.
 * Lo mismo que en gloop-pop, para que las dos cabinas digan lo mismo.
 */
export const CONFORT_LEGEND: TextKey = 'When hit'
export const CONFORT_LABELS: Record<Confort, TextKey> = { off: 'Off', gentle: 'Gentle', normal: 'Full' }
