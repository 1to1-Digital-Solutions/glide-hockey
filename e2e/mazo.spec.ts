import { expect, test, type Page } from '@playwright/test'
import { constrainMallet, type Vec2 } from '@/lib/puckPhysics'
import {
  abrirJuego,
  esperarALaMesa,
  jugarPartida,
  leerLaMesa,
  observarLaMesa,
  perseguirElDisco,
} from './helpers'

/**
 * Mover el mazo con el ratón, que es la interacción principal del juego.
 *
 * Desde el DOM no se ve nada de esto: el mazo y el disco son objetos de three
 * dentro de un canvas. Se miran por donde la escena los publica cuando un test
 * lo pide (ver `src/lib/sceneProbe.ts`), y no por el marcador: esperar a que
 * caiga un gol convertiría estos tests en una apuesta sobre la puntería y sobre
 * lo rápido que vaya la máquina donde corran.
 *
 * Se juega en Fácil y a quince goles para que la partida no se acabe sola
 * mientras se mira.
 */

/** Distancia entre dos puntos de la mesa, en metros. */
function distancia(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/**
 * Cuánto se le consiente al mazo quedarse del punto al que se apuntó.
 *
 * El ratón se mueve a un píxel entero y la mesa mide dos metros repartidos en
 * unos cientos de píxeles, así que entre proyectar el disco y volver a apuntar
 * ahí se pierden milímetros. Tres centímetros es menos de medio mazo: no hay
 * forma de cumplirlo quedándose quieto en el otro extremo de la mesa.
 */
const TOLERANCIA = 0.03

/**
 * Apunta con el ratón al disco y espera a que el mazo llegue hasta él.
 *
 * El disco es el único punto de la mesa del que el test sabe a la vez el píxel
 * en el que se ve y las coordenadas a las que corresponde, así que es la única
 * forma de comprobar que el mazo va **a donde se apunta** y no a cualquier
 * sitio. El mazo no cruza la línea de medio campo, de ahí el `constrainMallet`.
 */
async function llevarElMazoAlDisco(page: Page): Promise<Vec2> {
  const mesa = await leerLaMesa(page)
  // Recién empezada la partida el disco espera el saque en el centro de la
  // mesa. Si estuviera lejos de ahí es que se ha jugado media partida antes de
  // mirar, y entonces ni el mazo está donde se cree ni el píxel al que se
  // apunta tiene por qué caer sobre la mesa.
  expect(
    distancia(mesa.puck, { x: 0, z: 0 }),
    'el disco ya no estaba saliendo del centro',
  ).toBeLessThan(0.3)

  const destino = constrainMallet(mesa.puck, 'player')
  await page.mouse.move(mesa.puckScreen.x, mesa.puckScreen.y)

  await expect
    .poll(
      async () => distancia((await leerLaMesa(page)).playerMallet, destino),
      { message: 'el mazo no fue a donde apuntaba el ratón' },
    )
    .toBeLessThan(TOLERANCIA)

  return destino
}

test('el ratón mueve el mazo del jugador a donde apunta', async ({ page }) => {
  await observarLaMesa(page)
  await abrirJuego(page)
  await jugarPartida(page, { goles: 15, nivel: 'Fácil' })

  const inicio = await esperarALaMesa(page)
  // El mazo sale delante de su portería, a media mesa del centro: si ya
  // estuviera donde se le va a mandar, llegar no demostraría nada.
  expect(
    distancia(inicio.playerMallet, constrainMallet(inicio.puck, 'player')),
  ).toBeGreaterThan(0.4)

  await llevarElMazoAlDisco(page)
})

test('el mazo golpea el disco cuando se le persigue con el ratón', async ({
  page,
}) => {
  await observarLaMesa(page)
  await abrirJuego(page)
  await jugarPartida(page, { goles: 15, nivel: 'Fácil' })
  await esperarALaMesa(page)

  // Primero se comprueba que el ratón manda de verdad. Sin esto, un mazo
  // clavado delante de su portería acabaría tocando el disco de rebote y el
  // test daría por bueno un juego en el que el ratón no mueve nada.
  await llevarElMazoAlDisco(page)

  // Y ahora se le persigue, que es lo que hace quien juega. No se espera a un
  // gol ni a un número de golpes: basta con que el mazo alcance el disco una
  // vez y la física cuente el golpe.
  await expect
    .poll(() => perseguirElDisco(page), {
      // Cada vuelta lee dónde se ve el disco y lleva el ratón hasta ahí: cuanto
      // más seguidas, menos se le escapa.
      intervals: [20],
      timeout: 60_000,
      message: 'el mazo no llegó a golpear el disco persiguiéndolo con el ratón',
    })
    .toBeGreaterThan(0)
})
