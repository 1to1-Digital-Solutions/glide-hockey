'use client'

import { type ReactNode } from 'react'
import { GameContext, useGameStoreValue, type HallOptions } from '../lib/gameStore'

export function GameProvider({ children, challenge: challenge, onFinish, goal: goal }: { children: ReactNode } & HallOptions) {
  const store = useGameStoreValue({ challenge: challenge, onFinish, goal: goal })
  return <GameContext.Provider value={store}>{children}</GameContext.Provider>
}
