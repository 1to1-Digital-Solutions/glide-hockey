/**
 * Los colores que **significan algo**, y significan lo mismo en todo el salón.
 *
 * Es el mismo fichero en todos los juegos (`comunes.py` lo vigila). Cada juego conserva su
 * escenario y sus colores —el cian de la mesa, el naranja de la feria, el latón del bar—, que son
 * su personalidad y siguen en su `palette.ts` o junto al componente que los pinta. Lo que vive
 * aquí es lo otro: el verde que dice «esto ha contado», el rojo que dice «esto se ha perdido», el
 * amarillo que dice «ojo», las medallas y los neutros con los que se escribe en un panel. Si el
 * verde de acertar fuera uno en los dardos y otro en los topos, el salón se leería como dieciséis
 * demos sueltas en vez de como un solo sitio, y quien pasa de un juego a otro tendría que volver a
 * aprender qué quiere decir cada cosa.
 *
 * Nada de React ni de three: los mismos literales los piden el CSS de la web, los materiales de la
 * escena y los lienzos de los paneles del visor, y el port a Godot los copia tal cual.
 */

export const PALETA = {
  /**
   * Lo que ha contado: el topo que recibe, la partida ganada, el golpe que entra.
   *
   * Sale del verde de acierto de los topos, que ya había demostrado leerse con el mazo en el aire.
   * Es claro a propósito: sobre cualquier fondo de panel del salón pasa de 10:1.
   */
  acierto: '#7ae582',
  /**
   * Lo que se ha perdido o amenaza: el topo que se escapa, la partida perdida, pasarse.
   *
   * Es el rojo de escapado de los topos aclarado hasta pasar de 5:1 sobre cualquier panel del
   * salón: también se escribe como texto, y un rojo más oscuro se queda en el mínimo o por debajo
   * en los paneles más claros. Tiene que distinguirse del verde **sin ver el color** —por luz—,
   * que es lo único que queda para quien no separa el rojo del verde (lo mide el test).
   */
  fallo: '#ff5a4f',
  /**
   * Ojo, que esto va a pasar: los últimos segundos, un aviso antes de que algo se pierda.
   *
   * El `--color-aviso` del salón (`xrcade/src/app/globals.css`).
   */
  aviso: '#ffc24d',

  /** Los neutros de los paneles del salón (`xrcade/src/components/salon/theme.ts`). */
  fondo: '#0b0a12',
  /** Texto principal sobre el fondo. */
  texto: '#edeafd',
  /** Lo secundario, lo apagado, lo que todavía no se puede elegir. */
  textoSuave: '#a6a1cc',
  /** El borde de un panel y la separación entre sus partes. */
  borde: '#2b2748',

  /**
   * El acento del salón: lo apuntado, lo encendido, lo que se va a pulsar.
   *
   * Es el menta del marco de la cabina encendida en el salón. Que el realce de un botón apuntado
   * sea el mismo en los dieciséis juegos es lo que hace que el gesto se aprenda una vez.
   */
  acento: '#5ee6c0',

  /**
   * Las medallas, idénticas a las del salón (`MEDAL_COLORS` de su `theme.ts`): una chapa de oro en
   * un juego y la de la cabina del salón tienen que ser el mismo oro. Aclaradas respecto al metal
   * de verdad porque se escriben sobre fondo oscuro, y el oro es también el color de lo que se
   * gana —estrellas, récords—.
   */
  bronce: '#e39a64',
  plata: '#d3d9e6',
  oro: '#f6c945',
} as const

/** El nombre de cada color común. */
export type ColorComun = keyof typeof PALETA

/**
 * El contraste entre dos colores según WCAG 2.2 (de 1 a 21).
 *
 * Está aquí y no solo en los tests porque cada juego tiene que comprobar los colores comunes
 * **sobre sus propios paneles**, que no son el fondo del salón: el verde de acierto que se lee en
 * uno se puede apagar en el de al lado.
 */
export function contraste(a: string, b: string): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** La luminancia relativa de un `#rrggbb`, con la fórmula de WCAG. */
function luminancia(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`Not a #rrggbb color: ${hex}`)
  const [r, g, b] = [1, 3, 5].map((i) => {
    const canal = parseInt(hex.slice(i, i + 2), 16) / 255
    return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/*
 * Los materiales base: parámetros, no materiales.
 *
 * Son objetos planos que se extienden sobre el material de R3F
 * (`<meshBasicMaterial {...materialEncendido(PALETA.acierto)} />`). Así el módulo no instancia three
 * —se puede importar desde un test o desde el servidor— y cada material que se pinta sigue siendo
 * uno por malla. Lo que fijan es lo que se equivoca al escribirlo a mano.
 */

/** Un material mate, sin brillo ni metal: el de las piezas low-poly de colores planos del kit. */
export function materialMate(color: string): { color: string; roughness: 1; metalness: 0 } {
  return { color, roughness: 1, metalness: 0 }
}

/**
 * Un color que se ve **tal cual**, sin luz ni corrección de tono: lo de los paneles y las señales.
 *
 * Sin `toneMapped: false` three le aplica la curva de tono de la escena y el verde de acierto
 * sale apagado y distinto en cada juego, que es justo lo que la paleta existe para evitar.
 */
export function materialEncendido(color: string): { color: string; toneMapped: false } {
  return { color, toneMapped: false }
}

/**
 * Un color translúcido: ondas, velos, realces que dejan ver lo de detrás.
 *
 * Lleva `depthWrite: false` siempre. Un material transparente de three **escribe profundidad**
 * aunque se vea a través de él, y entonces borra todo lo que queda detrás: es lo que deja un botón
 * «sin color», como apagado (`.claude/rules/xr.md`).
 */
export function materialTranslucido(
  color: string,
  opacidad: number,
): { color: string; transparent: true; opacity: number; depthWrite: false; toneMapped: false } {
  if (!(opacidad >= 0 && opacidad <= 1)) throw new RangeError(`Opacity out of [0, 1]: ${opacidad}`)
  return { color, transparent: true, opacity: opacidad, depthWrite: false, toneMapped: false }
}
