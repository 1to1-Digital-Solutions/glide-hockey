import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import paquete from '../../package.json'
import type { Objetivo, VistaDelCartel } from '../../src/lib/objetivo'

/**
 * Lo que los e2e de los diecisiete hacen igual, para probar la UX de todos con la misma receta.
 *
 * Es el mismo fichero en todos los juegos. Cada juego llegó a tener su propio `lookAt` (en grados
 * o en radianes, con el giro a un lado o al otro), su anfitrión de prueba con o sin objetivo y sus
 * ganchos de partida con otros nombres; así no había forma de sacar la misma captura de los
 * diecisiete. Lo de cada juego se queda en su sitio —cómo monta el anfitrión (`host.ts`) y qué hace
 * cada gancho en su escena (`lib/partidaDePrueba.ts`)—, y aquí va lo que se llama igual en todos.
 *
 * **La mirada**: `mirar(page, giro, cabeceo)` en **grados**, con el giro positivo a la izquierda
 * (como `rotation.y` de three) y el cabeceo positivo hacia arriba. Es el convenio del `lookAt` del
 * emulador de cada juego (`xr-emulator.src.ts`).
 *
 * **El gancho de la partida**: el test crea `window.__partida<Juego>` antes de cargar la página
 * (`pedirLaPartida`) y la escena deja ahí lo que se le puede pedir. Lo común son `start`, `score`,
 * `end` y `cartel` (`PartidaComun`); cada juego puede colgar más cosas suyas del mismo objeto.
 */

/** Lo que todo juego deja en su gancho de partida, si el test lo ha pedido. */
export interface PartidaComun {
  /** Empieza una partida del modo del récord, ya sin tutorial ni cuenta atrás que esperar. */
  start: () => void
  /** Fija lo que lleva la partida en curso, en la unidad del récord (golpes, si menos es mejor). */
  score: (puntos: number) => void
  /** Acaba la partida en curso como si se hubiera acabado jugando: cuenta para el salón. */
  end: () => void
  /** Lo que dice ahora el cartel del objetivo, o `null` si no se ve. */
  cartel: () => VistaDelCartel | null
}

/** Lo que el anfitrión de cada juego (`host.ts`) dice de su récord, para armar el objetivo. */
export interface Ensayo {
  /** El modo del récord, como lo llama el juego en `onTerminar`. */
  modo: string
  mejorEs: 'mas' | 'menos'
}

/** El id del juego: el `name` de su paquete. */
export const JUEGO = paquete.name

/** El nombre del gancho de la partida: `__partida` y el id en PascalCase (`__partidaAxeThrowing`). */
export function ganchoDePartida(juego: string = JUEGO): string {
  return `__partida${juego
    .split('-')
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join('')}`
}

/** Pide el gancho de la partida: hay que llamarlo **antes** de `page.goto`. */
export async function pedirLaPartida(page: Page): Promise<void> {
  await page.addInitScript((gancho) => {
    const ventana = window as unknown as Record<string, unknown>
    ventana[gancho] ??= {}
  }, ganchoDePartida())
}

/** Llama a una de las cosas comunes del gancho de la partida. */
export async function enLaPartida<K extends keyof PartidaComun>(
  page: Page,
  que: K,
  ...argumentos: Parameters<PartidaComun[K]>
): Promise<ReturnType<PartidaComun[K]>> {
  return page.evaluate(
    ([gancho, nombre, args]) => {
      const partida = (window as unknown as Record<string, Record<string, (...a: unknown[]) => unknown> | undefined>)[gancho]
      const llamada = partida?.[nombre]
      if (typeof llamada !== 'function') throw new Error(`la escena no ha dejado «${nombre}» en ${gancho}`)
      return llamada(...args)
    },
    [ganchoDePartida(), que, argumentos] as [string, string, unknown[]],
  ) as Promise<ReturnType<PartidaComun[K]>>
}

/** Si la escena ya ha dejado lo común en el gancho. */
export async function partidaLista(page: Page): Promise<boolean> {
  return page.evaluate((gancho) => {
    const partida = (window as unknown as Record<string, Record<string, unknown> | undefined>)[gancho]
    return ['start', 'score', 'end', 'cartel'].every((nombre) => typeof partida?.[nombre] === 'function')
  }, ganchoDePartida())
}

/** Gira la cabeza del visor emulado, en grados: a la izquierda y hacia arriba en positivo. */
export async function mirar(page: Page, giro: number, cabeceo = 0): Promise<void> {
  await page.evaluate(
    ([y, p]) => (window as unknown as { __xrTest: { lookAt: (y: number, p?: number) => void } }).__xrTest.lookAt(y, p),
    [giro, cabeceo] as const,
  )
}

/**
 * Un objetivo de ensayo con listones bajos, para cruzarlos con el gancho sin jugar: el bronce a 10,
 * la plata a 20 y el oro a 30 (a menos, al revés), y sin récord, que es la primera vez.
 */
export function objetivoDeEnsayo({ modo, mejorEs }: Ensayo): Objetivo {
  return {
    medallas: mejorEs === 'mas' ? { bronce: 10, plata: 20, oro: 30 } : { bronce: 30, plata: 20, oro: 10 },
    mejorEs,
    unidad: mejorEs === 'mas' ? 'points in challenge' : 'strokes',
    record: null,
    modo,
  }
}

/** Dónde caen las capturas comunes: `test-results/capturas/<juego>-<qué>.png`. */
export const CARPETA_DE_CAPTURAS = path.join(process.cwd(), 'test-results', 'capturas')

/** Guarda lo que se ve ahora con el nombre del juego delante, para mirar los diecisiete juntos. */
export async function capturar(page: Page, que: string): Promise<string> {
  mkdirSync(CARPETA_DE_CAPTURAS, { recursive: true })
  const ruta = path.join(CARPETA_DE_CAPTURAS, `${JUEGO}-${que}.png`)
  await page.screenshot({ path: ruta })
  return ruta
}
