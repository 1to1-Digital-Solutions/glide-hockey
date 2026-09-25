'use client'

import { type ReactNode } from 'react'
import { GameContext, useGameStoreValue, type OpcionesDelSalon } from '../lib/gameStore'

export function GameProvider({ children, reto, onTerminar }: { children: ReactNode } & OpcionesDelSalon) {
  const store = useGameStoreValue({ reto, onTerminar })
  return <GameContext.Provider value={store}>{children}</GameContext.Provider>
}
