'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Qué mano lleva algo cogido ahora mismo.
 *
 * **Para apagarle el rayo.** El mando dibuja un rayo largo con su cursor, que es lo que
 * sirve para pulsar los menús; con el objeto ya en la mano ese rayo sigue encendido y
 * apuntando a la pared, como si se estuviera señalando algo. Reportado con el visor puesto:
 * «una vez que el usuario agarre el objeto, yo creo que se debería dejar de ver el rayo».
 *
 * Se lleva fuera de React —un `Set` y unos oyentes— porque quien lo escribe es el bucle de
 * fotogramas del juego, que corre a 90 Hz y no puede pasar por `setState`, y quien lo lee es
 * el componente del mando, que sí es React. El almacén externo de `useSyncExternalStore` es
 * exactamente esa forma.
 *
 * **Solo se apaga el dibujo, no el puntero.** El rayo sigue existiendo: soltar el objeto y
 * volver a pulsar un botón del menú tiene que funcionar sin más ceremonia.
 */

type Mano = 'left' | 'right'

interface Registro {
  ocupadas: Set<Mano>
  oyentes: Set<() => void>
}

declare global {
  interface Window {
    /**
     * Quién lleva algo en la mano, **compartido entre el juego y quien lo monte**.
     *
     * Va en `window` y no en el módulo porque son dos módulos. Este fichero está copiado en
     * los **diez juegos que dejan coger algo** y en el hub, y montado dentro del salón el que
     * dibuja el mando es el del salón: el juego marcaba la mano en su copia y el salón leía
     * la suya, que estaba siempre vacía. Desde dentro del visor eso se ve como que **el rayo
     * no se apaga jugando desde el arcade** aunque sí lo haga en la web del juego, que es
     * donde se probó.
     *
     * **Diez y no trece**, y el docstring decía trece: los otros tres no tienen nada que
     * marcar. En ping-pong y en skeet la pala y la escopeta están *siempre* en la mano, así
     * que apagar el rayo ahí lo apagaría toda la partida y no quedaría con qué pulsar el
     * menú; en stick-rush los palos se atrapan de un toque, no se llevan.
     *
     * En la web propia de cada juego, además, el rayo lo dibuja el mando por defecto de la
     * librería, que no lee esto: solo air-hockey y whack-a-mole traen su propio
     * `XRControllerGrip`. Dentro del arcade —que es donde se juega— lo dibuja el del salón,
     * que sí lo lee. Lo compara `scripts/repos/comunes.py`.
     *
     * Un `window` compartido es feo y es el canal que hay: son dos paquetes que se empaquetan
     * juntos pero no comparten módulo. Lo crea el primero que llegue.
     */
    __xrManosOcupadas?: Registro
  }
}

/** El registro de siempre, o uno nuevo. Sin `window` —en el servidor— uno propio. */
const propio: Registro = { ocupadas: new Set(), oyentes: new Set() }

function registro(): Registro {
  if (typeof window === 'undefined') return propio
  window.__xrManosOcupadas ??= propio
  return window.__xrManosOcupadas
}

/** Apunta si esa mano lleva algo. Se puede llamar cada fotograma: solo avisa si cambia. */
export function marcarManoOcupada(mano: Mano, ocupada: boolean): void {
  const { ocupadas, oyentes } = registro()
  if (ocupada === ocupadas.has(mano)) return
  if (ocupada) ocupadas.add(mano)
  else ocupadas.delete(mano)
  for (const oyente of oyentes) oyente()
}

/** Suelta todas: al acabar la partida o al desmontar la escena nadie lleva nada. */
export function soltarLasManos(): void {
  const { ocupadas, oyentes } = registro()
  if (ocupadas.size === 0) return
  ocupadas.clear()
  for (const oyente of oyentes) oyente()
}

/** Se avisa aquí de los cambios. Exportado para poder probar que no avisa de más. */
export function suscribirseAManos(oyente: () => void): () => void {
  const { oyentes } = registro()
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

/** Si esa mano lleva algo, para quien lo tenga que pintar. Fuera del visor, nunca. */
export function useManoOcupada(mano: Mano | undefined): boolean {
  const leer = useCallback(() => (mano == null ? false : registro().ocupadas.has(mano)), [mano])
  return useSyncExternalStore(suscribirseAManos, leer, () => false)
}
