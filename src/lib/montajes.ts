/**
 * Contar cuántas veces se monta cada trozo de la escena.
 *
 * «La pantalla parpadea al entrar» es lo que más veces se ha reportado del visor y lo único
 * que nunca se ha podido reproducir desde una pantalla. Se quitó una causa posible —la
 * demostración del gesto repintando el árbol entero noventa veces por segundo— y en dos
 * juegos desapareció; en este no. Así que la causa de este es otra, y adivinar la siguiente
 * cuesta otra tanda de pruebas con las gafas puestas.
 *
 * Esto no arregla el parpadeo: lo convierte en un número. Si al entrar en la sesión el mundo
 * se monta dos veces, eso **es** un parpadeo —React tira el árbol y lo vuelve a construir, y
 * eso en un visor se ve como un fogonazo—, y se ve aquí sin ponerse nada en la cabeza. Si se
 * monta una sola vez, el parpadeo no es un remontaje y hay que buscarlo en otro sitio, que
 * también es saber algo.
 *
 * Solo cuenta **si alguien lo pide**: el test crea `window.__montajes` antes de cargar la
 * página. En una partida de verdad esto no hace nada.
 */

declare global {
  interface Window {
    __montajes?: Record<string, number>
    /** Cuántos programas de shader lleva compilados el renderer. Ver `apuntarProgramas`. */
    __programas?: number
  }
}

/** ¿Alguien está contando montajes? */
export function isMontajesRequested(): boolean {
  return typeof window !== 'undefined' && window.__montajes != null
}

/**
 * Apunta que `que` se acaba de montar.
 *
 * Se llama desde un efecto sin dependencias, que es el sitio donde React avisa de un montaje
 * y de uno solo. En modo estricto de desarrollo los efectos corren dos veces a propósito, así
 * que este número se lee en producción —que es como se exporta al visor—.
 */
export function contarMontaje(que: string): void {
  if (!isMontajesRequested()) return
  const cuenta = window.__montajes
  /* v8 ignore next -- lo garantiza `isMontajesRequested`, pero el tipo no lo sabe */
  if (cuenta == null) return
  cuenta[que] = (cuenta[que] ?? 0) + 1
}

/**
 * Cuántos programas de shader lleva compilados el renderer.
 *
 * El otro sospechoso del parpadeo, y el que sí dio algo: al abrir la sesión se compilaban
 * **tres programas nuevos** —los materiales que solo existen dentro del visor: los paneles,
 * el mando dibujado— y compilar un shader bloquea el hilo. En una pantalla eso es un
 * fotograma perdido; en un visor, a 72 por segundo y por ojo, es un fogonazo.
 *
 * Se apunta para poder decir en un test **cuántos quedan por compilar cuando la sesión ya
 * está abierta**, que es lo que hay que mantener en cero.
 */
export function apuntarProgramas(cuantos: number): void {
  if (!isMontajesRequested()) return
  window.__programas = cuantos
}
