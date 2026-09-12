import { describe, expect, it } from 'vitest'
import {
  SIN_HITOS,
  TUTORIAL_BUTTONS,
  TUTORIAL_SEEN_KEY,
  TUTORIAL_SEEN_VALUE,
  TUTORIAL_STEPS,
  apuntarHito,
  markTutorialSeen,
  tutorialSeen,
  tutorialStep,
  type TutorialHitos,
} from './tutorial'

/**
 * El guion del tutorial.
 *
 * Lo que se vigila aquí es que **se avance haciendo**. El de antes iba por reloj: se podía
 * mirar sin hacer nada y al acabar el tiempo se daba por aprendido. Reportado con el visor
 * puesto: el paso de lanzar no debería pasar hasta que se consiga lo último.
 *
 * Y que el paso se **calcule** de lo que ha pasado en la partida en vez de guardarse aparte:
 * un tutorial que lleva su propia cuenta acaba discrepando del juego.
 */

/** Los hitos con estos conseguidos. */
function hechos(...cuales: readonly (keyof TutorialHitos)[]): TutorialHitos {
  return cuales.reduce(apuntarHito, SIN_HITOS)
}

describe('qué paso toca', () => {
  it('sin hacer nada, el primero', () => {
    expect(tutorialStep(SIN_HITOS, 0)).toBe(TUTORIAL_STEPS[0])
  })

  it('haciendo cada cosa se recorren todos y se acaba', () => {
    let hitos = SIN_HITOS
    const recorridos = [tutorialStep(hitos, 0)]
    for (const paso of TUTORIAL_STEPS) {
      hitos = apuntarHito(hitos, paso)
      recorridos.push(tutorialStep(hitos, 0))
    }
    expect(recorridos).toEqual([...TUTORIAL_STEPS, null])
  })

  it('esperar no adelanta nada: el tutorial no lleva reloj', () => {
    // El control de lo que se cambió: sin hitos, el paso es el mismo para siempre.
    expect(tutorialStep(SIN_HITOS, 0)).toBe(tutorialStep(SIN_HITOS, 0))
  })

  it('conseguir algo de más adelante no salta lo de antes', () => {
    // Conseguir lo último sin haber pasado por coger deja el paso de coger donde estaba.
    expect(tutorialStep(hechos('goal'), 0)).toBe('grab')
  })

  it('un hito no se deshace', () => {
    const hitos = hechos(TUTORIAL_STEPS[0])
    expect(apuntarHito(hitos, TUTORIAL_STEPS[0])).toBe(hitos)
    expect(tutorialStep(hitos, 0)).toBe(TUTORIAL_STEPS[1])
  })
})

describe('las dos salidas', () => {
  it('siguiente pasa al siguiente aunque no se haya conseguido', () => {
    // Un paso que no se consigue dejaría a alguien encerrado en él.
    expect(tutorialStep(SIN_HITOS, 1)).toBe(TUTORIAL_STEPS[1])
  })

  it('saltarlos todos lo termina', () => {
    expect(tutorialStep(SIN_HITOS, TUTORIAL_STEPS.length)).toBeNull()
  })

  it('saltar de más no rompe nada', () => {
    expect(tutorialStep(SIN_HITOS, 99)).toBeNull()
    expect(tutorialStep(SIN_HITOS, -3)).toBe(TUTORIAL_STEPS[0])
  })
})

describe('qué botón enseña cada paso', () => {
  it('el de agarrar enseña el botón de agarre', () => {
    expect(TUTORIAL_BUTTONS.grab).toBe('agarre')
  })

  it('todos los pasos dicen algo, aunque sea que no hay botón', () => {
    // Un paso sin entrada aquí saldría dibujando el mando sin resaltar nada.
    for (const paso of TUTORIAL_STEPS) expect(paso in TUTORIAL_BUTTONS).toBe(true)
  })
})

describe('si ya se ha visto', () => {
  const almacen = (valor: string | null) => ({ getItem: () => valor })

  it('solo el valor exacto cuenta como visto', () => {
    expect(tutorialSeen(almacen(TUTORIAL_SEEN_VALUE))).toBe(true)
    expect(tutorialSeen(almacen('2'))).toBe(false)
    expect(tutorialSeen(almacen(null))).toBe(false)
  })

  it('sin almacenamiento se vuelve a enseñar: ver de más es mejor que no entender', () => {
    expect(tutorialSeen(null)).toBe(false)
    expect(
      tutorialSeen({
        getItem: () => {
          throw new Error('capado')
        },
      }),
    ).toBe(false)
  })

  it('la versión sube cuando la lección cambia, y esta cambió entera', () => {
    expect(Number(TUTORIAL_SEEN_VALUE)).toBeGreaterThan(2)
  })

  it('se deja constancia con la clave del juego', () => {
    const escrito: Record<string, string> = {}
    const guardado = markTutorialSeen({
      getItem: () => null,
      setItem: (clave: string, valor: string) => {
        escrito[clave] = valor
      },
    } as unknown as Storage)
    expect(guardado).toBe(true)
    expect(escrito[TUTORIAL_SEEN_KEY]).toBe(TUTORIAL_SEEN_VALUE)
  })

  it('y si el navegador no guarda, se dice que no se guardó', () => {
    expect(markTutorialSeen(null)).toBe(false)
    expect(
      markTutorialSeen({
        setItem: () => {
          throw new Error('capado')
        },
      } as unknown as Storage),
    ).toBe(false)
  })
})
