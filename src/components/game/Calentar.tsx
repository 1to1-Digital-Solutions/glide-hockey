'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useEffect, useRef } from 'react'
import { apuntarProgramas } from '../../lib/montajes'

/**
 * Compila los shaders del visor **antes** de que haga falta pintarlos.
 *
 * Al abrir la sesión inmersiva se compilaban tres programas nuevos —los materiales que solo
 * existen dentro del visor: los paneles, el mando dibujado—, y compilar un shader **bloquea
 * el hilo**. En una pantalla eso es un fotograma perdido y no se nota. A 72 por segundo y por
 * ojo, es un fogonazo justo al entrar, que es exactamente cuando se reporta el parpadeo.
 *
 * `compileAsync` no bloquea: con `KHR_parallel_shader_compile` el driver compila en paralelo
 * y la promesa resuelve cuando está. Se llama en cuanto la sesión arranca y los paneles ya
 * están montados, así que lo que quedara por compilar se hace fuera del camino del dibujo.
 *
 * No arregla nada que no sea compilación: si el parpadeo siguiera, este componente lo
 * descarta como causa, que es la mitad del trabajo de encontrarlo.
 */
export function Calentar() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const mode = useXR((state) => state.mode)
  /** Solo una vez por sesión: recompilar en cada fotograma sería peor que el problema. */
  const calentado = useRef(false)

  useEffect(() => {
    if (mode == null) {
      // Al salir se olvida, para que la siguiente sesión vuelva a calentar lo suyo.
      calentado.current = false
      return
    }
    if (calentado.current) return
    calentado.current = true
    void gl.compileAsync(scene, camera)
  }, [mode, gl, scene, camera])

  // Cuántos programas lleva compilados, para que un test pueda decir si al entrar en la
  // sesión todavía queda alguno por compilar (`lib/montajes.ts`).
  useFrame(() => {
    apuntarProgramas(gl.info.programs?.length ?? 0)
  })

  return null
}
