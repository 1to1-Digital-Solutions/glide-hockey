import type { ControllerButton } from '../../lib/tutorial'

/**
 * The drawing of a controller with one button highlighted, for the tutorial.
 *
 * **It is half of the lesson.** A phrase that says «el botón de agarre» only helps whoever
 * already knows which one it is; with the headset on, what is in the hand is a controller with
 * five buttons and none with its name written on it. Reported with the headset on: «if they have
 * to press the grab button, show which button that is, displaying a controller and marking which
 * one it is».
 *
 * It is drawn in strokes on the same 2D canvas as the rest of the panel and **nothing is
 * downloaded**: a controller model is 97 MB of package and a `.glb` from a CDN that the hall's
 * policy blocks (see `xr/xrStore.ts`). A recognisable controller is four strokes: the ring on
 * top, the body, the trigger at the front and the grab button on the inside.
 *
 * Everything in metres, like the rest of the panel, and centred on the point it is given.
 */

/** What the drawing measures, in metres: height of the controller from ring to base. */
export const CONTROLLER_HEIGHT = 0.18

/** Colours of the stroke: the controller switched off and the button in question. */
export interface ControllerColors {
  readonly body: string
  readonly highlight: string
}

/** Where each button falls inside the drawing, as a fraction of its height from the centre. */
const BUTTONS: Record<ControllerButton, { x: number; y: number; r: number }> = {
  // The trigger goes at the front, where the index finger is.
  gatillo: { x: -0.17, y: 0.06, r: 0.055 },
  // The grab one, on the side, where the fingers close.
  agarre: { x: 0.17, y: -0.04, r: 0.055 },
}

/**
 * Draws the controller centred on `(x, y)`, highlighting `button` if it is given one.
 *
 * The stroke scales with `CONTROLLER_HEIGHT`, so changing that number changes the whole
 * drawing without touching any sum here.
 */
export function drawController(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  button: ControllerButton | null,
  colors: ControllerColors,
): void {
  const u = CONTROLLER_HEIGHT
  ctx.save()
  ctx.translate(x, y)
  ctx.lineWidth = u * 0.045
  ctx.strokeStyle = colors.body
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // The tracking ring, on top: it is what makes a controller read as a controller.
  ctx.beginPath()
  ctx.arc(0, u * 0.3, u * 0.26, Math.PI * 0.15, Math.PI * 0.85, true)
  ctx.stroke()

  // The body: the handle, leaning back a little.
  ctx.beginPath()
  ctx.moveTo(-u * 0.1, u * 0.22)
  ctx.lineTo(-u * 0.05, -u * 0.34)
  ctx.lineTo(u * 0.12, -u * 0.34)
  ctx.lineTo(u * 0.12, u * 0.22)
  ctx.stroke()

  // The trigger, at the front, and the grab button, on the side: they are always drawn switched
  // off and the one in question is repainted lit on top.
  for (const [name, spot] of Object.entries(BUTTONS) as [ControllerButton, (typeof BUTTONS)[ControllerButton]][]) {
    const lit = name === button
    ctx.beginPath()
    ctx.arc(spot.x * u, spot.y * u, spot.r * u * (lit ? 1.6 : 1), 0, Math.PI * 2)
    ctx.fillStyle = lit ? colors.highlight : colors.body
    ctx.fill()
    // And a halo around the one in question: at one metre, a slightly fatter dot cannot be seen.
    if (!lit) continue
    ctx.beginPath()
    ctx.arc(spot.x * u, spot.y * u, spot.r * u * 2.8, 0, Math.PI * 2)
    ctx.strokeStyle = colors.highlight
    ctx.lineWidth = u * 0.035
    ctx.stroke()
  }

  ctx.restore()
}
