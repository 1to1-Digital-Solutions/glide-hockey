import { createStoredPreference } from './storage'

/**
 * Si el juego suena o está callado.
 *
 * Es lo segundo que se guarda entre visitas, después del récord, y por un
 * motivo distinto: el récord es un resultado y esto es **de quien juega**. Quien
 * se pone el visor en un sitio donde no puede hacer ruido no quiere volver a
 * silenciarlo cada vez, y quien juega sin auriculares tampoco. El nivel y los
 * goles, en cambio, arrancan siempre en su valor de entrada: son de la partida.
 *
 * Se guarda `'1'` o `'0'` y no `'true'`/`'false'` para que cualquier cosa rara
 * en el almacenamiento —lo edita quien quiera desde las herramientas del
 * navegador— caiga en «suena», que es como se entra: un juego mudo sin haberlo
 * pedido se lee como que está roto.
 *
 * La fontanería —guardar, leer y avisar a los dos menús— es la de
 * `createStoredPreference` (`storage.ts`), la misma que usa el récord.
 */

/** Cómo se entra: sonando. */
export const DEFAULT_MUTED = false

/** Clave en el almacenamiento, con prefijo para no chocar con nada más. */
export const MUTED_KEY = 'air-hockey:muted'

/** Lo que se escribe para cada estado. */
const MUTED_VALUE = '1'
const UNMUTED_VALUE = '0'

/**
 * Interpreta lo leído del almacenamiento. Solo un valor significa silencio;
 * cualquier otra cosa —incluido no haber elegido nunca— es que el juego suena.
 */
export function parseMuted(raw: string | null): boolean {
  return raw === MUTED_VALUE
}

export const {
  get: getMuted,
  getServer: getServerMuted,
  subscribe: subscribeMuted,
  save: saveMuted,
} = createStoredPreference<boolean>({
  key: MUTED_KEY,
  parse: parseMuted,
  serialize: (muted) => (muted ? MUTED_VALUE : UNMUTED_VALUE),
})
