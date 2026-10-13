/**
 * Lo que se siente en la mano: las recetas de vibración comunes a todos los juegos del salón.
 *
 * Es el mismo fichero en todos (`comunes.py` lo vigila). Cada juego traduce sus sucesos a un
 * `Tacto` —«esta mano ha golpeado con esta fuerza», «esta mano está tensando hasta aquí»— y de
 * aquí sale **qué pulsos, en qué mano y cuándo**. Así un golpe se siente igual en los dardos que
 * en los bolos, y quien aprende en un juego qué quiere decir una vibración no tiene que volver a
 * aprenderlo en el siguiente.
 *
 * Tres reglas que deciden todo lo de abajo:
 *
 * - **Vibra la mano que toca.** Las dos solo cuando el golpe lo recibe el cuerpo. Si vibran las
 *   dos por algo que ha hecho una, la mano deja de saber qué ha sido suyo.
 * - **Deslizar, esperar o que algo pase cerca no vibra.** Solo el contacto. Un roce continuo
 *   dejó un juego vibrando la partida entera.
 * - **`pulse()` no encola: cada llamada corta la anterior** (la especificación de
 *   `GamepadHapticActuator` y lo que hace el Quest). Un tren de pulsos se encadena con retardos
 *   iguales o mayores que la duración del pulso anterior; solaparlos no suma, corta. Lo vigila el
 *   test.
 *
 * Todo es puro: nada de React, three ni mandos. Quien reproduce los pulsos es cada juego, con su
 * `pulseInputSource` o equivalente; en Godot, `XRInterface.trigger_haptic_pulse` recibe lo mismo
 * (intensidad y duración) salvo la frecuencia, que aquí no existe.
 */

export type Mano = 'left' | 'right'

/** Lo que ha pasado, dicho desde la mano. `fuerza` y `nivel` van de 0 a 1. */
export type Tacto =
  /** Algo golpea con lo que se tiene en la mano: un bate, una pala, una hoja, un mazo. */
  | { readonly tipo: 'impacto'; readonly mano: Mano; readonly fuerza: number }
  /** Lo que se lanzó llega y toca algo: el dardo se clava, los bolos caen, entra el aro. */
  | { readonly tipo: 'llegada'; readonly mano: Mano; readonly fuerza: number }
  /** Se coge algo. */
  | { readonly tipo: 'agarre'; readonly mano: Mano }
  /** Se suelta o se lanza algo; `fuerza` es lo fuerte que salió. */
  | { readonly tipo: 'suelta'; readonly mano: Mano; readonly fuerza: number }
  /** Un disparo: el retroceso del arma. */
  | { readonly tipo: 'disparo'; readonly mano: Mano }
  /** El cuerpo recibe un golpe. Las dos manos. */
  | { readonly tipo: 'golpeRecibido'; readonly fuerza: number }

/** Un pulso listo para `pulse(intensidad, ms)`, que sale `retardo` ms después del suceso. */
export type Pulso = {
  readonly mano: Mano
  readonly intensidad: number
  readonly ms: number
  readonly retardo: number
}

/**
 * Las cifras de las recetas. Salen de probar con un Quest 3 en la mano: por debajo de 0,08 de
 * intensidad o de 12 ms un pulso no se nota; por encima de 0,9 todos se notan igual.
 * A CALIBRAR CON EL VISOR, juntas y en un juego de cada tipo.
 */
export const RECETAS = {
  /** El golpe: fuerte y corto, y una cola más suave que dice «ha sido de verdad». */
  impacto: { minimo: 0.3, maximo: 0.95, ms: 35, cola: { factor: 0.35, ms: 60 } },
  /** Lo lanzado llega: más suave que un golpe en la mano, porque pasa lejos. */
  llegada: { minimo: 0.15, maximo: 0.5, ms: 30 },
  agarre: { intensidad: 0.25, ms: 18 },
  suelta: { minimo: 0.2, maximo: 0.6, ms: 30 },
  disparo: { intensidad: 0.7, ms: 30 },
  /** Lo más largo y en las dos manos: que no se confunda con nada que se haga. */
  golpeRecibido: { minimo: 0.6, maximo: 1, ms: 220 },
  /** La tensión: pulsos cortos que se aprietan y suben mientras se tensa. */
  tension: {
    ms: 14,
    intensidad: { floja: 0.08, tensa: 0.4 },
    periodo: { floja: 140, tensa: 45 },
    /** Por debajo de esto no se tensa nada todavía: la cuerda en reposo no vibra. */
    umbral: 0.05,
  },
} as const

const acotar = (x: number) => Math.min(1, Math.max(0, x))
const entre = (desde: number, hasta: number, t: number) => desde + (hasta - desde) * acotar(t)

/** Los pulsos de un suceso suelto. La tensión, que dura, va aparte (`siguienteTension`). */
export function pulsosDe(tacto: Tacto): Pulso[] {
  switch (tacto.tipo) {
    case 'impacto': {
      const r = RECETAS.impacto
      const intensidad = entre(r.minimo, r.maximo, tacto.fuerza)
      return [
        { mano: tacto.mano, intensidad, ms: r.ms, retardo: 0 },
        { mano: tacto.mano, intensidad: intensidad * r.cola.factor, ms: r.cola.ms, retardo: r.ms },
      ]
    }
    case 'llegada': {
      const r = RECETAS.llegada
      return [{ mano: tacto.mano, intensidad: entre(r.minimo, r.maximo, tacto.fuerza), ms: r.ms, retardo: 0 }]
    }
    case 'agarre':
      return [{ mano: tacto.mano, intensidad: RECETAS.agarre.intensidad, ms: RECETAS.agarre.ms, retardo: 0 }]
    case 'suelta': {
      const r = RECETAS.suelta
      return [{ mano: tacto.mano, intensidad: entre(r.minimo, r.maximo, tacto.fuerza), ms: r.ms, retardo: 0 }]
    }
    case 'disparo':
      return [{ mano: tacto.mano, intensidad: RECETAS.disparo.intensidad, ms: RECETAS.disparo.ms, retardo: 0 }]
    case 'golpeRecibido': {
      const r = RECETAS.golpeRecibido
      const intensidad = entre(r.minimo, r.maximo, tacto.fuerza)
      return (['left', 'right'] as const).map((mano) => ({ mano, intensidad, ms: r.ms, retardo: 0 }))
    }
  }
}

/** Cuándo tocó el último pulso de tensión de una mano. `null`: no se está tensando. */
export type Tension = { readonly ultimo: number | null }

export const SIN_TENSION: Tension = { ultimo: null }

/**
 * La tensión mientras dura: se llama cada fotograma con lo tensado (0–1) y el reloj en ms, y
 * devuelve si toca un pulso ahora. El periodo se acorta y la intensidad sube con lo tensado, así
 * que la cuerda **se siente crecer**. Como el pulso dura menos que el periodo más corto, nunca
 * corta al anterior.
 */
export function siguienteTension(
  estado: Tension,
  mano: Mano,
  nivel: number,
  ahora: number,
): { estado: Tension; pulso: Pulso | null } {
  const r = RECETAS.tension
  if (nivel < r.umbral) return { estado: SIN_TENSION, pulso: null }
  const periodo = entre(r.periodo.floja, r.periodo.tensa, nivel)
  if (estado.ultimo !== null && ahora - estado.ultimo < periodo) return { estado, pulso: null }
  return {
    estado: { ultimo: ahora },
    pulso: { mano, intensidad: entre(r.intensidad.floja, r.intensidad.tensa, nivel), ms: r.ms, retardo: 0 },
  }
}
