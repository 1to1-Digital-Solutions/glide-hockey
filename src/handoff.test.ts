// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * El tamaño de `ESTADO.md`, vigilado.
 *
 * `ESTADO.md` se lee al empezar casi cada sesión, así que sus bytes se pagan una y otra vez. Sin
 * nada que avise, engorda con cada tanda hasta que lo que hace falta hoy queda enterrado entre
 * decisiones ya cerradas. Esto avisa: no juzga lo que pone, solo que quepa en lo que hace falta
 * para trabajar hoy. Lo que responde a «por qué está esto así» va a `docs/historial.md`, que no
 * se lee al empezar.
 *
 * Lo instala la suite de Organízate (perfil `xrcade-game`) y se regenera al re-sincronizar: se
 * cambia en `organizate/suite/catalog/templates/handoff.test.ts.tmpl`, no aquí.
 */

/** Ocho kilobytes son unos 2.000 tokens. Subirlo tiene que ser una decisión, no un descuido. */
const TOPE_BYTES = 8 * 1024

describe('ESTADO.md', () => {
  it('cabe en lo que hace falta para trabajar hoy', () => {
    const bytes = readFileSync(path.join(process.cwd(), 'ESTADO.md')).length
    expect(
      bytes,
      `ESTADO.md ocupa ${bytes} bytes y el tope son ${TOPE_BYTES}. Lo que ya está cerrado va a ` +
        'docs/historial.md; aquí solo el siguiente paso, lo pendiente de visor y lo que bloquea.',
    ).toBeLessThanOrEqual(TOPE_BYTES)
  })
})
