import type { GrabMode } from './ajustes'

/**
 * Qué hacer con cada cambio del botón de agarre, según cómo se haya elegido agarrar.
 *
 * **El problema.** El gesto de este juego pide **mantener apretado** el gatillo de punta a
 * punta: coger, mover el brazo y soltar. Un lanzamiento son tres o cuatro segundos con la
 * mano cerrada; una partida entera, ciento y pico. Quien tiene poca fuerza de agarre
 * —artritis, temblor, una mano cansada— no se queda fuera de una parte del juego: se queda
 * fuera del gesto, que es el juego.
 *
 * **Qué cambia con `toggle`.** Un toque para cogerlo y otro para soltarlo. El gesto de en
 * medio es el mismo y por eso **no cambia ninguna puntuación**: lo que decide el lanzamiento
 * sigue siendo lo que hace el brazo hasta el momento de soltar.
 *
 * Aquí solo vive la decisión, sin three.js ni React, porque es donde se equivoca uno: en
 * `toggle` el botón hace algo distinto **según lo que ya se tenga en la mano**, y sin
 * ignorar el evento de soltar, un toque cogería y soltaría en el mismo gesto.
 *
 * Cómo se agarra lo elige quien juega en los ajustes del arcade y vale para las trece
 * cabinas (ver `lib/ajustes.ts`): quien no puede mantener el gatillo no puede mantenerlo en
 * ninguna.
 */

/** Lo que toca hacer con lo que se tiene (o no) en la mano. */
export type GrabStep = 'take' | 'release' | 'nothing'

/**
 * @param pressed  si este evento es el de apretar (`true`) o el de soltar (`false`)
 * @param holding  si ahora mismo se lleva algo en la mano
 * @param mode     cómo se ha elegido agarrar
 */
export function grabStep(pressed: boolean, holding: boolean, mode: GrabMode): GrabStep {
  if (mode === 'toggle') {
    // Soltar el botón no hace nada: si contara, el mismo toque cogería y soltaría.
    if (!pressed) return 'nothing'
    return holding ? 'release' : 'take'
  }
  if (pressed) return holding ? 'nothing' : 'take'
  return holding ? 'release' : 'nothing'
}

/**
 * Lo mismo, para quien lee el botón **en cada fotograma** en vez de por eventos.
 *
 * Varios juegos no escuchan el botón: lo miran en el bucle de render, porque lo que hacen
 * con él —seguir la mano con el mazo— pasa en cada fotograma de todas formas. Ahí no hay
 * un «evento de apretar» que consultar, así que el flanco hay que verlo: lo que enciende
 * o apaga el agarre en `toggle` es que el botón **pase** a estar apretado, no que lo esté.
 */
export interface GrabLatch {
  /** Si ahora mismo se lleva algo en la mano. */
  holding: boolean
  /** Si el botón estaba apretado en el fotograma anterior. */
  wasPressed: boolean
}

/** Un agarre recién empezado: la mano vacía y el botón suelto. */
export function startGrab(): GrabLatch {
  return { holding: false, wasPressed: false }
}

/** Avanza el agarre con lo que dice el botón en este fotograma. */
export function stepGrab(state: GrabLatch, pressed: boolean, mode: GrabMode): GrabLatch {
  // Manteniendo, la mano lleva algo exactamente mientras el botón esté apretado.
  if (mode !== 'toggle') return { holding: pressed, wasPressed: pressed }
  const flanco = pressed && !state.wasPressed
  return { holding: flanco ? !state.holding : state.holding, wasPressed: pressed }
}
