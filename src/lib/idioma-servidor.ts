import { cookies } from 'next/headers'

import { LANG_COOKIE, parseLang, type Lang } from './ajustes'

/**
 * El idioma con el que hay que pintar esta petición.
 *
 * Lo elige quien juega en el menú de xrcade y viaja en una cookie (ver
 * `ajustes.ts`), así que aquí se lee para que el HTML salga ya en su idioma.
 * Pintar en inglés y traducir al hidratar sería el desajuste que React prohíbe,
 * además de un parpadeo.
 *
 * Solo lo usa el juego servido por su cuenta: montado dentro del arcade, el
 * documento es el de xrcade y el `lang` lo pone él.
 */
export async function idiomaDeLaPeticion(): Promise<Lang> {
  const galletas = await cookies()
  return parseLang(galletas.get(LANG_COOKIE)?.value)
}
