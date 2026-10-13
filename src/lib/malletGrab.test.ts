import { describe, expect, it } from 'vitest'
import { GRAB_REACH, nextGrab, type MalletGrab } from './malletGrab'

/**
 * Lo que se comprueba aquí es cómo se siente coger el mazo, que es lo que el rayo hacía
 * mal: el mazo tiene que ir donde va la mano y no donde se apunta.
 */
const enReposo: MalletGrab = { held: false, target: { x: 0, z: 0.6 } }

describe('coger el mazo', () => {
  it('apretar con la mano encima lo coge', () => {
    const despues = nextGrab(enReposo, {
      position: { x: 0.02, z: 0.62 },
      grabbing: true,
    })

    expect(despues.held).toBe(true)
    expect(despues.target).toEqual({ x: 0.02, z: 0.62 })
  })

  it('apretar desde lejos no lo trae a la mano', () => {
    // Es lo que lo devolvería a ser un cursor: el mazo cruzando media mesa de un salto
    // porque alguien apretó un botón mirando hacia allí.
    const despues = nextGrab(enReposo, {
      position: { x: 0.5, z: -0.4 },
      grabbing: true,
    })

    expect(despues.held).toBe(false)
    expect(despues.target).toEqual(enReposo.target)
  })

  it('la mano no tiene que caer exacta encima', () => {
    const justo = { x: enReposo.target.x, z: enReposo.target.z + GRAB_REACH - 0.001 }
    expect(nextGrab(enReposo, { position: justo, grabbing: true }).held).toBe(true)
  })

  it('sin apretar no se coge, por muy encima que esté la mano', () => {
    const despues = nextGrab(enReposo, { position: enReposo.target, grabbing: false })
    expect(despues.held).toBe(false)
  })
})

describe('sostener el mazo', () => {
  const cogido: MalletGrab = { held: true, target: { x: 0, z: 0.6 } }

  it('sigue a la mano vaya donde vaya', () => {
    // Sin esto se soltaría en pleno golpe, que es cuando la mano va más rápido y más
    // lejos: el radio de agarre solo decide cuándo se coge, no cuándo se suelta.
    const lejos = { x: 0.45, z: 0.15 }
    expect(nextGrab(cogido, { position: lejos, grabbing: true })).toEqual({
      held: true,
      target: lejos,
    })
  })

  it('se suelta al soltar el botón, y el mazo se queda donde estaba', () => {
    const despues = nextGrab(cogido, { position: { x: 0.3, z: 0.2 }, grabbing: false })
    expect(despues).toEqual({ held: false, target: cogido.target })
  })

  it('perder el mando un fotograma no lo suelta', () => {
    // El seguimiento se pierde al salirse el mando del campo de visión del visor. Soltar
    // ahí dejaría el mazo tirado en mitad de una jugada.
    expect(nextGrab(cogido, null)).toEqual(cogido)
  })
})
