import { createStoredPreference } from './storage'

/**
 * Qué se pinta alrededor: la sala del juego o la habitación de quien juega.
 *
 * **Es una elección, no un modo de sesión.** Dentro de una sesión de realidad
 * aumentada las dos son la misma sesión pintada de dos formas, así que se puede
 * cambiar **sin salirse**: con el visor puesto, salir y volver a entrar para
 * ver la habitación es justo lo que hace que nadie lo use.
 *
 * **Se recuerda entre visitas**, como el silencio: quien juega en su cuarto tenía
 * que quitar la sala cada vez que se ponía las gafas, deshaciendo algo que ya
 * había decidido. Sigue sin salir nada del navegador.
 *
 * **Lo que esto NO decide.** Que la preferencia diga «habitación» no significa
 * que se pueda servir: en una sesión de realidad virtual no hay habitación real
 * detrás y en el navegador no hay cámara, así que quitar la sala dejaría a
 * quien juega mirando la nada. Eso lo resuelve `showsPlace`, que es el único
 * que sabe qué tipo de sesión se ha concedido.
 */

export const SCENERY_IDS = ['place', 'room'] as const
export type Scenery = (typeof SCENERY_IDS)[number]

export const SCENERY_LABELS: Record<Scenery, string> = {
  place: 'La sala',
  room: 'Tu habitación',
}

export const SCENERY_HINTS: Record<Scenery, string> = {
  place: 'La mesa con la sala de recreativos alrededor.',
  room: 'Solo con el visor y en realidad aumentada: la mesa se planta en tu cuarto.',
}

/** Con qué se entra: con la sala, que es lo que se ve en cualquier pantalla. */
export const DEFAULT_SCENERY: Scenery = 'place'

/** Clave en el almacenamiento, con prefijo para no chocar con nada más. */
export const SCENERY_KEY = 'air-hockey:scenery'

/**
 * Interpreta lo leído del almacenamiento. Es entrada externa —se edita a mano
 * desde las herramientas del navegador—, así que solo el valor exacto cuenta.
 */
export function parseScenery(raw: string | null): Scenery {
  return raw === 'room' ? 'room' : DEFAULT_SCENERY
}

/**
 * Si toca pintar la sala, con el modo de sesión y lo elegido.
 *
 * Fuera de una sesión de realidad aumentada se pinta siempre: no hay habitación
 * que enseñar, así que quitarla dejaría la mesa flotando en el vacío. Dentro
 * de una, manda lo que haya elegido quien juega.
 */
export function showsPlace(mode: string | null | undefined, scenery: Scenery): boolean {
  return mode !== 'immersive-ar' || scenery === 'place'
}

export const {
  get: getScenery,
  getServer: getServerScenery,
  subscribe: subscribeScenery,
  save: saveScenery,
} = createStoredPreference<Scenery>({
  key: SCENERY_KEY,
  parse: parseScenery,
  serialize: (scenery) => scenery,
})
