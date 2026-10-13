/**
 * El mundo de Glide Hockey en Godot, contra la web y en el motor:
 *
 * - **El salón** (`Room.tsx`): las copias de cada malla múltiple, las recreativas dentro de la sala y
 *   de cara a la mesa, y el halo bajo ella.
 * - **La sala y tu habitación**: la habitación solo con realidad aumentada; con ella, la sala se
 *   esconde sin desmontarse y el fondo deja de tapar.
 * - **Las ayudas** (`Ayudas.tsx`) con el guion de la web: qué se enciende al entrar, al empezar la
 *   partida y al coger el mazo, qué apaga cada hito, los plazos, que nada aparece de golpe, que sin
 *   visor no se enseñan, y que lo pintado cae donde dicen las cotas de `guionDeAyudas.ts`.
 * - **El mando de verdad** junto al mazo fantasma, con el modelo del paquete y el agarre marcado.
 *
 * Corre dentro del motor, con los tests de dominio (`npm run godot:build -- --tests`).
 */
import { Environment, Node3D } from 'godot'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SceneryRig, type RoomView } from '@kit/runtime/scene/scenery'
import { RealController } from '@kit/runtime/ui/controller'

import { MAX_EXPIRY } from '@/lib/hints'
import { MALLET_RADIUS, PUCK_RADIUS, TABLE_CENTER_Z } from '@/lib/gameConfig'
import {
  AYUDAS_QUE_OCUPAN_LA_MESA,
  GUION_DE_AYUDAS,
  HUELLAS,
  HUELLAS_Y,
  MANDO_JUNTO_AL_MAZO,
  MARCA_DE_PORTERIA,
  enElCampoDelJugador,
  sobreLaMesa,
  type HechoDeLasAyudas,
} from '@/lib/hintScript'
import { playerStart } from '@/lib/opponent'
import { gameStorage } from '@/lib/storage'

import { AyudasDelJuego, juntoAlMazo } from './hints'
import { CABINET, ROOM, Sala, sitiosDeLasMaquinas } from './room'

const DIR_DE_LOS_MANDOS = 'res://games/glide-hockey/mandos'

describe('el salón de la web', () => {
  it('las mismas copias que las mallas instanciadas de la web', () => {
    const sala = new Sala(new Environment())
    expect(sala.copias).toEqual({ bandas: 5, paredes: 3, zocalos: 3, maquinas: 10 })
    sala.nodo.free()
  })

  it('las recreativas caben entre las paredes y miran hacia la mesa', () => {
    for (const s of sitiosDeLasMaquinas()) {
      expect(Math.abs(s.x) + CABINET.depth / 2).toBeLessThanOrEqual(ROOM.width / 2)
      expect(s.z - CABINET.depth / 2).toBeGreaterThanOrEqual(TABLE_CENTER_Z - ROOM.depth / 2)
      // Su frente (+Z girado) apunta hacia el centro de la mesa y no hacia la pared.
      const frente = { x: Math.sin(s.giro), z: Math.cos(s.giro) }
      const hacia = { x: -s.x, z: TABLE_CENTER_Z - s.z }
      expect(frente.x * hacia.x + frente.z * hacia.z, JSON.stringify(s)).toBeGreaterThan(0)
    }
  })
})

describe('la sala y tu habitación', () => {
  let sala: Sala
  let entorno: Environment
  let transparente: boolean[]
  let passthrough: boolean
  const vista: RoomView = {
    hayPassthrough: () => passthrough,
    transparente: (si) => transparente.push(si),
  }

  beforeEach(() => {
    gameStorage()?.clear()
    entorno = new Environment()
    sala = new Sala(entorno)
    transparente = []
    passthrough = false
  })
  afterEach(() => sala.nodo.free())

  it('sin realidad aumentada se ve la sala aunque el salón pida la habitación', () => {
    const escenario = new SceneryRig({ mostrar: (si) => sala.mostrar(si), vista })
    gameStorage()!.setItem('xrcade:scenery', 'room')
    escenario.actualizar()
    expect(escenario.hayHabitacion).toBe(false)
    expect(sala.nodo.visible).toBe(true)
    expect(entorno.background_color.a).toBe(1)
    expect(transparente).toEqual([false])
  })

  it('con ella, la habitación: la sala se esconde sin desmontarse y el fondo no tapa', () => {
    passthrough = true
    const escenario = new SceneryRig({ mostrar: (si) => sala.mostrar(si), vista })
    escenario.alternar()
    escenario.actualizar()
    expect(escenario.elegido).toBe('room')
    expect(sala.nodo.visible).toBe(false)
    expect(sala.nodo.get_child_count()).toBeGreaterThan(5)
    expect(entorno.background_color.a).toBe(0)
    expect(transparente).toEqual([true])
    // Volver a la sala la enseña; lo elegido va en la clave del salón, para todas las cabinas.
    escenario.alternar()
    escenario.actualizar()
    expect(escenario.elegido).toBe('place')
    expect(sala.nodo.visible).toBe(true)
  })
})

describe('las ayudas, con el guion de la web', () => {
  let suelo: Node3D
  let mesa: Node3D
  let ayudas: AyudasDelJuego
  const hechos = (h: Partial<Record<HechoDeLasAyudas, boolean>> = {}) => ({ tanda: false, grab: false, hit: false, goal: false, ...h })

  beforeEach(() => {
    suelo = new Node3D()
    mesa = new Node3D()
    suelo.add_child(mesa)
    ayudas = new AyudasDelJuego(suelo, mesa, new RealController({ mano: 'right', dir: DIR_DE_LOS_MANDOS, perfil: () => 'meta-quest-touch-plus', junto: juntoAlMazo() }))
  })
  afterEach(() => suelo.free())

  function correr(segundos: number, h: Partial<Record<HechoDeLasAyudas, boolean>>, dando = true): void {
    for (let t = 0; t < segundos; t += 0.05) ayudas.actualizar(0.05, { dando, hechos: hechos(h) })
  }

  it('al entrar, solo las huellas; nada aparece de golpe', () => {
    ayudas.actualizar(0.05, { dando: true, hechos: hechos() })
    expect(ayudas.fuerza.suelo).toBeGreaterThan(0)
    expect(ayudas.fuerza.suelo).toBeLessThan(0.2)
    correr(1, {})
    expect(ayudas.visibles()).toEqual(['suelo'])
  })

  it('con la partida, el mando y el mazo fantasma; con el mazo en la mano, la portería; y se van', () => {
    correr(1, { tanda: true })
    expect(ayudas.visibles()).toEqual(['suelo', 'mando', 'gesto'])
    correr(1, { tanda: true, grab: true })
    expect(ayudas.visibles()).toEqual(['suelo', 'porteria'])
    correr(1, { tanda: true, grab: true, hit: true })
    expect(ayudas.visibles()).toEqual(['porteria'])
    correr(1, { tanda: true, grab: true, hit: true, goal: true })
    expect(ayudas.visibles()).toEqual([])
  })

  it('lo que se levanta de la mesa se ha ido con el mazo en la mano, antes de que salga el disco', () => {
    correr(1, { tanda: true })
    correr(1, { tanda: true, grab: true })
    const visibles = ayudas.visibles()
    for (const id of AYUDAS_QUE_OCUPAN_LA_MESA) expect(visibles, id).not.toContain(id)
  })

  it('ninguna se queda puesta: pasado el plazo más largo, todas fuera aunque no se haga nada', () => {
    correr(MAX_EXPIRY + 1, { tanda: true, grab: true })
    expect(ayudas.visibles()).toEqual([])
    expect(Math.max(...GUION_DE_AYUDAS.map((a) => a.expiresAfter))).toBeLessThanOrEqual(MAX_EXPIRY)
  })

  it('sin visor no se enseñan ni corren sus plazos', () => {
    correr(30, { tanda: true }, false)
    expect(ayudas.visibles()).toEqual([])
    correr(1, { tanda: true })
    expect(ayudas.visibles()).toContain('gesto')
  })

  it('las huellas van a los pies, a la par y de frente', () => {
    correr(1, {})
    const huellas: Node3D[] = []
    for (let i = 0; i < suelo.get_child_count(); i++) {
      const n = suelo.get_child(i)
      if (n instanceof Node3D && n !== mesa) huellas.push(n)
    }
    expect(huellas.length).toBe(HUELLAS.length)
    huellas.forEach((n, i) => {
      expect(n.position.x).toBeCloseTo(HUELLAS[i].x, 6)
      expect(n.position.y).toBeCloseTo(HUELLAS_Y, 6)
      expect(n.position.z).toBeCloseTo(HUELLAS[i].z, 6)
    })
  })

  it('el fantasma empuja por la mitad del jugador hasta tocar el disco del saque', () => {
    let masCerca = Infinity
    let masLejos = -Infinity
    for (let t = 0; t < 1.7; t += 0.02) {
      ayudas.actualizar(0.02, { dando: true, hechos: hechos({ tanda: true }) })
      const p = ayudas.fantasma.position
      expect(enElCampoDelJugador({ x: p.x, z: p.z }), `${p.z}`).toBe(true)
      masCerca = Math.min(masCerca, p.z)
      masLejos = Math.max(masLejos, p.z)
    }
    expect(masCerca).toBeLessThan(PUCK_RADIUS + MALLET_RADIUS + 0.01)
    expect(masLejos).toBeGreaterThan(playerStart().z + 0.1)
  })

  it('la marca de la portería va calcada dentro de la mesa, en el fondo de la máquina', () => {
    const p = ayudas.porteria.position
    expect(p.z).toBeCloseTo(MARCA_DE_PORTERIA.z, 6)
    for (const z of [p.z - MARCA_DE_PORTERIA.fondo / 2, p.z + MARCA_DE_PORTERIA.fondo / 2]) {
      for (const x of [-MARCA_DE_PORTERIA.ancho / 2, MARCA_DE_PORTERIA.ancho / 2]) expect(sobreLaMesa({ x, z })).toBe(true)
    }
  })

  it('el mando va a un palmo del sitio del mazo, crecido y con el agarre marcado', () => {
    correr(1, { tanda: true })
    const mando = ayudas.mando!
    expect(mando.visible).toBe(true)
    expect(mando.perfil).toBe('meta-quest-touch-plus')
    expect(mando.sitioDeLaMarca).not.toBeNull()
    const junto = juntoAlMazo()
    expect(mando.nodo.position.x).toBeCloseTo(playerStart().x + MANDO_JUNTO_AL_MAZO.separacion, 6)
    expect(mando.nodo.position.y).toBeCloseTo(MANDO_JUNTO_AL_MAZO.alto, 6)
    expect(mando.nodo.position.z).toBeCloseTo(playerStart().z, 6)
    expect(mando.nodo.scale.x).toBeCloseTo(junto.escala, 6)
    expect(mando.nodo.rotation.y).toBeCloseTo(junto.giro, 6)
    correr(1, { tanda: true, grab: true })
    expect(mando.visible).toBe(false)
    // Queda colgado de la mesa: esconderlo no lo desmonta.
    expect(mando.nodo.get_parent()).toBe(mesa)
  })
})
