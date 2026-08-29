'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { endXrSession } from '../components/xr/xrStore'

/**
 * Qué significa «salir» en este juego, que lo decide quien lo monta.
 *
 * En su propia web, salir es cerrar la sesión inmersiva: no hay ningún sitio al
 * que volver. Montado dentro del salón de xrcade significa lo contrario —el
 * salón es el dueño de la sesión y hay que dejársela abierta—, así que salir es
 * devolverle al jugador. El juego no puede decidir eso: solo sabe que el
 * jugador quiere irse, no a dónde.
 *
 * Por eso la salida es una prop del montaje y no una llamada a la sesión: con
 * un `session.end()` escrito dentro del menú, montar el juego en un salón
 * inmersivo significaría que salir del juego arranca a todo el mundo del visor.
 */
const ExitContext = createContext<() => void>(endXrSession)

export function ExitProvider({
  onExit,
  children,
}: {
  onExit: () => void
  children: ReactNode
}) {
  return <ExitContext.Provider value={onExit}>{children}</ExitContext.Provider>
}

/**
 * Devolver al jugador a donde estaba antes de entrar.
 *
 * Sin nadie que lo diga, cierra la sesión: es lo que significa salir cuando el
 * juego es lo único que hay en la página.
 */
export function useExit(): () => void {
  return useContext(ExitContext)
}
