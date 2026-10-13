/**
 * El azar del reto, con semilla: lo que hace que dos personas jueguen la misma partida.
 *
 * Es el mismo fichero en todos los juegos del salón (`comunes.py` lo vigila). El salón le pasa a
 * la escena un `reto` con una semilla —el reto del día, o el código de «reta mi puntuación»— y
 * todo lo que el reto sortea sale de aquí en vez de `Math.random`: qué plato sale, hacia dónde
 * lanza la máquina, cuándo asoma el topo. Misma semilla, misma partida.
 *
 * Todo es puro: ni React, ni three, ni reloj. En Godot, el mismo algoritmo da los mismos números.
 */

/** Lo que el salón le pasa a la escena para jugar un reto concreto. */
export type Reto = {
  /** Entero de 32 bits sin signo. */
  readonly semilla: number
}

/** Lo que la escena le cuenta al salón al acabar una partida con puntuación. */
export type Resultado = {
  /** El modo tal como lo llama el juego (`challenge`, `classic`, `match`…). */
  readonly modo: string
  /** Los puntos de esta partida, aunque no sean récord, en la unidad del récord del manifiesto. */
  readonly puntos: number
  /** Si la partida era el `reto` que pasó el salón. */
  readonly reto: boolean
  /**
   * Las hazañas conseguidas por primera vez en esta partida, por su nombre de API de Steam
   * (`docs/logros-de-steam.md` del salón). Opcional porque la mayoría de partidas no estrena
   * ninguna y hay juegos que no tienen: el salón es quien las filtra, las guarda y las anuncia.
   */
  readonly hazanas?: readonly string[]
}

/**
 * Un generador de números en [0, 1) a partir de una semilla (mulberry32).
 *
 * Mulberry32 porque es corto, rápido y ya era el que usaban los juegos que sembraban algo: pasa
 * las pruebas estadísticas que importan para sortear platos y topos, que no es criptografía.
 */
export function azarDesde(semilla: number): () => number {
  let estado = semilla >>> 0
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Una semilla derivada de otra y de unos cuantos enteros (la ronda, el número de palo…).
 *
 * Para que cada ronda del reto tenga su propio azar sin depender de cuántos números se sacaron en
 * la anterior: si un jugador falla y el otro no, la ronda siguiente sigue siendo la misma para los
 * dos. Mezcla con la constante de Knuth y un paso de mulberry32, que reparte bien semillas
 * consecutivas.
 */
export function semillaDe(semilla: number, ...partes: readonly number[]): number {
  let h = semilla >>> 0
  for (const parte of partes) {
    h = Math.imul(h ^ (parte >>> 0), 0x9e3779b1) >>> 0
    h = (h ^ (h >>> 16)) >>> 0
  }
  return Math.floor(azarDesde(h)() * 4294967296) >>> 0
}

/** Una semilla nueva para cuando no hay reto: la partida normal sigue siendo distinta cada vez. */
export function semillaAlAzar(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0
}
