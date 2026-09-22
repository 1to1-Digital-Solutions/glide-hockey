import { expect, test } from '@playwright/test'

import { CRUCE } from '../src/lib/ayudas'
import { GUION_DE_AYUDAS } from '../src/lib/guionDeAyudas'
import { abrirJuego } from './helpers'
import { contarLlamadas, dejarAsentar, medianaDeLlamadas } from './support/escenario'
import { enterVR, installXREmulator, skipTutorial, startGameInsideSession } from './support/xr'

/**
 * Las ayudas visuales, dentro del visor.
 *
 * **Qué se comprueba aquí y qué no.** Que el guion se apague solo, que lo que se levanta de la
 * mesa desaparezca antes del saque y que cada cota caiga donde dice lo mide
 * `src/lib/guionDeAyudas.test.ts`, sin navegador y con cifras. Lo que solo se ve aquí es que
 * **se pinten de verdad** —que es distinto de que el guion las encienda— y que **dejen de
 * pintarse** cuando su plazo se acaba.
 *
 * **Y se miden por lo que cuestan**, que es lo único que una ayuda deja ver desde fuera del
 * visor: las llamadas de dibujo por fotograma (`e2e/support/escenario.ts`). Una ayuda encendida
 * cuesta; apagada es invisible y no cuesta nada. Eso convierte «¿sigue puesta?» en un número.
 *
 * Si se **leen** —si el fantasma se entiende como un empujón o como un borrón ámbar— no lo dice
 * ningún número. Para eso están las capturas, y la respuesta llega con las gafas puestas
 * (`organizate/docs/pendiente-de-visor.md`).
 *
 * **Se entra con el tutorial ya visto**, que es el caso en el que las ayudas enseñan el mando:
 * quien llega nuevo lo ve en la lección, y los dos no pueden pintarlo a la vez sobre la misma
 * mano.
 */

const CAPTURAS = 'test-results/capturas'

/**
 * Hacia dónde se mira para verlas.
 *
 * El emulador entra siempre mirando al frente y las ayudas están donde se mira después: las
 * huellas **a los pies** y el fantasma sobre la mesa. Cincuenta grados hacia abajo es el único
 * ángulo que coge las dos cosas a la vez, y se eligió mirando capturas a −20, −35, −50 y −70:
 * a −28 la captura enseñaba una mesa preciosa y ninguna ayuda.
 *
 * **Las dos medidas de una comparación se toman con la cabeza en el mismo sitio**: si no, lo
 * que se compara son dos vistas y no dos escenas.
 */
const A_LAS_AYUDAS = { yaw: 0, pitch: -50 }

/** Lo que tarda la ayuda más paciente en irse sola, más el cruce con el que se desvanece. */
const HASTA_QUE_SE_VAN = Math.max(...GUION_DE_AYUDAS.map((ayuda) => ayuda.caduca)) + CRUCE + 2

/**
 * Cuántas llamadas de dibujo por fotograma pueden costar todas las ayudas a la vez.
 *
 * Los dos ojos de una sesión inmersiva duplican cada malla, y el modelo del mando trae las
 * suyas —es, de largo, la cara: por eso es la ayuda que menos dura—. El resto son cinco mallas:
 * las dos huellas, el aro y el mango del fantasma y la marca de la portería.
 */
const TECHO_DE_LAS_AYUDAS = 60

/** Deja que el cruce con el que aparecen o se van termine, que dura casi medio segundo. */
async function dejarQueCrucen(page: import('@playwright/test').Page) {
  await page.waitForTimeout(CRUCE * 1000 + 300)
  await dejarAsentar(page)
}

test.describe('Las ayudas visuales', () => {
  test.beforeEach(async ({ page }) => {
    await contarLlamadas(page)
    await installXREmulator(page)
    await skipTutorial(page)
    await abrirJuego(page)
  })

  test('se pintan al entrar en la cabina, y se van solas al agotarse su plazo', async ({
    page,
  }) => {
    test.setTimeout(HASTA_QUE_SE_VAN * 1000 + 60_000)
    await enterVR(page)
    await page.evaluate(({ yaw, pitch }) => window.__xrTest.lookAt(yaw, pitch), A_LAS_AYUDAS)
    await dejarQueCrucen(page)

    const conAyudas = await medianaDeLlamadas(page)
    await page.screenshot({ path: `${CAPTURAS}/ayudas-al-entrar.png` })

    // Se dejan caducar, que es la única forma de apagarlas sin tocar la escena. **La cabeza no
    // se mueve entre una medida y la otra.**
    await page.waitForTimeout(HASTA_QUE_SE_VAN * 1000)
    await dejarAsentar(page)
    const sinAyudas = await medianaDeLlamadas(page)
    await page.screenshot({ path: `${CAPTURAS}/ayudas-agotadas.png` })

    expect(conAyudas, 'las ayudas no costaron nada: ¿se están pintando?').toBeGreaterThan(sinAyudas)
    expect(
      conAyudas - sinAyudas,
      `${conAyudas} llamadas con ayudas y ${sinAyudas} sin ellas: se han ido de precio`,
    ).toBeLessThanOrEqual(TECHO_DE_LAS_AYUDAS)
  })

  test('con la partida en marcha se enseña el empujón y la portería', async ({ page }) => {
    // **La captura es para mirarla**, y es la única forma de juzgar lo que aquí importa: que el
    // mazo fantasma se lea como un empujón hacia el disco y no como una mancha sobre la mesa.
    // Lo que sí queda comprobado es que la partida arranca con las ayudas puestas, que es el
    // momento en el que hacen falta.
    await enterVR(page)
    await startGameInsideSession(page)
    await page.evaluate(({ yaw, pitch }) => window.__xrTest.lookAt(yaw, pitch), A_LAS_AYUDAS)
    await dejarQueCrucen(page)

    await page.screenshot({ path: `${CAPTURAS}/ayudas-jugando.png` })
    // Y la partida sigue esperando al mazo: es lo que garantiza que nada corra por la mesa
    // mientras el fantasma está encima de ella.
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toHaveCount(0)
  })
})
