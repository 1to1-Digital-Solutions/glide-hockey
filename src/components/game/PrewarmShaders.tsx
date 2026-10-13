'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useLayoutEffect } from 'react'
import { apuntarProgramas } from '../../lib/montajes'

/**
 * Compila los shaders de la escena **antes** de que haga falta pintarlos.
 *
 * Compilar un shader **bloquea el hilo**, y three no lo hace hasta que le toca pintar ese
 * material por primera vez. En una pantalla eso es un fotograma perdido y no se nota. A 72
 * por segundo y por ojo, es un fogonazo — y no uno: **uno por material**, repartidos por los
 * primeros fotogramas según va apareciendo cada cosa. Es el tirón que se reporta al empezar.
 *
 * `compile` no bloquea: con `KHR_parallel_shader_compile` el driver compila en paralelo. Se
 * llama de una vez para la escena entera, así que en lugar de ocho compilaciones sueltas —cada
 * una en su fotograma— hay una tanda fuera del camino del dibujo.
 *
 * **Con `compile` y no con `compileAsync`.** `compileAsync` es `compile` más una promesa que
 * three resuelve sondeando cada diez milisegundos el programa de cada material. Si entretanto
 * se desmonta uno (los botones del menú al pulsar Jugar), el sondeo lee un programa que ya no
 * existe y revienta en un temporizador: «Cannot read properties of undefined (reading
 * 'isReady')». Aquí nadie espera esa promesa, así que el sondeo sobra.
 *
 * **Va montado en el mundo, no en el Canvas de la web del juego.** Ahí estuvo, y por eso no
 * calentaba nada justo donde se juega de verdad: el salón monta `<GameWorld>` dentro de su
 * propio Canvas, y todo lo que colgara del Canvas propio se quedaba en la web. Peor aún, en
 * el salón se entra en la cabina **con el visor ya puesto**: la escena nace dentro de una
 * sesión abierta y sin haber pintado un solo fotograma en pantalla, así que allí no hay nada
 * compilado de antes y se compila todo en marcha.
 *
 * **Y en un efecto de disposición** (`useLayoutEffect`), que React vacía antes de ceder el
 * control al navegador: con un efecto normal la tanda puede caer después del primer fotograma
 * de la escena, que es exactamente el fotograma que hay que salvar.
 *
 * `compile` recorre la escena **se vea o no lo que hay en ella**, así que el decorado que se
 * oculta al elegir «tu habitación» entra igual: lo que no entra es lo que se desmonta, y por
 * eso lo que cambia con el escenario se oculta en vez de quitarse.
 *
 * No arregla nada que no sea compilación: si el parpadeo siguiera, este componente lo
 * descarta como causa, que es la mitad del trabajo de encontrarlo.
 */
export function Calentar() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const mode = useXR((state) => state.mode)

  // Al montarse y cada vez que se abre o se cierra una sesión: entrar al visor estrena los
  // materiales que solo existen dentro —los paneles, el mando dibujado— y son justo los que
  // no ha compilado nadie. Repetirlo no cuesta: three devuelve el programa que ya tiene.
  useLayoutEffect(() => {
    gl.compile(scene, camera)
  }, [mode, gl, scene, camera])

  // Cuántos programas lleva compilados, para que un test pueda decir si al entrar en la
  // sesión todavía queda alguno por compilar (`lib/montajes.ts`).
  useFrame(() => {
    apuntarProgramas(gl.info.programs?.length ?? 0)
  })

  return null
}
