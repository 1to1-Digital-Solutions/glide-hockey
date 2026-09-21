/**
 * Dónde va la salida en el panel de ajustes, y qué le falla cuando no está ahí.
 *
 * **La esquina de abajo a la derecha, la misma en los trece.** El dibujo ya se unificó —es la
 * flecha de volver de `FLECHA_DE_SALIR`— pero el **sitio** no: nueve juegos la tenían al final
 * de la fila de abajo, tres en la punta izquierda de esa fila y uno a media altura, en una
 * columna lateral. Con el visor puesto eso se nota como que hay que buscarla en cada cabina.
 * Reportado así: «el botón para salir debería estar siempre en el mismo sitio en el menú de
 * config (abajo siempre, o siempre a la izquierda o siempre a la derecha). Que depende del
 * juego, está en un lado o en otro».
 *
 * **Por qué abajo a la derecha y no otra.** Dos razones, y ninguna es estética:
 *
 * - Es donde ya estaba en nueve de los trece. Mover cuatro deja intacto lo que ya se sabe de
 *   memoria; elegir la otra punta habría obligado a reaprender nueve juegos para arreglar tres.
 * - Es la **fila de las acciones**, la que se mira al acabar de elegir: jugar está en medio de
 *   esa fila, así que salir no obliga a recorrer el panel con el rayo, solo a llegar al final
 *   de la fila que ya se está mirando. Fuera de esa fila —a media altura, en una columna— se
 *   cruza con lo que se está eligiendo y se pulsa sin querer, que es lo que ya enseñó el aviso
 *   de dejar la ronda.
 *
 * Como en `legibilidad.ts`, esto **devuelve frases y no un `false`**: un test que solo dijera
 * «la salida está mal» obligaría a abrir el reparto para saber qué mirar.
 */

/** Un botón del panel, en metros y desde el centro de la placa. */
export interface PanelBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Lo que mide la placa, para saber si la salida se sale por el borde. */
export interface PanelSize {
  readonly width: number
  readonly height: number
}

/**
 * El aire que se le permite a la comparación, en metros.
 *
 * Los repartos calculan posiciones con divisiones y sumas de constantes, así que dos botones
 * de la misma fila pueden no caer en la misma `y` por una milésima. Medio milímetro no es una
 * fila distinta y no tiene por qué serlo aquí.
 */
const PELO = 0.0005

export function problemasDeLaSalida(
  salida: PanelBox,
  resto: readonly PanelBox[],
  panel: PanelSize,
): string[] {
  const problemas: string[] = []

  if (salida.x <= 0) {
    problemas.push(
      `la salida está en la mitad izquierda del panel (x=${salida.x.toFixed(3)}): va a la derecha`,
    )
  }

  // Su fila es la que se solapa con ella de alto: las filas de arriba pueden llegar más a la
  // derecha —son filas de opciones que ocupan el panel entero— y eso no es un problema.
  const suFila = resto.filter(
    (otro) => Math.abs(otro.y - salida.y) < (otro.height + salida.height) / 2 - PELO,
  )
  const masALaDerecha = suFila.filter(
    (otro) => otro.x + otro.width / 2 > salida.x + salida.width / 2 + PELO,
  )
  if (masALaDerecha.length > 0) {
    problemas.push(
      `hay ${masALaDerecha.length} botón(es) de su misma fila más a la derecha que la salida: tiene que ser el último de la fila`,
    )
  }

  const masAbajo = resto.filter((otro) => otro.y < salida.y - PELO)
  if (masAbajo.length > 0) {
    problemas.push(
      `hay ${masAbajo.length} botón(es) por debajo de la salida: va en la fila de abajo del panel`,
    )
  }

  if (salida.x + salida.width / 2 > panel.width / 2 + PELO) {
    problemas.push('la salida se sale del panel por la derecha')
  }
  if (salida.y - salida.height / 2 < -panel.height / 2 - PELO) {
    problemas.push('la salida se sale del panel por abajo')
  }

  return problemas
}
