import { expect, test, type Page } from '@playwright/test'
import { abrirJuego } from './helpers'

/**
 * Que la sala esté **cerrada**: que mirar hacia arriba no sea mirar a la nada.
 *
 * Las paredes llegaban a tres metros y medio y ahí se acababa el mundo: por encima estaba el
 * negro del compositor, que no es el negro de un sitio a oscuras sino la ausencia de sitio, y
 * con el visor puesto eso se nota inmediatamente. Ahora hay techo, y sobre todo hay **fondo**.
 *
 * El fondo se comprueba por el color con el que se limpia el lienzo, que es lo que three pone
 * cuando la escena tiene `background`. Se mira desde fuera, envolviendo el contexto WebGL,
 * para no meter contadores en el código del juego — igual que el presupuesto de llamadas.
 */

declare global {
  interface Window {
    /** Todos los colores de limpieza que ha pedido el motor, en RGBA de 0 a 1. */
    __clearColors?: [number, number, number, number][]
  }
}

/**
 * Apunta con qué colores se limpia el lienzo. Antes de `page.goto`.
 *
 * Se guardan **todos** y no el último: el motor deja el color en cero al acabar de pintar,
 * así que quedarse con el último diría que no hay fondo aunque lo haya.
 */
async function spyClearColor(page: Page) {
  await page.addInitScript(() => {
    const colores: [number, number, number, number][] = []
    window.__clearColors = colores
    const gl = WebGL2RenderingContext.prototype
    const original = gl.clearColor
    gl.clearColor = function (r: number, g: number, b: number, a: number) {
      colores.push([r, g, b, a])
      return original.call(this, r, g, b, a)
    }
  })
}

test('la escena trae su propio fondo, y no es la nada', async ({ page }) => {
  // Tiene que traerlo el juego y no el `<Canvas>`: montado en el salón, el hub retira el suyo
  // al entrar en la cabina, así que un juego sin fondo propio se queda sin ninguno.
  await spyClearColor(page)
  await abrirJuego(page)

  // Un fondo es un color **opaco**: transparente deja ver el negro de detrás, que es justo
  // el problema. Y oscuro sin llegar a negro: es la sala de un recreativo de noche, no el
  // vacío, y el negro puro es lo que el motor pone cuando no hay fondo ninguno.
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.__clearColors ?? [])).some(
          ([r, g, b, a]) => a === 1 && r + g + b > 0 && r + g + b < 0.5,
        ),
      { message: 'la escena se pintó sin fondo propio: por encima de las paredes, la nada' },
    )
    .toBe(true)
})
