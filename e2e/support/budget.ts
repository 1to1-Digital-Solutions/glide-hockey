import paquete from '../../package.json'

/**
 * El presupuesto de llamadas de dibujo por fotograma que el juego declara en su manifiesto:
 * `xrcade.budget.drawCalls` de su `package.json`, fase a fase.
 *
 * **Por qué no va escrito en el spec.** Los techos vivían como `const TECHO_… = 45` en cada e2e,
 * sin que nadie más pudiera leerlos: ni el salón, que tenía su propia tabla aparte, ni quien
 * quisiera saber cuánto pinta un juego sin abrir sus tests. Ahora son un dato del manifiesto,
 * junto a `xrcade.capabilities`, y el salón comprueba que estén bien escritos en
 * `npm run catalog:validate` (`xrcade/src/lib/catalog/budget.ts`, que es donde está el formato).
 * El porqué de cada cifra —el desglose de lo que se pinta— sigue en el spec que la mide.
 *
 * Cada fase admite tres formas:
 * - un número: el techo;
 * - `{ "min", "max" }`: una banda, cuando lo medido depende de la física o del ritmo;
 * - `{ "measured", "margin" }`: la medida clavada con su margen, que es lo que avisa de que el
 *   desglose del spec se ha quedado viejo.
 *
 * Es el mismo fichero en todos los juegos (`organizate/scripts/repos/comunes.py`).
 */

/** Un límite ya resuelto: el techo, el suelo (cero si la fase no tiene) y la medida si la hay. */
export interface DrawCallLimit {
  min: number
  max: number
  measured?: number
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

/** El límite de una fase, tal y como lo declara el `package.json`. Falla si no está o no vale. */
export function drawCallBudget(phase: string): DrawCallLimit {
  const raw: unknown = paquete
  const phases = (raw as { xrcade?: { budget?: { drawCalls?: Record<string, unknown> } } }).xrcade?.budget?.drawCalls
  const limit = phases?.[phase]
  const where = `xrcade.budget.drawCalls.${phase} de package.json`
  if (isCount(limit) && limit > 0) return { min: 0, max: limit }
  if (typeof limit === 'object' && limit !== null) {
    const { min, max, measured, margin } = limit as Record<string, unknown>
    if (isCount(min) && isCount(max) && min <= max) return { min, max }
    if (isCount(measured) && isCount(margin) && margin <= measured) {
      return { min: measured - margin, max: measured + margin, measured }
    }
  }
  throw new Error(
    limit === undefined
      ? `falta ${where}: el presupuesto de esta fase se declara en el manifiesto del juego`
      : `${where} no es un techo, { "min", "max" } ni { "measured", "margin" }`,
  )
}
