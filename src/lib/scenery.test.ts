import { afterEach, describe, expect, it } from 'vitest'

import { SCENERIES, readScenery } from './ajustes'
import { OWN_SCENERY_KEY, SCENERY_HINTS, SCENERY_LABELS, forgetOwnScenery } from './scenery'

/**
 * Cómo se ofrece el escenario del arcade en este juego.
 *
 * La preferencia y la regla del decorado se prueban con el puente (`ajustes.test.ts` y
 * `ajustesCliente.test.tsx`). Lo que queda aquí es lo que es de air-hockey: que la clave propia
 * del juego no mande y desaparezca.
 */

afterEach(() => {
  window.localStorage.clear()
})

describe('la clave propia del juego', () => {
  it('es la del juego, escrita a mano', () => {
    // Si se apartara, se quedaría sin borrar la de verdad y se borraría una que no existe.
    expect(OWN_SCENERY_KEY).toBe('air-hockey:scenery')
  })

  it('no manda: con ella a «habitación» y la del arcade sin poner, se ve la sala', () => {
    window.localStorage.setItem(OWN_SCENERY_KEY, 'room')

    expect(readScenery(window.localStorage)).toBe('place')
  })

  it('se borra sin trasladarla a la del arcade', () => {
    window.localStorage.setItem(OWN_SCENERY_KEY, 'room')

    forgetOwnScenery(window.localStorage)

    expect(window.localStorage.getItem(OWN_SCENERY_KEY)).toBeNull()
    expect(window.localStorage.getItem('xrcade:scenery')).toBeNull()
  })

  it('no toca lo que se eligió en el salón', () => {
    window.localStorage.setItem(OWN_SCENERY_KEY, 'place')
    window.localStorage.setItem('xrcade:scenery', 'room')

    forgetOwnScenery(window.localStorage)

    expect(readScenery(window.localStorage)).toBe('room')
  })

  it('sin almacenamiento, o con uno que lanza, no revienta', () => {
    const roto = {
      removeItem() {
        throw new Error('almacenamiento capado')
      },
    }

    expect(() => forgetOwnScenery(null)).not.toThrow()
    expect(() => forgetOwnScenery(roto)).not.toThrow()
  })
})

describe('cómo se ofrece', () => {
  it('los dos sitios tienen nombre y explicación', () => {
    for (const scenery of SCENERIES) {
      expect(SCENERY_LABELS[scenery]).not.toBe('')
      expect(SCENERY_HINTS[scenery]).not.toBe('')
    }
  })

  it('avisa de que la habitación solo se ve con el visor', () => {
    // En el navegador la opción está y no hace nada: sin decirlo, se lee como
    // que el juego está roto.
    expect(SCENERY_HINTS.room).toMatch(/[Hh]eadset/)
  })
})
