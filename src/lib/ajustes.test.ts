import { describe, expect, it } from 'vitest'

import {
  DEFAULT_GRAB_MODE,
  DEFAULT_HAND,
  DEFAULT_LANG,
  DEFAULT_PLAY_HEIGHT,
  DEFAULT_PLAY_HEIGHT_OFFSET,
  DEFAULT_SCENERY,
  DEFAULT_TURN_MODE,
  DEFAULT_VOLUMES,
  DEFAULT_VOLUME_SETTINGS,
  GRAB_MODES,
  GRAB_MODE_KEY,
  HANDS,
  HAND_KEY,
  HAND_ORDER,
  LANGS,
  LANG_COOKIE,
  MAX_PLAY_HEIGHT_OFFSET,
  PLAY_HEIGHTS,
  PLAY_HEIGHT_KEY,
  PLAY_HEIGHT_OFFSET_KEY,
  SCENERIES,
  SCENERY_KEY,
  TURN_MODES,
  TURN_MODE_KEY,
  VOLUME_KEYS,
  langFromCookies,
  parseGrabMode,
  parseHand,
  parseLang,
  parsePlayHeight,
  parsePlayHeightOffset,
  parseScenery,
  parseTurnMode,
  parseVolume,
  playHeightOffsetMeters,
  readGrabMode,
  readHand,
  readPlayHeight,
  readPlayHeightOffset,
  readScenery,
  readTurnMode,
  readVolumes,
  showsPlace,
  volumeFactor,
  writeGrabMode,
  writeHand,
  writePlayHeight,
  writeScenery,
  writeTurnMode,
  writeVolume,
} from './ajustes'

/**
 * El contrato que este juego comparte con xrcade y con los demás juegos del salón.
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

describe('cómo se sujeta lo que se coge', () => {
  it('la clave y el agarre de partida son los que escribe xrcade', () => {
    expect(GRAB_MODE_KEY).toBe('xrcade:grab')
    expect(DEFAULT_GRAB_MODE).toBe('hold')
    expect(GRAB_MODES).toEqual(['hold', 'toggle'])
  })

  it('solo cuenta un agarre que exista', () => {
    expect(parseGrabMode('toggle')).toBe('toggle')
    expect(parseGrabMode('hold')).toBe('hold')
    for (const basura of ['mantener', '', null, undefined]) {
      expect(parseGrabMode(basura)).toBe('hold')
    }
  })

  it('se lee de donde el arcade lo deja', () => {
    expect(readGrabMode(almacen({ [GRAB_MODE_KEY]: 'toggle' }))).toBe('toggle')
    expect(readGrabMode(almacen())).toBe('hold')
  })

  it('sin sitio donde mirar se agarra manteniendo, y no revienta', () => {
    expect(readGrabMode(null)).toBe('hold')
    expect(readGrabMode(almacen({}, true))).toBe('hold')
  })

  it('se guarda al apartarse de mantener, y se olvida al volver', () => {
    const storage = almacen()

    expect(writeGrabMode(storage, 'toggle')).toBe(true)
    expect(storage.getItem(GRAB_MODE_KEY)).toBe('toggle')

    expect(writeGrabMode(storage, 'hold')).toBe(true)
    expect(storage.getItem(GRAB_MODE_KEY)).toBeNull()
  })

  it('dice que no sin sitio donde guardar, y no revienta', () => {
    expect(writeGrabMode(null, 'toggle')).toBe(false)
    expect(writeGrabMode(almacen({}, true), 'toggle')).toBe(false)
  })
})

describe('cuándo se gira el decorado con el stick', () => {
  it('la clave y el giro de partida son los que escribirá xrcade', () => {
    expect(TURN_MODE_KEY).toBe('xrcade:giro')
    expect(DEFAULT_TURN_MODE).toBe('auto')
    expect(TURN_MODES).toEqual(['auto', 'stick'])
  })

  it('solo cuenta un giro que exista', () => {
    expect(parseTurnMode('stick')).toBe('stick')
    expect(parseTurnMode('auto')).toBe('auto')
    for (const basura of ['siempre', '', null, undefined]) {
      expect(parseTurnMode(basura)).toBe('auto')
    }
  })

  it('se lee de donde el arcade lo deja, y sin él es solo sentado', () => {
    // Un salón anterior al ajuste no escribe nada: eso tiene que seguir siendo un juego que
    // se puede jugar, no un fallo.
    expect(readTurnMode(almacen({ [TURN_MODE_KEY]: 'stick' }))).toBe('stick')
    expect(readTurnMode(almacen())).toBe('auto')
  })

  it('sin sitio donde mirar se gira solo sentado, y no revienta', () => {
    expect(readTurnMode(null)).toBe('auto')
    expect(readTurnMode(almacen({}, true))).toBe('auto')
  })

  it('se guarda al apartarse del de partida, y se olvida al volver', () => {
    const storage = almacen()

    expect(writeTurnMode(storage, 'stick')).toBe(true)
    expect(storage.getItem(TURN_MODE_KEY)).toBe('stick')

    expect(writeTurnMode(storage, 'auto')).toBe(true)
    expect(storage.getItem(TURN_MODE_KEY)).toBeNull()
  })

  it('dice que no sin sitio donde guardar, y no revienta', () => {
    expect(writeTurnMode(null, 'stick')).toBe(false)
    expect(writeTurnMode(almacen({}, true), 'stick')).toBe(false)
  })
})

describe('qué se ve alrededor con el visor', () => {
  it('la clave, los valores y el de partida son los que escribe xrcade', () => {
    // Escritos a mano, como el resto: es el puente entre repositorios, y contra la propia
    // constante esto pasaría siempre. Una clave que se apartara de la del salón dejaría la
    // cabina con su decorado aunque en el salón se hubiera elegido la habitación.
    expect(SCENERY_KEY).toBe('xrcade:scenery')
    expect(SCENERIES).toEqual(['place', 'room'])
    expect(DEFAULT_SCENERY).toBe('place')
  })

  it('solo cuenta un escenario que exista', () => {
    expect(parseScenery('room')).toBe('room')
    expect(parseScenery('place')).toBe('place')
    // `passthrough` y `scene` incluidos: son los nombres con los que stick-rush habla del
    // escenario dentro de su código, y escritos en la clave del arcade no significan nada.
    for (const basura of ['ROOM', 'passthrough', 'scene', '', null, undefined]) {
      expect(parseScenery(basura)).toBe('place')
    }
  })

  it('se lee de donde el arcade lo deja', () => {
    expect(readScenery(almacen({ [SCENERY_KEY]: 'room' }))).toBe('room')
    expect(readScenery(almacen())).toBe('place')
  })

  it('sin sitio donde mirar se ve el sitio dibujado, y no revienta', () => {
    expect(readScenery(null)).toBe('place')
    expect(readScenery(almacen({}, true))).toBe('place')
  })

  it('se guarda al elegir la habitación, y se olvida al volver al sitio dibujado', () => {
    const storage = almacen()

    expect(writeScenery(storage, 'room')).toBe(true)
    expect(storage.getItem(SCENERY_KEY)).toBe('room')

    expect(writeScenery(storage, 'place')).toBe(true)
    expect(storage.getItem(SCENERY_KEY)).toBeNull()
  })

  it('dice que no sin sitio donde guardar, y no revienta', () => {
    expect(writeScenery(null, 'room')).toBe(false)
    expect(writeScenery(almacen({}, true), 'room')).toBe(false)
  })

  describe('cuándo se pinta el decorado', () => {
    it('con el sitio dibujado elegido, siempre', () => {
      expect(showsPlace('immersive-ar', 'place')).toBe(true)
    })

    it('con la habitación elegida y en realidad aumentada, no: se ve la habitación', () => {
      expect(showsPlace('immersive-ar', 'room')).toBe(false)
    })

    it('con la habitación elegida pero en realidad virtual, sí: no hay habitación detrás', () => {
      // Un visor sin passthrough: quitar el decorado dejaría a quien juega mirando negro.
      expect(showsPlace('immersive-vr', 'room')).toBe(true)
    })

    it('con la habitación elegida y fuera del visor, también: la pantalla no tiene cámara', () => {
      expect(showsPlace(null, 'room')).toBe(true)
      expect(showsPlace(undefined, 'room')).toBe(true)
    })
  })
})

describe('con qué mano se juega', () => {
  it('la clave, los valores y la de partida son los que escribe xrcade', () => {
    // Escritos a mano, como el resto: es el puente entre repositorios. Los valores son los de
    // WebXR (`XRHandedness`), que es como se le pide a `@react-three/xr` el mando de esa mano.
    expect(HAND_KEY).toBe('xrcade:hand')
    expect(HANDS).toEqual(['right', 'left'])
    expect(DEFAULT_HAND).toBe('right')
    // Y se enseñan como se tienen las manos de frente.
    expect(HAND_ORDER).toEqual(['left', 'right'])
  })

  it('solo cuenta una mano que exista', () => {
    expect(parseHand('left')).toBe('left')
    expect(parseHand('right')).toBe('right')
    for (const basura of ['zurdo', 'LEFT', 'none', '', null, undefined]) {
      expect(parseHand(basura)).toBe('right')
    }
  })

  it('se lee de donde la deja el salón, y sin nada guardado es la derecha', () => {
    expect(readHand(almacen({ [HAND_KEY]: 'left' }))).toBe('left')
    expect(readHand(almacen())).toBe('right')
  })

  it('se guarda al elegir la izquierda, y se olvida al volver a la derecha', () => {
    const storage = almacen()

    expect(writeHand(storage, 'left')).toBe(true)
    expect(storage.getItem(HAND_KEY)).toBe('left')

    expect(writeHand(storage, 'right')).toBe(true)
    expect(storage.getItem(HAND_KEY)).toBeNull()
  })

  it('sin almacenamiento, o con uno capado, se juega con la derecha y no revienta', () => {
    expect(readHand(null)).toBe('right')
    expect(readHand(almacen({}, true))).toBe('right')
    expect(writeHand(null, 'left')).toBe(false)
    expect(writeHand(almacen({}, true), 'left')).toBe(false)
  })
})

describe('la altura fina del salón', () => {
  it('la clave y el cero de partida son los que escribe xrcade', () => {
    // Escritos a mano, como el resto: es el puente entre repositorios.
    expect(PLAY_HEIGHT_OFFSET_KEY).toBe('xrcade:play-height-offset')
    expect(DEFAULT_PLAY_HEIGHT_OFFSET).toBe(0)
    expect(MAX_PLAY_HEIGHT_OFFSET).toBe(30)
  })

  it('sin la clave el mundo no se mueve', () => {
    expect(readPlayHeightOffset(almacen())).toBe(0)
    expect(playHeightOffsetMeters(readPlayHeightOffset(almacen()))).toBe(0)
  })

  it('con −15 el mundo baja quince centímetros', () => {
    const cm = readPlayHeightOffset(almacen({ [PLAY_HEIGHT_OFFSET_KEY]: '-15' }))

    expect(cm).toBe(-15)
    expect(playHeightOffsetMeters(cm)).toBeCloseTo(-0.15, 9)
    expect(readPlayHeightOffset(almacen({ [PLAY_HEIGHT_OFFSET_KEY]: '30' }))).toBe(30)
  })

  it('un valor roto o fuera del tope deja el mundo sin afinar', () => {
    for (const basura of ['31', '-31', '12.5', 'arriba', '', '+5', '1000', null, undefined]) {
      expect(parsePlayHeightOffset(basura)).toBe(0)
    }
  })

  it('sin sitio donde mirar no se afina, y no revienta', () => {
    expect(readPlayHeightOffset(null)).toBe(0)
    expect(readPlayHeightOffset(almacen({}, true))).toBe(0)
  })
})
