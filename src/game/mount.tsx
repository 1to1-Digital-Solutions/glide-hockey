'use client'

import { createRoot } from 'react-dom/client'
import { GlideHockey, type GlideHockeyProps } from './GlideHockey'

/** What `mountGlideHockey` returns so that it can be undone. */
export interface GlideHockeyHandle {
  /** Unmounts the game and releases whatever it has open (scene, session). */
  unmount(): void
}

/**
 * Mounts the game in a DOM element.
 *
 * It is the same game as `<GlideHockey>`, for whoever does not render React on
 * their own: it creates the root, renders inside it and returns what to remove
 * it with. The element has to have a height; the game fills it.
 */
export function mountGlideHockey(
  container: HTMLElement,
  options: GlideHockeyProps = {},
): GlideHockeyHandle {
  const root = createRoot(container)
  root.render(<GlideHockey {...options} />)

  return { unmount: () => root.unmount() }
}
