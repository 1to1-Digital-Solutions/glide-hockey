'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { useFrame, type RootState, type ThreeEvent } from '@react-three/fiber'
import { Vector3, type Group, type PointLight, type Texture } from 'three'
import {
  OPPONENT_SKILLS,
  RAIL_HEIGHT,
  TABLE_LENGTH,
  TABLE_WIDTH,
} from '../../lib/gameConfig'
import { useGame } from '../../lib/gameStore'
import { advanceTable, startTable, type TableState } from '../../lib/matchLoop'
import { playerStart } from '../../lib/opponent'
import { PALETTE } from '../../lib/palette'
import {
  HALF_LENGTH,
  constrainMallet,
  type Vec2,
} from '../../lib/puckPhysics'
import {
  isSceneProbeRequested,
  publishSceneProbe,
  screenPointFromNdc,
  type ScreenPoint,
} from '../../lib/sceneProbe'
import { impactStrength } from '../../lib/audioEngine'
import { type PlayGameSound, type SlidePuck } from '../../lib/useGameAudio'
import { Mallet } from './Mallet'
import { Puck } from './Puck'
import { MalletHand } from './MalletHand'

/**
 * La partida en marcha: el disco, los dos mazos y el bucle que los mueve.
 *
 * Nada de lo que cambia sesenta veces por segundo pasa por el estado de React.
 * Las posiciones viven en `useRef` y se escriben directamente sobre los objetos
 * de three; lo único que sale hacia el store son los goles, que son unos pocos
 * por partida. Con la posición del disco en un `useState`, el árbol entero se
 * repintaría en cada fotograma.
 *
 * Aquí no se simula nada: lo que pasa en la mesa lo calcula `lib/matchLoop.ts`
 * a partir del tiempo transcurrido, y este componente solo le pasa el reloj y
 * coloca el resultado. Está fuera para poder jugar partidas enteras en un test
 * —incluidas las de una máquina lenta, que es donde el reloj se rompía— sin
 * abrir el navegador.
 *
 * Se monta con `key={runId}`, así que cada partida —y cada ronda del reto—
 * estrena uno limpio: remontarlo es más simple que devolver a mano cada pieza a
 * su sitio.
 *
 * Por eso el sonido **se recibe hecho** y no se abre aquí: el audio dura lo que
 * la escena, no lo que una ronda (ver `GameWorld` y `lib/useGameAudio.ts`).
 */
export function Rink({
  play,
  slide,
  onAim,
  environment,
}: {
  play: PlayGameSound
  /** El roce del disco según su velocidad, cada fotograma (`useGameAudio`). */
  slide: SlidePuck
  /** Cada movimiento del mazo, para saber qué mando lo lleva (`useGameHaptics`). */
  onAim?: (event: ThreeEvent<PointerEvent>) => void
  /** Los reflejos de la sala para el disco, los mismos que lleva el tablero. */
  environment?: Texture
}) {
  const {
    gameState,
    activeDifficulty,
    lastScorer,
    scoreOpponent,
    scorePlayer,
    setMalletHeld,
  } = useGame()

  const skill = OPPONENT_SKILLS[activeDifficulty]

  const rink = useRef<Group>(null)
  const puckObject = useRef<Group>(null)
  const playerObject = useRef<Group>(null)
  const opponentObject = useRef<Group>(null)
  const goalLight = useRef<PointLight>(null)

  const table = useRef<TableState>(startTable({ skill, lastScorer }))
  /** Lo rápido que va el disco, para su halo (`Puck`) y su roce (`play.slide`). */
  const puckSpeed = useRef(0)

  // Al retirar la mesa (fin de ronda, vuelta al menú) el roce se apaga: nadie
  // volvería a llamarlo y se quedaría sonando a la última velocidad.
  useEffect(() => () => slide(0), [slide])
  /** Dónde apunta el jugador. El mazo va detrás, no salta hasta ahí. */
  const pointer = useRef<Vec2>(playerStart())
  /** Si el mazo va cogido con la mano (visor). Con el ratón nunca. */
  const enLaMano = useRef(false)

  // El punto del evento viene en coordenadas del mundo y hay que traerlo a las
  // de la mesa. Se reutiliza el mismo vector: son varios eventos por fotograma.
  const worldPoint = useRef(new Vector3())
  /** El vector del camino de vuelta: de un punto de la mesa al mundo. */
  const tablePoint = useRef(new Vector3())

  // Con el visor puesto el mazo va en la mano, no en el rayo: apuntar con el mando se
  // sentía como manejar un cursor. Fuera de sesión sigue mandando el ratón sobre el
  // tablero, que es como se juega en pantalla.
  const enSesion = useXR((state) => state.mode != null)

  const aim = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      onAim?.(event)
      const rinkGroup = rink.current
      if (rinkGroup == null) return

      // `worldToLocal` muta lo que recibe, así que nunca se le pasa el punto del
      // evento: es de la librería y lo reutiliza para el siguiente.
      const local = rinkGroup.worldToLocal(worldPoint.current.copy(event.point))
      pointer.current = constrainMallet({ x: local.x, z: local.z }, 'player')
    },
    [onAim],
  )

  useFrame((state, delta) => {
    const {
      table: next,
      goals,
      struck,
      bounced,
      impact,
    } = advanceTable(table.current, {
      delta,
      pointer: pointer.current,
      // Cogido con la mano el mazo no persigue: está donde está la mano.
      inHand: enLaMano.current,
      skill,
      playing: gameState === 'playing',
    })
    table.current = next

    for (const goal of goals) {
      if (goal === 'player') scorePlayer()
      else scoreOpponent()
    }

    // Lo que se oye de la mesa, en el orden en que pasa: el mazo lanza el
    // disco, el disco choca donde vaya a chocar y, si entra, se canta el gol.
    // Silenciado, `play` no hace nada (ver `lib/useGameAudio.ts`).
    if (struck) play('strike', impactStrength(impact.strike))
    if (bounced) play('bounce', impactStrength(impact.bounce))
    if (goals.length > 0) play('goal')

    // El disco deslizándose se oye y se ve según lo rápido que va; parado, o
    // con la partida en pausa, nada.
    const { x: vx, z: vz } = next.puck.velocity
    const speed = gameState === 'playing' ? Math.hypot(vx, vz) : 0
    puckSpeed.current = speed
    slide(speed)
    place(puckObject.current, next.puck.position)
    place(playerObject.current, next.player.position)
    place(opponentObject.current, next.opponent.position)

    // La portería del gol se enciende mientras dura la celebración. Es lo que
    // hace que en el visor se vea dónde ha entrado sin buscar el marcador.
    const light = goalLight.current
    if (light != null) {
      const celebrating = next.pause > 0
      light.intensity = celebrating ? 6 : 0
      light.color.set(
        next.pendingServe === 'player' ? PALETTE.primary : PALETTE.rival,
      )
      light.position.z =
        next.pendingServe === 'player' ? -HALF_LENGTH : HALF_LENGTH
    }

    // Lo que pasa en la mesa, para quien lo haya pedido (ver
    // `lib/sceneProbe.ts`). Nadie lo pide en producción: ahí esto es una
    // comprobación por fotograma y se sale.
    const rinkGroup = rink.current
    if (isSceneProbeRequested() && rinkGroup != null) {
      const { x, z } = next.puck.position
      const world = rinkGroup.localToWorld(tablePoint.current.set(x, 0, z))

      publishSceneProbe({
        playerMallet: next.player.position,
        puck: next.puck.position,
        puckScreen: screenPoint(state, world),
        playerHits: next.playerHits,
      })
    }
  })

  return (
    <group ref={rink}>
      {/*
        Por dónde se apunta. Cubre la mesa entera y no solo la mitad del
        jugador: al llevar el mazo hasta la línea de medio campo, el puntero se
        pasa de largo constantemente, y sin superficie debajo el mazo se queda
        clavado justo cuando hace falta moverlo. Los límites los pone
        `constrainMallet`, no la geometría.

        Invisible pero sí presente para los punteros: es lo que hace que el
        mismo código valga para el ratón y para el rayo del mando del visor.
      */}
      <mesh
        position={[0, 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={enSesion ? undefined : aim}
        visible={false}
      >
        <planeGeometry args={[TABLE_WIDTH, TABLE_LENGTH]} />
      </mesh>

      {/* El mazo en la mano: solo en sesión, que es donde hay manos. */}
      {enSesion ? (
        <MalletHand
          rink={rink}
          destino={pointer}
          onMove={(destino, cogido) => {
            pointer.current = destino
            enLaMano.current = cogido
            // El estado también se entera: la cuenta atrás no saca hasta tenerlo en la mano.
            setMalletHeld(cogido)
          }}
          onRelease={() => {
            enLaMano.current = false
            setMalletHeld(false)
          }}
        />
      ) : null}

      <Puck ref={puckObject} speedRef={puckSpeed} environment={environment} />
      <Mallet ref={playerObject} color={PALETTE.primary} />
      <Mallet ref={opponentObject} color={PALETTE.rival} />

      <pointLight
        ref={goalLight}
        position={[0, RAIL_HEIGHT + 0.12, HALF_LENGTH]}
        intensity={0}
        distance={1.2}
        decay={2}
      />
    </group>
  )
}

/**
 * En qué píxel de la página se ve un punto del mundo.
 *
 * Se proyecta el punto y no el objeto que lo dibuja: la matriz de mundo del
 * objeto es todavía la del fotograma anterior, y el disco cruza la mesa a seis
 * metros por segundo.
 */
function screenPoint({ camera, gl }: RootState, world: Vector3): ScreenPoint {
  const ndc = world.project(camera)
  return screenPointFromNdc(ndc.x, ndc.y, gl.domElement.getBoundingClientRect())
}

/** Lleva un objeto de la escena a su sitio en la mesa. */
function place(object: Group | null, position: Vec2) {
  if (object == null) return
  object.position.set(position.x, 0, position.z)
}
