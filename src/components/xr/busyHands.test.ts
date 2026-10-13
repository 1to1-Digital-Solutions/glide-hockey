// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { marcarManoOcupada, soltarLasManos, suscribirseAManos as suscribir } from './manosOcupadas'

/**
 * Qué mano lleva algo, que es lo que apaga el rayo de ese mando.
 *
 * Lo escribe el bucle de fotogramas, a noventa veces por segundo, así que lo que importa es
 * que **solo avise cuando algo cambie**: un aviso por fotograma repintaría el árbol entero
 * noventa veces por segundo por un booleano que no se ha movido.
 */

afterEach(() => soltarLasManos())

describe('marcar una mano ocupada', () => {
  it('avisa al cambiar, y no mientras siga igual', () => {
    const oyente = vi.fn()
    const quitar = suscribir(oyente)

    marcarManoOcupada('left', true)
    marcarManoOcupada('left', true)
    marcarManoOcupada('left', true)

    expect(oyente).toHaveBeenCalledTimes(1)
    quitar()
  })

  it('cada mano va por su lado', () => {
    const oyente = vi.fn()
    const quitar = suscribir(oyente)

    marcarManoOcupada('left', true)
    marcarManoOcupada('right', true)

    expect(oyente).toHaveBeenCalledTimes(2)
    quitar()
  })

  it('soltarlas todas avisa una vez, y no avisa si ya estaban sueltas', () => {
    const oyente = vi.fn()
    const quitar = suscribir(oyente)

    soltarLasManos()
    expect(oyente).not.toHaveBeenCalled()

    marcarManoOcupada('left', true)
    marcarManoOcupada('right', true)
    oyente.mockClear()
    soltarLasManos()

    expect(oyente).toHaveBeenCalledTimes(1)
    quitar()
  })
})
