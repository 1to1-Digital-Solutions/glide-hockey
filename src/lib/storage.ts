/**
 * El almacenamiento del navegador, cuando deja tocarlo, y las preferencias que
 * viven en él.
 *
 * En modo privado, o con el almacenamiento vetado por política, leer
 * `window.localStorage` **lanza** en vez de devolver `null`. Lo único que el
 * juego guarda es el récord, que es prescindible, así que aquí ese fallo se
 * traduce a «no hay almacenamiento» y se juega sin marca. En el servidor
 * tampoco lo hay, y eso es lo que mantiene igual el HTML que se prerenderiza y
 * el que se hidrata.
 */
export function gameStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * Una preferencia guardada en el navegador, vista desde React.
 *
 * `subscribe`/`get`/`getServer` son justo los tres argumentos que pide
 * `useSyncExternalStore`: la preferencia no es estado de React sino algo que
 * vive fuera y que el juego consulta, que es lo que evita sincronizarla con
 * efectos. `Args` son los datos que hacen falta para saber de qué clave se
 * habla, y está vacío salvo cuando hay una clave por variante (el récord tiene
 * una por modo).
 */
export interface StoredPreference<T, Args extends unknown[] = []> {
  /**
   * Valor vigente. Se lee del navegador cada vez en lugar de guardar una copia:
   * el almacenamiento es la única fuente de verdad, así que no hay dos
   * versiones que puedan discrepar.
   */
  get(...args: Args): T
  /**
   * Lo que ve el servidor al prerenderizar: no hay navegador, así que el valor
   * de entrada. Sin esto el HTML del servidor y el del cliente diferirían y
   * React avisaría de un error de hidratación.
   */
  getServer(): T
  /** Suscripción para `useSyncExternalStore`, también entre pestañas. */
  subscribe(listener: () => void): () => void
  /** Guarda el valor y avisa a quien lo esté mirando. */
  save(value: T, ...args: Args): void
}

/** Lo único que distingue a una preferencia de otra. */
interface PreferenceSpec<T, Args extends unknown[]> {
  /** Clave en el almacenamiento, o cuál toca cuando hay una por variante. */
  key: string | ((...args: Args) => string)
  /**
   * Interpreta lo leído. Es entrada externa —cualquiera puede editarla desde
   * las herramientas del navegador—, así que solo debe aceptar lo que existe.
   * Lo que devuelva ante `null` es el valor de entrada: el que vale cuando no
   * hay nada guardado, no hay almacenamiento o está bloqueado.
   *
   * Tiene que devolver algo **comparable con `Object.is`** —un número, un
   * texto, un booleano—: como `get` vuelve a parsear en cada lectura y así es
   * como `useSyncExternalStore` compara dos lecturas seguidas, uno que
   * devolviera un objeto nuevo cada vez dejaría a React repintando sin parar.
   */
  parse: (raw: string | null) => T
  /** Qué texto se guarda para un valor. */
  serialize: (value: T) => string
}

/**
 * Monta una preferencia sobre el almacenamiento del navegador.
 *
 * Aquí vive lo que no se ve al copiar una preferencia en otra: **avisar a quien
 * mira después de escribir** —sin eso, un récord batido en el visor deja al
 * menú de escritorio enseñando el anterior— y **escuchar el evento `storage`**,
 * que es como el navegador cuenta que ha sido otra pestaña.
 *
 * El acceso es tolerante a fallos: con el almacenamiento bloqueado se juega con
 * el valor de entrada, que es una función de menos y no una razón para
 * interrumpir la partida con un aviso.
 */
export function createStoredPreference<T, Args extends unknown[] = []>({
  key,
  parse,
  serialize,
}: PreferenceSpec<T, Args>): StoredPreference<T, Args> {
  const keyFor: (...args: Args) => string =
    typeof key === 'string' ? () => key : key
  const listeners = new Set<() => void>()

  return {
    get(...args) {
      const storage = gameStorage()
      if (!storage) return parse(null)
      try {
        return parse(storage.getItem(keyFor(...args)))
      } catch {
        return parse(null)
      }
    },

    getServer: () => parse(null),

    subscribe(listener) {
      listeners.add(listener)
      window.addEventListener('storage', listener)
      return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', listener)
      }
    },

    save(value, ...args) {
      try {
        gameStorage()?.setItem(keyFor(...args), serialize(value))
      } catch {
        // Cuota agotada o escritura prohibida: el récord no llega a guardarse.
        // Se avisa igual, para que quien mira vuelva a leer y enseñe lo que hay
        // de verdad.
      }
      for (const listener of listeners) listener()
    },
  }
}
