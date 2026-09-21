import path from 'node:path'
import { build } from 'esbuild'

const SUPPORT = path.join(process.cwd(), 'e2e/support')
export const XR_EMULATOR_BUNDLE = path.join(SUPPORT, 'xr-emulator.bundle.js')
export const HOST_BUNDLE = path.join(SUPPORT, 'host.bundle.js')

/**
 * Empaqueta antes de la suite lo que se inyecta en el navegador: el emulador de
 * WebXR (IWER, un Quest 3 fingido: Chromium no trae WebXR) y el anfitrión de
 * prueba, que monta `<GlideHockeyScene>` dentro de un Canvas ajeno como hace el
 * salón de xrcade.
 */
export default async function globalSetup() {
  await Promise.all([
    bundle('xr-emulator.src.ts', XR_EMULATOR_BUNDLE),
    bundle('host.src.tsx', HOST_BUNDLE),
  ])
}

function bundle(entry: string, outfile: string) {
  return build({
    entryPoints: [path.join(SUPPORT, entry)],
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
  })
}
