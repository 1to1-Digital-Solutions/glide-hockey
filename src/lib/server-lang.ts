import { cookies, headers } from 'next/headers'

import { DEFAULT_LANG, LANG_COOKIE, asLang, langFromSystem, type Lang } from './ajustes'

/**
 * El idioma con el que hay que pintar esta petición.
 *
 * Lo elige quien juega en el menú de xrcade y viaja en una cookie (ver
 * `ajustes.ts`), así que aquí se lee para que el HTML salga ya en su idioma.
 * Pintar en inglés y traducir al hidratar sería el desajuste que React prohíbe,
 * además de un parpadeo.
 *
 * Sin elegir, el del sistema, como el salón.
 *
 * Solo lo usa el juego servido por su cuenta: montado dentro del arcade, el
 * documento es el de xrcade y el `lang` lo pone él.
 */
export async function idiomaDeLaPeticion(): Promise<Lang> {
  const galletas = await cookies()
  const elegido = asLang(galletas.get(LANG_COOKIE)?.value)
  if (elegido !== null) return elegido
  // Sin cookie —quien llega por primera vez—, el del navegador (`Accept-Language`), que es el
  // mismo que lee el cliente en `navigator.languages`.
  return langFromSystem((await headers()).get('accept-language')) ?? DEFAULT_LANG
}
