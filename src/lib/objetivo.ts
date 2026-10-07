/**
 * El objetivo de la partida, dicho de frente: qué pone el cartel en cada momento.
 *
 * Es el mismo fichero en todos los juegos del salón, junto con
 * `components/xr/CartelDeObjetivo.tsx`, y por eso **no importa nada del juego**: ni three, ni
 * React, ni su diccionario. Lo que es de cada juego —la frase de la misión, lo que le queda a
 * quien juega, dónde cuelga el cartel— entra por parámetros.
 *
 * **Cómo se monta en un juego:**
 *
 * 1. La escena recibe `objetivo?: Objetivo` del salón, igual que `reto` y `onTerminar`, y lo baja
 *    hasta donde se arma el marcador. Sin él (el juego abierto suelto) el cartel dice la misión
 *    y el récord local.
 * 2. Las frases de aquí van en inglés y son su propia clave. El diccionario del juego las
 *    aprende poniendo `...OBJETIVO_ES` **lo primero** de su objeto de traducciones (lo primero,
 *    para que una frase que el juego ya tuviera no choque).
 * 3. Con el estado de la partida se arma una `Partida` y se pide la vista, ya traducida:
 *    `cartelDeObjetivo({ objetivo, fase, puntos, mision: t(MISION), queda: '♥♥♡', cuenta }, t)`.
 *    - `fase`: `'antes'` (cuenta atrás o hasta el primer intento), `'jugando'`, `'final'`.
 *    - `puntos`: lo que se lleva, en la unidad del récord (golpes, si menos es mejor).
 *    - `queda`: lo que le queda a quien juega, ya escrito: vidas, tiros, tiempo u hoyos.
 *    - `cuenta: cuentaParaMedalla(objetivo, modo)`: `false` en la práctica y en cualquier modo
 *      que no sea el del récord; entonces `modo` es el nombre que se enseña.
 * 4. La vista se le da a `<CartelDeObjetivo>` con su sitio, su orientación y la distancia a la
 *    que se lee, y `medallaQueCelebra(partida)` en `celebra` para que festeje cada listón.
 * 5. Lo que el cartel ya dice se quita del marcador de al lado, y el panel se mide en un test
 *    con la misión del juego en los dos idiomas (`cartel.legible.test.ts` enseña cómo).
 *
 * **Las cifras se le dan como números** y el cartel las escribe como se leen en cada idioma,
 * igual que la chapa de la cabina del salón (`formatRecordValue`, en xrcade): el inglés separa
 * los miles con coma desde las cuatro cifras («7,000») y el español con punto y **desde las
 * cinco** («7000», «17.000»), que es la regla de la RAE y de CLDR, no un descuido. El separador
 * es una frase más del diccionario (`,`), así que sale del mismo traductor y no hace falta
 * decirle el idioma: de él se saca desde cuántas cifras se agrupa y el signo de los decimales.
 */

/** Lo que el salón le pasa a la escena: los listones del juego y la marca de quien juega. */
export type Objetivo = {
  medallas: { bronce: number; plata: number; oro: number }
  mejorEs: 'mas' | 'menos'
  unidad: string
  record: number | null
  modo: string
}

export const MEDALLAS = ['bronce', 'plata', 'oro'] as const
export type Medalla = (typeof MEDALLAS)[number]

/** En qué momento de la partida se está. */
export type FaseDelObjetivo = 'antes' | 'jugando' | 'final'

/** Un traductor: la frase en inglés es la clave, y los huecos van entre llaves. */
export type Traducir = (clave: string, valores?: Record<string, string | number>) => string

/** Lo que el juego sabe de la partida y el cartel necesita. */
export interface Partida {
  /** Lo que pasó el salón. Sin él, el juego está abierto suelto y no hay medallas. */
  objetivo?: Objetivo | null
  fase: FaseDelObjetivo
  /** Lo que se lleva, en la unidad del récord. */
  puntos: number
  /** La misión en una frase, ya traducida: «Encesta hasta fallar 3 veces». */
  mision: string
  /** Lo que le queda a quien juega, ya escrito: vidas, tiros, tiempo, hoyos. */
  queda?: string | null
  /** Si esta partida cuenta para la medalla. `false` en la práctica. Por defecto, sí. */
  cuenta?: boolean
  /** Cómo se llama lo que se juega, ya traducido, para decir que no cuenta. */
  modo?: string
  /** El récord local, para cuando no hay `objetivo`. */
  record?: number | null
  /** Qué es mejor, para cuando no hay `objetivo`. Por defecto, más. */
  mejorEs?: 'mas' | 'menos'
}

/** Lo que pinta el cartel: dos líneas como mucho y una barra. */
export interface VistaDelCartel {
  titulo: string
  detalle: string | null
  /** De 0 a 1, o `null` si no hay barra. Con «menos es mejor» es el margen que queda. */
  barra: number | null
  /** De qué medalla va el color: la que se persigue o la conseguida. */
  medalla: Medalla | null
  /** Se dice bajito: la partida no cuenta para medalla. */
  discreto: boolean
}

/**
 * Las frases del cartel en español. El inglés no se guarda: es la clave.
 *
 * Van aquí y no en el diccionario de cada juego para que el cartel diga lo mismo en todos; cada
 * diccionario las incluye con `...OBJETIVO_ES`.
 */
export const OBJETIVO_ES = {
  // El separador de miles, que también se traduce: «17,000» es «17.000». De él sale lo demás
  // de cómo se escribe una cifra (`ESCRITURA`): con punto se agrupa desde las cinco cifras.
  ',': '.',
  Bronze: 'Bronce',
  Silver: 'Plata',
  Gold: 'Oro',
  'Bronze {bronce} · Silver {plata} · Gold {oro}': 'Bronce {bronce} · Plata {plata} · Oro {oro}',
  'Gold {oro} or less · Silver {plata} · Bronze {bronce}': 'Oro {oro} o menos · Plata {plata} · Bronce {bronce}',
  '{medal} at {target} · you have {score}': '{medal} a {target} · llevas {score}',
  '{medal} with {target} or less · you have {score}': '{medal} con {target} o menos · llevas {score}',
  'Gold · your record {record} · you have {score}': 'Oro · tu récord {record} · llevas {score}',
  'Gold · new record {score}': 'Oro · nuevo récord {score}',
  'No medal within reach · you have {score}': 'Ya sin medalla · llevas {score}',
  'Your record {record} · you have {score}': 'Tu récord {record} · llevas {score}',
  'Your record {record}': 'Tu récord {record}',
  'You have {score}': 'Llevas {score}',
  'You scored {score}': 'Has hecho {score}',
  '{medal} · {score} {unit}': '{medal} · {score} {unit}',
  'No medal · {score} {unit}': 'Sin medalla · {score} {unit}',
  '{missing} short of bronze': 'Te han faltado {missing} para el bronce',
  '{missing} short of silver': 'Te han faltado {missing} para la plata',
  '{missing} short of gold': 'Te han faltado {missing} para el oro',
  '{missing} short of your record': 'Te han faltado {missing} para tu récord',
  '{extra} too many for bronze': 'Te han sobrado {extra} para el bronce',
  '{extra} too many for silver': 'Te han sobrado {extra} para la plata',
  '{extra} too many for gold': 'Te han sobrado {extra} para el oro',
  '{extra} over your record': 'Te han sobrado {extra} para tu récord',
  'You matched your record': 'Has igualado tu récord',
  'New record!': '¡Nuevo récord!',
  '{mode} · does not count for a medal': '{mode} · no cuenta para medalla',
} as const

const NOMBRE: Record<Medalla, string> = { bronce: 'Bronze', plata: 'Silver', oro: 'Gold' }
const FALTO: Record<Medalla, string> = {
  bronce: '{missing} short of bronze',
  plata: '{missing} short of silver',
  oro: '{missing} short of gold',
}
const SOBRO: Record<Medalla, string> = {
  bronce: '{extra} too many for bronze',
  plata: '{extra} too many for silver',
  oro: '{extra} too many for gold',
}

/** Sin traductor, en inglés: rellena los huecos y nada más. */
const EN: Traducir = (clave, valores) =>
  valores === undefined ? clave : clave.replace(/\{(\w+)\}/g, (_, hueco: string) => String(valores[hueco]))

/**
 * Cómo se escribe una cifra según el separador de miles que dé el traductor: el signo de los
 * decimales y desde cuántas cifras se agrupa. Son las reglas de la cabina del salón: con coma
 * (inglés) desde las cuatro, «1,240»; con punto (español) desde las cinco, «1240» y «12.400».
 * Un separador que no esté aquí se escribe como el del inglés.
 */
const ESCRITURA: Record<string, { decimal: string; desde: number }> = {
  ',': { decimal: '.', desde: 4 },
  '.': { decimal: ',', desde: 5 },
}

/**
 * Una cifra como se lee en ese idioma, sin `Intl`: fuera del navegador (el port a Godot) no lo
 * hay. Los miles, agrupados si la parte entera llega a las cifras que tocan; los decimales, si
 * los hubiera, hasta tres, redondeados y con el otro signo.
 */
function cifra(valor: number, miles: string): string {
  if (!Number.isFinite(valor)) return String(valor)
  const { decimal, desde } = ESCRITURA[miles] ?? ESCRITURA[',']
  // La parte entera y la decimal por separado, para que el redondeo no invente decimales.
  const absoluto = Math.abs(valor)
  let entera = Math.trunc(absoluto)
  let milesimas = Math.round((absoluto - entera) * 1000)
  if (milesimas === 1000) {
    entera += 1
    milesimas = 0
  }
  const cifras = String(entera)
  const agrupada = cifras.length < desde ? cifras : cifras.replace(/\B(?=(\d{3})+$)/g, miles)
  const resto = String(milesimas).padStart(3, '0').replace(/0+$/, '')
  return `${valor < 0 ? '-' : ''}${agrupada}${resto ? decimal + resto : ''}`
}

/** El traductor del juego, escribiendo las cifras de los huecos como se leen en su idioma. */
function conMiles(t: Traducir): Traducir {
  const miles = t(',')
  return (clave, valores) => {
    if (valores === undefined) return t(clave)
    const escritos: Record<string, string | number> = {}
    for (const [hueco, valor] of Object.entries(valores)) {
      escritos[hueco] = typeof valor === 'number' ? cifra(valor, miles) : valor
    }
    return t(clave, escritos)
  }
}

/** Si `a` es mejor marca que `b`. */
function mejor(a: number, b: number, mejorEs: 'mas' | 'menos'): boolean {
  return mejorEs === 'mas' ? a > b : a < b
}

/** Una parte de un todo, de 0 a 1. Un todo que no mide nada está entero. */
function fraccion(parte: number, todo: number): number {
  return todo > 0 ? Math.min(1, Math.max(0, parte / todo)) : 1
}

/** Si lo que se juega es el modo del que salen las medallas. Sin objetivo no hay nada que descontar. */
export function cuentaParaMedalla(objetivo: Objetivo | null | undefined, modo: string): boolean {
  return objetivo == null || objetivo.modo === modo
}

/** La mejor medalla que da esa puntuación, o `null` si no llega a ninguna. */
export function medallaConseguida(objetivo: Objetivo, puntos: number): Medalla | null {
  const llega = (medalla: Medalla) =>
    objetivo.mejorEs === 'mas' ? puntos >= objetivo.medallas[medalla] : puntos <= objetivo.medallas[medalla]
  return [...MEDALLAS].reverse().find(llega) ?? null
}

/**
 * El listón que se acaba de cruzar al pasar de una medalla a otra, o `null`.
 *
 * Solo cuenta subir: con «menos es mejor» la medalla se va perdiendo golpe a golpe, y eso no se
 * celebra.
 */
export function listonCruzado(antes: Medalla | null, ahora: Medalla | null): Medalla | null {
  if (ahora == null) return null
  return antes == null || MEDALLAS.indexOf(ahora) > MEDALLAS.indexOf(antes) ? ahora : null
}

/**
 * La medalla que ya es de quien juega, que es la que el cartel celebra al cambiar.
 *
 * Con «más es mejor» se gana en cuanto se cruza el listón; con «menos es mejor» no es de nadie
 * hasta que se acaba. Sin objetivo, o en un modo que no cuenta, no hay ninguna.
 */
export function medallaQueCelebra(partida: Partida): Medalla | null {
  const { objetivo, fase } = partida
  if (objetivo == null || partida.cuenta === false || fase === 'antes') return null
  if (objetivo.mejorEs === 'menos' && fase !== 'final') return null
  return medallaConseguida(objetivo, partida.puntos)
}

/** Lo que dura la celebración de un listón, en segundos: el color; el pulso acaba antes. */
export const SEGUNDOS_DE_FESTEJO = 1.2
const SEGUNDOS_DE_PULSO = 0.5
const CRECE = 0.12

/**
 * Cuánto crece el cartel a esos segundos de cruzar un listón: sube y vuelve a 1 en medio
 * segundo. Es toda la celebración que se mueve: nada a pantalla completa.
 */
export function pulsoDelFestejo(segundos: number): number {
  if (segundos <= 0 || segundos >= SEGUNDOS_DE_PULSO) return 1
  return 1 + CRECE * Math.sin((Math.PI * segundos) / SEGUNDOS_DE_PULSO)
}

/** Cómo quedó la partida frente al récord: lo que faltó, lo que sobró o que se ha batido. */
function frenteAlRecord(record: number, puntos: number, mejorEs: 'mas' | 'menos', t: Traducir): string {
  if (puntos === record) return t('You matched your record')
  if (mejor(puntos, record, mejorEs)) return t('New record!')
  return mejorEs === 'mas'
    ? t('{missing} short of your record', { missing: record - puntos })
    : t('{extra} over your record', { extra: puntos - record })
}

/** El juego suelto, sin salón: la misión y el récord local. */
function sinObjetivo(partida: Partida, t: Traducir): VistaDelCartel {
  const { fase, puntos, mision } = partida
  const record = partida.record ?? null
  const mejorEs = partida.mejorEs ?? 'mas'
  const base = { barra: null, medalla: null, discreto: false }
  if (fase === 'antes') {
    return { ...base, titulo: mision, detalle: record == null ? null : t('Your record {record}', { record }) }
  }
  if (fase === 'final') {
    return {
      ...base,
      titulo: t('You scored {score}', { score: puntos }),
      detalle: record == null ? null : frenteAlRecord(record, puntos, mejorEs, t),
    }
  }
  return {
    ...base,
    titulo:
      record == null
        ? t('You have {score}', { score: puntos })
        : t('Your record {record} · you have {score}', { record, score: puntos }),
    detalle: partida.queda ?? null,
    barra: record == null ? null : mejorEs === 'mas' ? fraccion(puntos, record) : fraccion(record - puntos, record),
  }
}

/** Antes de empezar: la misión y los tres listones. */
function antes(objetivo: Objetivo, mision: string, t: Traducir): VistaDelCartel {
  return {
    titulo: mision,
    detalle: t(
      objetivo.mejorEs === 'mas'
        ? 'Bronze {bronce} · Silver {plata} · Gold {oro}'
        : 'Gold {oro} or less · Silver {plata} · Bronze {bronce}',
      objetivo.medallas,
    ),
    barra: null,
    medalla: null,
    discreto: false,
  }
}

/** Jugando a más: el siguiente listón que falta; con el oro en la mano, el récord propio. */
function jugandoAMas(objetivo: Objetivo, puntos: number, queda: string | null, t: Traducir): VistaDelCartel {
  const { medallas, record } = objetivo
  const siguiente = MEDALLAS.find((medalla) => puntos < medallas[medalla])
  if (siguiente != null) {
    const desde = siguiente === 'bronce' ? 0 : medallas[MEDALLAS[MEDALLAS.indexOf(siguiente) - 1]]
    return {
      titulo: t('{medal} at {target} · you have {score}', {
        medal: t(NOMBRE[siguiente]),
        target: medallas[siguiente],
        score: puntos,
      }),
      detalle: queda,
      barra: fraccion(puntos - desde, medallas[siguiente] - desde),
      medalla: siguiente,
      discreto: false,
    }
  }
  const porBatir = record != null && record > medallas.oro && puntos <= record
  return {
    titulo: porBatir
      ? t('Gold · your record {record} · you have {score}', { record, score: puntos })
      : t('Gold · new record {score}', { score: puntos }),
    detalle: queda,
    barra: porBatir ? fraccion(puntos - medallas.oro, record - medallas.oro) : 1,
    medalla: 'oro',
    discreto: false,
  }
}

/**
 * Jugando a menos: la mejor marca que todavía se puede hacer, con el margen que queda.
 *
 * Aquí lo que se lleva solo sube, así que no hay listón que alcanzar sino uno del que no pasarse:
 * primero el récord propio, si es mejor que el oro, y después el oro, la plata y el bronce.
 */
function jugandoAMenos(objetivo: Objetivo, puntos: number, queda: string | null, t: Traducir): VistaDelCartel {
  const { medallas, record } = objetivo
  const base = { detalle: queda, discreto: false }
  if (record != null && record < medallas.oro && puntos <= record) {
    return {
      ...base,
      titulo: t('Your record {record} · you have {score}', { record, score: puntos }),
      barra: fraccion(record - puntos, record),
      medalla: 'oro',
    }
  }
  const alcance = medallaConseguida(objetivo, puntos)
  if (alcance == null) {
    return { ...base, titulo: t('No medal within reach · you have {score}', { score: puntos }), barra: 0, medalla: null }
  }
  return {
    ...base,
    titulo: t('{medal} with {target} or less · you have {score}', {
      medal: t(NOMBRE[alcance]),
      target: medallas[alcance],
      score: puntos,
    }),
    barra: fraccion(medallas[alcance] - puntos, medallas[alcance]),
    medalla: alcance,
  }
}

/** Al acabar: lo conseguido y lo que faltó, que es la frase que hace repetir. */
function final(objetivo: Objetivo, puntos: number, t: Traducir): VistaDelCartel {
  const { medallas, mejorEs, record } = objetivo
  const conseguida = medallaConseguida(objetivo, puntos)
  const unit = t(objetivo.unidad)
  const titulo =
    conseguida == null
      ? t('No medal · {score} {unit}', { score: puntos, unit })
      : t('{medal} · {score} {unit}', { medal: t(NOMBRE[conseguida]), score: puntos, unit })
  const siguiente = conseguida == null ? 'bronce' : MEDALLAS[MEDALLAS.indexOf(conseguida) + 1]
  const detalle =
    siguiente != null
      ? mejorEs === 'mas'
        ? t(FALTO[siguiente], { missing: medallas[siguiente] - puntos })
        : t(SOBRO[siguiente], { extra: puntos - medallas[siguiente] })
      : record == null
        ? null
        : frenteAlRecord(record, puntos, mejorEs, t)
  return { titulo, detalle, barra: null, medalla: conseguida, discreto: false }
}

/**
 * Lo que dice el cartel con esa partida, ya traducido.
 *
 * `t` es el traductor del juego; sin él sale en inglés. Las cifras salen como se leen en cada idioma.
 */
export function cartelDeObjetivo(partida: Partida, traducir: Traducir = EN): VistaDelCartel {
  const t = conMiles(traducir)
  const { objetivo, fase, puntos, mision } = partida
  if (partida.cuenta === false) {
    return {
      titulo:
        objetivo == null
          ? mision
          : t('{mode} · does not count for a medal', { mode: partida.modo ?? mision }),
      detalle: null,
      barra: null,
      medalla: null,
      discreto: true,
    }
  }
  if (objetivo == null) return sinObjetivo(partida, t)
  if (fase === 'antes') return antes(objetivo, mision, t)
  if (fase === 'final') return final(objetivo, puntos, t)
  const queda = partida.queda ?? null
  return objetivo.mejorEs === 'mas'
    ? jugandoAMas(objetivo, puntos, queda, t)
    : jugandoAMenos(objetivo, puntos, queda, t)
}
