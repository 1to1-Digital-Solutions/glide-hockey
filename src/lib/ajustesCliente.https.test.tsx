/**
 * @vitest-environment-options { "url": "https://localhost/" }
 */
import { describe, expect, it } from 'vitest'

import { LANG_COOKIE } from './ajustes'
import { setLang } from './ajustesCliente'

/**
 * La cookie del idioma, servida por HTTPS.
 *
 * Va aparte porque `window.location` se fija al montar el entorno y no se puede
 * cambiar a mitad de un fichero: el caso sin cifrar vive en
 * `ajustesCliente.test.tsx`. Y hace falta probarlo por separado porque marcar
 * `Secure` siempre dejaría el idioma sin guardarse en desarrollo, donde el
 * juego se sirve por `http://localhost`.
 */
describe('el idioma servido por HTTPS', () => {
  it('se prueba de verdad sobre una ventana cifrada', () => {
    // Sin esto, si el `@vitest-environment-options` de arriba dejara de
    // aplicarse, el test de abajo seguiría pasando sobre `http:` sin tocar la
    // rama que dice probar.
    expect(window.location.protocol).toBe('https:')
  })

  it('viaja en una cookie marcada como segura', () => {
    setLang('es')

    expect(document.cookie === '' || document.cookie.includes(`${LANG_COOKIE}=es`)).toBe(true)
    // jsdom no expone los atributos de la cookie, así que lo que se comprueba es
    // que escribirla con `Secure` por HTTPS sigue guardándola: con el protocolo
    // equivocado, el navegador la tiraría y `document.cookie` saldría vacío.
    expect(document.cookie).toContain(`${LANG_COOKIE}=es`)
  })
})
