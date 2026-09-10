import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LANG,
  DEFAULT_PLAY_HEIGHT,
  DEFAULT_VOLUMES,
  DEFAULT_VOLUME_SETTINGS,
  LANGS,
  LANG_COOKIE,
  PLAY_HEIGHTS,
  PLAY_HEIGHT_KEY,
  VOLUME_KEYS,
  langFromCookies,
  parseLang,
  parsePlayHeight,
  parseVolume,
  readPlayHeight,
  readVolumes,
  volumeFactor,
  writePlayHeight,
  writeVolume,
} from './ajustes'

/**
 * El contrato que este juego comparte con xrcade y con los otros once.
 *
 * El fichero es una **copia deliberada** —lo explica su cabecera—, así que lo
 * que se prueba aquí no es la lógica por sí sola sino el puente: si una clave
 * o un valor de partida se apartaran de los del arcade, elegir español o bajar
 * el ambiente en la portada dejaría de notarse dentro de la cabina, y en
 * silencio. Por eso las claves están escritas a mano en las expectativas: una
 * comparación contra la propia constante no vería el cambio.
 *
 * Todo lo que entra viene de fuera —una cookie y un almacenamiento que
 * cualquiera puede editar desde las herramientas del navegador—, así que la
 * otra mitad de lo que se comprueba es que nada de eso deje al juego en un
 * estado que no existe.
 */

/** Un almacenamiento de mentira, que además puede negarse a funcionar. */
function almacen(inicial: Record<string, string> = {}, roto = false): Storage {
  const datos = new Map(Object.entries(inicial))
  const reventar = () => {
    if (roto) throw new Error('almacenamiento capado')
  }

  return {
    get length() {
      return datos.size
    },
    clear: () => datos.clear(),
    getItem: (clave: string) => {
      reventar()
      return datos.get(clave) ?? null
    },
    key: (indice: number) => [...datos.keys()][indice] ?? null,
    removeItem: (clave: string) => {
      reventar()
      datos.delete(clave)
    },
    setItem: (clave: string, valor: string) => {
      reventar()
      datos.set(clave, valor)
    },
  }
}

describe('las claves del arcade', () => {
  it('son exactamente las que escribe xrcade', () => {
    // Escritas a mano a propósito: es el puente entre repositorios, y contra la
    // propia constante esto pasaría siempre.
    expect(LANG_COOKIE).toBe('xrcade_lang')
    expect(VOLUME_KEYS).toEqual({
      sfx: 'xrcade:volume:sfx',
      ambience: 'xrcade:volume:ambience',
    })
  })

  it('entra en inglés y con el ambiente por debajo de los efectos', () => {
    expect(DEFAULT_LANG).toBe('en')
    expect(DEFAULT_VOLUMES).toEqual({ sfx: 100, ambience: 60 })
    expect(DEFAULT_VOLUME_SETTINGS).toEqual(DEFAULT_VOLUMES)
    expect(LANGS).toEqual(['en', 'es'])
  })
})

describe('el idioma que llega de fuera', () => {
  it('vale si es uno de los que hay', () => {
    expect(parseLang('es')).toBe('es')
    expect(parseLang('en')).toBe('en')
  })

  it('cae al de partida si es cualquier otra cosa', () => {
    // Una cookie editada a mano, o la de una versión que hablaba otro idioma.
    expect(parseLang('fr')).toBe(DEFAULT_LANG)
    expect(parseLang('')).toBe(DEFAULT_LANG)
    expect(parseLang(null)).toBe(DEFAULT_LANG)
    expect(parseLang(undefined)).toBe(DEFAULT_LANG)
  })
})

describe('el idioma escrito en una cabecera de cookies', () => {
  it('lo encuentra esté donde esté entre las demás', () => {
    expect(langFromCookies(`${LANG_COOKIE}=es`)).toBe('es')
    expect(langFromCookies(`otra=1; ${LANG_COOKIE}=es; ultima=2`)).toBe('es')
    // Con espacios alrededor, que es como llega de `document.cookie`.
    expect(langFromCookies(` ${LANG_COOKIE}=es ; otra=1`)).toBe('es')
  })

  it('no confunde una cookie que solo empieza igual', () => {
    expect(langFromCookies(`${LANG_COOKIE}_otra=es`)).toBe(DEFAULT_LANG)
  })

  it('descodifica el valor antes de mirarlo', () => {
    expect(langFromCookies(`${LANG_COOKIE}=${encodeURIComponent('es')}`)).toBe('es')
  })

  it('sin cookies, en el idioma de partida', () => {
    expect(langFromCookies('')).toBe(DEFAULT_LANG)
    expect(langFromCookies(null)).toBe(DEFAULT_LANG)
    expect(langFromCookies(undefined)).toBe(DEFAULT_LANG)
  })
})

describe('un volumen leído del almacenamiento', () => {
  it('vale si es un entero de 0 a 100', () => {
    expect(parseVolume('0', 60)).toBe(0)
    expect(parseVolume('37', 60)).toBe(37)
    expect(parseVolume('100', 60)).toBe(100)
  })

  it('cae al de partida si no lo es', () => {
    expect(parseVolume(null, 60)).toBe(60)
    expect(parseVolume('', 60)).toBe(60)
    expect(parseVolume('alto', 60)).toBe(60)
    expect(parseVolume('37.5', 60)).toBe(60)
    expect(parseVolume('-5', 60)).toBe(60)
    // Tres cifras que se pasan de 100: entra por la forma y sale por el rango.
    expect(parseVolume('101', 60)).toBe(60)
    expect(parseVolume('999', 60)).toBe(60)
    // Cuatro cifras ya no son forma de volumen.
    expect(parseVolume('1000', 60)).toBe(60)
  })
})

describe('los volúmenes del arcade', () => {
  it('salen del almacenamiento cuando hay algo guardado', () => {
    const storage = almacen({
      [VOLUME_KEYS.sfx]: '40',
      [VOLUME_KEYS.ambience]: '0',
    })

    expect(readVolumes(storage)).toEqual({ sfx: 40, ambience: 0 })
  })

  it('son los de partida cuando no hay nada, ni dónde guardarlo', () => {
    expect(readVolumes(almacen())).toEqual(DEFAULT_VOLUME_SETTINGS)
    expect(readVolumes(null)).toEqual(DEFAULT_VOLUME_SETTINGS)
  })

  it('sobreviven a un navegador con el almacenamiento capado', () => {
    // Ventana privada, o un navegador con las cookies de sitio bloqueadas: se
    // juega con lo de partida en vez de dejar el juego sin arrancar.
    expect(readVolumes(almacen({}, true))).toEqual(DEFAULT_VOLUME_SETTINGS)
  })
})

describe('guardar un volumen', () => {
  it('lo escribe cuando se aparta de lo de partida', () => {
    const storage = almacen()

    expect(writeVolume(storage, 'sfx', 40)).toBe(true)
    expect(storage.getItem(VOLUME_KEYS.sfx)).toBe('40')
  })

  it('lo olvida cuando vuelve a ser el de partida', () => {
    // Así el almacenamiento tiene algo solo cuando alguien ha decidido algo, y
    // borrarlo devuelve el arcade a como venía.
    const storage = almacen({ [VOLUME_KEYS.ambience]: '10' })

    expect(writeVolume(storage, 'ambience', DEFAULT_VOLUMES.ambience)).toBe(true)
    expect(storage.getItem(VOLUME_KEYS.ambience)).toBeNull()
  })

  it('dice que no sin sitio donde guardar, y no revienta', () => {
    expect(writeVolume(null, 'sfx', 40)).toBe(false)
    expect(writeVolume(almacen({}, true), 'sfx', 40)).toBe(false)
  })
})

describe('el volumen que entiende el audio', () => {
  it('va de 0 a 1', () => {
    expect(volumeFactor(0)).toBe(0)
    expect(volumeFactor(50)).toBe(0.5)
    expect(volumeFactor(100)).toBe(1)
  })

  it('no se sale aunque le llegue un número imposible', () => {
    expect(volumeFactor(-20)).toBe(0)
    expect(volumeFactor(400)).toBe(1)
  })
})

describe('a qué altura se juega', () => {
  it('la clave y la altura de partida son las que escribe xrcade', () => {
    // Escritas a mano a propósito, como el resto: es el puente entre
    // repositorios, y contra la propia constante esto pasaría siempre.
    expect(PLAY_HEIGHT_KEY).toBe('xrcade:play-height')
    expect(DEFAULT_PLAY_HEIGHT).toBe('standing')
    expect(PLAY_HEIGHTS).toEqual(['standing', 'eyes'])
  })

  it('solo cuenta una altura que exista', () => {
    expect(parsePlayHeight('eyes')).toBe('eyes')
    expect(parsePlayHeight('standing')).toBe('standing')
    // Almacenamiento manipulado o de otra versión: se juega de pie, que es
    // como se jugaba antes de haber esto.
    for (const basura of ['sentado', '', null, undefined]) {
      expect(parsePlayHeight(basura)).toBe('standing')
    }
  })

  it('se lee de donde el arcade la deja', () => {
    expect(readPlayHeight(almacen({ [PLAY_HEIGHT_KEY]: 'eyes' }))).toBe('eyes')
    expect(readPlayHeight(almacen())).toBe('standing')
  })

  it('sin sitio donde mirar se juega de pie, y no revienta', () => {
    expect(readPlayHeight(null)).toBe('standing')
    expect(readPlayHeight(almacen({}, true))).toBe('standing')
  })

  it('se guarda al apartarse de pie, y se olvida al volver', () => {
    // Así el almacenamiento tiene algo solo cuando alguien ha decidido algo.
    const storage = almacen()

    expect(writePlayHeight(storage, 'eyes')).toBe(true)
    expect(storage.getItem(PLAY_HEIGHT_KEY)).toBe('eyes')

    expect(writePlayHeight(storage, 'standing')).toBe(true)
    expect(storage.getItem(PLAY_HEIGHT_KEY)).toBeNull()
  })

  it('dice que no sin sitio donde guardar, y no revienta', () => {
    expect(writePlayHeight(null, 'eyes')).toBe(false)
    expect(writePlayHeight(almacen({}, true), 'eyes')).toBe(false)
  })
})
