import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { XR, XROrigin, createXRStore } from '@react-three/xr'
import { AirHockeyScene } from '../../src/game'

/**
 * El anfitrión de prueba: monta `<AirHockeyScene>` dentro de un Canvas y una
 * sesión que no son suyos, como hace el salón de xrcade. Es el único sitio de la
 * suite que ejercita el contrato de montaje (`docs/montar-el-juego.md`): la web
 * del juego monta `<AirHockey>`, que trae su propio Canvas.
 */
const mount = document.getElementById('juego')
if (mount == null) {
  throw new Error('El anfitrión de prueba no tiene dónde montar el juego')
}
const assetsBase = mount.dataset.assetsBase ?? '/'

const store = createXRStore({
  // Lo que el contrato pide cablear al anfitrión: los perfiles de mando bajo su
  // propio prefijo.
  baseAssetPath: new URL(`${assetsBase}webxr-profiles/`, window.location.origin).href,
  controller: { model: false },
  hand: { model: false },
})

declare global {
  interface Window {
    __airHockeyHost: { enterVR: () => Promise<void> }
  }
}

window.__airHockeyHost = {
  async enterVR() {
    await store.enterVR()
  },
}

function Host() {
  return (
    <Canvas shadows="percentage" camera={{ position: [0, 1.6, 0.9], fov: 62, near: 0.05, far: 60 }}>
      <XR store={store}>
        <XROrigin position={[0, 0, 0]} />
        {/* Volver es cosa del anfitrión, y aquí no hay a dónde. */}
        <AirHockeyScene assetsBase={assetsBase} onExit={() => {}} />
      </XR>
    </Canvas>
  )
}

createRoot(mount).render(<Host />)
