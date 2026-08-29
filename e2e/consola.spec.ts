import { expect, test } from '@playwright/test'
import { abrirJuego } from './helpers'

/**
 * La consola limpia y ninguna petición fuera de casa.
 *
 * Es el test que caza lo que no rompe el build y sí rompe el juego montado en
 * el salón de xrcade: un módulo de WebAssembly que la política de seguridad
 * bloquea, una fuente o un modelo que alguna librería se baja de un CDN, un
 * aviso de three sobre una API deprecada. Todo eso sale por consola y por la
 * red, y en local —con una política más laxa— no se nota (ver `docs/xrcade.md`).
 */

/**
 * Avisos que vienen de dentro de las librerías y no se pueden arreglar desde
 * aquí. Cada uno va con su motivo y con qué lo emite; sin esta lista el test
 * solo podría vigilar errores, y entonces se perderían los avisos que sí son
 * del juego (una clave repetida en React, un material mal configurado).
 *
 * Se comparan por fragmento exacto: cualquier aviso nuevo, aunque venga de la
 * misma librería, falla y hay que mirarlo.
 */
const AVISOS_DE_TERCEROS = [
  // @react-three/fiber usa THREE.Clock en su bucle de render. Se irá cuando la
  // librería pase a THREE.Timer; el juego no lo instancia en ningún sitio.
  'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.',
]

test('el juego arranca sin ensuciar la consola ni salir a la red', async ({
  page,
}) => {
  const problemas: string[] = []
  const fuera: string[] = []

  page.on('console', (message) => {
    const tipo = message.type()
    if (tipo !== 'error' && tipo !== 'warning') return
    const texto = message.text()
    if (AVISOS_DE_TERCEROS.some((aviso) => texto.includes(aviso))) return
    problemas.push(`${tipo}: ${texto}`)
  })
  page.on('pageerror', (error) => problemas.push(`pageerror: ${error.message}`))
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.hostname !== '127.0.0.1') fuera.push(request.url())
  })

  await abrirJuego(page)
  // Un poco de partida: es cuando entran en juego la física y la escena, que
  // es donde aparecerían los avisos de three.
  await page.getByRole('button', { name: 'Jugar' }).click()
  await expect(page.getByText('Máquina')).toBeVisible()
  await page.waitForTimeout(4000)

  expect(problemas).toEqual([])
  expect(fuera).toEqual([])
})

test('las fuentes se sirven desde el propio sitio', async ({ page }) => {
  await abrirJuego(page)

  // `next/font` se las descarga al construir y las auto-hospeda. Si alguna vez
  // se cuela una `<link>` a Google Fonts, la política de seguridad la bloquea
  // en el salón y el menú se queda con la fuente del sistema sin avisar.
  const recursos = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => (entry as PerformanceResourceTiming).name),
  )
  const origen = new URL(page.url()).origin

  expect(recursos.length).toBeGreaterThan(0)
  expect(recursos.filter((url) => !url.startsWith(origen))).toEqual([])
})
