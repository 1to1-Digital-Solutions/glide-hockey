import { describe, expect, it } from 'vitest'

import {
  CONFORTS,
  CONFORT_DE_PARTIDA,
  DURACION_DEL_GOLPE,
  EN_REPOSO,
  GOLPE,
  GOLPES_A_LA_VEZ,
  SIN_CAPAS,
  capasDelGolpe,
  corteEn,
  escalaDelRelojEn,
  estadoDelGolpe,
  formaDeLaSacudida,
  formaDeLaVineta,
  guardarConfort,
  ladoEnLaVista,
  leerConfort,
  parseConfort,
  pulsosDelGolpe,
  sacudidaEn,
  sumarGolpe,
  unitaria,
  vinetaEn,
  type Golpe,
} from './golpeRecibido'
import { RECETAS } from './tactos'

/** Un almacenamiento de mentira, con fallos a demanda. */
function almacen(inicial: Record<string, string> = {}, { rompe = false } = {}) {
  const datos = new Map(Object.entries(inicial))
  return {
    datos,
    getItem: (k: string) => {
      if (rompe) throw new Error('capado')
      return datos.get(k) ?? null
    },
    setItem: (k: string, v: string) => {
      if (rompe) throw new Error('capado')
      datos.set(k, v)
    },
    removeItem: (k: string) => {
      if (rompe) throw new Error('capado')
      datos.delete(k)
    },
  } as unknown as Storage & { datos: Map<string, string> }
}

/** Recorre una curva a pasos de un milisegundo desde antes del golpe hasta después de apagarse. */
function muestreo(f: (edad: number) => number): number[] {
  const valores: number[] = []
  for (let ms = -20; ms <= DURACION_DEL_GOLPE * 1000 + 50; ms += 1) valores.push(f(ms / 1000))
  return valores
}

const DE_FRENTE = { x: 0, y: 0, z: -1 }

function golpe(inicio: number, fuerza = 1, direccion = DE_FRENTE): Golpe {
  return { inicio, capas: capasDelGolpe(fuerza, 'normal'), direccion, lado: { x: -1, y: 0 } }
}

describe('el ajuste de confort', () => {
  it('son tres, en inglés porque se guardan, y se entra con el golpe entero', () => {
    // Escritos a mano: si cambian, cambia lo que hay guardado en el navegador de quien juega.
    expect(CONFORTS).toEqual(['off', 'gentle', 'normal'])
    expect(CONFORT_DE_PARTIDA).toBe('normal')
  })

  it('lee solo lo que existe, y lo demás cae al de partida', () => {
    expect(parseConfort('off')).toBe('off')
    expect(parseConfort('gentle')).toBe('gentle')
    expect(parseConfort('apagado')).toBe('normal')
    expect(parseConfort(null)).toBe('normal')
    expect(parseConfort(undefined)).toBe('normal')
  })

  it('se lee y se guarda con la clave del juego, y el de partida no ocupa sitio', () => {
    const s = almacen()
    expect(leerConfort(s, 'juego:confort')).toBe('normal')
    expect(guardarConfort(s, 'juego:confort', 'gentle')).toBe(true)
    expect(s.datos.get('juego:confort')).toBe('gentle')
    expect(leerConfort(s, 'juego:confort')).toBe('gentle')
    expect(guardarConfort(s, 'juego:confort', 'normal')).toBe(true)
    expect(s.datos.has('juego:confort')).toBe(false)
  })

  it('sin almacenamiento, o con uno capado, sigue jugando con el de partida', () => {
    expect(leerConfort(null, 'x')).toBe('normal')
    expect(guardarConfort(null, 'x', 'off')).toBe(false)
    const capado = almacen({}, { rompe: true })
    expect(leerConfort(capado, 'x')).toBe('normal')
    expect(guardarConfort(capado, 'x', 'off')).toBe(false)
  })
})

describe('de la fuerza a las capas', () => {
  it('con el confort apagado no hace nada: ni se ve, ni se mueve, ni se oye, ni vibra', () => {
    for (const fuerza of [0, 0.3, 1]) {
      for (const reducido of [false, true]) {
        const capas = capasDelGolpe(fuerza, 'off', reducido)
        expect(capas).toEqual(SIN_CAPAS)
        expect(pulsosDelGolpe(capas)).toEqual([])
        expect(muestreo((e) => vinetaEn(capas, e)).every((v) => v === 0)).toBe(true)
        expect(muestreo((e) => sacudidaEn(capas, DE_FRENTE, e).z).every((v) => v === 0)).toBe(true)
        expect(muestreo((e) => escalaDelRelojEn(capas, e)).every((v) => v === 1)).toBe(true)
        expect(muestreo((e) => corteEn(capas, e)).every((v) => v === GOLPE.filtro.abierto)).toBe(true)
      }
    }
  })

  it('el golpe entero, con la fuerza máxima, llega a las cifras de la tabla', () => {
    expect(capasDelGolpe(1, 'normal')).toEqual({ vineta: 0.9, sacudida: 1, lenta: 1, filtro: 1, haptico: 1 })
  })

  it('en suave, todo a la mitad salvo el háptico, que lleva la fuerza', () => {
    const entero = capasDelGolpe(0.8, 'normal')
    const suave = capasDelGolpe(0.8, 'gentle')
    expect(suave.vineta).toBeCloseTo(entero.vineta / 2)
    expect(suave.sacudida).toBeCloseTo(entero.sacudida / 2)
    expect(suave.lenta).toBeCloseTo(entero.lenta / 2)
    expect(suave.filtro).toBeCloseTo(entero.filtro / 2)
    expect(suave.haptico).toBe(0.8)
  })

  it('más fuerza, más de todo; y el golpe más flojo también se ve', () => {
    const flojo = capasDelGolpe(0, 'normal')
    const medio = capasDelGolpe(0.5, 'normal')
    const fuerte = capasDelGolpe(1, 'normal')
    expect(flojo.vineta).toBeCloseTo(GOLPE.vineta.suelo * GOLPE.vineta.maximo)
    expect(flojo.sacudida).toBe(0)
    expect(medio.vineta).toBeGreaterThan(flojo.vineta)
    expect(fuerte.vineta).toBeGreaterThan(medio.vineta)
    expect(medio.sacudida).toBeGreaterThan(0)
    expect(fuerte.sacudida).toBeGreaterThan(medio.sacudida)
  })

  it('la fuerza fuera de rango se acota: pasarse no oscurece de más ni mueve más', () => {
    expect(capasDelGolpe(3, 'normal')).toEqual(capasDelGolpe(1, 'normal'))
    expect(capasDelGolpe(-1, 'normal')).toEqual(capasDelGolpe(0, 'normal'))
  })

  it('con el movimiento reducido: sin sacudida ni cámara lenta, viñeta suave, y el háptico sigue', () => {
    for (const confort of ['gentle', 'normal'] as const) {
      const capas = capasDelGolpe(1, confort, true)
      expect(capas.sacudida).toBe(0)
      expect(capas.lenta).toBe(0)
      expect(capas.vineta).toBeCloseTo(capasDelGolpe(1, 'gentle').vineta)
      expect(capas.haptico).toBe(1)
      expect(capas.filtro).toBeGreaterThan(0)
      expect(muestreo((e) => sacudidaEn(capas, DE_FRENTE, e).z).every((v) => v === 0)).toBe(true)
      expect(muestreo((e) => escalaDelRelojEn(capas, e)).every((v) => v === 1)).toBe(true)
    }
  })

  it('el háptico es la receta común de golpe recibido, en las dos manos', () => {
    const pulsos = pulsosDelGolpe(capasDelGolpe(1, 'gentle'))
    expect(pulsos.map((p) => p.mano).sort()).toEqual(['left', 'right'])
    for (const p of pulsos) {
      expect(p.intensidad).toBe(RECETAS.golpeRecibido.maximo)
      expect(p.ms).toBe(RECETAS.golpeRecibido.ms)
      expect(p.retardo).toBe(0)
    }
  })
})

describe('las curvas en el tiempo', () => {
  it('la viñeta sube en la entrada, cae en curva y se queda en cero', () => {
    const { entrada, salida } = GOLPE.vineta
    expect(formaDeLaVineta(-0.01)).toBe(0)
    expect(formaDeLaVineta(0)).toBe(0)
    expect(formaDeLaVineta(entrada / 2)).toBeCloseTo(0.5)
    expect(formaDeLaVineta(entrada)).toBe(1)
    // Cae en curva: a mitad de la salida ya va por un cuarto.
    expect(formaDeLaVineta(entrada + salida / 2)).toBeCloseTo(0.25)
    expect(formaDeLaVineta(entrada + salida)).toBe(0)
    // Nunca pasa de 1 y, una vez arriba, solo baja.
    const valores = muestreo(formaDeLaVineta)
    expect(Math.max(...valores)).toBe(1)
    const pico = valores.indexOf(1)
    for (let i = pico + 1; i < valores.length; i += 1) expect(valores[i]).toBeLessThanOrEqual(valores[i - 1])
  })

  it('la sacudida arranca en cero, oscila amortiguada y acaba exactamente en su sitio', () => {
    const { dura, hercios } = GOLPE.sacudida
    expect(formaDeLaSacudida(0)).toBe(0)
    expect(formaDeLaSacudida(-0.1)).toBe(0)
    expect(formaDeLaSacudida(dura)).toBe(0)
    expect(formaDeLaSacudida(dura + 1)).toBe(0)
    // El primer cuarto de onda va hacia el golpe, y el siguiente medio vuelve y se pasa.
    expect(formaDeLaSacudida(1 / (4 * hercios))).toBeGreaterThan(0)
    expect(formaDeLaSacudida(3 / (4 * hercios))).toBeLessThan(0)
    // Cada cresta, más baja que la anterior.
    const crestas = [0, 1, 2].map((n) => Math.abs(formaDeLaSacudida((n + 0.25) / hercios)))
    expect(crestas[1]).toBeLessThan(crestas[0])
    expect(crestas[2]).toBeLessThan(crestas[1])
    // Sin saltos: de un milisegundo al siguiente no se mueve más de lo que se mueve un muelle.
    const valores = muestreo(formaDeLaSacudida)
    for (let i = 1; i < valores.length; i += 1) expect(Math.abs(valores[i] - valores[i - 1])).toBeLessThan(0.08)
  })

  it('el decorado se mueve centímetro y medio como mucho, y hacia donde viene el golpe', () => {
    const capas = capasDelGolpe(1, 'normal')
    const desdeLaIzquierda = { x: -1, y: 0, z: 0 }
    const valores = muestreo((e) => sacudidaEn(capas, desdeLaIzquierda, e).x)
    const mayor = Math.max(...valores.map(Math.abs))
    expect(mayor).toBeLessThanOrEqual(GOLPE.sacudida.amplitud)
    expect(mayor).toBeGreaterThan(GOLPE.sacudida.amplitud / 2)
    // Lo primero, hacia la izquierda: hacia allí se va el mundo cuando a uno lo empujan desde allí.
    expect(sacudidaEn(capas, desdeLaIzquierda, 1 / (4 * GOLPE.sacudida.hercios)).x).toBeLessThan(0)
    // Solo a lo largo de la dirección.
    expect(muestreo((e) => sacudidaEn(capas, desdeLaIzquierda, e).y).every((v) => v === 0)).toBe(true)
  })

  it('la cámara lenta se queda un instante y vuelve a 1 sin tirón', () => {
    const capas = capasDelGolpe(1, 'normal')
    const { escala, quieta, vuelta } = GOLPE.lenta
    expect(escalaDelRelojEn(capas, -0.01)).toBe(1)
    expect(escalaDelRelojEn(capas, 0)).toBeCloseTo(escala)
    expect(escalaDelRelojEn(capas, quieta / 2)).toBeCloseTo(escala)
    expect(escalaDelRelojEn(capas, quieta + vuelta / 2)).toBeCloseTo((1 + escala) / 2)
    expect(escalaDelRelojEn(capas, quieta + vuelta)).toBe(1)
    const valores = muestreo((e) => escalaDelRelojEn(capas, e))
    expect(Math.min(...valores)).toBeCloseTo(escala)
    expect(Math.max(...valores)).toBe(1)
    for (let i = 1; i < valores.length; i += 1) expect(Math.abs(valores[i] - valores[i - 1])).toBeLessThan(0.75)
    // Menos de la mitad del reloj parado del parón de golpe más largo que se conoce.
    expect(quieta).toBeLessThan(0.167 / 2)
  })

  it('en suave, el reloj frena la mitad', () => {
    expect(escalaDelRelojEn(capasDelGolpe(1, 'gentle'), 0)).toBeCloseTo(1 - (1 - GOLPE.lenta.escala) / 2)
  })

  it('el filtro cierra hasta el corte, se queda y vuelve a abrirse del todo', () => {
    const capas = capasDelGolpe(1, 'normal')
    const { corte, abierto, quieto, vuelta } = GOLPE.filtro
    expect(corteEn(capas, -0.01)).toBe(abierto)
    expect(corteEn(capas, 0)).toBeCloseTo(corte)
    expect(corteEn(capas, quieto / 2)).toBeCloseTo(corte)
    // A mitad de la vuelta está a medio camino en octavas, no en hercios.
    expect(corteEn(capas, quieto + vuelta / 2)).toBeCloseTo(Math.sqrt(corte * abierto))
    expect(corteEn(capas, quieto + vuelta)).toBe(abierto)
    // En suave, a medio camino en octavas.
    expect(corteEn(capasDelGolpe(1, 'gentle'), 0)).toBeCloseTo(Math.sqrt(corte * abierto))
  })
})

describe('de dónde viene, en la vista', () => {
  it('de frente no tiene lado; por la izquierda, la izquierda; por arriba, arriba', () => {
    expect(ladoEnLaVista({ x: 0, y: 0, z: -1 })).toEqual({ x: 0, y: 0 })
    expect(ladoEnLaVista({ x: -2, y: 0, z: 0 })).toEqual({ x: -1, y: 0 })
    expect(ladoEnLaVista({ x: 0, y: 3, z: 0 })).toEqual({ x: 0, y: 1 })
    const diagonal = ladoEnLaVista({ x: 1, y: 0, z: -1 })
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2)
    expect(ladoEnLaVista({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0 })
  })

  it('una dirección se deja de largo 1, y sin dirección el golpe es sordo, hacia abajo', () => {
    expect(unitaria({ x: 0, y: 0, z: -5 })).toEqual({ x: 0, y: 0, z: -1 })
    expect(unitaria(null)).toEqual({ x: 0, y: -1, z: 0 })
    expect(unitaria(undefined)).toEqual({ x: 0, y: -1, z: 0 })
    expect(unitaria({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: -1, z: 0 })
  })
})

describe('varios golpes a la vez', () => {
  it('sin golpes, en reposo', () => {
    expect(estadoDelGolpe([], 3)).toBe(EN_REPOSO)
  })

  it('todo vuelve a cero: pasado el golpe, el reposo exacto y ningún golpe vivo', () => {
    const golpes = [golpe(10, 1, { x: -1, y: 0, z: 0 })]
    const durante = estadoDelGolpe(golpes, 10.05)
    expect(durante.vineta).toBeGreaterThan(0)
    expect(durante.escala).toBeLessThan(1)
    expect(durante.corte).toBeLessThan(GOLPE.filtro.abierto)
    expect(durante.vivos).toHaveLength(1)
    const despues = estadoDelGolpe(golpes, 10 + DURACION_DEL_GOLPE)
    expect(despues).toBe(EN_REPOSO)
    // Y justo antes de acabar, ya prácticamente nada.
    const casi = estadoDelGolpe(golpes, 10 + DURACION_DEL_GOLPE - 0.001)
    expect(casi.vineta).toBeLessThan(1e-4)
    expect(casi.escala).toBe(1)
    expect(casi.corte).toBe(GOLPE.filtro.abierto)
    expect(Math.hypot(casi.sacudida.x, casi.sacudida.y, casi.sacudida.z)).toBe(0)
  })

  it('la viñeta es la más oscura, con su lado; las sacudidas se suman; reloj y filtro, los más frenados', () => {
    const viejo: Golpe = { ...golpe(0, 1), lado: { x: 1, y: 0 } }
    const nuevo: Golpe = { ...golpe(0.2, 0.2), lado: { x: -1, y: 0 } }
    const estado = estadoDelGolpe([viejo, nuevo], 0.25)
    const soloViejo = estadoDelGolpe([viejo], 0.25)
    const soloNuevo = estadoDelGolpe([nuevo], 0.25)
    expect(estado.vineta).toBe(Math.max(soloViejo.vineta, soloNuevo.vineta))
    expect(estado.lado).toEqual(soloViejo.vineta > soloNuevo.vineta ? viejo.lado : nuevo.lado)
    expect(estado.sacudida.z).toBeCloseTo(soloViejo.sacudida.z + soloNuevo.sacudida.z)
    expect(estado.escala).toBe(Math.min(soloViejo.escala, soloNuevo.escala))
    expect(estado.corte).toBe(Math.min(soloViejo.corte, soloNuevo.corte))
  })

  it('se olvidan los que ya no aportan y nunca se siguen más de los que caben', () => {
    let golpes: Golpe[] = []
    for (let i = 0; i < GOLPES_A_LA_VEZ + 3; i += 1) golpes = sumarGolpe(golpes, golpe(i * 0.01))
    expect(golpes).toHaveLength(GOLPES_A_LA_VEZ)
    expect(golpes[0].inicio).toBeCloseTo(0.03)
    const estado = estadoDelGolpe([golpe(0), golpe(DURACION_DEL_GOLPE)], DURACION_DEL_GOLPE + 0.01)
    expect(estado.vivos.map((g) => g.inicio)).toEqual([DURACION_DEL_GOLPE])
  })

  it('la cifra más larga manda en lo que dura un golpe', () => {
    expect(DURACION_DEL_GOLPE).toBeCloseTo(GOLPE.vineta.entrada + GOLPE.vineta.salida)
  })
})
