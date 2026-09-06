'use client'

import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator, type Texture } from 'three'
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
  const texture = useMemo(() => {
    const pmrem = new PMREMGenerator(gl)
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    return environment
  }, [gl])

  // La textura vive en la tarjeta gráfica: se suelta al desmontar la escena.
  useEffect(() => () => texture.dispose(), [texture])

  return texture
}
