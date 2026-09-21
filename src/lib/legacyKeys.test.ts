import { beforeEach, describe, expect, it } from 'vitest'
import {
  KEY_PREFIX,
  LEGACY_PREFIX,
  migrateLegacyKeys,
  migrateLegacyKeysOnce,
  resetLegacyKeysMigration,
} from './legacyKeys'

/**
 * Que el cambio de nombre no le cueste el récord a quien ya jugó.
 *
 * Es lo único del renombrado que puede romper algo de quien juega: el resto —el repositorio,
 * el paquete, las exportaciones— se arregla recompilando, y una marca perdida no se recupera.
 */

/** Un almacenamiento que lanza a la primera, como el de una ventana privada. */
function almacenamientoCapado(): Storage {
  const lanza = () => {
    throw new DOMException('denegado', 'SecurityError')
  }
  return {
    get length(): number {
      return lanza()
    },
    key: lanza,
    getItem: lanza,
    setItem: lanza,
    removeItem: lanza,
    clear: lanza,
  } as unknown as Storage
}

beforeEach(() => {
  window.localStorage.clear()
  resetLegacyKeysMigration()
})

describe('el traslado de las claves viejas', () => {
  it('lleva al prefijo nuevo todo lo que empezaba por el viejo', () => {
    window.localStorage.setItem(`${LEGACY_PREFIX}best-points:challenge`, '1240')
    window.localStorage.setItem(`${LEGACY_PREFIX}levels:unlocked`, '7')
    window.localStorage.setItem(`${LEGACY_PREFIX}levels:stars`, '3,2,0')

    migrateLegacyKeys(window.localStorage)

    expect(window.localStorage.getItem(`${KEY_PREFIX}best-points:challenge`)).toBe('1240')
    expect(window.localStorage.getItem(`${KEY_PREFIX}levels:unlocked`)).toBe('7')
    expect(window.localStorage.getItem(`${KEY_PREFIX}levels:stars`)).toBe('3,2,0')
  })

  it('borra las viejas, para que no queden dos verdades', () => {
    window.localStorage.setItem(`${LEGACY_PREFIX}tutorial-seen`, '1')

    migrateLegacyKeys(window.localStorage)

    expect(window.localStorage.getItem(`${LEGACY_PREFIX}tutorial-seen`)).toBeNull()
  })

  it('no toca nada que no sea suyo', () => {
    window.localStorage.setItem('xrcade:scenery', 'room')
    window.localStorage.setItem('bowling:best-points', '180')

    migrateLegacyKeys(window.localStorage)

    expect(window.localStorage.getItem('xrcade:scenery')).toBe('room')
    expect(window.localStorage.getItem('bowling:best-points')).toBe('180')
  })

  it('traslada también las claves que nadie escribió en la tabla de la documentación', () => {
    // El traslado va por prefijo justo por esto: una lista a mano se queda corta y esa marca
    // se pierde sin que nadie lo note.
    window.localStorage.setItem(`${LEGACY_PREFIX}lo-que-venga`, 'algo')

    migrateLegacyKeys(window.localStorage)

    expect(window.localStorage.getItem(`${KEY_PREFIX}lo-que-venga`)).toBe('algo')
  })

  it('deja ganar a lo guardado con el nombre nuevo', () => {
    // Ya se jugó con el nombre nuevo: esa marca es la buena. Pisarla con la vieja sería
    // devolverle a alguien un récord peor por abrir una pestaña antigua.
    window.localStorage.setItem(`${LEGACY_PREFIX}best-points`, '400')
    window.localStorage.setItem(`${KEY_PREFIX}best-points`, '900')

    migrateLegacyKeys(window.localStorage)

    expect(window.localStorage.getItem(`${KEY_PREFIX}best-points`)).toBe('900')
    expect(window.localStorage.getItem(`${LEGACY_PREFIX}best-points`)).toBeNull()
  })

  it('con el almacenamiento capado no lanza', () => {
    expect(() => migrateLegacyKeys(almacenamientoCapado())).not.toThrow()
  })

  it('sin almacenamiento tampoco', () => {
    expect(() => migrateLegacyKeys(null)).not.toThrow()
  })

  it('repetirlo no cambia nada', () => {
    window.localStorage.setItem(`${LEGACY_PREFIX}best-points`, '120')

    migrateLegacyKeys(window.localStorage)
    migrateLegacyKeys(window.localStorage)

    expect(window.localStorage.getItem(`${KEY_PREFIX}best-points`)).toBe('120')
  })
})

describe('el traslado de una sola vez', () => {
  it('traslada a la primera llamada', () => {
    window.localStorage.setItem(`${LEGACY_PREFIX}best-points`, '55')

    migrateLegacyKeysOnce()

    expect(window.localStorage.getItem(`${KEY_PREFIX}best-points`)).toBe('55')
  })

  it('y en la segunda ya no recorre nada', () => {
    migrateLegacyKeysOnce()
    // Lo que aparezca después de la primera pasada no es de una versión vieja: en esta carga
    // de página ya se trasladó lo que había.
    window.localStorage.setItem(`${LEGACY_PREFIX}best-points`, '55')

    migrateLegacyKeysOnce()

    expect(window.localStorage.getItem(`${KEY_PREFIX}best-points`)).toBeNull()
    expect(window.localStorage.getItem(`${LEGACY_PREFIX}best-points`)).toBe('55')
  })
})
