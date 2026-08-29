'use client'

import { createRoot } from 'react-dom/client'
import { AirHockey, type AirHockeyProps } from './AirHockey'

/** Lo que devuelve `mountAirHockey` para poder deshacerlo. */
export interface AirHockeyHandle {
  /** Desmonta el juego y libera lo que tenga abierto (escena, sesión). */
  unmount(): void
}

/**
 * Monta el juego en un elemento del DOM.
 *
 * Es el mismo juego que `<AirHockey>`, para quien no renderiza React por su
 * cuenta: crea la raíz, pinta dentro y devuelve con qué quitarlo. El elemento
 * tiene que tener altura; el juego la llena.
 */
export function mountAirHockey(
  container: HTMLElement,
  options: AirHockeyProps = {},
): AirHockeyHandle {
  const root = createRoot(container)
  root.render(<AirHockey {...options} />)

  return { unmount: () => root.unmount() }
}
