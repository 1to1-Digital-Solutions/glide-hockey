import { cookies, headers } from 'next/headers'

import { DEFAULT_LANG, LANG_COOKIE, asLang, langFromSystem, type Lang } from './settings'

/**
 * The language this request has to be painted in.
 *
 * Whoever plays chooses it in the xrcade menu and it travels in a cookie (see
 * `settings.ts`), so it is read here for the HTML to come out already in their language.
 * Painting in English and translating on hydration would be the mismatch React forbids,
 * besides a flicker.
 *
 * With none chosen, the system's, like the hall.
 *
 * Only the game served on its own uses it: mounted inside the hall, the
 * document is xrcade's and it sets the `lang`.
 */
export async function requestLang(): Promise<Lang> {
  const cookieJar = await cookies()
  const chosen = asLang(cookieJar.get(LANG_COOKIE)?.value)
  if (chosen !== null) return chosen
  // With no cookie —whoever arrives for the first time—, the browser's (`Accept-Language`), which is the
  // same one the client reads in `navigator.languages`.
  return langFromSystem((await headers()).get('accept-language')) ?? DEFAULT_LANG
}
