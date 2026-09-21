import { expect, type Page } from '@playwright/test'
import { SCENERY_KEY, type Scenery } from '../../src/lib/ajustes'

/**
 * Lo que hace falta para comprobar desde fuera que el juego obedece al escenario del arcade.
 *
 * **Qué se comprueba.** El salón entra siempre en `immersive-ar` si el visor la tiene, así que
 * el tipo de sesión no dice qué se eligió: lo dice `xrcade:scenery`. Un juego que decidiera su
 * decorado con otra cosa —su propio ajuste, o el tipo de sesión— entraría sin decorado aunque
 * en el salón se hubiera elegido el sitio dibujado, y el fallo solo se vería con el visor
 * puesto.
 *
 * **Cómo se ve sin mirar.** El decorado son decenas de mallas y en una sesión se pintan dos
 * veces, una por ojo, así que quitarlo se nota en las **llamadas de dibujo por fotograma**. Se
 * cuentan envolviendo el contexto WebGL, como el presupuesto de llamadas de cada juego, para
 * no meter ningún contador en el código que se juega.
 *
 * **Y que cambiarlo no dé un tirón.** Cambiar de escenario se hace con el visor puesto, así que
 * tiene que ser instantáneo. Lo que lo estropea no se ve en las llamadas sino en los shaders:
 * montar o desmontar una luz cambia cuántas hay, y poner o quitar la niebla cambia si la hay, y
 * las dos cosas obligan a three a recompilar los materiales de todo lo que se ilumina. Por eso
 * también se apunta, desde el mismo contexto WebGL, cada programa que se enlaza y con cuántas
 * luces de cada tipo se compiló.
 *
 * Es el mismo fichero en todos los juegos: lo que cambia de uno a otro —cómo se entra en la
 * sesión y cuánto pesa su decorado— va en su `escenario.spec.ts`.
 */

declare global {
  interface Window {
    /** Llamadas de dibujo de cada fotograma, las últimas 240. */
    __llamadasPorFotograma?: number[]
    /** Cuántos programas de shader se han enlazado desde que cargó la página. */
    __programasEnlazados?: number
    /** Las combinaciones de luces con las que se ha pintado algo iluminado en la sesión. */
    __lucesDeLosShaders?: string[]
    /** Cuántas llamadas de dibujo llevaba la página al enlazarse cada shader. Ver abajo. */
    __cuandoSeEnlazo?: number[]
    /** De qué material es cada shader enlazado (`MeshStandardMaterial`, `MeshDepthMaterial`…). */
    __tiposDeShader?: string[]
  }
}

/** Empieza a contar llamadas de dibujo por fotograma. Antes de abrir la página. */
export async function contarLlamadas(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const frames: number[] = []
    window.__llamadasPorFotograma = frames
    let calls = 0
    const gl = WebGL2RenderingContext.prototype
    for (const name of ['drawElements', 'drawElementsInstanced', 'drawArrays', 'drawArraysInstanced'] as const) {
      const original = gl[name] as (...args: unknown[]) => unknown
      ;(gl as unknown as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
        calls++
        return original.apply(this, args)
      }
    }
    const cerrarFotograma = () => {
      frames.push(calls)
      if (frames.length > 240) frames.shift()
      calls = 0
      requestAnimationFrame(cerrarFotograma)
    }
    requestAnimationFrame(cerrarFotograma)
  })
}

/**
 * La mediana de llamadas por fotograma, con lo último que se cambió ya asentado.
 *
 * La mediana y no la media: el fotograma en que se monta o se quita el decorado, o en que se
 * compila un material, se sale de lo normal y no dice nada de lo que se pinta después.
 */
export async function medianaDeLlamadas(page: Page, count = 30): Promise<number> {
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    window.__llamadasPorFotograma!.length = 0
  })
  await expect
    .poll(() => page.evaluate(() => window.__llamadasPorFotograma!.length), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(count)
  const calls = await page.evaluate(() =>
    window.__llamadasPorFotograma!.filter((c) => c > 0).sort((a, b) => a - b),
  )
  return calls[Math.floor(calls.length / 2)] ?? 0
}

/**
 * Empieza a apuntar los programas de shader que se enlazan, **cuándo** se enlaza cada uno y con
 * cuántas luces pinta la escena. Antes de abrir la página.
 *
 * **Enlazar es el tirón.** three compila un programa la primera vez que pinta un material con una
 * combinación de luces, niebla y entorno, y lo vuelve a compilar si un material se libera al
 * desmontarse y vuelve a aparecer. Contar `linkProgram` dice cuántas veces ha pasado, sin mirar
 * dentro del juego.
 *
 * **Contar enlaces no basta para las luces.** three guarda en cada material un programa por
 * combinación de luces, así que alternar entre dos solo compila la primera vez que aparece cada
 * una; y la del sitio dibujado ya se compila en la pantalla, antes de entrar. Así que las luces se
 * miran en lo que se **usa** para pintar: cada shader iluminado lleva escrito cuántas luces de
 * cada tipo hay en la declaración de sus uniformes (`pointLights[ 1 ]`, también cuando son cero);
 * se apunta de qué programa es, y cada vez que se pinta con ese programa con la sesión abierta,
 * esa combinación cuenta.
 *
 * **Solo con la sesión abierta**, porque antes de entrar los juegos que reflejan una sala la
 * pintan en una escena aparte (`RoomEnvironment`, con su propia luz) para sacar el mapa de
 * reflejos, y esa escena no es la del juego.
 *
 * **Y cuándo se enlaza cada uno, contado en llamadas de dibujo.** Contarlos no basta para ver
 * el precalentado: los mismos programas se enlazan con él y sin él, y lo que cambia es *cuándo*.
 * Sin calentar, cada material enlaza el suyo la primera vez que le toca pintarse, así que salen
 * de uno en uno repartidos por los primeros fotogramas —y cada uno de esos bloquea el hilo, que
 * con el visor puesto es un tirón—. Calentando, se enlazan **todos en la misma tanda**, antes de
 * pintar. Las llamadas de dibujo son el reloj porque no paran: dos shaders con el mismo número
 * se enlazaron sin que se pintara nada entre medias.
 */
export async function vigilarProgramas(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__programasEnlazados = 0
    const cuando: number[] = []
    window.__cuandoSeEnlazo = cuando
    const tipos: string[] = []
    window.__tiposDeShader = tipos
    const luces = new Set<string>()
    window.__lucesDeLosShaders = []
    const lucesDelShader = new WeakMap<WebGLShader, string>()
    const lucesDelPrograma = new WeakMap<WebGLProgram, string>()
    const tipoDelShader = new WeakMap<WebGLShader, string>()
    const tipoDelPrograma = new WeakMap<WebGLProgram, string>()
    const gl = WebGL2RenderingContext.prototype

    // El reloj con el que se fecha cada compilación. Propio y no el de `contarLlamadas`:
    // los dos se pueden usar sueltos, y encadenar envoltorios del mismo método es inocuo.
    let dibujos = 0
    for (const name of ['drawElements', 'drawElementsInstanced', 'drawArrays', 'drawArraysInstanced'] as const) {
      const original = gl[name] as (...args: unknown[]) => unknown
      ;(gl as unknown as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
        dibujos++
        return original.apply(this, args)
      }
    }

    const enlazar = gl.linkProgram
    gl.linkProgram = function (this: WebGL2RenderingContext, program: WebGLProgram) {
      window.__programasEnlazados = (window.__programasEnlazados ?? 0) + 1
      cuando.push(dibujos)
      tipos.push(tipoDelPrograma.get(program) ?? 'desconocido')
      return enlazar.call(this, program)
    }

    const fuente = gl.shaderSource
    gl.shaderSource = function (this: WebGL2RenderingContext, shader: WebGLShader, texto: string) {
      const tipo = /#define SHADER_TYPE (\w+)/.exec(texto)?.[1]
      if (tipo !== undefined) tipoDelShader.set(shader, tipo)
      if (texto.includes('directionalLights[')) {
        const tipos = ['directionalLights', 'pointLights', 'spotLights', 'rectAreaLights', 'hemisphereLights']
        lucesDelShader.set(
          shader,
          tipos.map((tipo) => `${tipo} ${texto.match(new RegExp(`${tipo}\\[ (\\d+) \\]`))?.[1] ?? '?'}`).join(', '),
        )
      }
      return fuente.call(this, shader, texto)
    }

    const adjuntar = gl.attachShader
    gl.attachShader = function (this: WebGL2RenderingContext, program: WebGLProgram, shader: WebGLShader) {
      const suyas = lucesDelShader.get(shader)
      if (suyas !== undefined) lucesDelPrograma.set(program, suyas)
      const suyo = tipoDelShader.get(shader)
      if (suyo !== undefined) tipoDelPrograma.set(program, suyo)
      return adjuntar.call(this, program, shader)
    }

    const usar = gl.useProgram
    gl.useProgram = function (this: WebGL2RenderingContext, program: WebGLProgram | null) {
      const visor = (window as { __xrTest?: { hasSession(): boolean } }).__xrTest
      const suyas = program == null ? undefined : lucesDelPrograma.get(program)
      if (suyas !== undefined && visor?.hasSession() === true && !luces.has(suyas)) {
        luces.add(suyas)
        window.__lucesDeLosShaders = [...luces]
      }
      return usar.call(this, program)
    }
  })
}

/** Cuántos programas de shader se han enlazado desde que cargó la página. */
export async function programasEnlazados(page: Page): Promise<number> {
  return page.evaluate(() => window.__programasEnlazados ?? 0)
}

/**
 * Cuántas llamadas de dibujo llevaba la página al enlazarse cada shader, en orden.
 *
 * Dos shaders con el mismo número se compilaron **de una tanda**, sin pintar nada entre
 * medias: eso es lo que hace el precalentado. Números distintos son compilaciones sueltas,
 * cada una en mitad de un fotograma.
 */
export async function cuandoSeEnlazaron(page: Page): Promise<number[]> {
  return page.evaluate(() => [...(window.__cuandoSeEnlazo ?? [])])
}

/**
 * De qué material es cada shader enlazado, en el mismo orden que `cuandoSeEnlazaron`.
 *
 * Sirve para distinguir lo que se pinta de lo que no: `MeshDepthMaterial` es el mapa de
 * sombras, y ese three solo lo compila cuando hay algo **visible** que proyecte, así que el
 * precalentado no lo alcanza —`compile()` recorre la escena entera pero solo prepara la
 * pasada que se ve—.
 */
export async function tiposDeShader(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window.__tiposDeShader ?? [])])
}

/**
 * De esas fechas, cuántos shaders caen en la tanda más grande y cuántos quedan sueltos.
 *
 * Es la forma de leer el precalentado sin depender de cuántos materiales tenga cada juego:
 * calentando, la tanda se lleva casi todo; sin calentar, no hay tanda —cada shader va por su
 * cuenta— y todo queda suelto.
 */
export function enTandas(fechas: readonly number[]): { mayorTanda: number; sueltos: number } {
  const porFecha = new Map<number, number>()
  for (const fecha of fechas) porFecha.set(fecha, (porFecha.get(fecha) ?? 0) + 1)
  const mayorTanda = Math.max(0, ...porFecha.values())
  return { mayorTanda, sueltos: fechas.length - mayorTanda }
}

/**
 * Con cuántas combinaciones de luces distintas se ha pintado algo iluminado con la sesión abierta.
 * Si la escena no cambia de luces al cambiar de escenario, es una.
 */
export async function combinacionesDeLuces(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__lucesDeLosShaders ?? [])
}

/**
 * Deja pasar el cambio: el aviso llega, React vuelve a pintar y el fotograma siguiente compila lo
 * que tenga que compilar.
 */
export async function dejarAsentar(page: Page, count = 30): Promise<void> {
  await medianaDeLlamadas(page, count)
}

/** Deja escrito algo en el almacenamiento antes de que cargue la página. */
export async function guardarAntesDeAbrir(page: Page, key: string, value: string): Promise<void> {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [key, value] as const)
}

/**
 * Lo que hace el panel del salón al cambiar el escenario: escribir la clave y avisar.
 *
 * Sin recargar a propósito: con el visor puesto, recargar es salir de la sesión, así que el
 * cambio tiene que llegar por el evento o no llega.
 */
export async function elegirEnElSalon(page: Page, scenery: Scenery): Promise<void> {
  await page.evaluate(
    ([key, value]) => {
      window.localStorage.setItem(key, value)
      window.dispatchEvent(new Event('xrcade:ajustes'))
    },
    [SCENERY_KEY, scenery] as const,
  )
}

/** Lo que hay guardado en una clave, o `null`. */
export async function leerClave(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => window.localStorage.getItem(k), key)
}
