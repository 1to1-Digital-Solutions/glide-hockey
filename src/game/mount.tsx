'use client'

import { createRoot } from 'react-dom/client'
import { GlideHockey, type GlideHockeyProps } from './GlideHockey'

/** Lo que devuelve `mountGlideHockey` para poder deshacerlo. */
export interface GlideHockeyHandle {
  /** Desmonta el juego y libera lo que tenga abierto (escena, sesión). */
  unmount(): void
}

/**
 * Monta el juego en un elemento del DOM.
 *
 * Es el mismo juego que `<GlideHockey>`, para quien no renderiza React por su
 * cuenta: crea la raíz, pinta dentro y devuelve con qué quitarlo. El elemento
 * tiene que tener altura; el juego la llena.
 */
export function mountGlideHockey(
  container: HTMLElement,
  options: GlideHockeyProps = {},
): GlideHockeyHandle {
  const root = createRoot(container)
  root.render(<GlideHockey {...options} />)

  return { unmount: () => root.unmount() }
}
