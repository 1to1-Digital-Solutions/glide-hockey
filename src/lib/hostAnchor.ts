/**
 * El anclaje que presta el anfitrión: dónde planta el mundo del juego y con qué rumbo.
 *
 * **Por qué no siempre vale la mirada.** Un juego solo en su web abre él la sesión y no sabe
 * nada de quien entra, así que planta el decorado delante de donde mira: es lo único que
 * garantiza que no salga por la espalda. Dentro del salón ya se sabe más —el arco de cabinas
 * lleva plantado un rato, con su sitio y su rumbo—, y ahí la mirada es la peor de las dos
 * pistas: para elegir una cabina de las de la izquierda hay que girar la cabeza, y anclando a
 * eso el juego sale girado hacia donde se giró, o sea de lado respecto del cuerpo. Con el
 * visor puesto eso obliga a girarse entero o a recentrar la sala, que es lo que se reportó.
 *
 * Así que el anfitrión puede prestar el suyo, y el juego lo usa **solo en la primera
 * colocación**: a partir de ahí manda la mirada. Recentrar recoloca el espacio de referencia
 * entero y deja lo prestado apuntando a donde ya no hay nada, así que el gesto que recoloca
 * la sala tiene que ganar a los dos.
 *
 * Lo que NO se hereda es la altura: la pone cada juego —la mesa, el tee, el suelo del prado—
 * y el anfitrión solo sabe del suelo.
 *
 * Es el mismo fichero en los trece juegos y en el salón (lo vigila `comunes.py`): es el
 * contrato entre los dos lados, y una copia que se aparte cambiaría en silencio dónde
 * aparece el juego, sin romper nada que se vea desde una pantalla.
 */

/** Dónde se planta el mundo: el punto del suelo y el rumbo de su frente. */
export interface Placement {
  /** En el espacio del origen que pone el anfitrión, en metros. */
  x: number
  z: number
  /** Adónde mira el frente de la escena (su −Z), en radianes sobre el eje vertical. */
  yaw: number
}

/** El anclaje tal y como se lo pasa el anfitrión a la escena que monta. */
export interface HostAnchor {
  /** Los pies de quien juega, en el espacio del anfitrión: `[x, y, z]`, en metros. */
  position: readonly [number, number, number]
  /** El rumbo de su frente, en radianes sobre el eje vertical. */
  yaw: number
}

/**
 * Con qué se planta el mundo esta vez.
 *
 * @param lent Lo que presta el anfitrión mientras no se haya usado. `null` si no presta nada
 *   —la web propia del juego— o si ya se gastó en la primera colocación, que es lo que deja
 *   mandar a la mirada en cuanto se recentra la sala.
 * @param feet Dónde están los pies de quien juega ahora.
 * @param gazeYaw El rumbo que sale de su mirada ahora.
 */
export function entryPlacement(
  lent: HostAnchor | null | undefined,
  feet: { x: number; z: number },
  gazeYaw: number,
): Placement {
  if (lent == null) return { x: feet.x, z: feet.z, yaw: gazeYaw }
  return { x: lent.position[0], z: lent.position[2], yaw: lent.yaw }
}
