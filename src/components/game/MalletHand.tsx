'use client'

import { useFrame } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'

import { startGrab, stepGrab, type GrabLatch } from '../../lib/grab'
import { useGrabMode } from '../../lib/settingsClient'
import type { GrabMode } from '../../lib/settings'
import { isPinching } from '../../lib/pinch'
import { useEffect, useRef } from 'react'
import { Vector3, type Group, type Object3D } from 'three'

import { nextGrab, type HandOnTable } from '../../lib/malletGrab'
import { markHandBusy, releaseHands } from '../xr/busyHands'
import { constrainMallet, type Vec2 } from '../../lib/puckPhysics'
import { useGame } from '../../lib/gameStore'

/**
 * El mazo en la mano, con el visor puesto.
 *
 * Lee las dos manos cada fotograma, las trae a coordenadas de la mesa y le pasa el destino
 * al mazo mientras se sostenga. Lo que decide cuándo se coge y cuándo se suelta es
 * `lib/malletGrab.ts`, que se prueba sin visor; aquí solo está lo que necesita a three: la
 * pose del mando y el cambio de coordenadas.
 *
 * **Las dos manos, no una elegida.** Quien juega coge el mazo con la que tenga libre y la
 * cambia a media partida, como en una mesa de verdad. Manda la que esté agarrando; si las
 * dos aprietan, la que ya lo llevaba.
 *
 * Fuera de sesión no hace nada: allí el mazo lo lleva el ratón sobre el tablero.
 */
export function MalletHand({
  rink,
  target: destino,
  onMove,
  onRelease,
}: {
  /** La mesa, para pasar del mundo a sus coordenadas. */
  rink: React.RefObject<Group | null>
  /**
   * Dónde va el mazo ahora mismo. Es el mismo dato que mueve la mesa, no una copia: si
   * fueran dos, coger el mazo se mediría contra un mazo que no es el que se ve.
   */
  target: React.RefObject<Vec2>
  /**
   * A dónde va el mazo, ya dentro de los límites de la mesa, que va cogido y con qué mano: es lo
   * que decide en qué mando vibra el golpe (`useGameHaptics`).
   */
  onMove: (destino: Vec2, cogido: boolean, lado: 'left' | 'right' | null) => void
  /** Se ha soltado: el mazo vuelve a perseguir en vez de ir en la mano. */
  onRelease: () => void
}) {
  const { recordMilestone: apuntarHito } = useGame()
  const izquierda = useXRInputSourceState('controller', 'left')
  const derecha = useXRInputSourceState('controller', 'right')
  // Y las manos desnudas, que son el otro modo de entrada del visor: sin esto, quien no
  // tiene los mandos a mano —o no puede sostenerlos— no puede coger el mazo y no juega.
  const manoIzquierda = useXRInputSourceState('hand', 'left')
  const manoDerecha = useXRInputSourceState('hand', 'right')
  const referenceSpace = useXR((state) => state.originReferenceSpace)
  const origin = useXR((state) => state.origin)
  const pellizcando = useRef({ left: false, right: false })
  // Cómo se sujeta el mazo: manteniendo el gatillo (o el pellizco) toda la partida, o con
  // un toque para cogerlo y otro para soltarlo. Una partida entera con la mano cerrada es
  // el agarre más largo de las trece cabinas, así que es donde más se nota (ver
  // `lib/agarre.ts`). El enganche se lleva por lado, porque el mazo se cambia de mano.
  const agarre = useGrabMode()
  const enganche = useRef<{ left: GrabLatch; right: GrabLatch }>({
    left: startGrab(),
    right: startGrab(),
  })

  /** Si el mazo va en la mano. Dónde está lo dice `destino`, que es de la mesa. */
  const cogido = useRef(false)
  // Se reutiliza entre fotogramas: `worldToLocal` muta lo que recibe y esto corre a 90 Hz.
  const punto = useRef(new Vector3())

  useFrame((_, __, frame) => {
    const grupo = rink.current
    if (grupo == null) return

    // Lo que dice cada lado en este fotograma, **antes** de decidir nada: el enganche solo
    // avanza una vez por lado y por fotograma, o el flanco que enciende «un toque» se
    // contaría dos veces y el mazo se cogería y se soltaría en el mismo gesto.
    const conMando = izquierda?.object != null || derecha?.object != null
    let enLaMesa: HandOnTable | null = null
    // De qué lado es la mano que manda este fotograma: es lo que apaga el rayo de ESE mando
    // y no el del otro (ver `xr/manosOcupadas.ts`).
    let lado: 'left' | 'right' | null = null

    if (conMando) {
      const apretado = {
        left: aprietaElGatillo(izquierda),
        right: aprietaElGatillo(derecha),
      }
      const sujeta = pasarElEnganche(enganche.current, apretado, agarre)
      const mano = manoQueManda(izquierda, derecha, cogido.current, sujeta)

      if (mano?.object != null) {
        // La pose del mando llega en coordenadas del mundo; la mesa puede estar movida y
        // girada (el salón la coloca donde le toca), así que se trae a las suyas.
        const local = grupo.worldToLocal(
          punto.current.setFromMatrixPosition(mano.object.matrixWorld),
        )
        lado = mano === izquierda ? 'left' : 'right'
        enLaMesa = {
          position: { x: local.x, z: local.z },
          grabbing: sujeta[lado],
        }
      }
    } else {
      // Sin mando, la mano desnuda. Aquí no hay botón que apretar: agarrar es juntar el
      // pulgar y el índice (ver `lib/pellizco.ts`), y el mazo va donde va la palma. El
      // pellizco pasa por el mismo enganche: quien no puede mantener un gatillo tampoco
      // tiene por qué poder mantener los dedos juntos una partida entera.
      const leidas = {
        left: leerLaMano(manoIzquierda, frame, referenceSpace, origin, pellizcando.current, grupo, punto.current),
        right: leerLaMano(manoDerecha, frame, referenceSpace, origin, pellizcando.current, grupo, punto.current),
      }
      const sujeta = pasarElEnganche(
        enganche.current,
        { left: leidas.left?.grabbing ?? false, right: leidas.right?.grabbing ?? false },
        agarre,
      )
      for (const lado_ of ['left', 'right'] as const) {
        const leida = leidas[lado_]
        if (leida == null) continue
        const conAgarre = { ...leida, grabbing: sujeta[lado_] }
        // La que esté agarrando manda; si ninguna, vale la primera que haya para saber si
        // está encima del mazo cuando pellizque.
        if (conAgarre.grabbing || enLaMesa == null) {
          enLaMesa = conAgarre
          lado = lado_
        }
      }
    }

    const siguiente = nextGrab(
      { held: cogido.current, target: destino.current },
      enLaMesa,
    )
    const soltado = cogido.current && !siguiente.held
    cogido.current = siguiente.held
    // Con el mazo en la mano, el rayo de ese mando se apaga: apuntar a la pared mientras se
    // sostiene algo es justo lo contrario de lo que está pasando.
    // El primer paso del tutorial se supera cogiendo el mazo de verdad.
    if (siguiente.held) apuntarHito('grab')
    markHandBusy('left', siguiente.held && lado === 'left')
    markHandBusy('right', siguiente.held && lado === 'right')
    if (siguiente.held) onMove(constrainMallet(siguiente.target, 'player'), true, lado)
    else if (soltado) onRelease()
  })

  // Al quitar la escena —volver al salón, acabar la partida— nadie lleva nada: si no, el
  // rayo se quedaría apagado en el arco, donde es lo único con lo que se elige cabina.
  useEffect(() => () => releaseHands(), [])

  return null
}

/**
 * Cuál de las dos manos lleva el mazo.
 *
 * Con el mazo ya cogido manda la que siga apretando —cambiar de mano a mitad de un golpe
 * porque la otra rozó el botón sería perderlo—; libre, la primera que apriete.
 */
function manoQueManda<T>(
  izquierda: T | undefined,
  derecha: T | undefined,
  cogido: boolean,
  sujeta: { left: boolean; right: boolean },
): T | undefined {
  if (cogido) return sujeta.left ? izquierda : sujeta.right ? derecha : undefined
  if (sujeta.left) return izquierda
  if (sujeta.right) return derecha
  // Sin nadie agarrando se devuelve una cualquiera: hace falta su posición para saber si
  // la mano está encima del mazo cuando agarre.
  return izquierda ?? derecha
}

/** Si el gatillo lateral de ese mando está apretado ahora mismo. */
function aprietaElGatillo(
  mando: { gamepad: { 'xr-standard-squeeze'?: { state: string } } } | undefined,
): boolean {
  return mando?.gamepad['xr-standard-squeeze']?.state === 'pressed'
}

/**
 * Avanza el enganche de los dos lados y dice cuál sujeta el mazo.
 *
 * Muta el objeto que recibe a propósito: es el mismo `ref` que vive entre fotogramas, y
 * copiarlo por pasada sería basura que recoger noventa veces por segundo.
 */
function pasarElEnganche(
  enganche: { left: GrabLatch; right: GrabLatch },
  apretado: { left: boolean; right: boolean },
  agarre: GrabMode,
): { left: boolean; right: boolean } {
  enganche.left = stepGrab(enganche.left, apretado.left, agarre)
  enganche.right = stepGrab(enganche.right, apretado.right, agarre)
  return { left: enganche.left.holding, right: enganche.right.holding }
}

/**
 * Dónde está una mano desnuda sobre la mesa, y si está agarrando.
 *
 * Se leen las articulaciones del fotograma de WebXR y no `state.object`: ese objeto solo lo
 * rellena la librería cuando dibuja el modelo de la mano, y quien monta el juego decide si
 * se dibuja —dentro del salón, no—. Las articulaciones llegan siempre que el visor las siga.
 */
function leerLaMano(
  estado: ReturnType<typeof useXRInputSourceState<'hand'>>,
  frame: XRFrame | undefined,
  referenceSpace: XRReferenceSpace | null | undefined,
  /** El origen de XR, que es de quien monta el juego: la pose llega en su espacio. */
  origin: Object3D | undefined,
  pellizcando: { left: boolean; right: boolean },
  mesa: Group,
  punto: Vector3,
): HandOnTable | null {
  const articulaciones = estado?.inputSource.hand
  if (articulaciones == null || frame == null || referenceSpace == null) return null

  const palma = articulaciones.get('wrist')
  const pulgar = articulaciones.get('thumb-tip')
  const indice = articulaciones.get('index-finger-tip')
  if (palma == null || pulgar == null || indice == null) return null

  const posePalma = frame.getJointPose?.(palma, referenceSpace)
  if (posePalma == null) return null

  const posePulgar = frame.getJointPose?.(pulgar, referenceSpace)
  const poseIndice = frame.getJointPose?.(indice, referenceSpace)
  const separacion =
    posePulgar == null || poseIndice == null
      ? null
      : Math.hypot(
          posePulgar.transform.position.x - poseIndice.transform.position.x,
          posePulgar.transform.position.y - poseIndice.transform.position.y,
          posePulgar.transform.position.z - poseIndice.transform.position.z,
        )

  const lado = estado?.inputSource.handedness === 'left' ? 'left' : 'right'
  const grabbing = isPinching(separacion, pellizcando[lado])
  pellizcando[lado] = grabbing

  const { position } = posePalma.transform
  punto.set(position.x, position.y, position.z)
  if (origin != null) origin.localToWorld(punto)
  mesa.worldToLocal(punto)
  return { position: { x: punto.x, z: punto.z }, grabbing: grabbing }
}
