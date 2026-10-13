import { expect, test } from '@playwright/test'
import { ENSAYO, enterHostVR, openHost } from './support/host'
import { installXREmulator } from './support/xr'
import { capturar, enLaPartida, mirar, objetivoDeEnsayo, partidaLista, pedirLaPartida } from './support/comun'

/**
 * Las capturas comunes de la UX, las mismas en los diecisiete: el menú del visor mirando al frente,
 * el cartel del objetivo antes de empezar, el cartel al cruzar el bronce y el final.
 *
 * Es el mismo fichero en todos los juegos. Monta la escena en el anfitrión de prueba del juego con
 * un objetivo de ensayo (`objetivoDeEnsayo`, el bronce a 10) y la mueve con el gancho de la partida
 * (`support/comun.ts`), sin jugar: lo que se mira aquí es lo que se ve, no el gesto. Las capturas
 * van a `test-results/capturas/<juego>-<qué>.png`, para poner los diecisiete uno al lado del otro.
 *
 * Lo que dice el cartel se comprueba con lo que la escena le pasa a pintar (el gancho `cartel`), en
 * inglés, que es el idioma del navegador de los tests.
 */

test.use({ locale: 'en-US' })

test('el menú nace de frente, el cartel dice el bronce y lo celebra al cruzarlo', async ({ page }) => {
  const objetivo = objetivoDeEnsayo(ENSAYO)
  const { bronce, oro } = objetivo.medallas
  await installXREmulator(page)
  await pedirLaPartida(page)
  await openHost(page, undefined, { objetivo })
  await enterHostVR(page)
  await expect.poll(() => partidaLista(page), { message: 'la escena no ha dejado el gancho de la partida' }).toBe(true)

  await mirar(page, 0, 0)
  await capturar(page, '1-menu')

  await enLaPartida(page, 'start')
  await expect
    .poll(async () => (await enLaPartida(page, 'cartel'))?.detalle ?? '')
    .toContain(ENSAYO.mejorEs === 'mas' ? `Bronze ${bronce}` : `Gold ${oro} or less`)
  await capturar(page, '2-cartel-antes')

  if (ENSAYO.mejorEs === 'mas') {
    await enLaPartida(page, 'score', 1)
    await expect.poll(async () => (await enLaPartida(page, 'cartel'))?.titulo).toBe(`Bronze at ${bronce} · you have 1`)
    await enLaPartida(page, 'score', bronce)
    await expect.poll(async () => (await enLaPartida(page, 'cartel'))?.vitor).toBe('Bronze!')
  } else {
    await enLaPartida(page, 'score', oro)
    await expect.poll(async () => (await enLaPartida(page, 'cartel'))?.titulo).toBe(`Gold with ${oro} or less · you have ${oro}`)
  }
  await capturar(page, '3-cartel-bronce')

  await enLaPartida(page, 'end')
  await expect.poll(async () => (await enLaPartida(page, 'cartel'))?.titulo ?? '').toMatch(/^(Bronze|Gold) · /)
  await capturar(page, '4-final')
})
