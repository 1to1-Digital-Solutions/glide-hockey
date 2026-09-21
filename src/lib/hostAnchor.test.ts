import { describe, expect, it } from 'vitest'

import { entryPlacement, type HostAnchor } from './hostAnchor'

/**
 * De qué se fía el decorado al plantarse, que es lo que decide dónde aparece el juego.
 *
 * El fallo que arregla esto no se ve desde una pantalla —ahí la cámara ya apunta al sitio— y
 * con el visor puesto se ve enseguida: se gira la cabeza para leer las cabinas de la
 * izquierda, se entra, y la mesa sale girada hacia allí. Entonces hay que girarse entero o
 * recentrar la sala para poder jugar.
 */

/** Lo que presta el salón: el arco a los pies de quien entró y girado un cuarto de vuelta. */
const DEL_SALON: HostAnchor = { position: [1.5, 0, -0.5], yaw: Math.PI / 2 }

/** Y lo que dice la cabeza en ese instante: girada para mirar las cabinas de la izquierda. */
const PIES = { x: 1.2, z: -0.4 }
const MIRADA = -Math.PI / 4

describe('con qué se planta el decorado', () => {
  it('sin anfitrión que preste anclaje, con los pies y la mirada de ahora', () => {
    // Es la web propia del juego: no hay más pista que la mirada, y sin ella el decorado
    // se queda donde caiga el −Z de la calibración de la sala, que puede ser la espalda.
    expect(entryPlacement(null, PIES, MIRADA)).toEqual({ x: 1.2, z: -0.4, yaw: MIRADA })
    expect(entryPlacement(undefined, PIES, MIRADA)).toEqual({ x: 1.2, z: -0.4, yaw: MIRADA })
  })

  it('con el del anfitrión, con su rumbo y su sitio, y NO con los de la cámara', () => {
    const sitio = entryPlacement(DEL_SALON, PIES, MIRADA)

    expect(sitio.yaw).toBe(Math.PI / 2)
    expect(sitio.yaw, 'el rumbo de la mirada es justo el que descoloca').not.toBe(MIRADA)
    expect([sitio.x, sitio.z]).toEqual([1.5, -0.5])
  })

  it('la altura del anfitrión no se hereda: la pone el juego', () => {
    // El anfitrión solo sabe del suelo; a qué altura va la mesa, el tee o el prado es del
    // juego, y traerse su `y` los bajaría o los subiría a la de la cabeza.
    expect(entryPlacement({ position: [0, 1.6, 0], yaw: 0 }, PIES, MIRADA)).toEqual({ x: 0, z: 0, yaw: 0 })
  })

  it('gastado lo prestado —recentrar la sala—, vuelve a mandar la mirada', () => {
    // Recentrar recoloca el espacio de referencia entero: lo prestado se queda apuntando a
    // donde ya no hay nada, así que el gesto que recoloca la sala gana a los dos.
    expect(entryPlacement(null, { x: 0, z: 0 }, Math.PI)).toEqual({ x: 0, z: 0, yaw: Math.PI })
  })
})
