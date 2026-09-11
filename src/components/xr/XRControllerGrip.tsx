'use client'

import {
  CombinedPointer,
  DefaultXRControllerGrabPointer,
  DefaultXRInputSourceRayPointer,
  XRSpace,
  useXRInputSourceStateContext,
} from '@react-three/xr'
import type { Object3D } from 'three'

import { useManoOcupada } from './manosOcupadas'

/**
 * El mando dentro del visor: su sitio en el espacio y sus punteros, **sin modelo**.
 *
 * **Por qué existe.** Con `controller: { model: false }` la librería no monta
 * `XRControllerModel`, y ese componente es el único que escribe `state.object` — el objeto
 * de three que va pegado al puño. Sin él, `useXRInputSourceState('controller', mano).object`
 * es siempre `undefined`, así que **cualquier juego que coja algo llevando la mano hasta
 * ello no llega a enterarse nunca de dónde está la mano**: el mazo no se agarra, el bate no
 * se levanta, y desde fuera parece que el botón de agarre no funciona. Se descubrió con el
 * visor puesto, en tres juegos a la vez.
 *
 * Y el modelo no se puede encender: son `.glb` que la librería descarga de un CDN, y la
 * política de seguridad del salón lo bloquea. Así que aquí va un grupo vacío colocado en el
 * puño, que es lo único que hacía falta: la pose, sin nada que dibujar ni que descargar.
 *
 * **El puntero de agarre también vuelve.** Es el que usa `stick-rush` para atrapar los
 * palos; apagado, ese juego no se puede jugar.
 *
 * **Y el rayo se apaga con algo en la mano** (`manosOcupadas.ts`): con el objeto cogido
 * seguía encendido apuntando a la pared, como si se estuviera señalando un sitio. Se apaga
 * el dibujo, no el puntero: soltar y volver a pulsar un botón del menú funciona igual.
 */
/**
 * Deja apuntado en el estado del mando el objeto que va pegado al puño.
 *
 * **Se escribe a propósito**: es así como la librería lo hace en su propio
 * `XRControllerModel`, y es justo el hueco que este componente viene a rellenar. Va en una
 * función aparte porque escribirlo dentro del componente es, para el linter, tocar por tu
 * cuenta lo que devuelve un hook — que casi siempre es un error, y aquí es el contrato.
 *
 * @param anterior Si se pasa, solo se borra cuando siga siendo ese: al desmontar puede haber
 *   entrado ya el objeto del mando siguiente, y borrarlo dejaría al juego sin pose.
 */
function apuntarPuño(
  state: { object?: Object3D },
  node: Object3D | null,
  anterior?: Object3D | null,
): void {
  if (anterior !== undefined && state.object !== anterior) return
  state.object = node ?? undefined
}

export function XRControllerGrip({
  grabRadius,
  rayLength = 6,
}: {
  /** Radio de la esfera de agarre, en metros. Sin él, el de la librería. */
  grabRadius?: number
  /** Hasta dónde llega el rayo con el que se pulsan los menús. */
  rayLength?: number
}) {
  const state = useXRInputSourceStateContext('controller')
  const ocupada = useManoOcupada(state.inputSource.handedness as 'left' | 'right' | undefined)

  return (
    <>
      <XRSpace space="grip-space">
        {/* El grupo se registra en cuanto three lo crea, y se descuelga al desmontar: dejar
            apuntado un objeto que ya no está en la escena daría una pose congelada. */}
        <group
          ref={(node: Object3D | null) => {
            apuntarPuño(state, node)
            return () => apuntarPuño(state, null, node)
          }}
        />
      </XRSpace>

      <CombinedPointer>
        <DefaultXRControllerGrabPointer {...(grabRadius == null ? {} : { radius: grabRadius })} />
        <DefaultXRInputSourceRayPointer
          makeDefault
          minDistance={0.2}
          rayModel={ocupada ? false : { maxLength: rayLength, opacity: 0.35 }}
          cursorModel={!ocupada}
        />
      </CombinedPointer>
    </>
  )
}
