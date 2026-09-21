import { describe, expect, it } from 'vitest'
import { problemasDeLaSalida, type PanelBox } from './exitCorner'

/**
 * La regla de dónde va la salida, probada con cajas de mentira.
 *
 * Aquí no hay nada de este juego a propósito: lo que se comprueba es que la regla **sepa
 * decir qué falla**, porque es lo que va a leer quien la incumpla en cualquiera de los trece.
 * Que el panel de este juego la cumpla se comprueba en `menuLayout.test.ts`, con su reparto
 * de verdad.
 */

const PANEL = { width: 0.8, height: 1.0 }
const FILA_DE_ABAJO = -0.4

/** La salida donde manda la regla: al final de la fila de abajo. */
const SALIDA: PanelBox = { x: 0.28, y: FILA_DE_ABAJO, width: 0.16, height: 0.09 }
/** Y jugar, a su izquierda en la misma fila. */
const JUGAR: PanelBox = { x: 0, y: FILA_DE_ABAJO, width: 0.34, height: 0.09 }
/** Una fila de opciones de arriba, que ocupa el panel entero. */
const OPCION: PanelBox = { x: 0.34, y: 0.2, width: 0.12, height: 0.07 }

describe('dónde va la salida del panel', () => {
  it('al final de la fila de abajo no le falla nada', () => {
    expect(problemasDeLaSalida(SALIDA, [JUGAR, OPCION], PANEL)).toEqual([])
  })

  it('una fila de opciones que llega más a la derecha no cuenta: no es su fila', () => {
    // Las filas de opciones ocupan el panel de lado a lado; exigir que la salida las pasara
    // sería exigir que se saliera del panel.
    const masAncha: PanelBox = { ...OPCION, x: 0.37 }
    expect(problemasDeLaSalida(SALIDA, [JUGAR, masAncha], PANEL)).toEqual([])
  })

  it('en la mitad izquierda se canta, que es donde estaban cuatro de los trece', () => {
    const aLaIzquierda: PanelBox = { ...SALIDA, x: -0.28 }
    // Y arrastra la otra queja, que jugar le queda a la derecha: son dos frases porque son
    // dos cosas que mirar.
    expect(problemasDeLaSalida(aLaIzquierda, [JUGAR], PANEL)).toContainEqual(
      expect.stringContaining('mitad izquierda'),
    )
  })

  it('con un vecino de su fila más a la derecha, también', () => {
    const vecino: PanelBox = { x: 0.34, y: FILA_DE_ABAJO, width: 0.1, height: 0.09 }
    expect(problemasDeLaSalida(SALIDA, [JUGAR, vecino], PANEL)).toEqual([
      expect.stringContaining('más a la derecha'),
    ])
  })

  it('y fuera de la fila de abajo, otro tanto: a media altura se cruza con lo que se elige', () => {
    const aMediaAltura: PanelBox = { ...SALIDA, y: 0 }
    expect(problemasDeLaSalida(aMediaAltura, [JUGAR], PANEL)).toEqual([
      expect.stringContaining('por debajo de la salida'),
    ])
  })

  it('asomando por el borde derecho se canta aparte: ahí el rayo ya no la alcanza entera', () => {
    const asomando: PanelBox = { ...SALIDA, x: 0.38 }
    expect(problemasDeLaSalida(asomando, [JUGAR], PANEL)).toEqual([
      expect.stringContaining('por la derecha'),
    ])
  })

  it('y asomando por abajo, igual', () => {
    const asomando: PanelBox = { ...SALIDA, y: -0.49 }
    expect(problemasDeLaSalida(asomando, [], PANEL)).toEqual([
      expect.stringContaining('por abajo'),
    ])
  })

  it('dice todo lo que falla de una vez, que arreglarlo de uno en uno son tres vueltas', () => {
    const malDeltodo: PanelBox = { x: -0.3, y: 0.3, width: 0.16, height: 0.09 }
    expect(problemasDeLaSalida(malDeltodo, [JUGAR], PANEL)).toHaveLength(2)
  })
})
