import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_LANG, LANG_COOKIE } from './settings'

/**
 * The language the HTML of a request comes out in.
 *
 * It is what avoids the flicker: if the server always painted in English and the
 * browser translated on hydration, React would see two different trees and the
 * player would see the change. That is why what is checked is that the hall's
 * cookie gets all the way here, and that a tampered cookie does not leave the page in a
 * language that does not exist.
 *
 * `next/headers` is faked: it only runs inside a Next request, and what
 * is tested of this module is what it does with what it gets back from it.
 */
const get = vi.fn()
const header = vi.fn((): string | null => null)

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get }),
  headers: () => Promise.resolve({ get: (name: string) => (name === 'accept-language' ? header() : null) }),
}))

const { requestLang } = await import('./server-lang')

describe('the language of the request', () => {
  it('is the one the hall left in the cookie', async () => {
    get.mockReturnValue({ value: 'es' })

    await expect(requestLang()).resolves.toBe('es')
    expect(get).toHaveBeenCalledWith(LANG_COOKIE)
  })

  it('is the default one when there is no cookie', async () => {
    get.mockReturnValue(undefined)

    await expect(requestLang()).resolves.toBe(DEFAULT_LANG)
  })

  it('does not trust a cookie edited by hand', async () => {
    get.mockReturnValue({ value: 'klingon' })

    await expect(requestLang()).resolves.toBe(DEFAULT_LANG)
  })

  it('with none chosen, it is the browser\'s; the chosen one overrides it', async () => {
    get.mockReturnValue(undefined)
    header.mockReturnValue('es-ES,es;q=0.9,en;q=0.8')

    await expect(requestLang()).resolves.toBe('es')

    get.mockReturnValue({ value: 'en' })
    await expect(requestLang()).resolves.toBe('en')

    get.mockReturnValue(undefined)
    header.mockReturnValue('fr-FR,de;q=0.5')
    await expect(requestLang()).resolves.toBe(DEFAULT_LANG)
    header.mockReturnValue(null)
  })
})
