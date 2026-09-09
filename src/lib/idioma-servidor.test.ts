import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_LANG, LANG_COOKIE } from './ajustes'

/**
 * El idioma con el que sale el HTML de una petición.
 *
 * Es lo que evita el parpadeo: si el servidor pintara siempre en inglés y el
 * navegador tradujera al hidratar, React vería dos árboles distintos y el
 * jugador vería el cambio. Por eso lo que se comprueba es que la cookie del
 * arcade llegue hasta aquí, y que una cookie manipulada no deje la página en un
 * idioma que no existe.
 *
 * `next/headers` va de mentira: solo corre dentro de una petición de Next, y lo
 * que se prueba de este módulo es qué hace con lo que le devuelve.
 */
const get = vi.fn()

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get }),
}))

const { idiomaDeLaPeticion } = await import('./idioma-servidor')

describe('el idioma de la petición', () => {
  it('es el que el arcade dejó en la cookie', async () => {
    get.mockReturnValue({ value: 'es' })

    await expect(idiomaDeLaPeticion()).resolves.toBe('es')
    expect(get).toHaveBeenCalledWith(LANG_COOKIE)
  })

  it('es el de partida cuando no hay cookie', async () => {
    get.mockReturnValue(undefined)

    await expect(idiomaDeLaPeticion()).resolves.toBe(DEFAULT_LANG)
  })

  it('no se fía de una cookie editada a mano', async () => {
    get.mockReturnValue({ value: 'klingon' })

    await expect(idiomaDeLaPeticion()).resolves.toBe(DEFAULT_LANG)
  })
})
