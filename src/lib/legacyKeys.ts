import { gameStorage } from './storage'

/**
 * Lo que este juego guardó cuando se llamaba de otra forma, traído a las claves de ahora.
 *
 * El juego pasó de `air-hockey` a `glide-hockey` en el cambio de nombres
 * (`xrcade/docs/nombres-y-marcas.md`): «AIR-HOCKEY» sigue registrada a nombre de Brunswick, y
 * aunque hoy el término se comporte como descriptivo, una cabina rotulada es justo donde deja
 * de serlo. **Todas sus claves llevaban el nombre por delante**: el récord de cada modo, los
 * niveles abiertos, las estrellas y el tutorial visto. Cambiar el nombre sin más le borraría
 * el récord a quien ya jugó — y una marca que se pierde porque los de dentro decidimos otro
 * nombre es justo lo que no se puede romper.
 *
 * **Se traslada el prefijo, no una lista de claves.** Una lista habría que mantenerla al día
 * y olvidarse de una es perder esa marca en silencio; el prefijo cubre también las que no
 * estaban escritas en ninguna parte cuando se hizo el cambio.
 */

/** Cómo empezaban las claves de este juego antes del cambio de nombre. */
export const LEGACY_PREFIX = 'air-hockey:'

/** Y cómo empiezan ahora. */
export const KEY_PREFIX = 'glide-hockey:'

/**
 * Traslada al prefijo nuevo todo lo guardado con el viejo, y borra lo viejo.
 *
 * Tres decisiones que importan:
 *
 * - **No pisa lo que ya hay.** Si la clave nueva existe es que ya se jugó con el nombre
 *   nuevo, y esa marca es la buena: la vieja se borra sin más. Sin esto, volver a abrir una
 *   pestaña antigua devolvería un récord peor.
 * - **Lee las claves antes de tocar nada.** Recorrer el almacenamiento mientras se le borran
 *   entradas se salta la mitad, porque los índices se mueven bajo los pies.
 * - **Con el almacenamiento capado no pasa nada.** En una ventana privada leerlo lanza; ahí
 *   no hay récord que trasladar y el juego sigue igual.
 */
export function migrateLegacyKeys(storage: Storage | null = gameStorage()): void {
  if (storage === null) return
  try {
    const viejas: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const clave = storage.key(i)
      if (clave !== null && clave.startsWith(LEGACY_PREFIX)) viejas.push(clave)
    }
    for (const vieja of viejas) {
      const nueva = KEY_PREFIX + vieja.slice(LEGACY_PREFIX.length)
      const valor = storage.getItem(vieja)
      if (valor !== null && storage.getItem(nueva) === null) storage.setItem(nueva, valor)
      storage.removeItem(vieja)
    }
  } catch {
    // Almacenamiento capado o cuota agotada: no hay nada que trasladar y se juega igual.
  }
}

/**
 * Lo mismo, pero una sola vez por carga de página.
 *
 * Se llama **durante el render** del estado de la partida y no desde un efecto, por el mismo
 * motivo que `setAssetsBase`: el récord y los niveles se leen con `useSyncExternalStore` en
 * el primer render, antes de que corra ningún efecto. Trasladando después, la primera pintura
 * diría «sin récord» y nadie volvería a avisar a React de que ya no es verdad.
 *
 * Repetirlo es inocuo —la segunda pasada no encuentra nada que trasladar—, así que el
 * pestillo es por ahorrar el recorrido, no por corrección.
 */
let hecho = false

export function migrateLegacyKeysOnce(): void {
  if (hecho) return
  hecho = true
  migrateLegacyKeys()
}

/** Solo para los tests: olvida que ya se hizo. */
export function resetLegacyKeysMigration(): void {
  hecho = false
}
