'use client'

import { createContext, useContext, type ReactNode } from 'react'

import { endXrSession } from '../components/xr/xrStore'

/**
 * Qué hace el botón de salir, que depende de quién haya montado el juego.
 *
 * **Montado en el salón de xrcade**, salir es volver al arco de cabinas: el hub pasa su propia
 * función (`onExit`) y desmonta la escena sin cerrar la sesión, que es lo que permite cambiar
 * de juego sin quitarse el visor.
 *
 * **En la web propia del juego** no hay adónde volver, así que salir es lo único que tiene
 * sentido ahí: cerrar la sesión inmersiva y devolver a quien juega a la página. Es el valor por
 * defecto y no un error: un botón de salir que no hiciera nada dejaría a alguien encerrado
 * dentro de la sesión con el visor puesto.
 *
 * Va en un contexto y no como propiedad de cada panel porque quien lo llama es el menú, que
 * está tres niveles por debajo de donde se monta el juego, y pasarlo de mano en mano obligaría
 * a que cada trozo de escena por el que pasa supiera de él.
 */
const Salida = createContext<(() => void) | null>(null)

export function ExitProvider({ onExit, children }: { onExit?: () => void; children: ReactNode }) {
  return <Salida.Provider value={onExit ?? null}>{children}</Salida.Provider>
}

export function useExit(): () => void {
  return useContext(Salida) ?? endXrSession
}
