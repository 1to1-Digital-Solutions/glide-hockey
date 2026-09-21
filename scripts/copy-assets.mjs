#!/usr/bin/env node
/**
 * Copia los ficheros estáticos del juego a donde los sirva quien lo monta.
 *
 * Los perfiles de mando de WebXR no viajan en el código: son ficheros que el
 * navegador pide por HTTP al entrar en el visor. Una aplicación que monte Air
 * Hockey tiene que servirlos desde su propio sitio y decirle dónde con la
 * opción `assetsBase` (ver `docs/montar-el-juego.md`).
 *
 * Uso, desde el proyecto que lo consume:
 *
 *   npx glide-hockey-assets public/juegos/glide-hockey
 *
 * Es idempotente: se ejecuta otra vez tras subir la versión del juego y deja el
 * destino con los ficheros de la versión nueva.
 */
import { existsSync } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(packageRoot, 'public')

/**
 * Lo que necesita el juego. `audio/` es la música de fondo, y
 * `webxr-profiles/` es el mapa de botones de cada
 * mando: sin él, el anfitrión que apunte ahí su store se queda sin mandos en el
 * visor (ver `scripts/sync-xr-profiles.mjs`). `CREDITS.md` va con ellos porque
 * su licencia obliga a acompañar cada copia del aviso.
 */
const ASSETS = ['audio', 'webxr-profiles', 'CREDITS.md']

async function main() {
  const target = process.argv[2]
  if (!target) {
    console.error('Uso: glide-hockey-assets <directorio de destino>')
    process.exit(1)
  }

  // Antes de tocar el destino: que falte uno solo se nota en el visor y tarde
  // —sin mandos y sin explicación—, así que aquí se para en vez de dejar la
  // copia a medias. Es la red que avisa si alguna vez se renombra un directorio
  // de `public/` y esta lista se queda atrás.
  const missing = ASSETS.filter((asset) => !existsSync(join(source, asset)))
  if (missing.length > 0) {
    console.error(
      `Faltan en el paquete de Glide Hockey: ${missing.join(', ')}. ` +
        'Reinstala la versión del juego; si persiste, es un fallo suyo.',
    )
    process.exit(1)
  }

  const destination = resolve(process.cwd(), target)
  await mkdir(destination, { recursive: true })

  for (const asset of ASSETS) {
    const to = join(destination, asset)
    // Se rehace cada uno desde cero para que al subir de versión no queden
    // ficheros huérfanos de la anterior. Se borra solo lo que se va a copiar:
    // el destino puede ser un directorio compartido con otras cosas.
    await rm(to, { recursive: true, force: true })
    await cp(join(source, asset), to, { recursive: true })
  }

  console.log(`Ficheros de Glide Hockey copiados a ${destination}`)
}

await main()
