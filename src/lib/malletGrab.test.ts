import { describe, expect, it } from 'vitest'
import { ALCANCE_DE_AGARRE, siguienteAgarre, type AgarreDelMazo } from './malletGrab'

/**
 * Lo que se comprueba aquí es cómo se siente coger el mazo, que es lo que el rayo hacía
 * mal: el mazo tiene que ir donde va la mano y no donde se apunta.
 */
const enReposo: AgarreDelMazo = { cogido: false, destino: { x: 0, z: 0.6 } }

describe('coger el mazo', () => {
  it('apretar con la mano encima lo coge', () => {
    const despues = siguienteAgarre(enReposo, {
      posicion: { x: 0.02, z: 0.62 },
      agarrando: true,
    })

    expect(despues.cogido).toBe(true)
    expect(despues.destino).toEqual({ x: 0.02, z: 0.62 })
  })

  it('apretar desde lejos no lo trae a la mano', () => {
    // Es lo que lo devolvería a ser un cursor: el mazo cruzando media mesa de un salto
    // porque alguien apretó un botón mirando hacia allí.
    const despues = siguienteAgarre(enReposo, {
      posicion: { x: 0.5, z: -0.4 },
      agarrando: true,
    })

    expect(despues.cogido).toBe(false)
    expect(despues.destino).toEqual(enReposo.destino)
  })

  it('la mano no tiene que caer exacta encima', () => {
    const justo = { x: enReposo.destino.x, z: enReposo.destino.z + ALCANCE_DE_AGARRE - 0.001 }
    expect(siguienteAgarre(enReposo, { posicion: justo, agarrando: true }).cogido).toBe(true)
  })

  it('sin apretar no se coge, por muy encima que esté la mano', () => {
    const despues = siguienteAgarre(enReposo, { posicion: enReposo.destino, agarrando: false })
    expect(despues.cogido).toBe(false)
  })
})

describe('sostener el mazo', () => {
  const cogido: AgarreDelMazo = { cogido: true, destino: { x: 0, z: 0.6 } }

  it('sigue a la mano vaya donde vaya', () => {
    // Sin esto se soltaría en pleno golpe, que es cuando la mano va más rápido y más
    // lejos: el radio de agarre solo decide cuándo se coge, no cuándo se suelta.
    const lejos = { x: 0.45, z: 0.15 }
    expect(siguienteAgarre(cogido, { posicion: lejos, agarrando: true })).toEqual({
      cogido: true,
      destino: lejos,
    })
  })

  it('se suelta al soltar el botón, y el mazo se queda donde estaba', () => {
    const despues = siguienteAgarre(cogido, { posicion: { x: 0.3, z: 0.2 }, agarrando: false })
    expect(despues).toEqual({ cogido: false, destino: cogido.destino })
  })

  it('perder el mando un fotograma no lo suelta', () => {
    // El seguimiento se pierde al salirse el mando del campo de visión del visor. Soltar
    // ahí dejaría el mazo tirado en mitad de una jugada.
    expect(siguienteAgarre(cogido, null)).toEqual(cogido)
  })
})
