'use client'

import { type ReactNode } from 'react'
import { GameContext, useGameStoreValue, type OpcionesDelSalon } from '../lib/gameStore'

export function GameProvider({ children, reto, onFinish, objetivo }: { children: ReactNode } & OpcionesDelSalon) {
  const store = useGameStoreValue({ reto, onFinish, objetivo })
  return <GameContext.Provider value={store}>{children}</GameContext.Provider>
}
