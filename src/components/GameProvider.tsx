'use client'

import { type ReactNode } from 'react'
import { GameContext, useGameStoreValue, type HallOptions } from '../lib/gameStore'

export function GameProvider({ children, challenge, onFinish, goal }: { children: ReactNode } & HallOptions) {
  const store = useGameStoreValue({ challenge, onFinish, goal })
  return <GameContext.Provider value={store}>{children}</GameContext.Provider>
}
