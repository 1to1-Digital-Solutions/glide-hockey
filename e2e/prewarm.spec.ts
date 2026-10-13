import { expect, test, type Page } from '@playwright/test'
import { SCENERY_KEY } from '../src/lib/settings'
import {
  installDrawCallCounter,
  linkTimes,
  letSettle,
  chooseInSalon,
  inBatches,
  storeBeforeOpen,
  shaderTypes,
  watchPrograms,
} from './support/scenery'
import { enterHostBooth, openHost } from './support/host'
import { installXREmulator } from './support/xr'

/**
 * Que al entrar en la cabina no se compile un shader por fotograma.
 *
 * **Lo que se arregló.** El precalentado (`<Calentar />`) colgaba del Canvas de la web del
 * juego, que es uno de sus dos anfitriones. El otro es el salón, y el salón monta la escena y
 * no el Canvas: justo donde se juega de verdad no se precalentaba nada.
 *
 * **Por qué ahí es peor.** En la web se entra al visor desde una página que lleva un rato
 * pintando la escena, así que casi todo está compilado antes de abrir la sesión. En el salón
 * se elige cabina **con el visor ya puesto**: la escena nace dentro de una sesión abierta y
 * sin haber pintado un solo fotograma, de modo que se compila todo en marcha, un material por
 * fotograma, y compilar bloquea el hilo. Ese es el tirón de los primeros segundos de partida.
 *
 * **Cómo se ve sin gafas.** No por cuántos shaders se compilan —son los mismos con
 * precalentado y sin él—, sino por **cuándo**: se fecha cada compilación en llamadas de
 * dibujo (`e2e/support/scenery.ts`). Calentando salen **todas con la misma fecha**, en una
 * tanda y antes de pintar; sin calentar no hay tanda, cada una va en su fotograma.
 *
 * El anfitrión de prueba monta la escena a la carta para poder reproducirlo: se entra primero
 * en la sesión y la escena se monta después, como en el arco de cabinas.
 */

/** Entra como entra el salón: en realidad aumentada, que es donde manda el escenario. */
async function entrarComoElSalon(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.__glideHockeyHost.enterAR().then(
            () => true,
            () => false,
          ),
        ),
      { message: 'el anfitrión no pudo abrir la sesión de realidad aumentada' },
    )
    .toBe(true)
}

test.describe('Los shaders están calientes donde se juega', () => {
  test('la escena que monta el salón compila sus shaders de una tanda, no de uno en uno', async ({
    page,
  }) => {
    await installDrawCallCounter(page)
    await watchPrograms(page)
    await installXREmulator(page)
    // En «tu habitación», que es el escenario con menos cosas a la vista: así la sala queda
    // montada y oculta, y lo que se calienta de ella no lo ha pintado nadie.
    await storeBeforeOpen(page, SCENERY_KEY, 'room')
    await openHost(page, undefined, { aLaCarta: true })
    await entrarComoElSalon(page)
    // Lo del anfitrión —sus rayos, su puntero— se compila al entrar y no es del juego: se le
    // deja asentarse para que no cuente como shader de la escena.
    await letSettle(page)

    const antesDeLaCabina = (await linkTimes(page)).length
    await enterHostBooth(page)
    await letSettle(page)

    const deLaEscena = (await linkTimes(page)).slice(antesDeLaCabina)
    const { largestBatch: mayorTanda, stray: sueltos } = inBatches(deLaEscena)
    console.log(
      `[calentado] la escena compiló ${deLaEscena.length} shaders: ${mayorTanda} de una tanda y ${sueltos} sueltos`,
    )

    expect(deLaEscena.length, 'la escena no compiló ningún shader: el test no mide nada').toBeGreaterThan(
      3,
    )
    expect(
      mayorTanda,
      'la escena compiló sus shaders de uno en uno, según le tocaba pintar cada material: eso es un tirón por fotograma al entrar en la cabina',
    ).toBeGreaterThan(sueltos)
  })

  test('y el decorado que se enseña al cambiar de escenario ya estaba caliente', async ({
    page,
  }) => {
    // «Tu habitación» y la sala son dos juegos de materiales, y al entrar solo se ve uno. El
    // otro está montado y oculto —por eso se oculta en vez de desmontarse—, así que el
    // precalentado lo recorre igual: enseñarlo no puede compilar nada.
    await installDrawCallCounter(page)
    await watchPrograms(page)
    await installXREmulator(page)
    await storeBeforeOpen(page, SCENERY_KEY, 'room')
    await openHost(page, undefined, { aLaCarta: true })
    await entrarComoElSalon(page)
    await letSettle(page)
    await enterHostBooth(page)
    await letSettle(page)

    const asentado = (await shaderTypes(page)).length
    await chooseInSalon(page, 'place')
    await letSettle(page)
    await chooseInSalon(page, 'room')
    await letSettle(page)

    // Lo que se pinta tiene que estar caliente: el precalentado recorre la escena entera, se
    // vea o no. **El mapa de sombras no**: `compile()` solo prepara la pasada que se ve, y
    // three no compila el `MeshDepthMaterial` de algo que no proyecta porque está oculto. Es
    // un shader, una vez por visita, y no hay forma de adelantarlo desde la escena.
    const nuevos = (await shaderTypes(page)).slice(asentado)
    console.log(`[calentado] al cambiar de escenario se compiló: ${nuevos.join(', ') || 'nada'}`)
    expect(
      nuevos.filter((tipo) => tipo !== 'MeshDepthMaterial'),
      'enseñar el decorado compiló shaders de lo que se pinta: eso es un tirón al cambiar de escenario con el visor puesto',
    ).toEqual([])
  })
})
