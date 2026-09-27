import { useMemo, useSyncExternalStore } from 'react'

import { serieGuardada, tallyDelTexto, type DuelTally } from './duelTally'

/**
 * Lo que llevan los dos que están jugando (`duelTally.ts`), y React se entera cuando cambia.
 *
 * Aparte de la serie porque es lo único de ella que necesita React: el resto lo ejecuta también
 * el port a Godot, que no lo tiene.
 */
export function useDuelTally(): DuelTally {
  const texto = useSyncExternalStore(serieGuardada.subscribe, serieGuardada.get, serieGuardada.getServer)
  return useMemo(() => tallyDelTexto(texto), [texto])
}
