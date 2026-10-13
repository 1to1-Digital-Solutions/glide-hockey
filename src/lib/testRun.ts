import type { VistaDelCartel } from './objetivo'

/**
 * La partida, manejable desde un test de navegador sin jugarla: el gancho común del salón
 * (`PartidaComun` de `e2e/support/comun.ts`).
 *
 * Meter goles de verdad en un e2e es llevar el mazo con el emulador y esperar a que el disco
 * entre, que depende de la máquina y de la puntería. Lo que las capturas comunes miran —el cartel
 * del objetivo antes de empezar, al cruzar el bronce y al final— no depende de cómo se marcaron
 * los puntos sino de cuántos lleva la partida, y eso se le puede dar hecho.
 *
 * **La llave lleva el nombre del juego**: los diecisiete se instalan a la vez dentro del salón y el
 * hueco de `window` es uno solo; dos juegos llamando `__partida` a lo suyo se pisarían.
 *
 * **Solo cuenta si alguien lo pide**: el test crea `window.__partidaGlideHockey` antes de cargar la
 * página y el estado de la partida (`gameStore.ts`) deja ahí lo que se le puede pedir. En una
 * partida de verdad esto no hace nada, que es lo que permite dejarlo puesto. Se lee de
 * `globalThis` y no de `window`: en la página son lo mismo, y así `src/lib` no se ata al navegador.
 */

/** Lo que un test puede hacerle a la partida. */
export interface PartidaDePrueba {
  /** Empieza una partida del reto, el modo del récord, sin tutorial; el saque, con `score`. */
  start?: () => void
  /** Saca si no se ha sacado y fija los puntos de la partida en curso. */
  score?: (puntos: number) => void
  /** La acaba como si la máquina hubiera ganado la ronda: cuenta para el salón. */
  end?: () => void
  /** Lo que dice ahora el cartel del objetivo, o `null` si no se ve. */
  cartel?: () => VistaDelCartel | null
}

declare global {
  var __partidaGlideHockey: PartidaDePrueba | undefined
}

/** Deja a mano lo que se puede hacer, si alguien lo ha pedido. */
export function exponerPartida(api: Required<PartidaDePrueba>): void {
  const partida = globalThis.__partidaGlideHockey
  if (partida == null) return
  Object.assign(partida, api)
}
