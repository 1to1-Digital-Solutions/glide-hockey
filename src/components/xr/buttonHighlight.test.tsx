import { act, cleanup, render } from '@testing-library/react'
import { Matrix4, PerspectiveCamera, Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ButtonHighlight,
  HIGHLIGHT_Z,
  PANEL_ORDER,
  useButtonFeedback,
  type ButtonState,
} from './buttonHighlight'

/**
 * Que apuntar un botón no lo borre.
 *
 * Es el fallo que se reportó con el visor puesto —«al poner el cursor encima de un botón es
 * como que el botón desaparece, mostrando lo que hay por debajo»— y no se ve desde una
 * pantalla porque **depende de hacia dónde se mira**: el realce se pinta 5 mm por delante de
 * la placa, y three ordena lo transparente por la profundidad del **origen** de cada objeto.
 * Mirando al centro del panel el realce sale más cerca y se pinta el último, que es lo
 * correcto; mirando al botón —que es lo que se hace para apuntarlo— el botón queda más lejos
 * por el eje de la vista que el centro de la placa, el orden se invierte, y un realce que
 * escriba profundidad borra la placa entera dentro de su rectángulo.
 *
 * Aquí se comprueban las dos mitades: que el orden **se da la vuelta** de verdad (con las
 * cuentas de three, sin navegador) y que el realce está hecho de forma que eso dé igual.
 */

/**
 * React DOM no conoce `<mesh>` ni `args`: son etiquetas de three y aquí se montan sin Canvas
 * a propósito, que lo que se mira es el árbol que React produce. Se callan esos avisos, uno a
 * uno; cualquier otro error sigue saliendo por consola.
 */
const AVISOS_DE_THREE = [
  'is unrecognized in this browser',
  'incorrect casing',
  'non-boolean attribute',
  'does not recognize the',
  'Invalid value for prop',
  'React does not recognize',
]

afterEach(cleanup)

beforeEach(() => {
  const original = console.error
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const texto = String(args[0])
    if (AVISOS_DE_THREE.some((aviso) => texto.includes(aviso))) return
    original(...args)
  })
})

const BOTON = { width: 0.16, height: 0.09 }

/**
 * Lo que de verdad le llega a three, que no es lo que se ve montándolo.
 *
 * React DOM no pinta los booleanos de una etiqueta que no conoce: montado, el material sale
 * con `color` y `opacity` y **sin rastro de `transparent` ni de `depthWrite`**. Así que un
 * test que mirara el DOM daría por bueno exactamente el fallo que se está arreglando. Se mira
 * el árbol que devuelve el componente, que es el contrato con `@react-three/fiber`.
 */
function piezasDelRealce(state: ButtonState) {
  const malla = ButtonHighlight({ ...BOTON, state, glow: '#f4f1ea', ink: '#151a22' })
  if (malla == null) return null

  const props = malla.props as { renderOrder: number; children: unknown }
  const hijos = (Array.isArray(props.children) ? props.children : [props.children]) as {
    type: string
    props: Record<string, unknown>
  }[]
  const dentro = (tipo: string) => hijos.find((hijo) => hijo?.type === tipo)?.props ?? {}

  return {
    renderOrder: props.renderOrder,
    geometria: dentro('planeGeometry') as { args: [number, number] },
    material: dentro('meshBasicMaterial') as {
      color: string
      transparent: boolean
      depthWrite: boolean
    },
  }
}

describe('el realce de un botón del panel', () => {
  it('sin apuntar no pinta nada: un panel quieto no tiene por qué pagar un plano más', () => {
    expect(piezasDelRealce('idle')).toBeNull()
    expect(
      render(<ButtonHighlight {...BOTON} state="idle" glow="#fff" ink="#000" />).container
        .querySelector('mesh'),
    ).toBeNull()
  })

  it.each<ButtonState>(['pointed', 'pressed'])(
    'apuntado o pulsado (%s) se pinta, que es lo contrario de desaparecer',
    (state) => {
      expect(
        render(<ButtonHighlight {...BOTON} state={state} glow="#fff" ink="#000" />).container
          .querySelector('mesh'),
      ).not.toBeNull()
    },
  )

  it.each<ButtonState>(['pointed', 'pressed'])(
    'y su material NO escribe profundidad (%s): es lo que borraba la placa de detrás',
    (state) => {
      const material = piezasDelRealce(state)!.material
      expect(material.transparent).toBe(true)
      // `transparent` no implica `depthWrite: false` en three, y esa es toda la avería.
      expect(material.depthWrite).toBe(false)
    },
  )

  it.each<ButtonState>(['pointed', 'pressed'])(
    'y se pinta después de la placa pase lo que pase (%s), no cuando la ordenación quiera',
    (state) => {
      const orden = piezasDelRealce(state)!.renderOrder
      expect(orden).toBe(PANEL_ORDER.highlight)
      // Por delante de todas las capas del panel: si empatara con alguna, volvería a decidir
      // la ordenación por profundidad, que es justo la que se da la vuelta.
      expect(orden).toBeGreaterThan(
        Math.max(PANEL_ORDER.back, PANEL_ORDER.behind, PANEL_ORDER.face),
      )
    },
  )

  it('apuntado desborda el botón y pulsado se mete dentro: se hunde en vez de irse', () => {
    expect(piezasDelRealce('pointed')!.geometria.args[0]).toBeGreaterThan(BOTON.width)
    expect(piezasDelRealce('pressed')!.geometria.args[0]).toBeLessThan(BOTON.width)
  })

  it('y cambia de color al pulsarlo, que es lo que se pidió: no solo de tamaño', () => {
    expect(piezasDelRealce('pointed')!.material.color).toBe('#f4f1ea')
    expect(piezasDelRealce('pressed')!.material.color).toBe('#151a22')
  })
})

/**
 * La inversión del orden, con las cuentas de three y sin navegador.
 *
 * `WebGLRenderer` guarda para cada objeto la `z` de su origen pasada por la matriz de
 * proyección, y pinta lo transparente de mayor a menor: lo más lejos primero. Eso es lo que se
 * repite aquí — y lo que enseña que **no** basta con adelantar el realce unos milímetros.
 */
describe('cómo ordena three la placa y el realce', () => {
  /** El panel, de frente y a un brazo, con un botón cerca del borde de abajo. */
  const DISTANCIA = 0.8
  const BOTON_Y = -0.55

  function zDeOrdenacion(punto: Vector3, mirandoA: Vector3): number {
    const camera = new PerspectiveCamera(60, 1, 0.05, 20)
    camera.position.set(0, 0, DISTANCIA)
    camera.lookAt(mirandoA)
    camera.updateMatrixWorld(true)
    camera.updateProjectionMatrix()
    const proyeccion = new Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    )
    return punto.clone().applyMatrix4(proyeccion).z
  }

  const placa = new Vector3(0, 0, 0)
  const realce = new Vector3(0, BOTON_Y, HIGHLIGHT_Z)

  it('mirando al centro del panel el realce sale delante, y por eso el fallo parecía caprichoso', () => {
    const alCentro = new Vector3(0, 0, 0)
    expect(zDeOrdenacion(realce, alCentro)).toBeLessThan(zDeOrdenacion(placa, alCentro))
  })

  it('pero mirando al botón —que es lo que se hace al apuntarlo— se pinta ANTES que la placa', () => {
    const alBoton = new Vector3(0, BOTON_Y, 0)
    // Más lejos por el eje de la vista, aunque esté 5 mm por delante en el panel: three lo
    // pinta primero, y desde ahí todo lo que escriba profundidad borra la placa.
    expect(zDeOrdenacion(realce, alBoton)).toBeGreaterThan(zDeOrdenacion(placa, alBoton))
  })
})

describe('qué se le escucha a un botón para saber cómo está', () => {
  function Panel() {
    const { stateOf, handlersFor } = useButtonFeedback()
    return (
      <div>
        <button data-testid="uno" {...handlersFor('uno')} />
        <span data-testid="estado">{stateOf('uno')}</span>
      </div>
    )
  }

  const estado = (container: HTMLElement) =>
    container.querySelector('[data-testid="estado"]')?.textContent

  function eventos(container: HTMLElement) {
    const boton = container.querySelector('[data-testid="uno"]') as HTMLElement
    return {
      entrar: () => act(() => boton.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))),
      apretar: () => act(() => boton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))),
      soltar: () => act(() => boton.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))),
      salir: () => act(() => boton.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }))),
    }
  }

  it('sin nada encima está suelto', () => {
    const { container } = render(<Panel />)
    expect(estado(container)).toBe('idle')
  })

  it('apuntándolo se enciende, y apretando se hunde', () => {
    const { container } = render(<Panel />)
    const { entrar, apretar } = eventos(container)
    entrar()
    expect(estado(container)).toBe('pointed')
    apretar()
    expect(estado(container)).toBe('pressed')
  })

  it('al soltar vuelve a estar solo apuntado: el botón sigue ahí', () => {
    const { container } = render(<Panel />)
    const { entrar, apretar, soltar } = eventos(container)
    entrar()
    apretar()
    soltar()
    expect(estado(container)).toBe('pointed')
  })

  it('y salirse limpia los dos: apuntando a pulso, el rayo se va del botón sin soltarlo', () => {
    const { container } = render(<Panel />)
    const { entrar, apretar, salir } = eventos(container)
    entrar()
    apretar()
    salir()
    // Sin esto el botón se quedaría hundido para siempre, que es peor que no hundirse.
    expect(estado(container)).toBe('idle')
  })
})
