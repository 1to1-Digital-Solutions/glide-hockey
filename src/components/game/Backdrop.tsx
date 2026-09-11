'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, type Scene } from 'three'

/**
 * El fondo de la escena: lo que se ve donde no hay nada dibujado.
 *
 * **Qué arregla.** Las paredes acaban a la altura que acaban, y por encima estaba el negro
 * del compositor: no el negro de un sitio a oscuras, sino la ausencia de sitio. Desde una
 * pantalla apenas se nota; con el visor puesto se nota a la primera, porque el ojo usa
 * justamente el fondo para saber dónde está.
 *
 * **Por qué no `<color attach="background">`.** Ese atajo adjunta el color a **su padre**, y
 * solo acierta si el padre es la escena. Dentro de cualquier `<group>` —y aquí el mundo
 * cuelga de varios— se adjunta al grupo, donde `background` no significa nada: no falla, no
 * avisa, simplemente no hace nada. Esto lo pone donde va, cuelgue de donde cuelgue.
 *
 * **Y lo devuelve al irse.** Montado en el salón, el juego se desmonta al volver al arco: sin
 * restaurar lo que había, la cabina se llevaría por delante el fondo del hub.
 *
 * La escena se toma del fotograma y no de `useThree` a propósito: lo que devuelve un hook no
 * se toca (`react-hooks/immutability`), y lo que hay que hacer aquí es exactamente tocarlo.
 */
export function Backdrop({ color }: { color: string }) {
  const fondo = useMemo(() => new Color(color), [color])
  const escena = useRef<Scene | null>(null)
  const anterior = useRef<Scene['background']>(null)

  useFrame(({ scene }) => {
    if (escena.current !== scene) {
      escena.current = scene
      anterior.current = scene.background
    }
    // Solo cuando hace falta: asignar en cada uno de los noventa fotogramas no
    // rompe nada, pero tampoco hace nada.
    if (scene.background !== fondo) scene.background = fondo
  })

  useEffect(
    () => () => {
      const scene = escena.current
      if (scene != null) scene.background = anterior.current
    },
    [],
  )

  return null
}
