/**
 * La plantilla del menú del salón: cómo se llama el juego en su menú, en qué orden van las filas y
 * dónde nace el menú en el visor.
 *
 * Es el mismo fichero en todos los juegos, junto a `palabras.ts`, y por lo mismo: cada juego
 * ordenaba distinto Modo / Contra quién / A dos / Dificultad, «Reto» iba en cuatro sitios del menú,
 * el menú se llamaba «Axe» o «Pins» cuando la cabina decía «Axe Throwing» o «Bowling», y nacía a
 * 60° de la mirada en un juego y de frente en el de al lado. Quien pasa de una cabina a otra tiene
 * que encontrar el mismo menú.
 *
 * **Cómo se usa.**
 *
 * - **El nombre.** La escena recibe `nombre` del salón (el `name` del manifiesto) y lo fija con
 *   `fijarNombreDelJuego(nombre)` al montarse, como `setAssetsBase`; el menú del visor, la portada y
 *   el `<title>` de la web dicen `nombreDelJuego()`. Sin salón —la web propia del juego— es el `name`
 *   de su `package.json` con mayúsculas: `axe-throwing` es «Axe Throwing», que es como lo llama el
 *   catálogo. En Godot lo fija `main.ts` con `base.nombre()` del kit (el metadato `game_name`). Es un
 *   nombre propio: no se traduce.
 * - **Las filas.** Primero «Modo» (`MENU_EN.modo`), con el reto, el que da medalla, el primero de
 *   sus opciones (`conElRetoPrimero`); después «Jugadores» (`MENU_EN.jugadores`), solo o a dos; y lo
 *   demás detrás de «Más opciones», plegado hasta que se pida (`filasDelMenu`). El reto es una
 *   partida fija, así que con él elegido lo plegado no se enseña aunque se pida: no hay nada que
 *   elegir que cuente.
 * - **Dónde nace.** El menú del visor nace a `GRADOS_DEL_MENU` o menos del frente de quien juega y
 *   se aparta al empezar. El guardián del menú de cada juego (`xrLayout`/`menuLayout`) lo mide con
 *   `gradosDelFrente` sobre el sitio del panel en la fase de menú.
 *
 * Sin nada del navegador ni del motor: se porta a Godot tal cual.
 */

import paquete from '../../package.json'

/** El nombre que ha pasado el salón, o `null` en la web propia del juego. */
let delSalon: string | null = null

/** Lo llama la escena al montarse con la prop `nombre` (o `main.ts` en Godot con `base.nombre()`). */
export function fijarNombreDelJuego(nombre: string | null | undefined): void {
  delSalon = typeof nombre === 'string' && nombre.trim() !== '' ? nombre.trim() : null
}

/** El nombre a partir del id del paquete: cada palabra con mayúscula, sin guiones. */
export function nombreDesdeElId(id: string): string {
  return id
    .split('-')
    .filter((palabra) => palabra !== '')
    .map((palabra) => palabra[0].toUpperCase() + palabra.slice(1))
    .join(' ')
}

/** Cómo se llama el juego en su menú: el nombre de la cabina del salón, o el de su paquete. */
export function nombreDelJuego(): string {
  return delSalon ?? nombreDesdeElId(paquete.name)
}

/** Qué papel tiene una fila del menú en la plantilla. */
export type PapelDeLaFila = 'modo' | 'jugadores' | 'otra'

/** Lo que se enseña del menú: las filas, ya en orden, y cuántas quedan detrás de «Más opciones». */
export interface FilasDelMenu<F> {
  filas: F[]
  /** Las que no se enseñan; con cero, el menú no lleva el botón de «Más opciones». */
  plegadas: number
}

/**
 * Las filas del menú en el orden de la plantilla: «Modo», «Jugadores» y lo demás, cada grupo en el
 * orden en que venía. Lo demás solo con `masOpciones` (lo ha pedido quien juega) y nunca con el reto
 * elegido (`enReto`): es una partida fija.
 */
export function filasDelMenu<F>(
  filas: readonly F[],
  papel: (fila: F) => PapelDeLaFila,
  { masOpciones, enReto = false }: { masOpciones: boolean; enReto?: boolean },
): FilasDelMenu<F> {
  const de = (cual: PapelDeLaFila) => filas.filter((fila) => papel(fila) === cual)
  const principales = [...de('modo'), ...de('jugadores')]
  const otras = enReto ? [] : de('otra')
  return masOpciones ? { filas: [...principales, ...otras], plegadas: 0 } : { filas: principales, plegadas: otras.length }
}

/** Las opciones de la fila «Modo» con el reto, el que da medalla, el primero; las demás, como venían. */
export function conElRetoPrimero<O>(opciones: readonly O[], esReto: (opcion: O) => boolean): O[] {
  return [...opciones.filter(esReto), ...opciones.filter((opcion) => !esReto(opcion))]
}

/** Lo más que se aparta del frente el menú del visor al nacer, en grados. */
export const GRADOS_DEL_MENU = 30

/**
 * Cuánto se aparta un sitio del frente de quien juega, en grados y en horizontal: el ángulo entre
 * −Z (delante) y el sitio visto desde arriba, sin signo. Las cotas, desde los pies, como las de los
 * paneles (`[derecha, altura, fondo]`). Lo que queda detrás está a más de 90°.
 */
export function gradosDelFrente([x, , z]: readonly [number, number, number]): number {
  return (Math.atan2(Math.abs(x), -z) * 180) / Math.PI
}
