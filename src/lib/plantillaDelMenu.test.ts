import { afterEach, describe, expect, it } from 'vitest'
import paquete from '../../package.json'
import {
  GRADOS_DEL_MENU,
  conElRetoPrimero,
  filasDelMenu,
  fijarNombreDelJuego,
  gradosDelFrente,
  nombreDelJuego,
  nombreDesdeElId,
  type PapelDeLaFila,
} from './plantillaDelMenu'

/**
 * La plantilla del menú, la misma en todos los juegos: el nombre, el orden de las filas y dónde
 * nace el menú. Lo de cada juego —qué filas tiene y dónde cuelga su panel— lo mide su guardián.
 */

afterEach(() => fijarNombreDelJuego(null))

describe('el nombre del juego en su menú', () => {
  it('sin salón, el del paquete con mayúsculas, que es el del catálogo', () => {
    expect(nombreDesdeElId('axe-throwing')).toBe('Axe Throwing')
    expect(nombreDesdeElId('minigolf')).toBe('Minigolf')
    expect(nombreDesdeElId('-raro--id-')).toBe('Raro Id')
    expect(nombreDelJuego()).toBe(nombreDesdeElId(paquete.name))
  })

  it('con salón, el nombre de la cabina; uno vacío no cuenta', () => {
    fijarNombreDelJuego('  Cabina de prueba ')
    expect(nombreDelJuego()).toBe('Cabina de prueba')
    fijarNombreDelJuego('   ')
    expect(nombreDelJuego()).toBe(nombreDesdeElId(paquete.name))
    fijarNombreDelJuego('Cabina de prueba')
    fijarNombreDelJuego(undefined)
    expect(nombreDelJuego()).toBe(nombreDesdeElId(paquete.name))
  })
})

describe('las filas del menú', () => {
  const FILAS: { clave: string; papel: PapelDeLaFila }[] = [
    { clave: 'mano', papel: 'otra' },
    { clave: 'rival', papel: 'jugadores' },
    { clave: 'dificultad', papel: 'otra' },
    { clave: 'modo', papel: 'modo' },
  ]
  const papel = (fila: (typeof FILAS)[number]) => fila.papel
  const claves = (filas: readonly { clave: string }[]) => filas.map((fila) => fila.clave)

  it('«Modo» primero, después «Jugadores», y lo demás plegado', () => {
    const plegado = filasDelMenu(FILAS, papel, { masOpciones: false })
    expect(claves(plegado.filas)).toEqual(['modo', 'rival'])
    expect(plegado.plegadas).toBe(2)
  })

  it('con «Más opciones», lo demás detrás, en el orden en que venía', () => {
    const abierto = filasDelMenu(FILAS, papel, { masOpciones: true })
    expect(claves(abierto.filas)).toEqual(['modo', 'rival', 'mano', 'dificultad'])
    expect(abierto.plegadas).toBe(0)
  })

  it('con el reto elegido no hay nada que desplegar: es una partida fija', () => {
    expect(filasDelMenu(FILAS, papel, { masOpciones: false, enReto: true })).toEqual({
      filas: [FILAS[3], FILAS[1]],
      plegadas: 0,
    })
    expect(claves(filasDelMenu(FILAS, papel, { masOpciones: true, enReto: true }).filas)).toEqual(['modo', 'rival'])
  })

  it('el reto, el primero de los modos', () => {
    expect(conElRetoPrimero(['practica', 'tiempo', 'reto', 'niveles'], (modo) => modo === 'reto')).toEqual([
      'reto',
      'practica',
      'tiempo',
      'niveles',
    ])
  })
})

describe('dónde nace el menú del visor', () => {
  it('se mide en horizontal desde el frente, sin signo', () => {
    expect(gradosDelFrente([0, 1.4, -1.2])).toBeCloseTo(0)
    expect(gradosDelFrente([-1, 1.4, -1])).toBeCloseTo(45)
    expect(gradosDelFrente([1, 0.2, -1])).toBeCloseTo(45)
    expect(gradosDelFrente([0, 1.4, 1])).toBeCloseTo(180)
  })

  it('el listón: a treinta grados o menos', () => {
    expect(GRADOS_DEL_MENU).toBe(30)
    expect(gradosDelFrente([Math.tan(Math.PI / 6), 1.4, -1])).toBeLessThanOrEqual(GRADOS_DEL_MENU + 1e-9)
  })
})
