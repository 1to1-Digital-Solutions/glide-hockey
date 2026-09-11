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

const ocupadas = new Set<Mano>()
const oyentes = new Set<() => void>()

/** Apunta si esa mano lleva algo. Se puede llamar cada fotograma: solo avisa si cambia. */
export function marcarManoOcupada(mano: Mano, ocupada: boolean): void {
  if (ocupada === ocupadas.has(mano)) return
  if (ocupada) ocupadas.add(mano)
  else ocupadas.delete(mano)
  for (const oyente of oyentes) oyente()
}

/** Suelta todas: al acabar la partida o al desmontar la escena nadie lleva nada. */
export function soltarLasManos(): void {
  if (ocupadas.size === 0) return
  ocupadas.clear()
  for (const oyente of oyentes) oyente()
}

/** Se avisa aquí de los cambios. Exportado para poder probar que no avisa de más. */
export function suscribirseAManos(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

/** Si esa mano lleva algo, para quien lo tenga que pintar. Fuera del visor, nunca. */
export function useManoOcupada(mano: Mano | undefined): boolean {
  const leer = useCallback(() => (mano == null ? false : ocupadas.has(mano)), [mano])
  return useSyncExternalStore(suscribirseAManos, leer, () => false)
}
