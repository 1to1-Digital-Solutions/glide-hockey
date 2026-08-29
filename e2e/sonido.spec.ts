import { expect, test, type Page } from '@playwright/test'
import { abrirJuego, jugarPartida } from './helpers'

/**
 * Que el juego suene de verdad, y que callado no suene nada.
 *
 * Los tests de `src/lib` prueban el sintetizador con un contexto de mentira y
 * el hook con un reproductor de mentira, así que ninguno de los dos toca el
 * único cable que queda: el de la mesa pidiendo el sonido en cada fotograma
 * (`components/game/Rink.tsx`). Ese solo se puede comprobar en un navegador de
 * verdad, y es justo el que se rompe en silencio —el juego sigue jugándose
 * igual, solo que mudo—.
 *
 * No se oye nada: se mira lo que el juego le pide a la Web Audio API, que es lo
 * que se puede observar sin tarjeta de sonido y sin depender de la máquina.
 */

/** Lo que el juego le ha pedido a la Web Audio API. */
interface UsoDelAudio {
  /** Contextos abiertos. Más de uno es una fuga: son un recurso escaso. */
  contextos: number
  /** Sonidos soltados: cada golpe, rebote o gol arranca al menos un tono. */
  sonidos: number
}

declare global {
  interface Window {
    __airHockeyAudio?: UsoDelAudio
  }
}

/**
 * Cuenta lo que se le pide al audio, sin cambiar lo que hace.
 *
 * Hay que llamarlo **antes** de abrir el juego: envuelve `AudioContext` y el
 * juego se queda con el suyo en cuanto suena la primera vez.
 */
async function contarElAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const uso: UsoDelAudio = { contextos: 0, sonidos: 0 }
    window.__airHockeyAudio = uso

    const Original = window.AudioContext
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof Original>) {
        super(...args)
        uso.contextos++
      }

      createOscillator(): OscillatorNode {
        uso.sonidos++
        return super.createOscillator()
      }
    }
  })
}

const leerElAudio = (page: Page) =>
  page.evaluate(() => window.__airHockeyAudio)

test('la partida suena: la mesa pide sus sonidos al navegador', async ({
  page,
}) => {
  await contarElAudio(page)
  await abrirJuego(page)

  // Nada más llegar al menú no se ha abierto ningún contexto: el navegador
  // dejaría en suspenso el que se creara antes de que nadie tocase nada.
  expect(await leerElAudio(page)).toEqual({ contextos: 0, sonidos: 0 })

  // Una partida a muchos goles contra la máquina más lenta: no hace falta que
  // termine, solo que el disco se mueva y choque con algo.
  await jugarPartida(page, { goles: 15, nivel: 'Fácil' })

  await expect
    .poll(async () => (await leerElAudio(page))?.sonidos ?? 0, {
      timeout: 30_000,
      message: 'la mesa no pidió ni un sonido en toda la jugada',
    })
    .toBeGreaterThan(0)

  // Y con un solo contexto para toda la partida, por muchos golpes que haya.
  expect((await leerElAudio(page))?.contextos).toBe(1)

  // Uno para la escena entera, además, y no uno por partida: la mesa se
  // estrena en cada partida y en cada ronda del reto (`key={runId}` en
  // `GameWorld`). Con el audio colgado de ella, la ronda ganada cerraba el
  // contexto en el mismo fotograma en que sonaba el gol que la ganaba.
  const sonados = (await leerElAudio(page))?.sonidos ?? 0
  await page.getByRole('button', { name: 'Dejar la partida' }).click()
  await page.getByRole('button', { name: 'Jugar' }).click()
  await expect(page.getByText('Máquina')).toBeVisible()

  await expect
    .poll(async () => (await leerElAudio(page))?.sonidos ?? 0, {
      timeout: 30_000,
      message: 'la segunda partida se jugó muda',
    })
    .toBeGreaterThan(sonados)

  expect((await leerElAudio(page))?.contextos).toBe(1)
})

test('en silencio no se abre siquiera el audio del navegador', async ({
  page,
}) => {
  await contarElAudio(page)
  await abrirJuego(page)

  await page.getByRole('button', { name: 'Silencio' }).click()
  await jugarPartida(page, { goles: 15, nivel: 'Fácil' })

  // Lo suficiente para que en una partida con sonido ya hubiera sonado algo:
  // el disco sale del centro y llega al fondo de la mesa en menos de dos
  // segundos.
  await page.waitForTimeout(5000)

  expect(await leerElAudio(page)).toEqual({ contextos: 0, sonidos: 0 })
})

test('el silencio se recuerda al volver al juego', async ({ page }) => {
  await abrirJuego(page)
  await page.getByRole('button', { name: 'Silencio' }).click()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Silencio' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
