'use client'

import { GlideHockey } from '@/game'

/**
 * La web del juego: un envoltorio que le da la pantalla entera y poco más. El
 * juego vive en `src/game` y se monta igual aquí que dentro de otra aplicación
 * (ver `docs/montar-el-juego.md`), así que esta página es también la forma de
 * desarrollarlo y de probarlo con el visor.
 */
export default function Home() {
  // Un `div` y no un `main`: el propio juego ya marca su menú como `main`, y
  // anidar dos landmarks deja al lector de pantalla con dos veces el mismo.
  return (
    <div className="h-dvh w-full">
      <GlideHockey />
    </div>
  )
}
