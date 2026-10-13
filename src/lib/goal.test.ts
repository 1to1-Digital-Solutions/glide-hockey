import { describe, expect, it } from 'vitest'
import {
  MEDALLAS,
  OBJETIVO_ES,
  SEGUNDOS_DE_FESTEJO,
  cartelDeObjetivo,
  cuentaParaMedalla,
  listonCruzado,
  medallaConseguida,
  medallaQueCelebra,
  pulsoDelFestejo,
  type Objetivo,
  type Partida,
  type Traducir,
} from './objetivo'

/**
 * Lo que dice el cartel del objetivo en cada momento de la partida.
 *
 * Es el mismo fichero en todos los juegos del salón, así que aquí no hay nada de ninguno: un
 * juego en el que más es mejor (puntos, con vidas) y otro en el que menos es mejor (golpes, con
 * hoyos), con el salón pasando el objetivo y con el juego abierto suelto.
 */

/** Más es mejor: 6, 16 y 40 puntos. */
const PUNTOS: Objetivo = {
  medallas: { bronce: 6, plata: 16, oro: 40 },
  mejorEs: 'mas',
  unidad: 'points',
  record: null,
  modo: 'challenge',
}

/** Menos es mejor: 35, 27 y 23 golpes. */
const GOLPES: Objetivo = {
  medallas: { bronce: 35, plata: 27, oro: 23 },
  mejorEs: 'menos',
  unidad: 'strokes',
  record: null,
  modo: 'normal:9',
}

const MISION = 'Score until you miss 3 times'

const partida = (cambios: Partial<Partida>): Partida => ({
  objetivo: PUNTOS,
  fase: 'jugando',
  puntos: 0,
  mision: MISION,
  ...cambios,
})

/** El traductor de un juego en español: su diccionario incluye el del cartel. */
const es: Traducir = (clave, valores) => {
  const dicho = (OBJETIVO_ES as Record<string, string>)[clave] ?? clave
  return valores === undefined ? dicho : dicho.replace(/\{(\w+)\}/g, (_, hueco: string) => String(valores[hueco]))
}

describe('antes de empezar', () => {
  it('dice la misión y los tres listones', () => {
    expect(cartelDeObjetivo(partida({ fase: 'antes' }))).toEqual({
      titulo: MISION,
      detalle: 'Bronze 6 · Silver 16 · Gold 40',
      barra: null,
      medalla: null,
      discreto: false,
    })
  })

  it('con «menos es mejor» los listones se leen del revés: el oro primero y «o menos»', () => {
    const vista = cartelDeObjetivo(partida({ objetivo: GOLPES, fase: 'antes', mision: 'Nine holes' }))

    expect(vista.titulo).toBe('Nine holes')
    expect(vista.detalle).toBe('Gold 23 or less · Silver 27 · Bronze 35')
  })

  it('en español', () => {
    expect(cartelDeObjetivo(partida({ fase: 'antes' }), es).detalle).toBe('Bronce 6 · Plata 16 · Oro 40')
    expect(cartelDeObjetivo(partida({ objetivo: GOLPES, fase: 'antes' }), es).detalle).toBe(
      'Oro 23 o menos · Plata 27 · Bronce 35',
    )
  })
})

describe('jugando a más', () => {
  it('dice el siguiente listón que falta, lo que se lleva y lo que queda', () => {
    const vista = cartelDeObjetivo(partida({ puntos: 9, queda: 'Lives ♥♥♡' }))

    expect(vista.titulo).toBe('Silver at 16 · you have 9')
    expect(vista.detalle).toBe('Lives ♥♥♡')
    expect(vista.medalla).toBe('plata')
    // De los 6 del bronce a los 16 de la plata, con 9: tres de diez.
    expect(vista.barra).toBeCloseTo(0.3)
  })

  it('en español: «Plata a 16 · llevas 9»', () => {
    expect(cartelDeObjetivo(partida({ puntos: 9 }), es).titulo).toBe('Plata a 16 · llevas 9')
  })

  it('sin nada que le quede a quien juega, la segunda línea no sale', () => {
    expect(cartelDeObjetivo(partida({ puntos: 9 })).detalle).toBeNull()
  })

  it('al cruzar cada listón pasa al siguiente, y la barra vuelve a empezar', () => {
    const titulo = (puntos: number) => cartelDeObjetivo(partida({ puntos })).titulo
    const barra = (puntos: number) => cartelDeObjetivo(partida({ puntos })).barra

    expect(titulo(0)).toBe('Bronze at 6 · you have 0')
    expect(titulo(5)).toBe('Bronze at 6 · you have 5')
    expect(titulo(6)).toBe('Silver at 16 · you have 6')
    expect(titulo(15)).toBe('Silver at 16 · you have 15')
    expect(titulo(16)).toBe('Gold at 40 · you have 16')
    expect(titulo(39)).toBe('Gold at 40 · you have 39')

    expect(barra(0)).toBe(0)
    expect(barra(3)).toBeCloseTo(0.5)
    expect(barra(6)).toBe(0)
    expect(barra(16)).toBe(0)
    expect(barra(28)).toBeCloseTo(0.5)
  })

  it('con el oro en la mano, el objetivo es el récord propio', () => {
    const vista = cartelDeObjetivo(partida({ objetivo: { ...PUNTOS, record: 52 }, puntos: 46 }))

    expect(vista.titulo).toBe('Gold · your record 52 · you have 46')
    expect(vista.medalla).toBe('oro')
    // De los 40 del oro a los 52 del récord, con 46: la mitad.
    expect(vista.barra).toBeCloseTo(0.5)
    expect(cartelDeObjetivo(partida({ objetivo: { ...PUNTOS, record: 52 }, puntos: 46 }), es).titulo).toBe(
      'Oro · tu récord 52 · llevas 46',
    )
  })

  it('igualarlo no es batirlo: sigue siendo el objetivo', () => {
    expect(cartelDeObjetivo(partida({ objetivo: { ...PUNTOS, record: 52 }, puntos: 52 })).titulo).toBe(
      'Gold · your record 52 · you have 52',
    )
  })

  it('pasado el récord, o sin récord, o con uno que no llegaba al oro, es récord nuevo', () => {
    for (const record of [52, null, 12]) {
      const vista = cartelDeObjetivo(partida({ objetivo: { ...PUNTOS, record }, puntos: 53 }))
      expect(vista.titulo, `${record}`).toBe('Gold · new record 53')
      expect(vista.barra).toBe(1)
    }
  })
})

describe('jugando a menos', () => {
  const jugando = (puntos: number, record: number | null = null) =>
    cartelDeObjetivo(partida({ objetivo: { ...GOLPES, record }, puntos, queda: 'Hole 4 of 9' }))

  it('dice la mejor medalla que todavía se puede hacer y el margen que queda', () => {
    const vista = jugando(9)

    expect(vista.titulo).toBe('Gold with 23 or less · you have 9')
    expect(vista.detalle).toBe('Hole 4 of 9')
    expect(vista.medalla).toBe('oro')
    expect(vista.barra).toBeCloseTo(14 / 23)
  })

  it('en español: «Oro con 23 o menos · llevas 9»', () => {
    expect(cartelDeObjetivo(partida({ objetivo: GOLPES, puntos: 9 }), es).titulo).toBe('Oro con 23 o menos · llevas 9')
  })

  it('al pasarse de cada listón baja al siguiente, y pasado el bronce ya no hay medalla', () => {
    expect(jugando(23).titulo).toBe('Gold with 23 or less · you have 23')
    expect(jugando(23).barra).toBe(0)
    expect(jugando(24).titulo).toBe('Silver with 27 or less · you have 24')
    expect(jugando(28).titulo).toBe('Bronze with 35 or less · you have 28')
    expect(jugando(35).medalla).toBe('bronce')

    const fuera = jugando(36)
    expect(fuera.titulo).toBe('No medal within reach · you have 36')
    expect(fuera.medalla).toBeNull()
    expect(fuera.barra).toBe(0)
  })

  it('con un récord mejor que el oro, lo primero es no pasarse de él', () => {
    const vista = jugando(9, 21)

    expect(vista.titulo).toBe('Your record 21 · you have 9')
    expect(vista.barra).toBeCloseTo(12 / 21)
    // Pasado el récord, queda el oro.
    expect(jugando(22, 21).titulo).toBe('Gold with 23 or less · you have 22')
  })

  it('un récord que no llega al oro no es objetivo: lo es el oro', () => {
    expect(jugando(9, 30).titulo).toBe('Gold with 23 or less · you have 9')
  })
})

describe('al acabar', () => {
  const acabar = (puntos: number, objetivo: Objetivo = PUNTOS, t?: Traducir) =>
    cartelDeObjetivo(partida({ objetivo, fase: 'final', puntos }), t)

  it('dice lo conseguido y lo que faltó para la siguiente', () => {
    expect(acabar(9, { ...PUNTOS, record: 9 })).toEqual({
      titulo: 'Bronze · 9 points',
      detalle: '7 short of silver',
      barra: null,
      medalla: 'bronce',
      discreto: false,
      pie: 'You matched your record',
      vitor: 'Bronze!',
    })
    expect(acabar(20).titulo).toBe('Silver · 20 points')
    expect(acabar(20).detalle).toBe('20 short of gold')
  })

  it('sin medalla, lo que faltó para el bronce', () => {
    const vista = acabar(2)

    expect(vista.titulo).toBe('No medal · 2 points')
    expect(vista.detalle).toBe('4 short of bronze')
    expect(vista.medalla).toBeNull()
  })

  it('en español: «Te han faltado 7 para la plata»', () => {
    expect(acabar(9, PUNTOS, es).detalle).toBe('Te han faltado 7 para la plata')
    expect(acabar(2, PUNTOS, es).titulo).toBe('Sin medalla · 2 points')
    expect(acabar(2, PUNTOS, es).detalle).toBe('Te han faltado 4 para el bronce')
    expect(acabar(20, PUNTOS, es).detalle).toBe('Te han faltado 20 para el oro')
  })

  it('con el oro, lo que queda por delante es el récord', () => {
    expect(acabar(45, { ...PUNTOS, record: 52 }).detalle).toBe('7 short of your record')
    expect(acabar(52, { ...PUNTOS, record: 52 }).detalle).toBe('You matched your record')
    expect(acabar(60, { ...PUNTOS, record: 52 }).detalle).toBe('New record!')
    // Sin marca anterior, la primera.
    expect(acabar(45).detalle).toBe('First record!')
    expect(acabar(45).titulo).toBe('Gold · 45 points')
  })

  it('a menos: lo que sobró para la siguiente', () => {
    expect(acabar(25, GOLPES).titulo).toBe('Silver · 25 strokes')
    expect(acabar(25, GOLPES).detalle).toBe('2 too many for gold')
    expect(acabar(30, GOLPES).detalle).toBe('3 too many for silver')
    expect(acabar(40, GOLPES).titulo).toBe('No medal · 40 strokes')
    expect(acabar(40, GOLPES).detalle).toBe('5 too many for bronze')
    expect(acabar(25, GOLPES, es).detalle).toBe('Te han sobrado 2 para el oro')
  })

  it('a menos, con el oro: lo que sobró para el récord, o que se ha batido', () => {
    expect(acabar(22, { ...GOLPES, record: 20 }).detalle).toBe('2 over your record')
    expect(acabar(19, { ...GOLPES, record: 20 }).detalle).toBe('New record!')
    expect(acabar(20, { ...GOLPES, record: 20 }).detalle).toBe('You matched your record')
  })

  it('la unidad pasa por el traductor del juego', () => {
    const t: Traducir = (clave, valores) => (clave === 'points' ? 'puntos' : es(clave, valores))

    expect(acabar(9, PUNTOS, t).titulo).toBe('Bronce · 9 puntos')
  })
})

describe('el final, frente al récord de antes y con su porqué', () => {
  const acabar = (cambios: Partial<Partida>) => cartelDeObjetivo(partida({ fase: 'final', ...cambios }))

  it('la primera partida con marca dice «¡Primer récord!» y nunca «igualado»', () => {
    const vista = acabar({ puntos: 9 })

    expect(vista.pie).toBe('First record!')
    expect(JSON.stringify(vista)).not.toContain('matched')
    expect(cartelDeObjetivo(partida({ fase: 'final', puntos: 9 }), es).pie).toBe('¡Primer récord!')
    // A menos, cualquier vuelta acabada es marca; a más, un cero no lo es.
    expect(acabar({ objetivo: GOLPES, puntos: 40 }).pie).toBe('First record!')
    expect(acabar({ puntos: 0 }).pie).toBeUndefined()
  })

  it('sin llegar al récord dice el récord a secas; batido o igualado, lo dice', () => {
    expect(acabar({ objetivo: { ...PUNTOS, record: 31 }, puntos: 9 }).pie).toBe('Your best 31')
    expect(acabar({ objetivo: { ...PUNTOS, record: 8 }, puntos: 9 }).pie).toBe('New record!')
    expect(acabar({ objetivo: { ...GOLPES, record: 30 }, puntos: 33 }).pie).toBe('Your best 30')
    expect(cartelDeObjetivo(partida({ objetivo: { ...PUNTOS, record: 31 }, fase: 'final', puntos: 9 }), es).pie).toBe(
      'Tu mejor 31',
    )
  })

  it('la causa que da el juego va delante, también en el juego suelto', () => {
    expect(acabar({ objetivo: { ...PUNTOS, record: 31 }, puntos: 9, causa: 'Three on the floor' }).pie).toBe(
      'Three on the floor · Your best 31',
    )
    expect(acabar({ objetivo: { ...PUNTOS, record: 30 }, puntos: 45, causa: 'Out of time' })).toMatchObject({
      detalle: 'New record!',
      pie: 'Out of time',
    })
    expect(acabar({ objetivo: null, puntos: 4, record: 6, causa: 'Out of time' })).toMatchObject({
      detalle: '2 short of your record',
      pie: 'Out of time',
    })
    // Jugando, la causa todavía no es nada.
    expect(cartelDeObjetivo(partida({ puntos: 4, causa: 'Out of time' })).pie).toBeUndefined()
  })

  it('un juego que ya dice el récord en su marcador no lo oye dos veces', () => {
    expect(acabar({ puntos: 9, recordAparte: true }).pie).toBeUndefined()
    expect(acabar({ puntos: 45, recordAparte: true }).detalle).toBeNull()
    expect(acabar({ objetivo: null, puntos: 9, recordAparte: true, causa: 'Out of time' })).toMatchObject({
      detalle: null,
      pie: 'Out of time',
    })
  })
})

describe('al cruzar un listón el cartel dice la medalla', () => {
  it('a más, en cuanto es suya: «¡Bronce!», en su idioma', () => {
    expect(cartelDeObjetivo(partida({ puntos: 5 })).vitor).toBeUndefined()
    expect(cartelDeObjetivo(partida({ puntos: 6 })).vitor).toBe('Bronze!')
    expect(cartelDeObjetivo(partida({ puntos: 20 }), es).vitor).toBe('¡Plata!')
    expect(cartelDeObjetivo(partida({ puntos: 40 }), es).vitor).toBe('¡Oro!')
  })

  it('a menos, al acabar; y nunca en lo que no cuenta', () => {
    expect(cartelDeObjetivo(partida({ objetivo: GOLPES, puntos: 20 })).vitor).toBeUndefined()
    expect(cartelDeObjetivo(partida({ objetivo: GOLPES, fase: 'final', puntos: 20 })).vitor).toBe('Gold!')
    expect(cartelDeObjetivo(partida({ puntos: 20, cuenta: false })).vitor).toBeUndefined()
  })
})

describe('el bronce en lo que se cuenta', () => {
  const contable = (puntos: number) => `≈ ${Math.round(puntos / 150)} sticks`

  it('la primera vez, antes de empezar, el bronce se dice en lo que se cuenta, y con el oro sin la plata', () => {
    const objetivo: Objetivo = { ...PUNTOS, medallas: { bronce: 1900, plata: 4000, oro: 7000 } }

    expect(cartelDeObjetivo(partida({ objetivo, fase: 'antes', contable })).detalle).toBe(
      'Bronze ≈ 13 sticks · Gold 7,000',
    )
    expect(cartelDeObjetivo(partida({ objetivo, fase: 'antes', contable }), es).detalle).toBe(
      'Bronce ≈ 13 sticks · Oro 7000',
    )
    expect(cartelDeObjetivo(partida({ objetivo: GOLPES, fase: 'antes', contable: () => '≈ 4 holes' })).detalle).toBe(
      'Gold 23 or less · Bronze ≈ 4 holes',
    )
  })

  it('con récord ya se sabe lo que vale una cifra: los listones a secas', () => {
    expect(cartelDeObjetivo(partida({ objetivo: { ...PUNTOS, record: 3 }, fase: 'antes', contable })).detalle).toBe(
      'Bronze 6 · Silver 16 · Gold 40',
    )
    expect(cartelDeObjetivo(partida({ fase: 'antes', contable: null })).detalle).toBe('Bronze 6 · Silver 16 · Gold 40')
  })
})

describe('un modo que no cuenta', () => {
  it('lo dice bajito, en una línea y sin barra', () => {
    expect(cartelDeObjetivo(partida({ cuenta: false, modo: 'Practice', puntos: 12, queda: '3 balls' }))).toEqual({
      titulo: 'Practice · does not count for a medal',
      detalle: null,
      barra: null,
      medalla: null,
      discreto: true,
    })
    expect(cartelDeObjetivo(partida({ cuenta: false, modo: 'Práctica' }), es).titulo).toBe(
      'Práctica · no cuenta para medalla',
    )
  })

  it('sin nombre de modo dice la misión; y sin salón no habla de medallas', () => {
    expect(cartelDeObjetivo(partida({ cuenta: false })).titulo).toBe(`${MISION} · does not count for a medal`)
    expect(cartelDeObjetivo(partida({ objetivo: null, cuenta: false, modo: 'Practice' }))).toMatchObject({
      titulo: MISION,
      discreto: true,
    })
  })

  it('cuenta el modo del que salen las medallas; sin objetivo no hay nada que descontar', () => {
    expect(cuentaParaMedalla(PUNTOS, 'challenge')).toBe(true)
    expect(cuentaParaMedalla(PUNTOS, 'practice')).toBe(false)
    expect(cuentaParaMedalla(null, 'practice')).toBe(true)
    expect(cuentaParaMedalla(undefined, 'practice')).toBe(true)
  })
})

describe('el juego suelto, sin objetivo del salón', () => {
  const suelto = (cambios: Partial<Partida>) => cartelDeObjetivo(partida({ objetivo: undefined, ...cambios }))

  it('antes de empezar: la misión y el récord local, si lo hay', () => {
    expect(suelto({ fase: 'antes', record: 31 })).toEqual({
      titulo: MISION,
      detalle: 'Your record 31',
      barra: null,
      medalla: null,
      discreto: false,
    })
    expect(suelto({ fase: 'antes' }).detalle).toBeNull()
    expect(suelto({ fase: 'antes', record: null }).detalle).toBeNull()
  })

  it('jugando: el récord como listón, lo que se lleva y lo que queda', () => {
    const vista = suelto({ puntos: 12, record: 30, queda: 'Lives ♥♥♥' })

    expect(vista.titulo).toBe('Your record 30 · you have 12')
    expect(vista.detalle).toBe('Lives ♥♥♥')
    expect(vista.barra).toBeCloseTo(0.4)
    expect(suelto({ puntos: 45, record: 30 }).barra).toBe(1)
  })

  it('jugando sin récord: solo lo que se lleva', () => {
    const vista = suelto({ puntos: 12 })

    expect(vista.titulo).toBe('You have 12')
    expect(vista.detalle).toBeNull()
    expect(vista.barra).toBeNull()
  })

  it('jugando a menos, la barra es el margen que queda hasta el récord', () => {
    expect(suelto({ puntos: 10, record: 40, mejorEs: 'menos' }).barra).toBeCloseTo(0.75)
    expect(suelto({ puntos: 50, record: 40, mejorEs: 'menos' }).barra).toBe(0)
    // Un récord de cero no deja margen que medir.
    expect(suelto({ puntos: 0, record: 0, mejorEs: 'menos' }).barra).toBe(1)
  })

  it('al acabar: lo hecho y cómo quedó frente al récord', () => {
    expect(suelto({ fase: 'final', puntos: 18, record: 30 })).toMatchObject({
      titulo: 'You scored 18',
      detalle: '12 short of your record',
    })
    expect(suelto({ fase: 'final', puntos: 31, record: 30 }).detalle).toBe('New record!')
    expect(suelto({ fase: 'final', puntos: 18 }).detalle).toBe('First record!')
    expect(suelto({ fase: 'final', puntos: 0 }).detalle).toBeNull()
    expect(suelto({ fase: 'final', puntos: 44, record: 40, mejorEs: 'menos' }).detalle).toBe('4 over your record')
    expect(suelto({ fase: 'final', puntos: 38, record: 40, mejorEs: 'menos' }).detalle).toBe('New record!')
  })
})

describe('las medallas', () => {
  it('la conseguida es la mejor a la que llega la puntuación', () => {
    expect(medallaConseguida(PUNTOS, 5)).toBeNull()
    expect(medallaConseguida(PUNTOS, 6)).toBe('bronce')
    expect(medallaConseguida(PUNTOS, 16)).toBe('plata')
    expect(medallaConseguida(PUNTOS, 40)).toBe('oro')
    expect(medallaConseguida(GOLPES, 36)).toBeNull()
    expect(medallaConseguida(GOLPES, 35)).toBe('bronce')
    expect(medallaConseguida(GOLPES, 27)).toBe('plata')
    expect(medallaConseguida(GOLPES, 23)).toBe('oro')
  })

  it('un listón se cruza al subir de medalla, nunca al bajar ni al quedarse', () => {
    expect(listonCruzado(null, 'bronce')).toBe('bronce')
    expect(listonCruzado('bronce', 'plata')).toBe('plata')
    expect(listonCruzado(null, 'oro')).toBe('oro')
    expect(listonCruzado('plata', 'plata')).toBeNull()
    expect(listonCruzado('oro', 'plata')).toBeNull()
    expect(listonCruzado('oro', null)).toBeNull()
    expect(listonCruzado(null, null)).toBeNull()
    expect(MEDALLAS).toEqual(['bronce', 'plata', 'oro'])
  })

  it('a más se celebra en cuanto se cruza el listón; antes de empezar no hay nada', () => {
    expect(medallaQueCelebra(partida({ fase: 'antes', puntos: 0 }))).toBeNull()
    expect(medallaQueCelebra(partida({ puntos: 5 }))).toBeNull()
    expect(medallaQueCelebra(partida({ puntos: 6 }))).toBe('bronce')
    expect(medallaQueCelebra(partida({ fase: 'final', puntos: 41 }))).toBe('oro')
  })

  it('a menos no es de nadie hasta que se acaba', () => {
    expect(medallaQueCelebra(partida({ objetivo: GOLPES, puntos: 3 }))).toBeNull()
    expect(medallaQueCelebra(partida({ objetivo: GOLPES, fase: 'final', puntos: 25 }))).toBe('plata')
  })

  it('sin objetivo, o en un modo que no cuenta, no hay medalla que celebrar', () => {
    expect(medallaQueCelebra(partida({ objetivo: null, puntos: 50 }))).toBeNull()
    expect(medallaQueCelebra(partida({ cuenta: false, puntos: 50 }))).toBeNull()
  })
})

describe('el pulso de la celebración', () => {
  it('crece y vuelve a su tamaño antes de que acabe el festejo', () => {
    expect(pulsoDelFestejo(0)).toBe(1)
    expect(pulsoDelFestejo(-1)).toBe(1)
    expect(pulsoDelFestejo(0.25)).toBeGreaterThan(1.1)
    expect(pulsoDelFestejo(0.25)).toBeLessThan(1.2)
    expect(pulsoDelFestejo(0.5)).toBe(1)
    expect(pulsoDelFestejo(SEGUNDOS_DE_FESTEJO)).toBe(1)
  })
})

describe('las cifras', () => {
  /** Listones de miles, como los del arco o el hockey. */
  const MILES: Objetivo = { ...PUNTOS, medallas: { bronce: 500, plata: 7000, oro: 17000 }, record: 104250 }
  const con = (cambios: Partial<Partida>, t?: Traducir) => cartelDeObjetivo(partida({ objetivo: MILES, ...cambios }), t)

  it('el inglés separa los miles con coma desde las cuatro cifras', () => {
    expect(con({ fase: 'antes' }).detalle).toBe('Bronze 500 · Silver 7,000 · Gold 17,000')
    expect(con({ puntos: 1250 }).titulo).toBe('Silver at 7,000 · you have 1,250')
    expect(con({ puntos: 1234567 }).titulo).toBe('Gold · new record 1,234,567')
  })

  it('el español, con punto y desde las cinco: «7000» y «17.000», como la chapa de la cabina', () => {
    expect(con({ fase: 'antes' }, es).detalle).toBe('Bronce 500 · Plata 7000 · Oro 17.000')
    expect(con({ puntos: 1250 }, es).titulo).toBe('Plata a 7000 · llevas 1250')
    expect(con({ puntos: 999 }, es).titulo).toBe('Plata a 7000 · llevas 999')
    expect(con({ objetivo: undefined, puntos: 9999 }, es).titulo).toBe('Llevas 9999')
    expect(con({ objetivo: undefined, puntos: 10000 }, es).titulo).toBe('Llevas 10.000')
    expect(con({ objetivo: undefined, puntos: 1234567 }, es).titulo).toBe('Llevas 1.234.567')
  })

  it('también el récord, lo que faltó y lo que se ha hecho', () => {
    expect(con({ puntos: 20000 }, es).titulo).toBe('Oro · tu récord 104.250 · llevas 20.000')
    expect(con({ fase: 'final', puntos: 5800 }, es)).toMatchObject({
      titulo: 'Bronce · 5800 points',
      detalle: 'Te han faltado 1200 para la plata',
    })
    expect(con({ fase: 'final', puntos: 5800 })).toMatchObject({
      titulo: 'Bronze · 5,800 points',
      detalle: '1,200 short of silver',
    })
    expect(con({ objetivo: undefined, fase: 'antes', record: 31000 }, es).detalle).toBe('Tu récord 31.000')
  })

  it('el separador sale del traductor del juego: sin esa frase en su diccionario, el del inglés', () => {
    const sinElCartel: Traducir = (clave, valores) =>
      valores === undefined ? clave : clave.replace(/\{(\w+)\}/g, (_, hueco: string) => String(valores[hueco]))

    expect(con({ puntos: 1250 }, sinElCartel).titulo).toBe('Silver at 7,000 · you have 1,250')
  })

  it('un separador que no es ni la coma ni el punto se agrupa como en inglés', () => {
    const conEspacio: Traducir = (clave, valores) => (clave === ',' ? ' ' : es(clave, valores))

    expect(con({ objetivo: undefined, puntos: 1234.5 }, conEspacio).titulo).toBe('Llevas 1 234.5')
  })

  it('una cifra negativa se sigue leyendo, y agrupa por sus cifras, no por el signo', () => {
    expect(con({ objetivo: undefined, puntos: -1500 }).titulo).toBe('You have -1,500')
    expect(con({ objetivo: undefined, puntos: -1500 }, es).titulo).toBe('Llevas -1500')
    expect(con({ objetivo: undefined, puntos: -15000 }, es).titulo).toBe('Llevas -15.000')
  })

  it('los decimales llevan el otro signo, hasta tres y redondeados', () => {
    expect(con({ objetivo: undefined, puntos: 1234.5 }).titulo).toBe('You have 1,234.5')
    expect(con({ objetivo: undefined, puntos: 1234.5 }, es).titulo).toBe('Llevas 1234,5')
    expect(con({ objetivo: undefined, puntos: 12345.678 }, es).titulo).toBe('Llevas 12.345,678')
    expect(con({ objetivo: undefined, puntos: 0.1 + 0.2 }, es).titulo).toBe('Llevas 0,3')
    expect(con({ objetivo: undefined, puntos: 2.25049 }).titulo).toBe('You have 2.25')
    // El redondeo que llega al entero se lo lleva: 9999,9996 es 10.000, y ya agrupa.
    expect(con({ objetivo: undefined, puntos: 9999.9996 }, es).titulo).toBe('Llevas 10.000')
    expect(con({ objetivo: undefined, puntos: 999.9996 }).titulo).toBe('You have 1,000')
  })

  it('lo que no es una cifra se escribe tal cual, sin agrupar nada', () => {
    expect(con({ objetivo: undefined, puntos: Number.NaN }).titulo).toBe('You have NaN')
    expect(con({ objetivo: undefined, puntos: Number.POSITIVE_INFINITY }, es).titulo).toBe('Llevas Infinity')
  })
})

describe('el diccionario del cartel', () => {
  it('conserva los huecos de cada frase al traducirla', () => {
    const huecos = (frase: string) => [...frase.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

    for (const [en, traducida] of Object.entries(OBJETIVO_ES)) expect(huecos(traducida), en).toEqual(huecos(en))
  })
})
