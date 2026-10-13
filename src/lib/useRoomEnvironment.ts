'use client'

import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { InstancedMesh, PMREMGenerator, type Texture } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * Un mapa de entorno para los reflejos de la mesa y del disco, **sin fichero**.
 *
 * La tarea pedía un cubemap o un HDRI pequeño servido desde `assetsBase`; esto
 * es lo mismo sin pedir nada por HTTP —un juego de xrcade puede arrancar en un
 * visor en red local— y sin nada que copiar al anfitrión: `RoomEnvironment`
 * es una sala de luces que three trae hecha, y `PMREMGenerator` la convierte
 * una vez, al montar, en el mapa prefiltrado que los materiales estándar saben
 * leer. Barato: se calcula una vez y los reflejos son una lectura de textura
 * por píxel del material que lo lleve. Nada de reflejos planares.
 *
 * Se aplica a mano a los materiales que lo quieren (`envMap`), no a
 * `scene.environment`: dentro del salón de xrcade la escena es del anfitrión, y
 * un entorno global le cambiaría el aspecto a las cabinas.
 */
export function useRoomEnvironment(): Texture {
  const gl = useThree((state) => state.gl)
  const target = useMemo(() => {
    const pmrem = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const environment = pmrem.fromScene(room, 0.04)
    pmrem.dispose()
    room.dispose()
    // `room.dispose()` suelta geometrías y materiales, pero no las cajas de la sala, que son un
    // `InstancedMesh`: su `instanceMatrix` es un búfer de WebGL que solo se va soltando la malla.
    // Sin esto quedaba un búfer por visita (medido en tower-tumble).
    room.traverse((part) => {
      if (part instanceof InstancedMesh) part.dispose()
    })
    return environment
  }, [gl])

  // El mapa vive en la tarjeta gráfica dentro de su render target, y es el target lo que se
  // suelta al desmontar: soltar solo su textura deja el búfer vivo en cada visita. La sala de
  // luces se suelta nada más convertirla (sus geometrías y materiales): ya no hace falta.
  useEffect(() => () => target.dispose(), [target])

  return target.texture
}
