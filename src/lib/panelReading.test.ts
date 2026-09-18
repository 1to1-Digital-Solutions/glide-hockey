import { describe, expect, it } from 'vitest'
import { Euler, Quaternion, Vector3 } from 'three'
import {
  EYE_HEIGHTS,
  MIN_READING_DEGREES,
  centreInside,
  distanceFromEyes,
  eyesAt,
  facingEyes,
  letterAngle,
  noTextOwnsAButton,
  panelRotation,
  pointOnPanel,
  readingDistance,
  rotate,
  sizesOffList,
  textsOnButtons,
  tiltTowardEyes,
  unreadableTexts,
  worstReadingDistance,
  worstText,
  type EulerOrder,
  type WrittenText,
} from './panelReading'

/**
 * Lo que ocupa en el ojo una letra de un panel, sin navegador.
 *
 * Las cuentas se comparan con three —la escena gira los paneles con él— y con lo que ocupa una
 * letra de frente, que es la cuenta de siempre: si una fila lejana o un panel de canto no
 * ocuparan menos, medir con el escorzo no serviría de nada.
 */

const OJOS = eyesAt(1.6)

/** Cuánto ocupa en el ojo algo de ese alto a esa distancia, de frente, en grados. */
function deFrente(alto: number, distancia: number): number {
  return (2 * Math.atan(alto / 2 / distancia) * 180) / Math.PI
}

/** Un texto apuntado como lo apunta el lienzo, con el alto de caja de una letra de `letra` metros. */
function escrito(texto: string, x: number, y: number, letra: number, lineHeight = 0.8): WrittenText {
  return { texto, x, y, ancho: texto.length * letra * 0.62, alto: letra * lineHeight }
}

describe('un panel girado como lo gira three', () => {
  const ORDENES: EulerOrder[] = ['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX']

  it('cada orden gira un punto igual que un Euler de three', () => {
    for (const orden of ORDENES) {
      const giro = [0.3, -0.7, 0.2, orden] as const
      const esperado = new Vector3(0.2, -0.35, 0.1).applyQuaternion(new Quaternion().setFromEuler(new Euler(...giro)))
      const punto = rotate({ x: 0.2, y: -0.35, z: 0.1 }, giro)
      expect(esperado.distanceTo(new Vector3(punto.x, punto.y, punto.z)), orden).toBeLessThan(1e-12)
    }
  })

  it('sin orden es XYZ, y sin giro no se mueve', () => {
    expect(rotate({ x: 1, y: 2, z: 3 }, [0.4, 0.5, 0.6])).toEqual(rotate({ x: 1, y: 2, z: 3 }, [0.4, 0.5, 0.6, 'XYZ']))
    expect(rotate({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('un punto del panel cae donde three lo pondría colgado de un grupo con ese sitio y ese giro', () => {
    const pose = { position: [0.7, 1.3, -1.1], rotation: [-0.2, -0.5, 0.1, 'YXZ'] } as const
    const esperado = new Vector3(0.25, -0.3, 0)
      .applyQuaternion(new Quaternion().setFromEuler(new Euler(...pose.rotation)))
      .add(new Vector3(...pose.position))
    const punto = pointOnPanel(pose, 0.25, -0.3)
    expect(esperado.distanceTo(new Vector3(punto.x, punto.y, punto.z))).toBeLessThan(1e-12)
  })
})

describe('de cara a los ojos e inclinado hacia ellos', () => {
  it('la cara del panel apunta a los ojos, esté por debajo, a la altura o por encima', () => {
    for (const sitio of [
      [-0.6, 0.8, -0.7],
      [0.6, 1.6, -0.7],
      [0.8, 2.1, -1.1],
      [0, 1.5, -1.15],
    ] as const) {
      for (const altura of EYE_HEIGHTS) {
        const ojos = eyesAt(altura)
        const [x, y, z, orden] = panelRotation(sitio, ojos)
        const cara = new Vector3(0, 0, 1).applyEuler(new Euler(x, y, z, orden))
        const alOjo = new Vector3(ojos.x - sitio[0], ojos.y - sitio[1], ojos.z - sitio[2]).normalize()
        expect(cara.dot(alOjo), `${sitio.join(', ')} con los ojos a ${altura}`).toBeCloseTo(1, 10)
      }
    }
  })

  it('a la altura de los ojos no se inclina, y delante no se gira', () => {
    expect(tiltTowardEyes([0, 1.6, -1], OJOS)).toBeCloseTo(0, 12)
    expect(facingEyes([0, 1.2, -1], OJOS)).toBeCloseTo(0, 12)
  })

  it('la distancia a los ojos cuenta la altura, no solo la planta', () => {
    expect(distanceFromEyes([0, 1.6, -1], OJOS)).toBeCloseTo(1, 12)
    expect(distanceFromEyes([0, 0.85, -1], OJOS)).toBeCloseTo(1.25, 12)
  })
})

describe('lo que ocupa una letra en el ojo', () => {
  it('en el centro de un panel que mira a los ojos, lo mismo que de frente a esa distancia', () => {
    const position = [-0.6, 0.8, -0.8] as const
    const pose = { position, rotation: panelRotation(position, OJOS) }
    const d = distanceFromEyes(position, OJOS)
    expect(letterAngle(pose, OJOS, 0, 0, 0.034)).toBeCloseTo(deFrente(0.034, d), 6)
    expect(readingDistance(pose, OJOS, 0, 0, 0.034)).toBeCloseTo(d, 6)
  })

  it('en una fila lejos del centro, menos: está más lejos y se ve de refilón', () => {
    const position = [0, 1.5, -1.15] as const
    const pose = { position, rotation: panelRotation(position, OJOS) }
    expect(letterAngle(pose, OJOS, -0.3, 0.48, 0.034)).toBeLessThan(letterAngle(pose, OJOS, 0, 0, 0.034))
    expect(readingDistance(pose, OJOS, -0.3, 0.48, 0.034)).toBeGreaterThan(distanceFromEyes(position, OJOS))
  })

  it('el control: un panel de canto por debajo de la vista lee la letra escorzada', () => {
    // Girado solo alrededor de la vertical, un metro por debajo de los ojos y a uno de ellos.
    const position = [0, 0.6, -1] as const
    const deCanto = letterAngle({ position }, OJOS, 0, 0, 0.034)
    const inclinado = letterAngle({ position, rotation: panelRotation(position, OJOS) }, OJOS, 0, 0, 0.034)
    expect(deCanto).toBeLessThan(inclinado * 0.75)
  })
})

describe('medir lo que escribe un panel', () => {
  const position = [0, 1.6, -1] as const
  const pose = { position, rotation: panelRotation(position, OJOS) }
  const grande = escrito('Jugar', 0, 0.1, 0.04)
  const pequeno = escrito('Salir', 0.1, -0.1, 0.02)

  it('canta la letra que no llega, con su tamaño y sus grados', () => {
    expect(MIN_READING_DEGREES).toBe(1.4)
    expect(unreadableTexts([grande, pequeno], pose, OJOS, 0.8)).toEqual([
      `«Salir» a 20.0 mm ocupa ${letterAngle(pose, OJOS, 0.1, -0.1, 0.02).toFixed(2)}°`,
    ])
    // Con un mínimo más bajo, pasa.
    expect(unreadableTexts([pequeno], pose, OJOS, 0.8, 1)).toEqual([])
  })

  it('dice cuál se lee peor y a qué distancia hay que medir el panel', () => {
    expect(worstText([grande, pequeno], pose, OJOS, 0.8)).toEqual({
      texto: 'Salir',
      degrees: letterAngle(pose, OJOS, 0.1, -0.1, 0.02),
    })
    expect(worstText([pequeno, grande], pose, OJOS, 0.8)?.texto).toBe('Salir')
    expect(worstText([], pose, OJOS, 0.8)).toBeNull()
    expect(worstReadingDistance([grande, pequeno], pose, OJOS, 0.8)).toBeCloseTo(
      readingDistance(pose, OJOS, 0.1, -0.1, 0.02),
      12,
    )
  })

  it('canta el tamaño que no está en la lista', () => {
    expect(sizesOffList([grande, pequeno], 0.8, [0.04, 0.034])).toEqual(['«Salir» a 20.0 mm'])
  })

  it('canta el texto que se mete en un botón que no es el suyo', () => {
    const botones = [
      { x: 0, y: 0.1, width: 0.3, height: 0.1 },
      { x: 0, y: 0.06, width: 0.3, height: 0.06 },
    ]
    // «Jugar» es la etiqueta del primero y se mete en el de abajo.
    expect(textsOnButtons([grande], botones)).toEqual(['«Jugar» se mete en el botón de (0.00, 0.06)'])
    // Uno que no toca ninguno no se canta.
    expect(textsOnButtons([escrito('Lejos', 0, -0.4, 0.04)], botones)).toEqual([])
  })

  it('en un panel de rótulos, ni siquiera el que tiene el centro dentro es de un botón', () => {
    const boton = { x: -0.28, y: 0.48, width: 0.11, height: 0.11 }
    const rotulo = escrito('Modo', -0.3, 0.43, 0.03)
    expect(centreInside(rotulo, boton)).toBe(true)
    expect(textsOnButtons([rotulo], [boton])).toEqual([])
    expect(textsOnButtons([rotulo], [boton], noTextOwnsAButton)).toEqual(['«Modo» se mete en el botón de (-0.28, 0.48)'])
  })
})
