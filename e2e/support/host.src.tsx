import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { XR, XROrigin, createXRStore } from '@react-three/xr'
import { GlideHockeyScene } from '../../src/game'

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

const store = createXRStore({
  // Lo que el contrato pide cablear al anfitrión: los perfiles de mando bajo su
  // propio prefijo.
  baseAssetPath: new URL(`${assetsBase}webxr-profiles/`, window.location.origin).href,
  controller: { model: false },
  hand: { model: false },
})

declare global {
  interface Window {
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
  return <GlideHockeyScene assetsBase={assetsBase} onExit={() => {}} />
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
