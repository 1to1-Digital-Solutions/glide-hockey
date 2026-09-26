/**
 * Los ajustes que el juego lee en Godot: el idioma y los volúmenes del salón, y el confort del golpe
 * recibido, que es del juego.
 *
 * **Idioma y volúmenes no se eligen aquí, se leen**, como en la web (`lib/ajustes.ts`): el salón
 * los escribe y el juego los lee del mismo guardado (`save/ajustes.json`, por las claves de
 * siempre gracias al kit). El idioma es la clave `xrcade:lang` —en la web viaja en una cookie para
 * que el servidor pinte ya traducido (`ajustesCliente.ts`, de React); en el motor no hay servidor—
 * y los volúmenes, `xrcade:volume:sfx` y `xrcade:volume:ambience`, leídos **a cada sonido**: un
 * cambio del hub vale para el siguiente golpe sin reiniciar nada.
 *
 * **El confort sí se elige aquí**, en la fila de arriba del menú, como en el menú del visor de la
 * web: es con el visor puesto cuando se sabe si marea. Se guarda con la misma clave y el mismo
 * formato que la web (`lib/confort.ts`, que no entra en el motor porque es un hook de React).
 */
import type { AudioLevels } from '@kit/sfx-core'

import { DEFAULT_LANG, parseLang, readVolumes, volumeFactor, type Lang } from '@/lib/ajustes'
import { guardarConfort, leerConfort, type Confort } from '@/lib/golpeRecibido'
import { createStoredPreference, gameStorage } from '@/lib/storage'

/** La clave del idioma en el guardado: la del salón (`ajustes.json`, campo `lang`). */
export const CLAVE_DEL_IDIOMA = 'xrcade:lang'

/** La clave del confort del golpe recibido: la de la web (`CONFORT_KEY` de `lib/confort.ts`). */
export const CLAVE_DEL_CONFORT = 'glide-hockey:confort'

const idiomaGuardado = createStoredPreference<Lang>({
  key: CLAVE_DEL_IDIOMA,
  parse: parseLang,
  serialize: String,
})

/** El idioma para esta sesión. `forzado` es el de la línea de órdenes (`-- --lang=es`). */
export function idioma(forzado: string | null = null): Lang {
  if (forzado != null) return parseLang(forzado)
  try {
    return idiomaGuardado.get()
  } catch {
    return DEFAULT_LANG
  }
}

/** Avisa cuando alguien cambia el idioma guardado; devuelve cómo dejar de escuchar. */
export function alCambiarElIdioma(oyente: () => void): () => void {
  return idiomaGuardado.subscribe(oyente)
}

/** Los niveles de sonido de ahora, en la escala de `runtime/sfx.ts`: apagar es bajar a cero. */
export function niveles(): AudioLevels {
  const volumenes = readVolumes(gameStorage())
  return { sfx: volumeFactor(volumenes.sfx), ambience: volumeFactor(volumenes.ambience), muted: false }
}

/** Cuánto se nota un gol en contra: apagado, suave o normal. */
export function confort(): Confort {
  return leerConfort(gameStorage(), CLAVE_DEL_CONFORT)
}

export function elegirConfort(valor: Confort): void {
  guardarConfort(gameStorage(), CLAVE_DEL_CONFORT, valor)
}
