import { describe, expect, it } from 'vitest'

import { hiddenByPanel, panelPoints, tablePoints, whatThePanelHides } from './panelOcclusion'
import { eyesAt, type PanelPose } from './panelReading'
import { TABLE_CENTER_Z, TABLE_HEIGHT } from './gameConfig'
import { HALF_LENGTH, HALF_WIDTH } from './puckPhysics'

/**
 * El instrumento que dice qué tapa un panel, probado con un panel de mentira: una placa de
 * 40 × 40 cm a un metro delante de unos ojos en el origen. Con números redondos se ve a simple
 * vista si la respuesta es la buena, que es justo lo que no pasa con las cotas del juego.
 */
const OJOS = eyesAt(0)
const PANEL: PanelPose = { position: [0, 0, -1] }
const MEDIDAS = { width: 0.4, height: 0.4 }

describe('lo que tapa un panel', () => {
  it('tapa lo que queda justo detrás', () => {
    expect(hiddenByPanel(PANEL, MEDIDAS, OJOS, { x: 0, y: 0, z: -2 })).toBe(true)
  })

  it('no tapa lo que está entre los ojos y él', () => {
    expect(hiddenByPanel(PANEL, MEDIDAS, OJOS, { x: 0, y: 0, z: -0.5 })).toBe(false)
  })

  it('no tapa lo que está a la espalda: el panel no está en medio, está detrás de los ojos', () => {
    expect(hiddenByPanel(PANEL, MEDIDAS, OJOS, { x: 0, y: 0, z: 2 })).toBe(false)
  })

  it('no tapa lo que se sale de su ancho', () => {
    // El rayo cruza su plano a 50 cm del centro, y la placa llega a 20.
    expect(hiddenByPanel(PANEL, MEDIDAS, OJOS, { x: 1, y: 0, z: -2 })).toBe(false)
  })

  it('ni lo que se sale de su alto', () => {
    expect(hiddenByPanel(PANEL, MEDIDAS, OJOS, { x: 0, y: 1, z: -2 })).toBe(false)
  })

  /**
   * Y cuenta el giro, que es lo que hace falta: los paneles se plantan de cara a los ojos e
   * inclinados hacia ellos, y girado el mismo panel deja de llegar adonde llegaba de frente.
   */
  it('girado, lo que rozaba su borde se le escapa', () => {
    const rozando = { x: 0.35, y: 0, z: -2 }
    const girado: PanelPose = { position: [0, 0, -1], rotation: [0, Math.PI / 6, 0] }
    expect(hiddenByPanel(PANEL, MEDIDAS, OJOS, rozando)).toBe(true)
    expect(hiddenByPanel(girado, MEDIDAS, OJOS, rozando)).toBe(false)
  })
})

describe('las frases que devuelve', () => {
  it('dicen qué se tapa y en cuántos puntos, y callan lo que se ve entero', () => {
    const detras = [
      { x: 0, y: 0, z: -2 },
      { x: 0, y: 0.1, z: -2 },
      { x: 3, y: 0, z: -2 },
    ]
    expect(
      whatThePanelHides(PANEL, MEDIDAS, OJOS, [
        { what: 'la mesa', points: detras },
        { what: 'el marcador', points: [{ x: 3, y: 0, z: -2 }] },
      ]),
    ).toEqual(['el panel tapa la mesa en 2 de 3 puntos'])
  })
})

describe('las rejillas', () => {
  it('la del tablero cubre la mesa entera, esquinas incluidas', () => {
    const puntos = tablePoints(4)
    expect(puntos).toHaveLength(25)
    expect(puntos.every((p) => p.y === TABLE_HEIGHT)).toBe(true)
    expect(Math.min(...puntos.map((p) => p.x))).toBeCloseTo(-HALF_WIDTH)
    expect(Math.max(...puntos.map((p) => p.x))).toBeCloseTo(HALF_WIDTH)
    expect(Math.min(...puntos.map((p) => p.z))).toBeCloseTo(TABLE_CENTER_Z - HALF_LENGTH)
    expect(Math.max(...puntos.map((p) => p.z))).toBeCloseTo(TABLE_CENTER_Z + HALF_LENGTH)
  })

  it('la de un panel cubre su cara entera', () => {
    const puntos = panelPoints([1, 2, 3], { width: 0.4, height: 0.2 }, 2)
    expect(puntos).toHaveLength(9)
    expect(puntos.every((p) => p.z === 3)).toBe(true)
    expect(Math.min(...puntos.map((p) => p.x))).toBeCloseTo(0.8)
    expect(Math.max(...puntos.map((p) => p.x))).toBeCloseTo(1.2)
    expect(Math.min(...puntos.map((p) => p.y))).toBeCloseTo(1.9)
    expect(Math.max(...puntos.map((p) => p.y))).toBeCloseTo(2.1)
  })
})
