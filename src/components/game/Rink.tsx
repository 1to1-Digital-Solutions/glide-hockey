'use client'

import { useCallback, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Vector3, type Group, type PointLight } from 'three'
import {
  GOAL_PAUSE_SECONDS,
  OPPONENT_SKILLS,
  PLAYER_MALLET_SPEED,
  RAIL_HEIGHT,
  TABLE_LENGTH,
  TABLE_WIDTH,
} from '../../lib/gameConfig'
import { useGame } from '../../lib/gameStore'
import { opponentStart, playerStart, stepOpponent } from '../../lib/opponent'
import { PALETTE } from '../../lib/palette'
import {
  HALF_LENGTH,
  constrainMallet,
  isStalled,
  serve,
  stallSeconds,
  stepPuck,
  type Body,
  type Scorer,
  type Vec2,
} from '../../lib/puckPhysics'
import { Mallet } from './Mallet'
import { Puck } from './Puck'

/**
 * La partida en marcha: el disco, los dos mazos y el bucle que los mueve.
 *
 * Nada de lo que cambia sesenta veces por segundo pasa por el estado de React.
 * Las posiciones viven en `useRef` y se escriben directamente sobre los objetos
 * de three; lo único que sale hacia el store son los goles, que son unos pocos
 * por partida. Con la posición del disco en un `useState`, el árbol entero se
 * repintaría en cada fotograma.
 *
 * La simulación es de `lib/puckPhysics.ts` y la máquina, de `lib/opponent.ts`:
 * aquí solo se les pasa el tiempo transcurrido y se coloca el resultado.
 *
 * Se monta con `key={runId}`, así que cada partida —y cada ronda del reto—
 * estrena uno limpio: remontarlo es más simple que devolver a mano cada pieza a
 * su sitio.
 */

/**
 * Tope del paso de simulación.
 *
 * Una pestaña que vuelve de segundo plano entrega un `delta` de segundos, y con
 * él la partida avanzaría de golpe: goles marcados sin que nadie lo viera.
 * Recortarlo hace que el juego se ralentice en vez de dar saltos.
 */
const MAX_FRAME_SECONDS = 1 / 30

export function Rink() {
  const {
    gameState,
    activeDifficulty,
    lastScorer,
    scoreOpponent,
    scorePlayer,
  } = useGame()

  const skill = OPPONENT_SKILLS[activeDifficulty]

  const rink = useRef<Group>(null)
  const puckObject = useRef<Group>(null)
  const playerObject = useRef<Group>(null)
  const opponentObject = useRef<Group>(null)
  const goalLight = useRef<PointLight>(null)

  const puck = useRef<Body>(serve(null))
  const player = useRef<Body>({
    position: playerStart(),
    velocity: { x: 0, z: 0 },
  })
  const opponent = useRef<Body>({
    position: opponentStart(skill),
    velocity: { x: 0, z: 0 },
  })

  /** Dónde apunta el jugador. El mazo va detrás, no salta hasta ahí. */
  const pointer = useRef<Vec2>(playerStart())

  /** Segundos que queda por celebrar el gol antes de volver a sacar. */
  const pause = useRef(0)
  /** Cuánto lleva el disco muerto: pasado el plazo se saca de nuevo. */
  const stalled = useRef(0)
  /** Quién marcó el gol que se está celebrando: decide hacia dónde se saca. */
  const pendingServe = useRef<Scorer | null>(lastScorer)

  // El punto del evento viene en coordenadas del mundo y hay que traerlo a las
  // de la mesa. Se reutiliza el mismo vector: son varios eventos por fotograma.
  const worldPoint = useRef(new Vector3())

  const aim = useCallback((event: ThreeEvent<PointerEvent>) => {
    const rinkGroup = rink.current
    if (rinkGroup == null) return

    // `worldToLocal` muta lo que recibe, así que nunca se le pasa el punto del
    // evento: es de la librería y lo reutiliza para el siguiente.
    const local = rinkGroup.worldToLocal(worldPoint.current.copy(event.point))
    pointer.current = constrainMallet({ x: local.x, z: local.z }, 'player')
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, MAX_FRAME_SECONDS)
    if (dt <= 0) return

    movePlayer(player, pointer.current, dt)

    // Fuera de la partida los mazos siguen respondiendo —así se coloca uno
    // durante la cuenta atrás— pero el disco espera en el centro.
    if (gameState === 'playing') {
      if (pause.current > 0) {
        pause.current -= dt
        if (pause.current <= 0) puck.current = serve(pendingServe.current)
      } else {
        opponent.current = stepOpponent({
          puck: puck.current,
          mallet: opponent.current.position,
          playerMallet: player.current.position,
          skill,
          dt,
        })

        const result = stepPuck({
          puck: puck.current,
          mallets: [player.current, opponent.current],
          dt,
        })
        puck.current = result.puck

        if (result.goal != null) {
          pendingServe.current = result.goal
          pause.current = GOAL_PAUSE_SECONDS
          stalled.current = 0
          if (result.goal === 'player') scorePlayer()
          else scoreOpponent()
        } else {
          // Ninguno de los dos mazos cruza la línea de medio campo, así que un
          // disco parado donde el otro no llega deja la partida congelada. Se
          // saca de nuevo, como en la mesa de verdad.
          stalled.current = stallSeconds(stalled.current, puck.current, dt)
          if (isStalled(stalled.current)) {
            stalled.current = 0
            puck.current = serve(pendingServe.current)
          }
        }
      }
    }

    place(puckObject.current, puck.current.position)
    place(playerObject.current, player.current.position)
    place(opponentObject.current, opponent.current.position)

    // La portería del gol se enciende mientras dura la celebración. Es lo que
    // hace que en el visor se vea dónde ha entrado sin buscar el marcador.
    const light = goalLight.current
    if (light != null) {
      const celebrating = pause.current > 0
      light.intensity = celebrating ? 6 : 0
      light.color.set(
        pendingServe.current === 'player' ? PALETTE.primary : PALETTE.rival,
      )
      light.position.z =
        pendingServe.current === 'player' ? -HALF_LENGTH : HALF_LENGTH
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
        onPointerMove={aim}
        visible={false}
      >
        <planeGeometry args={[TABLE_WIDTH, TABLE_LENGTH]} />
      </mesh>

      <Puck ref={puckObject} />
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

/** Lleva un objeto de la escena a su sitio en la mesa. */
function place(object: Group | null, position: Vec2) {
  if (object == null) return
  object.position.set(position.x, 0, position.z)
}

/**
 * Acerca el mazo del jugador a donde apunta, sin pasarse de su velocidad.
 *
 * La velocidad resultante es la real y no la pretendida: es con la que golpea,
 * así que un mazo que llega al tope del recorrido tiene que dejar de empujar.
 */
function movePlayer(
  mallet: { current: Body },
  target: Vec2,
  dt: number,
): void {
  const from = mallet.current.position
  const delta = { x: target.x - from.x, z: target.z - from.z }
  const distance = Math.hypot(delta.x, delta.z)
  const budget = PLAYER_MALLET_SPEED * dt

  const step =
    distance <= budget || distance === 0
      ? delta
      : { x: (delta.x / distance) * budget, z: (delta.z / distance) * budget }

  const position = constrainMallet(
    { x: from.x + step.x, z: from.z + step.z },
    'player',
  )

  mallet.current = {
    position,
    velocity: {
      x: (position.x - from.x) / dt,
      z: (position.z - from.z) / dt,
    },
  }
}
