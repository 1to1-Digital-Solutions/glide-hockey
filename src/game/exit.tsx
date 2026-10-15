'use client'

import { createContext, useContext, type ReactNode } from 'react'

import { endXrSession } from '../components/xr/xrStore'

/**
 * What the exit button does, which depends on who has mounted the game.
 *
 * **Mounted in the xrcade hall**, exiting is going back to the arc of cabinets: the hub passes its
 * own function (`onExit`) and unmounts the scene without closing the session, which is what allows
 * changing game without taking the headset off.
 *
 * **On the game's own web** there is nowhere to go back to, so exiting is the only thing that makes
 * sense there: closing the immersive session and returning whoever plays to the page. It is the
 * default value and not an error: an exit button that did nothing would leave someone locked
 * inside the session with the headset on.
 *
 * It goes in a context and not as a prop of each panel because the one who calls it is the menu,
 * which is three levels below where the game is mounted, and passing it from hand to hand would
 * force every piece of scene it goes through to know about it.
 */
const ExitContext = createContext<(() => void) | null>(null)

export function ExitProvider({ onExit, children }: { onExit?: () => void; children: ReactNode }) {
  return <ExitContext.Provider value={onExit ?? null}>{children}</ExitContext.Provider>
}

export function useExit(): () => void {
  return useContext(ExitContext) ?? endXrSession
}
