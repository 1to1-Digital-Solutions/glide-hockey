/**
 * El confort del golpe recibido: el único ajuste de la interfaz que es de Glide Hockey. El idioma y
 * los volúmenes del salón los lee el kit (`@kit/runtime/ajustes`).
 *
 * **El confort sí se elige aquí**, en la fila de arriba del menú, como en el menú del visor de la
 * web: es con el visor puesto cuando se sabe si marea. Se guarda con la misma clave y el mismo
 * formato que la web (`lib/confort.ts`, que no entra en el motor porque es un hook de React).
 */
import { guardarConfort, leerConfort, type Confort } from '@/lib/golpeRecibido'
import { gameStorage } from '@/lib/storage'

/** La clave del confort del golpe recibido: la de la web (`CONFORT_KEY` de `lib/confort.ts`). */
export const CLAVE_DEL_CONFORT = 'glide-hockey:confort'

/** Cuánto se nota un gol en contra: apagado, suave o normal. */
export function confort(): Confort {
  return leerConfort(gameStorage(), CLAVE_DEL_CONFORT)
}

export function elegirConfort(valor: Confort): void {
  guardarConfort(gameStorage(), CLAVE_DEL_CONFORT, valor)
}
