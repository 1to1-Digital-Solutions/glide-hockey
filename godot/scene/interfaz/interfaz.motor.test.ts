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

import { problemasDeLegibilidad } from '@kit/lib/ui/instrumento'
import { ALTO_DE_LINEA, medidorAproximado, type Escrito } from '@kit/lib/ui/texto'
import { PANEL_DEL_TUTORIAL } from '@kit/lib/ui/tutorial'
import { Sfx } from '@kit/runtime/sfx'
import { Punteria } from '@kit/runtime/ui/punteria'

import { LANGS, VOLUME_KEYS } from '@/lib/ajustes'
import { COUNTDOWN_SECONDS, DIFFICULTY_ORDER } from '@/lib/gameConfig'
import { GAME_MODE_ORDER, type GameMode } from '@/lib/gameMode'
import { problemasDeLaSalida } from '@/lib/exitCorner'
import { sizesOffList, textsOnButtons, unreadableTexts, worstReadingDistance, type PanelPose } from '@/lib/panelReading'
import { gameStorage } from '@/lib/storage'
import { traductor } from '@/lib/textos'
import { TUTORIAL_STEPS } from '@/lib/tutorial'
import { MENU_PANEL, MENU_TEXT } from '@/lib/xrMenuLayout'

import { CLAVE_DEL_CONFORT, CLAVE_DEL_IDIOMA, confort, idioma, niveles } from './ajustes'
import { AvisoDeSalir } from './aviso'
import { FinalDeLaPartida, LETRA_DEL_FINAL } from './final'
import { InterfazDelJuego } from './interfaz'
import { CuentaAtras } from './marcador'
import { MenuDelJuego, type EstadoDelMenu } from './menu'
import { Partida } from './partida'
import {
  AVISO,
  AVISO_DEL_MAZO,
  CAJAS_DEL_FINAL,
  ESCALA_DE_LA_COLUMNA,
  MEDIDAS_DEL_TUTORIAL,
  FINAL,
  LETRA_DEL_AVISO,
  LETRA_DEL_AVISO_DE_SALIR,
  XR_UI,
  XR_UI_ROTATION,
  aLaEscala,
  vistasDelPanel,
} from './reparto'
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
  const distancia = Math.max(...vistas.map(({ pose, ojos }) => worstReadingDistance(escalados, pose, ojos, ALTO_DE_LINEA)))
  return [
    ...problemasDeLegibilidad(escalados, { panel: { width: panel.width * k, height: panel.height * k }, distancia }),
    ...vistas.flatMap(({ pose, ojos, donde }) => unreadableTexts(escalados, pose, ojos, ALTO_DE_LINEA).map((p) => `${donde}: ${p}`)),
  ]
}

const COLUMNA = vistasDelPanel(XR_UI.panel, XR_UI_ROTATION.panel)

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
    }
    momentos.push({ donde: `${lang} sin fin`, estado: estadoDelMenu({ lang, sinFin: true }) })
    momentos.push({ donde: `${lang} en tu habitación`, estado: estadoDelMenu({ lang, habitacion: true, escenario: 'room', record: 98765 }) })
  }
  return momentos
}

describe('el menú mide lo que la web', () => {
  const punteria = new Punteria()
  const menu = new MenuDelJuego(
    { elegirModo() {}, elegirDificultad() {}, elegirConfort() {}, mover() {}, sinFin() {}, alternarEscenario() {}, jugar() {}, salir() {} },
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
  })

  it('con la letra de Godot cada texto mide lo que estima la web, con un cuarto de margen', () => {
    const estimado = medidorAproximado()
    for (const { donde, estado } of momentosDelMenu()) {
      menu.pintar(estado)
      for (const e of menu.panel.escritos) {
        const razon = e.ancho / estimado.ancho(e.texto, e.alto / ALTO_DE_LINEA)
        expect(razon, `${donde}: «${e.texto}»`).toBeGreaterThan(0.6)
        expect(razon, `${donde}: «${e.texto}»`).toBeLessThan(1.25)
      }
    }
  })

  it('se lee: nada se pisa ni se sale, y cada letra llega desde donde se juega', () => {
    for (const { donde, estado } of momentosDelMenu()) {
      menu.pintar(estado)
      expect(medir(menu.panel.escritos, MENU_PANEL, COLUMNA, ESCALA_DE_LA_COLUMNA), donde).toEqual([])
    }
  })

  it('y la medida se entera cuando no cabe: estrechado a un tercio, canta', () => {
    menu.pintar(estadoDelMenu({ lang: 'es' }))
    expect(menu.panel.escritos.length).toBeGreaterThan(5)
    const estrecho = { width: MENU_PANEL.width / 3, height: MENU_PANEL.height }
    expect(problemasDeLegibilidad(menu.panel.escritos, { panel: estrecho }).join(' ')).toContain('se sale del panel')
  })

  it('todo se escribe a un tamaño de la lista, sin encogerse, y ningún texto se mete en otro botón', () => {
    for (const { donde, estado } of momentosDelMenu()) {
      menu.pintar(estado)
      expect(sizesOffList(menu.panel.escritos, ALTO_DE_LINEA, Object.values(MENU_TEXT)), donde).toEqual([])
      expect(textsOnButtons(menu.panel.escritos, cajas(menu.botones.values())), donde).toEqual([])
    }
  })

  it('la salida está en la esquina de abajo a la derecha, en todos los modos', () => {
    for (const modo of GAME_MODE_ORDER) {
      menu.pintar(estadoDelMenu({ modo }))
      const salida = menu.boton('salir').caja
      const resto = cajas([...menu.botones.values()].filter((b) => b.id !== 'salir'))
      expect(problemasDeLaSalida(salida, resto, MENU_PANEL), modo).toEqual([])
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

describe('el final, el aviso, la cuenta y el tutorial se leen', () => {
  it('el final, en los dos idiomas, ganado, perdido, con récord y en un nivel', () => {
    const final = new FinalDeLaPartida({ otraVez() {}, menu() {}, salir() {} }, new Punteria())
    for (const lang of LANGS) {
      for (const estado of [
        { outcome: 'won' as const, esRecord: false, nivel: null },
        { outcome: 'lost' as const, esRecord: false, nivel: null },
        { outcome: 'won' as const, esRecord: true, nivel: null },
        { outcome: 'lost' as const, esRecord: false, nivel: { nivel: 12, stars: 0 as const, passed: false } },
      ]) {
        final.pintar({ lang, puntos: 98765, ...estado })
        const donde = `${lang} ${JSON.stringify(estado)}`
        expect(medir(final.panel.escritos, FINAL, COLUMNA, ESCALA_DE_LA_COLUMNA), donde).toEqual([])
        expect(sizesOffList(final.panel.escritos, ALTO_DE_LINEA, [LETRA_DEL_FINAL]), donde).toEqual([])
      }
    }
    const resto = [CAJAS_DEL_FINAL.again, CAJAS_DEL_FINAL.menu]
    expect(problemasDeLaSalida(CAJAS_DEL_FINAL.exit, resto, FINAL)).toEqual([])
  })

  it('el aviso de dejar la partida, en los dos idiomas', () => {
    const aviso = new AvisoDeSalir({ seguir() {}, menu() {}, dejar() {} }, new Punteria())
    const panel = { width: AVISO[0], height: AVISO[1] }
    for (const lang of LANGS) {
      aviso.escribir(lang)
      expect(medir(aviso.panel.escritos, panel, COLUMNA, ESCALA_DE_LA_COLUMNA), lang).toEqual([])
      expect(sizesOffList(aviso.panel.escritos, ALTO_DE_LINEA, Object.values(LETRA_DEL_AVISO_DE_SALIR)), lang).toEqual([])
      expect(textsOnButtons(aviso.panel.escritos, cajas([aviso.seguir, aviso.menu, aviso.dejar])), lang).toEqual([])
    }
    expect(problemasDeLaSalida(aviso.dejar.caja, cajas([aviso.seguir, aviso.menu]), panel)).toEqual([])
  })

  it('el aviso de coger el mazo, sobre el saque, con los dos agarres y en los dos idiomas', () => {
    const cuenta = new CuentaAtras()
    const vistas = vistasDelPanel(XR_UI.countdown, undefined)
    for (const lang of LANGS) {
      for (const conUnToque of [false, true]) {
        cuenta.pintar({ cuenta: 1, esperandoElMazo: true, conUnToque, lang })
        const donde = `${lang} ${conUnToque ? 'un toque' : 'manteniendo'}`
        expect(medir(cuenta.aviso.escritos, { width: AVISO_DEL_MAZO[0], height: AVISO_DEL_MAZO[1] }, vistas), donde).toEqual([])
        expect(sizesOffList(cuenta.aviso.escritos, ALTO_DE_LINEA, Object.values(LETRA_DEL_AVISO)), donde).toEqual([])
      }
    }
    cuenta.pintar({ cuenta: 2, esperandoElMazo: false, conUnToque: false, lang: 'en' })
    expect(cuenta.cifra.valor).toBe(2)
    expect(cuenta.aviso.nodo.visible).toBe(false)
  })

  it('el tutorial, en cada paso, con los dos agarres y en los dos idiomas', () => {
    const tutorial = new TutorialDelJuego(new Punteria())
    const vistas = vistasDelPanel(XR_UI.tutorial, XR_UI_ROTATION.tutorial)
    for (const lang of LANGS) {
      for (const agarre of ['hold', 'toggle'] as const) {
        const frases = agarre === 'toggle' ? FRASES_CON_UN_TOQUE : FRASES
        for (const [i, paso] of TUTORIAL_STEPS.entries()) {
          tutorial.vista.mostrarPaso(i + 1, TUTORIAL_STEPS.length, traductor(lang)(frases[paso]), null)
          const escritos = tutorial.vista.panel.escritos
          const donde = `${lang} ${agarre} ${paso}`
          expect(medir(escritos, PANEL_DEL_TUTORIAL, vistas), donde).toEqual([])
          expect(sizesOffList(escritos, ALTO_DE_LINEA, Object.values(MEDIDAS_DEL_TUTORIAL.letra)), donde).toEqual([])
        }
      }
    }
  })

  it('el tutorial pide lo que toca: el agarre, el golpe y el gol, y se puede saltar', () => {
    const tutorial = new TutorialDelJuego(new Punteria())
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
    expect(idioma()).toBe('en')
    gameStorage()!.setItem(CLAVE_DEL_IDIOMA, 'es')
    expect(idioma()).toBe('es')
    expect(idioma('en')).toBe('en')
  })

  it('los volúmenes del salón, de 0 a 1, y el sonido los obedece a cada disparo', () => {
    expect(niveles()).toEqual({ sfx: 1, ambience: 0.6, muted: false })
    const padre = new Node3D()
    const sfx = new Sfx(padre, { dir: 'res://games/glide-hockey/sfx', names: ['goal'], levels: niveles })
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
    partida = new Partida()
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
    clic(`nivel ${DIFFICULTY_ORDER[2]}`)
    clic('mas')
    clic('jugar')
    expect(partida.gameState).toBe('countdown')
    expect([partida.activeDifficulty, partida.activeGoalTarget]).toEqual([DIFFICULTY_ORDER[2], 8])
    expect(interfaz.menu.nodo.visible).toBe(false)
    expect(interfaz.marcador.nodo.visible).toBe(true)
  })

  it('elegir el confort lo guarda, y el modo cambia lo que pregunta', () => {
    clic('confort off')
    expect(confort()).toBe('off')
    clic('modo challenge')
    expect(partida.gameMode).toBe('challenge')
    expect(interfaz.punteria.boton('mas')?.nodo.is_visible_in_tree()).toBe(false)
  })

  it('el botón del decorado alterna la sala y tu habitación, y el menú lo dice', () => {
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
