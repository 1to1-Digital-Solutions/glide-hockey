'use client'

import { type ReactNode } from 'react'
import { GameContext, useGameStoreValue } from '../lib/gameStore'

export function GameProvider({ children }: { children: ReactNode }) {
  const store = useGameStoreValue()
  return <GameContext.Provider value={store}>{children}</GameContext.Provider>
}
