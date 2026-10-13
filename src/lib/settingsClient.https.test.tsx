/**
 * @vitest-environment-options { "url": "https://localhost/" }
 */
import { describe, expect, it } from 'vitest'

import { LANG_COOKIE } from './settings'
import { setLang } from './settingsClient'

/**
 * The language cookie, served over HTTPS.
 *
 * It lives apart because `window.location` is fixed when the environment is set
 * up and cannot be changed halfway through a file: the unencrypted case lives in
 * `settingsClient.test.tsx`. And it needs testing separately because always
 * marking it `Secure` would leave the language unsaved in development, where the
 * game is served over `http://localhost`.
 */
describe('the language served over HTTPS', () => {
  it('is really tested on an encrypted window', () => {
    // Without this, if the `@vitest-environment-options` above stopped
    // applying, the test below would keep passing over `http:` without touching
    // the branch it claims to test.
    expect(window.location.protocol).toBe('https:')
  })

  it('travels in a cookie marked as secure', () => {
    setLang('es')

    expect(document.cookie === '' || document.cookie.includes(`${LANG_COOKIE}=es`)).toBe(true)
    // jsdom does not expose the cookie's attributes, so what is checked is
    // that writing it with `Secure` over HTTPS still saves it: with the wrong
    // protocol, the browser would drop it and `document.cookie` would come out empty.
    expect(document.cookie).toContain(`${LANG_COOKIE}=es`)
  })
})
