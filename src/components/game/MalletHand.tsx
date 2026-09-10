'use client'

import { useFrame } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'

import { isPinching } from '../../lib/pellizco'
import { useRef } from 'react'
import { Vector3, type Group, type Object3D } from 'three'

import { siguienteAgarre, type ManoEnLaMesa } from '../../lib/malletGrab'
import { constrainMallet, type Vec2 } from '../../lib/puckPhysics'

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
  destino,
  onMove,
  onRelease,
}: {
  /** La mesa, para pasar del mundo a sus coordenadas. */
  rink: React.RefObject<Group | null>
  /**
   * Dónde va el mazo ahora mismo. Es el mismo dato que mueve la mesa, no una copia: si
   * fueran dos, coger el mazo se mediría contra un mazo que no es el que se ve.
   */
  destino: React.RefObject<Vec2>
  /** A dónde va el mazo, ya dentro de los límites de la mesa, y que va cogido. */
  onMove: (destino: Vec2, cogido: boolean) => void
  /** Se ha soltado: el mazo vuelve a perseguir en vez de ir en la mano. */
  onRelease: () => void
}) {
  const izquierda = useXRInputSourceState('controller', 'left')
  const derecha = useXRInputSourceState('controller', 'right')
  // Y las manos desnudas, que son el otro modo de entrada del visor: sin esto, quien no
  // tiene los mandos a mano —o no puede sostenerlos— no puede coger el mazo y no juega.
  const manoIzquierda = useXRInputSourceState('hand', 'left')
  const manoDerecha = useXRInputSourceState('hand', 'right')
  const referenceSpace = useXR((state) => state.originReferenceSpace)
  const origin = useXR((state) => state.origin)
  const pellizcando = useRef({ left: false, right: false })

  /** Si el mazo va en la mano. Dónde está lo dice `destino`, que es de la mesa. */
  const cogido = useRef(false)
  // Se reutiliza entre fotogramas: `worldToLocal` muta lo que recibe y esto corre a 90 Hz.
  const punto = useRef(new Vector3())

  useFrame((_, __, frame) => {
    const grupo = rink.current
    if (grupo == null) return

    const mano = manoQueManda(izquierda, derecha, cogido.current)
    let enLaMesa: ManoEnLaMesa | null = null

    if (mano?.object != null) {
      // La pose del mando llega en coordenadas del mundo; la mesa puede estar movida y
      // girada (el salón la coloca donde le toca), así que se trae a las suyas.
      const local = grupo.worldToLocal(punto.current.setFromMatrixPosition(mano.object.matrixWorld))
      enLaMesa = {
        posicion: { x: local.x, z: local.z },
        agarrando: mano.gamepad['xr-standard-squeeze']?.state === 'pressed',
      }
    } else {
      // Sin mando, la mano desnuda. Aquí no hay botón que apretar: agarrar es juntar el
      // pulgar y el índice (ver `lib/pellizco.ts`), y el mazo va donde va la palma.
      for (const candidata of [manoIzquierda, manoDerecha]) {
        const leida = leerLaMano(
          candidata,
          frame,
          referenceSpace,
          origin,
          pellizcando.current,
          grupo,
          punto.current,
        )
        // La que esté agarrando manda; si ninguna, vale la primera que haya para saber si
        // está encima del mazo cuando pellizque.
        if (leida != null && (leida.agarrando || enLaMesa == null)) enLaMesa = leida
      }
    }

    const siguiente = siguienteAgarre(
      { cogido: cogido.current, destino: destino.current },
      enLaMesa,
    )
    const soltado = cogido.current && !siguiente.cogido
    cogido.current = siguiente.cogido
    if (siguiente.cogido) onMove(constrainMallet(siguiente.destino, 'player'), true)
    else if (soltado) onRelease()
  })

  return null
}

/**
 * Cuál de las dos manos lleva el mazo.
 *
 * Con el mazo ya cogido manda la que siga apretando —cambiar de mano a mitad de un golpe
 * porque la otra rozó el botón sería perderlo—; libre, la primera que apriete.
 */
function manoQueManda<T extends { gamepad: { 'xr-standard-squeeze'?: { state: string } } }>(
  izquierda: T | undefined,
  derecha: T | undefined,
  cogido: boolean,
): T | undefined {
  const aprieta = (m: T | undefined) => m?.gamepad['xr-standard-squeeze']?.state === 'pressed'

  if (cogido) return aprieta(izquierda) ? izquierda : aprieta(derecha) ? derecha : undefined
  if (aprieta(izquierda)) return izquierda
  if (aprieta(derecha)) return derecha
  // Sin nadie apretando se devuelve una cualquiera: hace falta su posición para saber si
  // la mano está encima del mazo cuando apriete.
  return izquierda ?? derecha
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
): ManoEnLaMesa | null {
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
  const agarrando = isPinching(separacion, pellizcando[lado])
  pellizcando[lado] = agarrando

  const { position } = posePalma.transform
  punto.set(position.x, position.y, position.z)
  if (origin != null) origin.localToWorld(punto)
  mesa.worldToLocal(punto)
  return { posicion: { x: punto.x, z: punto.z }, agarrando }
}
