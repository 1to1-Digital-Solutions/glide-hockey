import type { ControllerButton } from '../../lib/tutorial'

/**
 * El dibujo de un mando con un botón resaltado, para el tutorial.
 *
 * **Es la mitad de la lección.** Una frase que dice «el botón de agarre» solo sirve a quien ya
 * sabe cuál es; con el visor puesto lo que hay en la mano es un mando con cinco botones y
 * ninguno con su nombre escrito. Reportado con el visor puesto: «si tiene que pulsar el botón
 * de agarrar, indicar cuál es ese botón, mostrando un mando y remarcando cuál es».
 *
 * Se dibuja a trazos en el mismo lienzo 2D que el resto del panel y **no se descarga nada**:
 * un modelo del mando son 97 MB de paquete y un `.glb` de un CDN que la política del salón
 * bloquea (ver `xr/xrStore.ts`). Un mando reconocible son cuatro trazos: el aro de arriba, el
 * cuerpo, el gatillo por delante y el agarre por dentro.
 *
 * Todo en metros, como el resto del panel, y centrado en el punto que se le pase.
 */

/** Lo que mide el dibujo, en metros: alto del mando de aro a base. */
export const ALTO_DEL_MANDO = 0.18

/** Colores del trazo: el mando apagado y el botón que toca. */
export interface ColoresDelMando {
  readonly cuerpo: string
  readonly resaltado: string
}

/** Dónde cae cada botón dentro del dibujo, en fracción de su alto desde el centro. */
const BOTONES: Record<ControllerButton, { x: number; y: number; r: number }> = {
  // El gatillo va por delante, donde el índice.
  gatillo: { x: -0.17, y: 0.06, r: 0.055 },
  // El de agarre, en el costado, donde cierran los dedos.
  agarre: { x: 0.17, y: -0.04, r: 0.055 },
}

/**
 * Dibuja el mando centrado en `(x, y)`, resaltando `boton` si se le da uno.
 *
 * El trazo se escala con `ALTO_DEL_MANDO`, así que cambiar ese número cambia el dibujo
 * entero sin tocar ninguna cuenta de aquí.
 */
export function dibujarMando(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  boton: ControllerButton | null,
  colores: ColoresDelMando,
): void {
  const u = ALTO_DEL_MANDO
  ctx.save()
  ctx.translate(x, y)
  ctx.lineWidth = u * 0.045
  ctx.strokeStyle = colores.cuerpo
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // El aro de seguimiento, arriba: es lo que hace que un mando se lea como un mando.
  ctx.beginPath()
  ctx.arc(0, u * 0.3, u * 0.26, Math.PI * 0.15, Math.PI * 0.85, true)
  ctx.stroke()

  // El cuerpo: la empuñadura, un poco caída hacia atrás.
  ctx.beginPath()
  ctx.moveTo(-u * 0.1, u * 0.22)
  ctx.lineTo(-u * 0.05, -u * 0.34)
  ctx.lineTo(u * 0.12, -u * 0.34)
  ctx.lineTo(u * 0.12, u * 0.22)
  ctx.stroke()

  // El gatillo, por delante, y el agarre, en el costado: se dibujan siempre apagados y el
  // que toca se repinta encendido encima.
  for (const [nombre, sitio] of Object.entries(BOTONES) as [ControllerButton, (typeof BOTONES)[ControllerButton]][]) {
    const encendido = nombre === boton
    ctx.beginPath()
    ctx.arc(sitio.x * u, sitio.y * u, sitio.r * u * (encendido ? 1.6 : 1), 0, Math.PI * 2)
    ctx.fillStyle = encendido ? colores.resaltado : colores.cuerpo
    ctx.fill()
    // Y un halo alrededor del que toca: a un metro, un punto un poco más gordo no se ve.
    if (!encendido) continue
    ctx.beginPath()
    ctx.arc(sitio.x * u, sitio.y * u, sitio.r * u * 2.8, 0, Math.PI * 2)
    ctx.strokeStyle = colores.resaltado
    ctx.lineWidth = u * 0.035
    ctx.stroke()
  }

  ctx.restore()
}
