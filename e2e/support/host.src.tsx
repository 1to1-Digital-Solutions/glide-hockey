import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { XR, XROrigin, createXRStore } from '@react-three/xr'
import { GlideHockeyScene, type ResultadoConHazanas as Resultado } from '../../src/game'
import { XRControllerGrip } from '../../src/components/xr/XRControllerGrip'

/**
 * El anfitrión de prueba: monta `<GlideHockeyScene>` dentro de un Canvas y una
 * sesión que no son suyos, como hace el salón de xrcade. Es el único sitio de la
 * suite que ejercita el contrato de montaje (`docs/montar-el-juego.md`): la web
 * del juego monta `<GlideHockey>`, que trae su propio Canvas.
 */
const mount = document.getElementById('juego')
if (mount == null) {
  throw new Error('El anfitrión de prueba no tiene dónde montar el juego')
}
const assetsBase = mount.dataset.assetsBase ?? '/'

/**
 * Si la escena espera a que la manden entrar, **como en el salón**.
 *
 * Por defecto se monta con la página, que es lo cómodo para el resto de la suite. Pero el
 * salón no hace eso: quien elige cabina ya lleva el visor puesto, así que la escena se monta
 * **dentro de una sesión que ya está abierta** y sin haber pintado un solo fotograma en
 * pantalla. Es la diferencia que importa para los shaders —lo que se pinta en la página se
 * compila ahí, fuera de la sesión, y así ningún fallo de precalentado se nota— y la única
 * forma de medirla desde aquí.
 */
const aLaCarta = mount.dataset.cabina === 'a-la-carta'

/**
 * La semilla del reto, si el salón lo está pasando (`data-reto`). Lo que la escena cuenta al
 * acabar cada partida se deja en `window.__terminadas`, que es lo que el salón haría suyo.
 */
const semillaDelReto = mount.dataset.reto
const reto = semillaDelReto === undefined ? undefined : { semilla: Number(semillaDelReto) }
window.__terminadas = []
const apuntarTerminada = (resultado: Resultado) => {
  window.__terminadas.push(resultado)
}

const store = createXRStore({
  // Lo que el contrato pide cablear al anfitrión: los perfiles de mando bajo su
  // propio prefijo.
  baseAssetPath: new URL(`${assetsBase}webxr-profiles/`, window.location.origin).href,
  // El mando del salón (`xrcade/src/components/salon/salonStore.ts`): sin modelo, pero con
  // su pose en el puño. Con `{ model: false }` no hay `state.object` y el mazo no se puede
  // coger, así que el saque del reto se quedaría esperándolo para siempre.
  controller: XRControllerGrip,
  hand: { model: false },
})

declare global {
  interface Window {
    __terminadas: Resultado[]
    __glideHockeyHost: {
      enterVR: () => Promise<void>
      enterAR: () => Promise<void>
      /** Monta la escena, como al elegir cabina. Solo hace algo con `data-cabina`. */
      entrarEnLaCabina: () => void
    }
  }
}

let entrar = () => {}

window.__glideHockeyHost = {
  async enterVR() {
    await store.enterVR()
  },
  // Como entra el salón: en realidad aumentada siempre que el visor la tiene, y el decorado lo
  // decide el escenario del arcade, no el tipo de sesión.
  async enterAR() {
    await store.enterAR()
  },
  entrarEnLaCabina: () => entrar(),
}

/** La cabina: la escena, montada cuando toca. */
function Cabina() {
  const [dentro, setDentro] = useState(!aLaCarta)
  useEffect(() => {
    entrar = () => setDentro(true)
    return () => {
      entrar = () => {}
    }
  }, [])

  if (!dentro) return null
  // Volver es cosa del anfitrión, y aquí no hay a dónde.
  return <GlideHockeyScene assetsBase={assetsBase} onExit={() => {}} reto={reto} onTerminar={apuntarTerminada} />
}

function Host() {
  return (
    <Canvas shadows="percentage" camera={{ position: [0, 1.6, 0.9], fov: 62, near: 0.05, far: 60 }}>
      <XR store={store}>
        <XROrigin position={[0, 0, 0]} />
        <Cabina />
      </XR>
    </Canvas>
  )
}

createRoot(mount).render(<Host />)
