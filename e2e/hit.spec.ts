import { expect, test, type Page } from '@playwright/test'
import { abrirJuego, jugarPartida } from './helpers'

/**
 * El golpe recibido (`components/xr/GolpeRecibido.tsx`), medido fotograma a fotograma en un
 * navegador de verdad.
 *
 * Lo que más importa no se ve en una captura: **que la cámara no se mueve en ningún
 * fotograma**. Mover la vista sin que se mueva la cabeza es lo que marea con el visor, y la
 * macro está hecha para sacudir el decorado y nunca la cámara. La sonda del componente
 * (`window.__hitFeedback`) apunta en cada fotograma la pose de la cámara, lo que se ha
 * desplazado la sala, la viñeta, el ritmo del reloj de la mesa y el corte del filtro.
 */

/** Lo que el componente apunta por fotograma. */
interface Muestra {
  camera: number[]
  shake: [number, number, number]
  vignette: number
  timeScale: number
  cutoff: number
}

const ABIERTO = 20000

/** Espera a que la sonda esté puesta: la monta la escena, que se carga aparte. */
async function sondaLista(page: Page) {
  await expect.poll(() => page.evaluate(() => window.__hitFeedback != null)).toBe(true)
}

/** Lo apuntado hasta ahora. */
function muestras(page: Page): Promise<Muestra[]> {
  return page.evaluate(() => (window.__hitFeedback?.samples() ?? []) as Muestra[])
}

/**
 * Espera a que el golpe haya pasado entero: alguna muestra con viñeta y, detrás, un rato de
 * fotogramas ya en reposo.
 */
async function hastaQuePase(page: Page): Promise<Muestra[]> {
  await expect
    .poll(
      async () => {
        const lista = await muestras(page)
        const ultimoConGolpe = lista.findLastIndex((m) => m.vignette > 0)
        return ultimoConGolpe >= 0 && lista.length - ultimoConGolpe > 10
      },
      { message: 'el golpe no llegó a verse y apagarse', timeout: 60_000 },
    )
    .toBe(true)
  return muestras(page)
}

function comprobarElGolpeEntero(lista: Muestra[]) {
  // La cámara, idéntica en todos los fotogramas: matriz, posición y giro.
  const primera = JSON.stringify(lista[0].camera)
  expect(lista[0].camera).toHaveLength(16 + 3 + 4)
  for (const m of lista) expect(JSON.stringify(m.camera)).toBe(primera)

  // La sala se ha movido y ha vuelto exactamente a su sitio.
  expect(lista.some((m) => m.shake.some((v) => v !== 0))).toBe(true)
  const ultima = lista.at(-1)!
  expect(ultima.shake).toEqual([0, 0, 0])
  // La viñeta ha subido y se ha apagado.
  expect(Math.max(...lista.map((m) => m.vignette))).toBeGreaterThan(0)
  expect(ultima.vignette).toBe(0)
  // El reloj de la mesa ha frenado y ha vuelto a su ritmo.
  expect(Math.min(...lista.map((m) => m.timeScale))).toBeLessThan(1)
  expect(ultima.timeScale).toBe(1)
  // Y el oído se ha tapado y destapado.
  expect(Math.min(...lista.map((m) => m.cutoff))).toBeLessThan(ABIERTO)
  expect(ultima.cutoff).toBe(ABIERTO)
}

test('un golpe mueve la sala, oscurece los bordes, frena la mesa y tapa el oído, sin tocar la cámara', async ({ page }) => {
  await abrirJuego(page)
  await jugarPartida(page, { goles: 5, nivel: 'Easy' })
  await sondaLista(page)

  await page.evaluate(() => {
    window.__hitFeedback!.measure()
    window.__hitFeedback!.hit(1, { x: -1, y: 0, z: 0 })
  })

  comprobarElGolpeEntero(await hastaQuePase(page))
})

test('el gol en contra dispara el golpe, flojo', async ({ page }) => {
  await abrirJuego(page)
  await sondaLista(page)
  await page.evaluate(() => window.__hitFeedback!.measure())
  // Con el mazo quieto, en Imposible la máquina marca en unos segundos.
  await jugarPartida(page, { goles: 5, nivel: 'Impossible' })

  const lista = await hastaQuePase(page)
  comprobarElGolpeEntero(lista)
  // Flojo: nadie te ha tocado. Con toda la fuerza la viñeta llegaría a 0,9.
  expect(Math.max(...lista.map((m) => m.vignette))).toBeLessThan(0.7)
})

test('con el confort apagado, el golpe no hace nada', async ({ page }) => {
  await abrirJuego(page)
  // Se elige como lo elegiría cualquiera: en la fila del menú, detrás de «Más opciones», que en el
  // reto no se ofrece (es una partida fija).
  await page.getByRole('button', { name: 'Practice', exact: true }).click()
  await page.getByRole('button', { name: 'More options', exact: true }).click()
  await page.getByRole('button', { name: 'Off', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Off', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await jugarPartida(page, { goles: 5, nivel: 'Easy' })
  await sondaLista(page)

  await page.evaluate(() => {
    window.__hitFeedback!.measure()
    window.__hitFeedback!.hit(1, { x: -1, y: 0, z: 0 })
  })
  // Un rato de fotogramas: lo que dura un golpe entero y algo más.
  await page.waitForTimeout(1_200)
  const lista = await muestras(page)
  expect(lista.length).toBeGreaterThan(5)
  for (const m of lista) {
    expect(m.vignette).toBe(0)
    expect(m.shake).toEqual([0, 0, 0])
    expect(m.timeScale).toBe(1)
    expect(m.cutoff).toBe(ABIERTO)
  }
})

test('la captura: la viñeta en su pico, más oscura del lado del golpe', async ({ page }) => {
  const ruta = process.env.GOLPE_CAPTURA
  test.skip(ruta == null, 'solo cuando se pide la captura (GOLPE_CAPTURA=ruta.png)')
  await abrirJuego(page)
  await jugarPartida(page, { goles: 5, nivel: 'Easy' })
  await sondaLista(page)
  await page.evaluate(() => {
    window.__hitFeedback!.hit(1, { x: -1, y: 0, z: 0 })
    // El pico de la viñeta: al acabar su entrada.
    window.__hitFeedback!.pinAge(0.06)
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: ruta! })
})
