import { expect, test, type Page } from '@playwright/test'
import { abrirJuego, jugarPartida } from './helpers'

/**
 * El golpe recibido (`components/xr/GolpeRecibido.tsx`), medido fotograma a fotograma en un
 * navegador de verdad.
 *
 * Lo que más importa no se ve en una captura: **que la cámara no se mueve en ningún
 * fotograma**. Mover la vista sin que se mueva la cabeza es lo que marea con el visor, y la
 * macro está hecha para sacudir el decorado y nunca la cámara. La sonda del componente
 * (`window.__golpeRecibido`) apunta en cada fotograma la pose de la cámara, lo que se ha
 * desplazado la sala, la viñeta, el ritmo del reloj de la mesa y el corte del filtro.
 */

/** Lo que el componente apunta por fotograma. */
interface Muestra {
  camara: number[]
  sacudida: [number, number, number]
  vineta: number
  escala: number
  corte: number
}

const ABIERTO = 20000

/** Espera a que la sonda esté puesta: la monta la escena, que se carga aparte. */
async function sondaLista(page: Page) {
  await expect.poll(() => page.evaluate(() => window.__golpeRecibido != null)).toBe(true)
}

/** Lo apuntado hasta ahora. */
function muestras(page: Page): Promise<Muestra[]> {
  return page.evaluate(() => (window.__golpeRecibido?.muestras() ?? []) as Muestra[])
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
        const ultimoConGolpe = lista.findLastIndex((m) => m.vineta > 0)
        return ultimoConGolpe >= 0 && lista.length - ultimoConGolpe > 10
      },
      { message: 'el golpe no llegó a verse y apagarse', timeout: 60_000 },
    )
    .toBe(true)
  return muestras(page)
}

function comprobarElGolpeEntero(lista: Muestra[]) {
  // La cámara, idéntica en todos los fotogramas: matriz, posición y giro.
  const primera = JSON.stringify(lista[0].camara)
  expect(lista[0].camara).toHaveLength(16 + 3 + 4)
  for (const m of lista) expect(JSON.stringify(m.camara)).toBe(primera)

  // La sala se ha movido y ha vuelto exactamente a su sitio.
  expect(lista.some((m) => m.sacudida.some((v) => v !== 0))).toBe(true)
  const ultima = lista.at(-1)!
  expect(ultima.sacudida).toEqual([0, 0, 0])
  // La viñeta ha subido y se ha apagado.
  expect(Math.max(...lista.map((m) => m.vineta))).toBeGreaterThan(0)
  expect(ultima.vineta).toBe(0)
  // El reloj de la mesa ha frenado y ha vuelto a su ritmo.
  expect(Math.min(...lista.map((m) => m.escala))).toBeLessThan(1)
  expect(ultima.escala).toBe(1)
  // Y el oído se ha tapado y destapado.
  expect(Math.min(...lista.map((m) => m.corte))).toBeLessThan(ABIERTO)
  expect(ultima.corte).toBe(ABIERTO)
}

test('un golpe mueve la sala, oscurece los bordes, frena la mesa y tapa el oído, sin tocar la cámara', async ({ page }) => {
  await abrirJuego(page)
  await jugarPartida(page, { goles: 5, nivel: 'Easy' })
  await sondaLista(page)

  await page.evaluate(() => {
    window.__golpeRecibido!.medir()
    window.__golpeRecibido!.golpe(1, { x: -1, y: 0, z: 0 })
  })

  comprobarElGolpeEntero(await hastaQuePase(page))
})

test('el gol en contra dispara el golpe, flojo', async ({ page }) => {
  await abrirJuego(page)
  await sondaLista(page)
  await page.evaluate(() => window.__golpeRecibido!.medir())
  // Con el mazo quieto, en Imposible la máquina marca en unos segundos.
  await jugarPartida(page, { goles: 5, nivel: 'Impossible' })

  const lista = await hastaQuePase(page)
  comprobarElGolpeEntero(lista)
  // Flojo: nadie te ha tocado. Con toda la fuerza la viñeta llegaría a 0,9.
  expect(Math.max(...lista.map((m) => m.vineta))).toBeLessThan(0.7)
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
    window.__golpeRecibido!.medir()
    window.__golpeRecibido!.golpe(1, { x: -1, y: 0, z: 0 })
  })
  // Un rato de fotogramas: lo que dura un golpe entero y algo más.
  await page.waitForTimeout(1_200)
  const lista = await muestras(page)
  expect(lista.length).toBeGreaterThan(5)
  for (const m of lista) {
    expect(m.vineta).toBe(0)
    expect(m.sacudida).toEqual([0, 0, 0])
    expect(m.escala).toBe(1)
    expect(m.corte).toBe(ABIERTO)
  }
})

test('la captura: la viñeta en su pico, más oscura del lado del golpe', async ({ page }) => {
  const ruta = process.env.GOLPE_CAPTURA
  test.skip(ruta == null, 'solo cuando se pide la captura (GOLPE_CAPTURA=ruta.png)')
  await abrirJuego(page)
  await jugarPartida(page, { goles: 5, nivel: 'Easy' })
  await sondaLista(page)
  await page.evaluate(() => {
    window.__golpeRecibido!.golpe(1, { x: -1, y: 0, z: 0 })
    // El pico de la viñeta: al acabar su entrada.
    window.__golpeRecibido!.fijarEdad(0.06)
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: ruta! })
})
