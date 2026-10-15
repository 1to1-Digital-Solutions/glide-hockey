/**
 * The browser's storage, when it lets us touch it, and the preferences that
 * live in it.
 *
 * In private mode, or with storage vetoed by policy, reading
 * `window.localStorage` **throws** instead of returning `null`. Everything the
 * game saves —the record and what is chosen in the menu— is dispensable, so
 * here that failure is translated to "there is no storage" and each thing
 * decides which value it keeps. On the server there is none either, and that is
 * what keeps the prerendered HTML and the hydrated one the same.
 */
export function gameStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * A preference saved in the browser, seen from React.
 *
 * `subscribe`/`get`/`getServer` are exactly the three arguments that
 * `useSyncExternalStore` asks for: the preference is not React state but
 * something that lives outside and that the game consults, which is what avoids
 * synchronising it with effects. `Args` are the data needed to know which key
 * is meant, and it is empty except when there is one key per variant (the
 * record has one per mode).
 */
export interface StoredPreference<T, Args extends unknown[] = []> {
  /**
   * Current value. It is read from the browser every time instead of keeping a
   * copy: the storage is the only source of truth, so there are no two
   * versions that could disagree.
   */
  get(...args: Args): T
  /**
   * What the server sees when prerendering: there is no browser, so the
   * default value. Without this the server's HTML and the client's would differ
   * and React would report a hydration error.
   */
  getServer(): T
  /** Subscription for `useSyncExternalStore`, across tabs too. */
  subscribe(listener: () => void): () => void
  /** Saves the value and notifies whoever is watching it. */
  save(value: T, ...args: Args): void
}

/** The only thing that tells one preference from another. */
interface PreferenceSpec<T, Args extends unknown[]> {
  /** Key in the storage, or which one applies when there is one per variant. */
  key: string | ((...args: Args) => string)
  /**
   * Interprets what is read. It is external input —anyone can edit it from
   * the browser's tools—, so it must only accept what exists.
   * Whatever it returns for `null` is the default value: the one that holds
   * when nothing is saved, there is no storage or it is blocked.
   *
   * It has to return something **comparable with `Object.is`** —a number, a
   * string, a boolean—: since `get` parses again on every read and that is
   * how `useSyncExternalStore` compares two consecutive reads, one that
   * returned a new object every time would leave React repainting endlessly.
   */
  parse: (raw: string | null) => T
  /** Which text is saved for a value. */
  serialize: (value: T) => string
}

/**
 * Builds a preference on top of the browser's storage.
 *
 * Here lives what is not seen when copying one preference into another:
 * **notifying whoever is watching after writing** —without that, a setting
 * changed in the headset's menu leaves the desktop one showing the previous
 * one, a bug that is only seen with the goggles on— and **listening to the
 * `storage` event**, which is how the browser tells that it was another tab.
 * Each preference only provides its key and how it is translated.
 *
 * Access is fault-tolerant: with storage blocked the game is played with
 * the default value, which is one feature less and not a reason to
 * interrupt the run with a notice.
 */
export function createStoredPreference<T, Args extends unknown[] = []>({
  key,
  parse,
  serialize,
}: PreferenceSpec<T, Args>): StoredPreference<T, Args> {
  const keyFor: (...args: Args) => string =
    typeof key === 'string' ? () => key : key
  const listeners = new Set<() => void>()
  /**
   * The last thing that was meant to be saved and the storage did not accept,
   * by key. Without this, with storage blocked —private window, exhausted
   * quota, browser policy— pressing «izquierda» or the mute did nothing: the
   * write failed silently and the re-read returned what was there before. While
   * the storage responds it keeps ruling, so that two tabs do not
   * disagree; this only covers the choice it could not take in, and it is
   * emptied as soon as a write goes in again.
   */
  const pendingByKey = new Map<string, string>()

  return {
    get(...args) {
      const storageKey = keyFor(...args)
      const pending = pendingByKey.get(storageKey)
      if (pending !== undefined) return parse(pending)
      const storage = gameStorage()
      // With something pending in memory it has already been returned above:
      // this only acts in the prerender, where nothing is pending.
      /* v8 ignore next */
      if (!storage) return parse(null)
      try {
        return parse(storage.getItem(storageKey))
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
      const storageKey = keyFor(...args)
      const serialized = serialize(value)
      try {
        const storage = gameStorage()
        // In the prerender nothing is saved: there is no menu to press.
        /* v8 ignore next */
        if (storage == null) throw new Error('no storage')
        storage.setItem(storageKey, serialized)
        pendingByKey.delete(storageKey)
      } catch {
        // Exhausted quota or forbidden write: that choice never gets
        // saved, but it holds at least for this visit. Listeners are notified
        // all the same, so that whoever is watching reads again and shows what
        // is really there.
        pendingByKey.set(storageKey, serialized)
      }
      for (const listener of listeners) listener()
    },
  }
}
