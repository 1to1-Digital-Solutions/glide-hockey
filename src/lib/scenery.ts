import type { Scenery } from './settings'

/**
 * Cómo se ofrece en este juego el escenario del arcade: la sala o la habitación de quien
 * juega.
 *
 * **La preferencia no es de este juego.** Se guarda en `xrcade:scenery` y la regla de cuándo
 * se pinta el decorado es `showsPlace`, las dos en `lib/ajustes.ts`, que es la copia del puente
 * con el salón; el hook y el cambio están en `lib/ajustesCliente.ts`. Aquí solo queda lo que es
 * de glide-hockey: cómo se llama cada opción en sus menús y la clave propia que hay que borrar.
 *
 * **Por qué no tiene uno propio.** El salón entra siempre en `immersive-ar` cuando el visor la
 * tiene, así que el tipo de sesión no dice qué eligió quien juega. Con un escenario por juego,
 * quien eligiera «tu habitación» en esta cabina entraría sin decorado aunque en el salón hubiera
 * elegido el sitio dibujado, y no habría forma de saber cuál de las dos manda.
 *
 * Quien decide la sala es `GameWorld`, con el escenario que le da el estado de la partida
 * (`lib/gameStore.ts`), que es también lo que leen los dos menús.
 */

/** Cómo se llama cada escenario en los menús de este juego. */
export const SCENERY_LABELS = {
  place: 'The room',
  room: 'Your room',
} as const satisfies Record<Scenery, string>

export const SCENERY_HINTS = {
  place: 'The table with the arcade room around it.',
  room: 'Headset and augmented reality only: the table stands in your own room.',
} as const satisfies Record<Scenery, string>

/**
 * La clave del escenario propio del juego, que no escribe nadie.
 *
 * Si está en el navegador, se borra al montar el estado de la partida y **no se traslada** a la
 * del arcade: la elección que manda es la del salón. Dejarla no rompería nada —no la lee nadie—,
 * pero borrarla evita que quien mire el almacenamiento crea que hay dos preferencias.
 */
export const OWN_SCENERY_KEY = 'glide-hockey:scenery'

/**
 * Olvida el escenario propio del juego.
 *
 * Aguanta un almacenamiento que no está o que lanza: no hay nada que olvidar, y el juego sigue
 * con el del arcade.
 */
export function forgetOwnScenery(storage: Pick<Storage, 'removeItem'> | null): void {
  try {
    storage?.removeItem(OWN_SCENERY_KEY)
  } catch {
    // Almacenamiento capado: tampoco se pudo guardar nada en esa clave.
  }
}
