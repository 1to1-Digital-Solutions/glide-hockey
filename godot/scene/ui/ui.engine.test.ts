/**
 * La interfaz de Glide Hockey en Godot, medida con el instrumento de la web y pulsada con el ratón.
 *
 * **Medida con lo mismo que la web**: los paneles de aquí apuntan lo que escriben con la letra del
 * motor (`panel.escritos`) y pasan por los guardianes de la web —`legibilidad.ts` (nada se pisa ni
 * se sale, ninguna letra por debajo de lo que se lee a su distancia), `panelReading.ts` (cada letra
 * en su fila y con el escorzo, desde donde se juega con el visor, a tres alturas de ojos y con el
 * mundo de pie o a su altura) y `exitCorner.ts` (la salida, abajo a la derecha)—, con la columna a
 * la escala a la que se pinta, como `menu.legible.test.ts`. En los dos idiomas y en todos los modos.
 *
 * **Pulsada con el ratón**: la interfaz entera montada con una cámara de verdad y los clics por el
 * mismo `PunteroDeRaton` que en plano: el menú lleva a jugar, parar pregunta, el aviso vuelve o
 * sale, y el final vuelve a jugar o al menú.
 *
 * Corre dentro del motor, con los tests de dominio (`npm run godot:build -- --tests`).
 */
import { Camera3D, Engine, InputEventMouseButton, InputEventMouseMotion, MouseButton, Node, Node3D, OS, SceneTree, Vector2, Vector3 } from 'godot'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { MIN_ANGLE, legibilityProblems } from '@kit/lib/ui/legibility'
import { LINE_HEIGHT, approximateMeasurer, type Escrito, drawnTexts } from '@kit/lib/ui/text'
import { PANEL_DEL_TUTORIAL } from '@kit/lib/ui/tutorial'
import { Sfx } from '@kit/runtime/sfx'
import { PointerAim } from '@kit/runtime/ui/pointerAim'

import { LANGS, VOLUME_KEYS } from '@/lib/settings'
import { partidaDelCartel, sitioDelCartel, type LoQueSeJuega } from '@/lib/scoreboardSign'
import { COUNTDOWN_SECONDS, DIFFICULTY_ORDER } from '@/lib/gameConfig'
import { GAME_MODE_ORDER, type GameMode } from '@/lib/gameMode'
import { exitProblems } from '@/lib/exitCorner'
import { panelPoints, whatThePanelHides } from '@/lib/panelOcclusion'
import { sizesOffList, textsOnButtons, unreadableTexts, worstReadingDistance, type PanelPose } from '@/lib/panelReading'
import { gameStorage } from '@/lib/storage'
import { goalSign, type Goal, type GoalSignView } from '@/lib/goal'
import { traductor, traductorSuave } from '@/lib/textos'
import { TUTORIAL_STEPS } from '@/lib/tutorial'
import { REFERENCE_EYE_HEIGHT } from '@/lib/uiHeight'
import { MENU_DEGREES, degreesFromFront, gameName } from '@/lib/menuTemplate'
import { MENU_PANEL, MENU_ROW, MENU_TEXT, sitioDelMenu } from '@/lib/xrMenuLayout'

import { LANG_KEY, currentLang, volumeLevels } from '@kit/runtime/settings'
import { CLAVE_DEL_CONFORT, confort } from './comfort'
import { AvisoDeSalir } from './notice'
import { Cartel } from './sign'
import { FinalDeLaPartida, LETRA_DEL_DUELO, LETRA_DEL_FINAL } from './gameOver'
import { InterfazDelJuego } from './ui'
import { CuentaAtras } from './scoreboard'
import { MenuDelJuego, type EstadoDelMenu } from './menu'
import { Partida, type VistaDelDuelo } from './match'
import {
  AVISO,
  AVISO_DEL_MAZO,
  CAJAS_DEL_FINAL,
  CARTEL,
  FILAS_DEL_MARCADOR,
  MARCADOR,
  SITIO_DEL_CARTEL,
  ESCALA_DE_LA_COLUMNA,
  MEDIDAS_DEL_TUTORIAL,
  PROPORCION_DEL_CARTEL,
  TUTORIAL_EN_PLANO,
  delEspacioDelJugador,
  FINAL,
  LETRA_DEL_AVISO,
  LETRA_DEL_AVISO_DE_SALIR,
  XR_UI,
  XR_UI_ROTATION,
  aLaEscala,
  vistasDelPanel,
} from './layout'
import { FRASES, FRASES_CON_UN_TOQUE, TutorialDelJuego } from './tutorial'

/**
 * Lo que la web mide de un panel: que nada se pise ni se salga a la distancia a la que peor se
 * lee, y que cada letra llegue desde cada vista. `k` es la escala a la que se pinta.
 */
function medir(
  escritos: readonly Escrito[],
  panel: { width: number; height: number },
  vistas: { donde: string; pose: PanelPose; ojos: { x: number; y: number; z: number } }[],
  k = 1,
): string[] {
  const escalados = aLaEscala(escritos, k)
  const distancia = Math.max(...vistas.map(({ pose, ojos }) => worstReadingDistance(drawnTexts(escalados), pose, ojos, LINE_HEIGHT)))
  return [
    ...legibilityProblems(escalados, { panel: { width: panel.width * k, height: panel.height * k }, distance: distancia }),
    ...vistas.flatMap(({ pose, ojos, donde }) => unreadableTexts(drawnTexts(escalados), pose, ojos, LINE_HEIGHT).map((p) => `${donde}: ${p}`)),
  ]
}

const COLUMNA = vistasDelPanel(XR_UI.panel, XR_UI_ROTATION.panel)
/** Donde nace el menú con el visor: casi de frente (`XR_UI.menu`), como en la web. */
const SITIO_DEL_MENU = vistasDelPanel(XR_UI.menu, XR_UI_ROTATION.menu)

const cajas = (botones: Iterable<{ caja: { x: number; y: number; width: number; height: number }; nodo: Node3D }>) =>
  [...botones].filter((b) => b.nodo.visible).map((b) => b.caja)

function estadoDelMenu(cambios: Partial<EstadoDelMenu> = {}): EstadoDelMenu {
  return {
    lang: 'en',
    modo: 'practice',
    dificultad: 'easy',
    goles: 7,
    sinFin: false,
    nivel: 1,
    abierto: 1,
    estrellas: Array.from({ length: 15 }, () => 0 as const),
    record: 0,
    confort: 'normal',
    habitacion: false,
    escenario: 'place',
    objetivo: null,
    masOpciones: true,
    ...cambios,
  }
}

/** Todos los momentos del menú: idioma, modo, con récord o sin él, sin fin, y niveles avanzados. */
function momentosDelMenu(): { donde: string; estado: EstadoDelMenu }[] {
  const momentos: { donde: string; estado: EstadoDelMenu }[] = []
  for (const lang of LANGS) {
    for (const modo of GAME_MODE_ORDER) {
      momentos.push({ donde: `${lang} ${modo}`, estado: estadoDelMenu({ lang, modo }) })
      momentos.push({ donde: `${lang} ${modo} con récord`, estado: estadoDelMenu({ lang, modo, record: 98765, nivel: 12, abierto: 15, confort: 'off' }) })
      momentos.push({ donde: `${lang} ${modo} plegado`, estado: estadoDelMenu({ lang, modo, masOpciones: false, record: 98765 }) })
    }
    momentos.push({ donde: `${lang} sin fin`, estado: estadoDelMenu({ lang, sinFin: true }) })
    momentos.push({ donde: `${lang} en tu habitación`, estado: estadoDelMenu({ lang, habitacion: true, escenario: 'room', record: 98765 }) })
  }
  return momentos
}

describe('el menú mide lo que la web', () => {
  const punteria = new PointerAim()
  const menu = new MenuDelJuego(
    { elegirModo() {}, elegirDificultad() {}, elegirConfort() {}, mover() {}, sinFin() {}, alternarEscenario() {}, masOpciones() {}, jugar() {}, salir() {} },
    punteria,
  )

  it('las filas del modo: la práctica pregunta nivel y goles; los niveles, la fase; el reto, nada', () => {
    const filas = (modo: GameMode) => {
      menu.pintar(estadoDelMenu({ modo }))
      return menu.panel.escritos.map((e) => e.texto).filter((t) => ['Mode', 'Level', 'Goals', 'Stage'].includes(t))
    }
    expect(filas('practice')).toEqual(['Mode', 'Level', 'Goals'])
    expect(filas('levels')).toEqual(['Mode', 'Stage'])
    expect(filas('challenge')).toEqual(['Mode'])
    expect(filas('duel')).toEqual(['Mode'])
  })

  it('lo que no es del modo, plegado tras «Más opciones» como en la web; en el reto, sin botón', () => {
    const filas = (modo: GameMode, masOpciones: boolean) => {
      menu.pintar(estadoDelMenu({ modo, masOpciones }))
      return menu.panel.escritos
        .map((e) => e.texto)
        .filter((t) => ['Mode', 'Level', 'Goals', 'Stage', 'When hit', 'More options', 'Fewer options'].includes(t))
    }
    expect(filas('practice', false)).toEqual(['More options', 'Mode'])
    expect(filas('levels', false)).toEqual(['More options', 'Mode', 'Stage'])
    expect(filas('duel', false)).toEqual(['More options', 'Mode'])
    expect(filas('practice', true)).toEqual(['Fewer options', 'When hit', 'Mode', 'Level', 'Goals'])
    menu.pintar(estadoDelMenu({ modo: 'practice', masOpciones: false }))
    expect(menu.boton('mas opciones').nodo.visible).toBe(true)
    for (const id of ['confort off', 'escenario', `nivel ${DIFFICULTY_ORDER[0]}`, 'menos', 'sin fin']) expect(menu.boton(id).nodo.visible, id).toBe(false)
    expect(filas('challenge', true)).toEqual(['Mode'])
    expect(menu.boton('mas opciones').nodo.visible).toBe(false)
    expect(menu.boton('confort off').nodo.visible).toBe(false)
  })

  it('se llama como la cabina, arriba a la izquierda y sin traducir, como en la web', () => {
    for (const { donde, estado } of momentosDelMenu()) {
      menu.pintar(estado)
      const titulo = menu.panel.escritos.find((e) => e.texto === gameName())
      expect(titulo, donde).toBeDefined()
      expect(titulo!.alto / LINE_HEIGHT).toBeCloseTo(MENU_TEXT.title, 9)
      expect(titulo!.y).toBeCloseTo(MENU_ROW.title, 9)
    }
  })

  it('cada modo lleva su icono y su nombre debajo, como en la web, y el elegido se enciende', () => {
    menu.pintar(estadoDelMenu({ modo: 'duel' }))
    for (const modo of GAME_MODE_ORDER) {
      const b = menu.boton(`modo ${modo}`)
      expect(b.nodo.visible, modo).toBe(true)
    }
    // El nombre de cada modo, dentro de su botón; y qué es el elegido, en la línea de abajo.
    expect(menu.panel.escritos.some((e) => e.texto.startsWith('Take turns'))).toBe(true)
    for (const nombre of ['Practice', 'Levels', 'Challenge', 'Duel']) {
      expect(menu.panel.escritos.filter((e) => e.texto === nombre), nombre).toHaveLength(1)
    }
  })

  it('con la letra de Godot cada texto mide lo que estima la web, con un cuarto de margen', () => {
    const estimado = approximateMeasurer()
    for (const { donde, estado } of momentosDelMenu()) {
      menu.pintar(estado)
      for (const e of menu.panel.escritos) {
        const razon = e.ancho / estimado.ancho(e.texto, e.alto / LINE_HEIGHT)
        expect(razon, `${donde}: «${e.texto}»`).toBeGreaterThan(0.6)
        expect(razon, `${donde}: «${e.texto}»`).toBeLessThan(1.25)
      }
    }
  })

  it('se lee: nada se pisa ni se sale, y cada letra llega desde donde se juega', () => {
    for (const { donde, estado } of momentosDelMenu()) {
      menu.pintar(estado)
      expect(medir(menu.panel.escritos, MENU_PANEL, SITIO_DEL_MENU, ESCALA_DE_LA_COLUMNA), donde).toEqual([])
    }
  })

  it(`nace a ${MENU_DEGREES}° o menos del frente, en el sitio de la web`, () => {
    expect(degreesFromFront(delEspacioDelJugador(XR_UI.menu))).toBeLessThanOrEqual(MENU_DEGREES)
    expect(XR_UI.menu).toEqual(sitioDelMenu())
  })

  it('y la medida se entera cuando no cabe: estrechado a un tercio, canta', () => {
    menu.pintar(estadoDelMenu({ lang: 'es' }))
    expect(menu.panel.escritos.length).toBeGreaterThan(5)
    const estrecho = { width: MENU_PANEL.width / 3, height: MENU_PANEL.height }
    expect(legibilityProblems(menu.panel.escritos, { panel: estrecho }).join(' ')).toContain('runs off the panel')
  })

  it('todo se escribe a un tamaño de la lista, sin encogerse, y ningún texto se mete en otro botón', () => {
    for (const { donde, estado } of momentosDelMenu()) {
      menu.pintar(estado)
      expect(sizesOffList(drawnTexts(menu.panel.escritos), LINE_HEIGHT, Object.values(MENU_TEXT)), donde).toEqual([])
      expect(textsOnButtons(drawnTexts(menu.panel.escritos), cajas(menu.botones.values())), donde).toEqual([])
    }
  })

  it('la salida está en la esquina de abajo a la derecha, en todos los modos', () => {
    for (const modo of GAME_MODE_ORDER) {
      menu.pintar(estadoDelMenu({ modo }))
      const salida = menu.boton('salir').caja
      const resto = cajas([...menu.botones.values()].filter((b) => b.id !== 'salir'))
      expect(exitProblems(salida, resto, MENU_PANEL), modo).toEqual([])
    }
  })

  it('lo que no se puede se apaga: bajar del mínimo, subir de lo abierto, los goles sin fin y la habitación', () => {
    menu.pintar(estadoDelMenu({ modo: 'levels', nivel: 1, abierto: 1 }))
    expect(menu.boton('menos').apagado).toBe(true)
    expect(menu.boton('mas').apagado).toBe(true)
    expect(menu.boton('escenario').apagado).toBe(true)
    menu.pintar(estadoDelMenu({ modo: 'levels', nivel: 2, abierto: 3 }))
    expect(menu.boton('menos').apagado).toBe(false)
    expect(menu.boton('mas').apagado).toBe(false)
    menu.pintar(estadoDelMenu({ sinFin: true }))
    expect(menu.boton('menos').apagado).toBe(true)
    expect(menu.goles.nodo.visible).toBe(false)
    // Con realidad aumentada, el decorado se puede cambiar y dice cuál está puesto.
    menu.pintar(estadoDelMenu({ habitacion: true, escenario: 'room' }))
    expect(menu.boton('escenario').apagado).toBe(false)
    expect(menu.panel.escritos.map((e) => e.texto)).toContain('Your room')
    menu.pintar(estadoDelMenu({ habitacion: true, escenario: 'place' }))
    expect(menu.panel.escritos.map((e) => e.texto)).toContain('The room')
  })

  it('las cifras son de siete segmentos: los goles, el nivel y su total, y el récord', () => {
    menu.pintar(estadoDelMenu({ goles: 11, record: 4321 }))
    expect([menu.goles.valor, menu.record.valor]).toEqual([11, 4321])
    expect(menu.record.nodo.visible).toBe(true)
    menu.pintar(estadoDelMenu({ modo: 'levels', nivel: 9, abierto: 12, record: 4321 }))
    expect([menu.nivel.valor, menu.total.valor]).toEqual([9, 15])
    expect(menu.record.nodo.visible).toBe(false)
  })
})

describe('el menú dice de cada modo si cuenta para medalla', () => {
  const menu = new MenuDelJuego(
    { elegirModo() {}, elegirDificultad() {}, elegirConfort() {}, mover() {}, sinFin() {}, alternarEscenario() {}, masOpciones() {}, jugar() {}, salir() {} },
    new PointerAim(),
  )

  it('con letras, en la línea del rótulo «Modo»: solo el reto cuenta, en los dos idiomas', () => {
    for (const lang of LANGS) {
      const t = traductor(lang)
      for (const modo of GAME_MODE_ORDER) {
        menu.pintar(estadoDelMenu({ lang, modo }))
        const frase = t(modo === 'challenge' ? 'Counts for a medal' : 'Does not count for a medal')
        const escrita = menu.panel.escritos.find((e) => e.texto === frase)
        const rotulo = menu.panel.escritos.find((e) => e.texto === t('Mode'))!
        expect(escrita, `${lang} ${modo}`).toBeDefined()
        expect(escrita!.y).toBeCloseTo(rotulo.y)
        expect(escrita!.x).toBeGreaterThan(rotulo.x)
      }
    }
  })

  it('y si el salón saca las medallas de otro modo, el reto tampoco cuenta', () => {
    const otro = { medals: { bronze: 1, silver: 2, gold: 3 }, better: 'higher', unit: 'points', record: null, mode: 'levels' } as const
    menu.pintar(estadoDelMenu({ modo: 'challenge', objetivo: otro }))
    expect(menu.panel.escritos.map((e) => e.texto)).toContain('Does not count for a medal')
  })
})

describe('el cartel del objetivo se lee, con la letra de Godot', () => {
  const OBJETIVO: Goal = {
    medals: { bronze: 1500, silver: 8000, gold: 20000 },
    better: 'higher',
    unit: 'points in the challenge',
    record: 104250,
    mode: 'challenge',
  }
  const PANEL = { width: CARTEL.ancho, height: CARTEL.alto }
  /** Desde donde se juega con el visor: a tres alturas de ojos, con el mundo de pie o a su altura. */
  const VISTAS = vistasDelPanel(SITIO_DEL_CARTEL.position, SITIO_DEL_CARTEL.rotation)
  /** Lo que se agranda el cartel donde cuelga: está pintado para leerse a `CARTEL.distancia`. */
  const ESCALA = SITIO_DEL_CARTEL.distancia / CARTEL.distancia

  /** Las partidas que se miden: de la primera cuenta atrás a un reto de dos vueltas, y el final. */
  const MOMENTOS: Partial<LoQueSeJuega>[] = [
    { gameState: 'countdown' },
    { gameState: 'playing' },
    { round: 5, points: 1650, goles: 20, streak: 4 },
    { round: 12, points: 19850, goles: 70, streak: 11 },
    { round: 28, points: 123450, goles: 180, streak: 12 },
    { gameState: 'finished', round: 4, points: 1650, goles: 20 },
    { gameState: 'finished', round: 30, points: 123450, goles: 190 },
    { gameMode: 'practice' },
    { gameMode: 'duel' },
  ]

  function vistas(lang: (typeof LANGS)[number]): GoalSignView[] {
    const t = traductorSuave(lang)
    const base: LoQueSeJuega = { gameMode: 'challenge', gameState: 'playing', round: 1, goles: 0, points: 0, streak: 0, record: 104250 }
    const todas: GoalSignView[] = []
    for (const objetivo of [OBJETIVO, null]) {
      for (const momento of MOMENTOS) {
        const partida = partidaDelCartel({ ...base, objetivo, ...momento }, t)
        if (partida != null) todas.push(goalSign(partida, t))
      }
    }
    return todas
  }

  it('todo lo que dice cabe y no se pisa, y cada letra pasa de lo que se lee desde donde se juega', () => {
    const cartel = new Cartel()
    cartel.colocar(SITIO_DEL_CARTEL)
    let medidas = 0
    for (const lang of LANGS) {
      for (const vista of vistas(lang)) {
        cartel.actualizar(vista, null, lang, 0.016)
        const escritos = cartel.panel.escritos
        const donde = `${lang}: ${vista.title} / ${vista.detail}`
        // Dos líneas jugando; al acabar, la tercera con el pie.
        expect(escritos.map((e) => e.texto), donde).toEqual([vista.title, ...[vista.detail, vista.footer].filter((linea) => linea != null)])
        expect(legibilityProblems(escritos, { panel: PANEL, distance: CARTEL.distancia }), donde).toEqual([])
        for (const { pose, ojos, donde: desde } of VISTAS) {
          expect(unreadableTexts(drawnTexts(aLaEscala(escritos, ESCALA)), pose, ojos, LINE_HEIGHT, MIN_ANGLE), `${donde}, ${desde}`).toEqual([])
        }
        medidas++
      }
    }
    expect(medidas).toBeGreaterThan(20)
    // Alguna vista del final lleva el pie, o la tercera línea no se estaría midiendo.
    expect(LANGS.some((lang) => vistas(lang).some((vista) => vista.footer != null))).toBe(true)
    cartel.nodo.free()
  })

  it('al cruzar un listón el título dice la medalla, y se sigue leyendo', () => {
    const cartel = new Cartel()
    cartel.colocar(SITIO_DEL_CARTEL)
    const t = traductorSuave('es')
    const vista = goalSign(
      partidaDelCartel({ objetivo: OBJETIVO, gameMode: 'challenge', gameState: 'playing', round: 12, goles: 70, points: 19850, streak: 11, record: 0 }, t)!,
      t,
    )
    expect(vista.cheer).toBeTruthy()
    cartel.actualizar(vista, null, 'es', 0.016)
    cartel.actualizar(vista, vista.medal ?? 'silver', 'es', 0.016)
    expect(cartel.panel.escritos[0]!.texto).toBe(vista.cheer)
    expect(legibilityProblems(cartel.panel.escritos, { panel: PANEL, distance: CARTEL.distancia })).toEqual([])
    cartel.nodo.free()
  })

  it('la misión y lo que se mira jugando se leen de un vistazo: más de un grado', () => {
    const cartel = new Cartel()
    cartel.colocar(SITIO_DEL_CARTEL)
    const base: LoQueSeJuega = { objetivo: OBJETIVO, gameMode: 'challenge', gameState: 'playing', round: 5, goles: 20, points: 1650, streak: 4, record: 0 }
    for (const lang of LANGS) {
      const t = traductorSuave(lang)
      for (const momento of [{ gameState: 'countdown', round: 1, goles: 0, points: 0, streak: 0 }, {}] as Partial<LoQueSeJuega>[]) {
        cartel.actualizar(goalSign(partidaDelCartel({ ...base, ...momento }, t)!, t), null, lang, 0.016)
        const escritos = aLaEscala(cartel.panel.escritos, ESCALA)
        for (const { pose, ojos, donde } of VISTAS) {
          expect(unreadableTexts(drawnTexts(escritos), pose, ojos, LINE_HEIGHT, 1), `${lang}, ${donde}`).toEqual([])
        }
      }
    }
    cartel.nodo.free()
  })

  it('mide lo que el de la web: 24° por 4,5° a su distancia, con la letra del título a 1,4°', () => {
    const grado = (2 * CARTEL.distancia * Math.tan((MIN_ANGLE * Math.PI) / 180 / 2)) / MIN_ANGLE
    expect(CARTEL.ancho / grado).toBeCloseTo(24)
    expect(CARTEL.alto / grado).toBeCloseTo(4.5)
    expect(CARTEL.titulo / grado).toBeCloseTo(1.4)
    expect(CARTEL.detalle / grado).toBeCloseTo(1.2)
    expect(SITIO_DEL_CARTEL).toEqual(sitioDelCartel({ width: CARTEL.ancho / CARTEL.distancia, height: CARTEL.alto / CARTEL.distancia }))
  })

  it('celebra el listón cruzado: lo devuelve una vez, crece y vuelve, y recién colgado no celebra nada', () => {
    const cartel = new Cartel()
    cartel.colocar(SITIO_DEL_CARTEL)
    const t = traductorSuave('en')
    const base: LoQueSeJuega = { objetivo: OBJETIVO, gameMode: 'challenge', gameState: 'playing', round: 4, goles: 14, points: 1650, streak: 0, record: 0 }
    const vista = goalSign(partidaDelCartel(base, t)!, t)

    // Colgado con el bronce ya en la mano: no se ha visto cruzar el listón.
    expect(cartel.actualizar(vista, 'bronze', 'en', 0.016)).toBeNull()
    expect(cartel.celebrando).toBeNull()
    expect(cartel.actualizar(vista, 'silver', 'en', 0.016)).toBe('silver')
    expect(cartel.celebrando).toBe('silver')
    expect(cartel.actualizar(vista, 'silver', 'en', 0.1)).toBeNull()
    expect(cartel.nodo.scale.x).toBeGreaterThan(ESCALA)
    // Pasado el festejo vuelve a su tamaño y deja de celebrar.
    for (let i = 0; i < 20; i++) cartel.actualizar(vista, 'silver', 'en', 0.1)
    expect(cartel.celebrando).toBeNull()
    expect(cartel.nodo.scale.x).toBeCloseTo(ESCALA)
    // Bajar de un listón —un gol encajado— no se celebra.
    expect(cartel.actualizar(vista, 'bronze', 'en', 0.016)).toBeNull()
    // Sin vista se esconde.
    cartel.actualizar(null, null, 'en', 0.016)
    expect(cartel.nodo.visible).toBe(false)
    cartel.nodo.free()
  })
})

describe('el final, el aviso, la cuenta y el tutorial se leen', () => {
  it('el final, en los dos idiomas, ganado, perdido, con récord y en un nivel', () => {
    const final = new FinalDeLaPartida({ otraVez() {}, menu() {}, salir() {} }, new PointerAim())
    for (const lang of LANGS) {
      for (const estado of [
        { outcome: 'won' as const, esRecord: false, nivel: null },
        { outcome: 'lost' as const, esRecord: false, nivel: null },
        { outcome: 'won' as const, esRecord: true, nivel: null },
        { outcome: 'lost' as const, esRecord: false, nivel: { nivel: 12, stars: 0 as const, passed: false } },
      ]) {
        final.pintar({ lang, puntos: 98765, duelo: null, ...estado })
        const donde = `${lang} ${JSON.stringify(estado)}`
        expect(medir(final.panel.escritos, FINAL, COLUMNA, ESCALA_DE_LA_COLUMNA), donde).toEqual([])
        expect(sizesOffList(drawnTexts(final.panel.escritos), LINE_HEIGHT, [LETRA_DEL_FINAL]), donde).toEqual([])
      }
    }
    const resto = [CAJAS_DEL_FINAL.again, CAJAS_DEL_FINAL.menu]
    expect(exitProblems(CAJAS_DEL_FINAL.exit, resto, FINAL)).toEqual([])
  })

  it('el final del duelo: el traspaso, el ganador y el empate, en los dos idiomas', () => {
    const final = new FinalDeLaPartida({ otraVez() {}, menu() {}, salir() {} }, new PointerAim())
    const pareja = { wins: [123, 99] as const, ties: 42 }
    const primera = { scored: 7, conceded: 5 }
    const vistas: VistaDelDuelo[] = [
      { player: 0, matches: [primera, null], next: 1, over: false, winner: null },
      { player: 1, matches: [primera, { scored: 7, conceded: 2 }], next: null, over: true, winner: 1 },
      { player: 1, matches: [primera, { scored: 4, conceded: 2 }], next: null, over: true, winner: null },
    ]
    for (const lang of LANGS) {
      for (const [i, vista] of vistas.entries()) {
        final.pintar({ lang, outcome: 'won', puntos: 0, esRecord: false, nivel: null, duelo: { vista, marcador: { scored: 7, conceded: 5 }, pareja } })
        const donde = `${lang} duelo ${i}`
        expect(medir(final.panel.escritos, FINAL, COLUMNA, ESCALA_DE_LA_COLUMNA), donde).toEqual([])
        expect(sizesOffList(drawnTexts(final.panel.escritos), LINE_HEIGHT, Object.values(LETRA_DEL_DUELO)), donde).toEqual([])
        expect(textsOnButtons(drawnTexts(final.panel.escritos), [CAJAS_DEL_FINAL.again, CAJAS_DEL_FINAL.menu, CAJAS_DEL_FINAL.exit]), donde).toEqual([])
      }
    }
    const t = traductor('es')
    final.pintar({ lang: 'es', outcome: 'lost', puntos: 0, esRecord: false, nivel: null, duelo: { vista: vistas[0], marcador: primera, pareja } })
    expect(final.panel.escritos.map((e) => e.texto).join(' ')).toContain(t('Pass the controller to {player}.', { player: t('Player 2') }))
    final.pintar({ lang: 'es', outcome: 'won', puntos: 0, esRecord: false, nivel: null, duelo: { vista: vistas[1], marcador: primera, pareja } })
    expect(final.panel.escritos.map((e) => e.texto).join(' ')).toContain('Gana Jugador 2')
  })

  it('el aviso de dejar la partida, en los dos idiomas', () => {
    const aviso = new AvisoDeSalir({ seguir() {}, menu() {}, dejar() {} }, new PointerAim())
    const panel = { width: AVISO[0], height: AVISO[1] }
    for (const lang of LANGS) {
      aviso.escribir(lang)
      expect(medir(aviso.panel.escritos, panel, COLUMNA, ESCALA_DE_LA_COLUMNA), lang).toEqual([])
      expect(sizesOffList(drawnTexts(aviso.panel.escritos), LINE_HEIGHT, Object.values(LETRA_DEL_AVISO_DE_SALIR)), lang).toEqual([])
      expect(textsOnButtons(drawnTexts(aviso.panel.escritos), cajas([aviso.seguir, aviso.menu, aviso.dejar])), lang).toEqual([])
    }
    expect(exitProblems(aviso.dejar.caja, cajas([aviso.seguir, aviso.menu]), panel)).toEqual([])
  })

  it('el aviso de coger el mazo, sobre el saque, con los dos agarres y en los dos idiomas', () => {
    const cuenta = new CuentaAtras()
    const vistas = vistasDelPanel(XR_UI.countdown, undefined)
    for (const lang of LANGS) {
      for (const conUnToque of [false, true]) {
        cuenta.pintar({ cuenta: 1, esperandoElMazo: true, conUnToque, lang })
        const donde = `${lang} ${conUnToque ? 'un toque' : 'manteniendo'}`
        expect(medir(cuenta.aviso.escritos, { width: AVISO_DEL_MAZO[0], height: AVISO_DEL_MAZO[1] }, vistas), donde).toEqual([])
        expect(sizesOffList(drawnTexts(cuenta.aviso.escritos), LINE_HEIGHT, Object.values(LETRA_DEL_AVISO)), donde).toEqual([])
      }
    }
    cuenta.pintar({ cuenta: 2, esperandoElMazo: false, conUnToque: false, lang: 'en' })
    expect(cuenta.cifra.valor).toBe(2)
    expect(cuenta.aviso.nodo.visible).toBe(false)
  })

  it('el tutorial, en cada paso, con los dos agarres y en los dos idiomas', () => {
    const tutorial = new TutorialDelJuego(new PointerAim())
    const vistas = vistasDelPanel(XR_UI.tutorial, XR_UI_ROTATION.tutorial)
    for (const lang of LANGS) {
      for (const agarre of ['hold', 'toggle'] as const) {
        const frases = agarre === 'toggle' ? FRASES_CON_UN_TOQUE : FRASES
        for (const [i, paso] of TUTORIAL_STEPS.entries()) {
          tutorial.vista.mostrarPaso(i + 1, TUTORIAL_STEPS.length, traductor(lang)(frases[paso]), null)
          const escritos = tutorial.vista.panel.escritos
          const donde = `${lang} ${agarre} ${paso}`
          expect(medir(escritos, PANEL_DEL_TUTORIAL, vistas), donde).toEqual([])
          expect(sizesOffList(drawnTexts(escritos), LINE_HEIGHT, Object.values(MEDIDAS_DEL_TUTORIAL.letra)), donde).toEqual([])
        }
      }
    }
  })

  it('el tutorial va a un lado del cartel y del marcador: no tapa ninguno, a ninguna altura de ojos', () => {
    const cartel = { width: PROPORCION_DEL_CARTEL.width * SITIO_DEL_CARTEL.distancia, height: PROPORCION_DEL_CARTEL.height * SITIO_DEL_CARTEL.distancia }
    const loQueSeLee = (sube: number) => {
      const c = delEspacioDelJugador(SITIO_DEL_CARTEL.position)
      const m = delEspacioDelJugador(XR_UI.scoreboard)
      return [
        { que: 'el cartel', puntos: panelPoints([c[0], c[1] + sube, c[2]], cartel, 8) },
        { que: 'el marcador', puntos: panelPoints([m[0], m[1] + sube, m[2]], MARCADOR, 8) },
      ]
    }
    for (const { donde, pose, ojos } of vistasDelPanel(XR_UI.tutorial, XR_UI_ROTATION.tutorial)) {
      const sube = pose.position[1] - delEspacioDelJugador(XR_UI.tutorial)[1]
      expect(whatThePanelHides(pose, PANEL_DEL_TUTORIAL, ojos, loQueSeLee(sube)), donde).toEqual([])
    }
    // El control: de frente, donde sigue en plano, los tapa enteros.
    const [deFrente] = vistasDelPanel(TUTORIAL_EN_PLANO, XR_UI_ROTATION.tutorialEnPlano).filter((v) => v.ojos.y === REFERENCE_EYE_HEIGHT)
    expect(whatThePanelHides(deFrente!.pose, PANEL_DEL_TUTORIAL, deFrente!.ojos, loQueSeLee(0))).toHaveLength(2)
  })

  it('el tutorial pide lo que toca: el agarre, el golpe y el gol, y se puede saltar', () => {
    const tutorial = new TutorialDelJuego(new PointerAim())
    tutorial.forzar()
    expect(tutorial.paso({ grab: false, hit: false, goal: false })).toBe('grab')
    expect(tutorial.paso({ grab: true, hit: false, goal: false })).toBe('hit')
    expect(tutorial.paso({ grab: true, hit: true, goal: false })).toBe('goal')
    tutorial.vista.saltar.alPulsar()
    expect(tutorial.paso({ grab: false, hit: false, goal: false })).toBeNull()
  })
})

describe('los ajustes', () => {
  beforeEach(() => gameStorage()?.clear())

  it('el idioma es el guardado del salón, y el de la línea de órdenes manda', () => {
    gameStorage()!.setItem(LANG_KEY, 'en')
    expect(currentLang()).toBe('en')
    gameStorage()!.setItem(LANG_KEY, 'es')
    expect(currentLang()).toBe('es')
    expect(currentLang('en')).toBe('en')
  })

  it('los volúmenes del salón, de 0 a 1, y el sonido los obedece a cada disparo', () => {
    expect(volumeLevels()).toEqual({ sfx: 1, ambience: 0.6, muted: false })
    const padre = new Node3D()
    const sfx = new Sfx(padre, { dir: 'res://games/glide-hockey/sfx', names: ['goal'], levels: volumeLevels })
    gameStorage()!.setItem(VOLUME_KEYS.sfx, '0')
    sfx.play('goal')
    expect(sfx.counts).toMatchObject({ requested: { goal: 1 }, played: {} })
    gameStorage()!.setItem(VOLUME_KEYS.sfx, '50')
    sfx.play('goal')
    expect(sfx.counts.played.goal).toBe(1)
    padre.free()
  })

  it('el confort del golpe recibido se guarda con la clave de la web', () => {
    expect(confort()).toBe('normal')
    gameStorage()!.setItem(CLAVE_DEL_CONFORT, 'gentle')
    expect(confort()).toBe('gentle')
  })
})

describe('con el ratón: el menú lleva a jugar, parar pregunta y el final vuelve', () => {
  let raiz: Node3D
  let mesa: Node3D
  let camara: Camera3D
  let partida: Partida
  let interfaz: InterfazDelJuego
  let salidas: number
  /** Un escenario del salón con realidad aumentada, que apunta lo elegido. */
  let escenario: { elegido: 'place' | 'room'; hayHabitacion: boolean; alternar(): void }

  beforeEach(() => {
    gameStorage()?.clear()
    // Lo que se lee, en inglés: sin idioma guardado, el juego hablaría el del sistema.
    gameStorage()?.setItem(LANG_KEY, 'en')
    const tree = Engine.get_main_loop() as SceneTree
    raiz = new Node3D()
    ;(tree.current_scene ?? (tree.root as Node)).add_child(raiz)
    mesa = new Node3D()
    mesa.position = new Vector3(0, 0.9, -1.2)
    raiz.add_child(mesa)
    camara = new Camera3D()
    camara.fov = 46
    raiz.add_child(camara)
    camara.look_at_from_position(new Vector3(0, 2.65, 1.5), new Vector3(0, 0.9, -1.2), Vector3.UP)
    camara.current = true
    salidas = 0
    // El menú abre en el reto (lo comprueba «abre en el reto», abajo); aquí se pulsa el de la
    // práctica, que es el que pregunta el nivel y los goles.
    partida = new Partida()
    partida.setGameMode('practice')
    escenario = {
      elegido: 'place',
      hayHabitacion: true,
      alternar() {
        this.elegido = this.elegido === 'room' ? 'place' : 'room'
      },
    }
    interfaz = new InterfazDelJuego(partida, { salir: () => salidas++ }, { raiz: mesa, camara, visor: false, escenario })
  })

  afterEach(() => {
    interfaz.soltar()
    raiz.get_parent()?.remove_child(raiz)
    raiz.free()
  })

  /** Un clic en el botón `id`: moverse, apretar en un fotograma y soltar en el siguiente. */
  function clic(id: string): void {
    interfaz.actualizar(0.016)
    const boton = interfaz.punteria.boton(id)
    expect(boton?.nodo.is_visible_in_tree(), `el botón ${id} no está a la vista`).toBe(true)
    const at: Vector2 = camara.unproject_position(boton!.nodo.global_position)
    const mover = new InputEventMouseMotion()
    mover.position = at
    interfaz.recibir(mover)
    for (const apretado of [true, false]) {
      const e = new InputEventMouseButton()
      e.position = at
      e.button_index = MouseButton.MOUSE_BUTTON_LEFT
      e.pressed = apretado
      interfaz.recibir(e)
      interfaz.actualizar(0.016)
    }
  }

  it('elegir el nivel de la máquina, subir los goles y jugar empieza con lo elegido', () => {
    clic('mas opciones')
    clic(`nivel ${DIFFICULTY_ORDER[2]}`)
    clic('mas')
    clic('jugar')
    expect(partida.gameState).toBe('countdown')
    expect([partida.activeDifficulty, partida.activeGoalTarget]).toEqual([DIFFICULTY_ORDER[2], 8])
    expect(interfaz.menu.nodo.visible).toBe(false)
    expect(interfaz.marcador.nodo.visible).toBe(true)
  })

  it('abre en el reto: jugar sin tocar nada lo empieza, con el cartel del objetivo encima del marcador', () => {
    interfaz.soltar()
    partida = new Partida()
    interfaz = new InterfazDelJuego(partida, { salir: () => salidas++ }, { raiz: mesa, camara, visor: false, escenario })
    interfaz.actualizar(0.016)
    expect(partida.gameMode).toBe('challenge')
    expect(interfaz.menu.panel.escritos.map((e) => e.texto)).toContain('Counts for a medal')
    expect(interfaz.cartel.nodo.visible).toBe(false)

    clic('jugar')
    interfaz.actualizar(0.016)
    expect([partida.gameMode, partida.gameState]).toEqual(['challenge', 'countdown'])
    expect(interfaz.cartel.nodo.visible).toBe(true)
    expect(interfaz.cartel.panel.escritos.map((e) => e.texto)).toEqual(['Win games until you lose one'])
    // Cuelga de la raíz de la interfaz, por encima del marcador entero.
    expect(interfaz.cartel.nodo.get_parent()).toBe(mesa)
    expect(interfaz.cartel.nodo.position.y - (CARTEL.alto / 2) * interfaz.cartel.nodo.scale.y).toBeGreaterThan(XR_UI.scoreboard[1] + MARCADOR.height / 2)
    expect(interfaz.cartel.nodo.position.x).toBeCloseTo(0)

    // Jugando, el marcador calla los puntos y la ronda, que ya dice el cartel, y los goles van en medio.
    for (let i = 0; i < COUNTDOWN_SECONDS * 60 + 2; i++) partida.tick(1 / 60)
    partida.scorePlayer()
    interfaz.actualizar(0.016)
    expect(interfaz.cartel.panel.escritos.map((e) => e.texto)).toEqual(['You have 100', 'Round 1 · to 3 goals · goal +120'])
    expect(interfaz.marcador.puntos.nodo.visible).toBe(false)
    expect(interfaz.marcador.fila.nodo.visible).toBe(false)
    expect(interfaz.marcador.jugador.nodo.position.y).toBe(0)
    expect(interfaz.liston).toBeNull()
  })

  it('en la práctica el marcador lo dice todo y no hay cartel: sin salón no hay medalla de la que hablar', () => {
    clic('jugar')
    interfaz.actualizar(0.016)
    expect(interfaz.cartel.nodo.visible).toBe(false)
    expect(interfaz.marcador.puntos.nodo.visible).toBe(true)
    expect(interfaz.marcador.jugador.nodo.position.y).toBeCloseTo(FILAS_DEL_MARCADOR.goals)
  })

  it('«Más opciones» despliega lo de la práctica; plegado al volver al menú, sin guardarse', () => {
    interfaz.actualizar(0.016)
    expect(interfaz.punteria.boton('confort off')?.nodo.is_visible_in_tree()).toBe(false)
    clic('mas opciones')
    expect(interfaz.punteria.boton('confort off')?.nodo.is_visible_in_tree()).toBe(true)
    expect(interfaz.menu.panel.escritos.map((e) => e.texto)).toContain('Fewer options')
    clic('jugar')
    interfaz.escape()
    clic('confirm:menu')
    interfaz.actualizar(0.016)
    expect(partida.gameState).toBe('menu')
    expect(interfaz.punteria.boton('confort off')?.nodo.is_visible_in_tree()).toBe(false)
    expect(interfaz.menu.panel.escritos.map((e) => e.texto)).toContain('More options')
  })

  it('elegir el confort lo guarda, y el modo cambia lo que pregunta', () => {
    clic('mas opciones')
    clic('confort off')
    expect(confort()).toBe('off')
    clic('modo challenge')
    expect(partida.gameMode).toBe('challenge')
    expect(interfaz.punteria.boton('mas')?.nodo.is_visible_in_tree()).toBe(false)
  })

  it('el botón del decorado alterna la sala y tu habitación, y el menú lo dice', () => {
    clic('mas opciones')
    clic('escenario')
    expect(escenario.elegido).toBe('room')
    interfaz.actualizar(0.016)
    expect(interfaz.menu.panel.escritos.map((e) => e.texto)).toContain('Your room')
    // Un segundo roce en menos de 300 ms no cuenta (`Punteria`): se espera como una mano de verdad.
    OS.delay_msec(320)
    clic('escenario')
    expect(escenario.elegido).toBe('place')
  })

  it('la flecha de la esquina sale; Escape en el menú, también', () => {
    clic('salir')
    expect(salidas).toBe(1)
    interfaz.escape()
    expect(salidas).toBe(2)
  })

  it('parar pregunta y la mesa espera; seguir vuelve, y volver al menú deja la partida', () => {
    clic('jugar')
    clic('quit')
    expect(partida.prompt).toBe('quit')
    expect(interfaz.aviso.nodo.visible).toBe(true)
    clic('confirm:stay')
    expect(partida.prompt).toBeNull()
    interfaz.escape()
    clic('confirm:menu')
    expect(partida.gameState).toBe('menu')
    expect(salidas).toBe(0)
  })

  it('al acabar sale el final: otra vez empieza de nuevo y el de las rayas vuelve al menú', () => {
    partida.setGoalTarget(3)
    clic('jugar')
    for (let i = 0; i < COUNTDOWN_SECONDS * 60 + 2; i++) partida.tick(1 / 60)
    for (let i = 0; i < 3; i++) partida.scorePlayer()
    interfaz.actualizar(0.016)
    expect(interfaz.final.nodo.visible).toBe(true)
    const mesaAntes = partida.runId
    clic('final:again')
    expect(partida.gameState).toBe('countdown')
    expect(partida.runId).toBe(mesaAntes + 1)
    for (let i = 0; i < COUNTDOWN_SECONDS * 60 + 2; i++) partida.tick(1 / 60)
    for (let i = 0; i < 3; i++) partida.scoreOpponent()
    clic('final:menu')
    expect(partida.gameState).toBe('menu')
  })

  it('en la partida solo se apunta a lo que se ve: el ratón sobre el «jugar» escondido no lo enciende', () => {
    clic('jugar')
    interfaz.actualizar(0.016)
    const visibles = ['quit', 'end', 'jugar', 'final:again'].filter((id) => interfaz.punteria.boton(id)?.nodo.is_visible_in_tree())
    expect(visibles).toEqual(['quit'])
    const jugar = interfaz.punteria.boton('jugar')!
    const mover = new InputEventMouseMotion()
    mover.position = camara.unproject_position(jugar.nodo.global_position)
    interfaz.recibir(mover)
    interfaz.actualizar(0.016)
    expect(interfaz.apuntaAUnBoton()).toBe(false)
    expect(jugar.estado).toBe('reposo')
  })
})
