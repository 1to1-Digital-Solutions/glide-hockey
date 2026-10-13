'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { useFrame, type RootState, type ThreeEvent } from '@react-three/fiber'
import { frameEvents, type Handedness, type HandEvent } from '../../lib/haptics'
import { Vector3, type Group, type PointLight, type Texture } from 'three'
import type { RefObject } from 'react'
import { GOAL_AGAINST_STRENGTH, goalAgainstDirection } from '../../lib/goalAgainst'
import type { HitFeedbackHandle } from '../xr/HitFeedback'
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
import { type PlayGameSound } from '../../lib/useGameAudio'
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
  feel: sentir,
  onHand,
  environment,
  hitFeedback: golpeRecibido,
}: {
  play: PlayGameSound
  /**
   * El roce del disco, cada fotograma, con su velocidad en m/s. **Solo suena**
   * (`useGameAudio`): en la mano no, que deslizar no es un contacto y era lo que
   * dejaba los mandos vibrando la jugada entera.
   */
  slide: (speed: number) => void
  /** Lo que se siente en la mano: el golpe del mazo al disco y el gol (`useGameHaptics`). */
  feel?: (suceso: HandEvent) => void
  /** Qué mano lleva el mazo en el visor, o `null` al soltarlo (`useGameHaptics`). */
  onHand?: (mano: Handedness | null) => void
  /** Los reflejos de la sala para el disco, los mismos que lleva el tablero. */
  environment?: Texture
  /**
   * El golpe que recibe el cuerpo (`GolpeRecibido`, montado en `GameWorld`): se dispara con el
   * gol en contra y frena el reloj de la mesa mientras dura su cámara lenta.
   */
  hitFeedback?: RefObject<HitFeedbackHandle | null>
}) {
  const {
    recordMilestone: apuntarHito,
    recordFeat: apuntarHazana,
    gameState,
    prompt,
    activeDifficulty,
    lastScorer,
    scoreOpponent,
    scorePlayer,
    setMalletHeld,
    waitingForMallet: esperandoElMazo,
    seed,
  } = useGame()

  const skill = OPPONENT_SKILLS[activeDifficulty]

  const rink = useRef<Group>(null)
  const puckObject = useRef<Group>(null)
  const playerObject = useRef<Group>(null)
  const opponentObject = useRef<Group>(null)
  const goalLight = useRef<PointLight>(null)

  // La semilla con la que la máquina elige sus tiros es el número de partida: así
  // dos partidas seguidas no repiten los mismos, y dos con el mismo número son la
  // misma partida (ver `AimSeed` en `lib/opponent.ts`). En el reto del salón sale
  // de su semilla y de la ronda (`semillaDeLaMesa`). Se lee al montar, que es
  // exactamente una vez por partida y por ronda del reto (`key={runId}`).
  const table = useRef<TableState>(startTable({ skill, lastScorer, seed }))
  /** Los goles de la máquina en esta mesa, cuenten o no: solo para quien mire (`sceneProbe`). */
  const golesEnContra = useRef(0)
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
  /** Los ojos, de la cámara a la mesa, para saber de dónde viene el gol en contra. */
  const headPoint = useRef(new Vector3())

  // Con el visor puesto el mazo va en la mano, no en el rayo: apuntar con el mando se
  // sentía como manejar un cursor. Fuera de sesión sigue mandando el ratón sobre el
  // tablero, que es como se juega en pantalla.
  const enSesion = useXR((state) => state.mode != null)

  const aim = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const rinkGroup = rink.current
      if (rinkGroup == null) return

      // `worldToLocal` muta lo que recibe, así que nunca se le pasa el punto del
      // evento: es de la librería y lo reutiliza para el siguiente.
      const local = rinkGroup.worldToLocal(worldPoint.current.copy(event.point))
      pointer.current = constrainMallet({ x: local.x, z: local.z }, 'player')
    },
    [],
  )

  useFrame((state, delta) => {
    const golpesAntes = table.current.playerHits
    const fotograma = advanceTable(table.current, {
      // La cámara lenta del golpe recibido frena **la mesa** y nada más: el disco y los mazos
      // van más despacio un instante, y la cabeza y la mano siguen a su ritmo, que es lo que
      // evita que se lea como un tirón de fotogramas.
      delta: delta * (golpeRecibido?.current?.timeScale() ?? 1),
      pointer: pointer.current,
      // Cogido con la mano el mazo no persigue: está donde está la mano.
      inHand: enLaMano.current,
      skill,
      // Con la pregunta de salir en pantalla el disco se queda quieto: decidir no puede
      // costar goles.
      playing: gameState === 'playing' && prompt === null,
    })
    const {
      table: next,
      goals,
      struck,
      bounced,
      impact,
    } = fotograma
    table.current = next

    // Cómo entró cada gol, si fue una hazaña: se apunta a la partida y se cuenta al salón al final.
    for (const hazana of fotograma.feats) apuntarHazana(hazana)
    for (const goal of goals) {
      if (goal === 'player') scorePlayer()
      else {
        golesEnContra.current += 1
        scoreOpponent()
      }
    }

    // Lo que se oye de la mesa, en el orden en que pasa: el mazo lanza el
    // disco, el disco choca donde vaya a chocar y, si entra, se canta el gol.
    // Silenciado, `play` no hace nada (ver `lib/useGameAudio.ts`).
    // El segundo paso del tutorial: darle al disco. El golpe ya se cuenta aquí.
    if (next.playerHits > 0) apuntarHito('hit')
    if (struck) play('strike', impactStrength(impact.strike))
    if (bounced) play('bounce', impactStrength(impact.bounce))
    if (goals.length > 0) play('goal')
    // Y lo que se siente, que no es lo mismo que lo que se oye: el golpe de la máquina y el
    // rebote en la banda suenan, pero no los toca la mano (`sucesosDelFotograma`).
    if (sentir != null) for (const suceso of frameEvents(golpesAntes, fotograma)) sentir(suceso)

    // Y el gol en contra, como golpe recibido, **después** de la vibración del gol: `pulse()` no
    // encola y cada pulso corta al anterior, así que el largo del golpe en las dos manos es el
    // que queda y el corto de la llegada no lo trunca. Con el confort apagado no vibra la macro y
    // queda solo la llegada, como siempre.
    const rinkAhora = rink.current
    if (goals.includes('opponent') && rinkAhora != null) {
      const ojos = rinkAhora.worldToLocal(state.camera.getWorldPosition(headPoint.current))
      golpeRecibido?.current?.hit(GOAL_AGAINST_STRENGTH, goalAgainstDirection(ojos))
    }

    // El disco deslizándose se oye y se ve según lo rápido que va; parado, o
    // con la partida en pausa, nada.
    const { x: vx, z: vz } = next.puck.velocity
    const speed = gameState === 'playing' && prompt === null ? Math.hypot(vx, vz) : 0
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
        goalsAgainst: golesEnContra.current,
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
          target={pointer}
          onMove={(destino, cogido, lado) => {
            pointer.current = destino
            enLaMano.current = cogido
            // La mano que lleva el mazo, para que el golpe vibre en ella y no en las dos.
            onHand?.(lado)
            // El estado también se entera: la cuenta atrás no saca hasta tenerlo en la mano.
            setMalletHeld(cogido)
          }}
          onRelease={() => {
            enLaMano.current = false
            onHand?.(null)
            setMalletHeld(false)
          }}
        />
      ) : null}

      <Puck ref={puckObject} speedRef={puckSpeed} environment={environment} />
      <Mallet
        ref={playerObject}
        color={PALETTE.primary}
        environment={environment}
        highlighted={esperandoElMazo}
      />
      <Mallet ref={opponentObject} color={PALETTE.rival} environment={environment} />

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
