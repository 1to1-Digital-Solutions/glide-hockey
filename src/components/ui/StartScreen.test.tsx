import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider } from '../GameProvider'
import { GAME_MODE_LABELS } from '../../lib/gameMode'
import { StartScreen } from './StartScreen'

// Sin visor no hay entrada al visor: lo que se prueba es qué pregunta el menú.
vi.mock('../xr/useImmersiveSupport', () => ({ useImmersiveSupport: () => null }))
vi.mock('../xr/xrStore', () => ({ getXrStore: () => null, endXrSession: () => undefined }))

/**
 * El menú de la web empieza por el modo, y **solo la práctica pregunta**: en niveles y en reto
 * la escalera pone el nivel de la máquina y los goles, así que la partida ya está hecha y se le
 * da a Jugar.
 */

afterEach(() => {
  cleanup()
  localStorage.clear()
})

async function abrir() {
  await act(async () => {
    render(
      <GameProvider>
        <StartScreen />
      </GameProvider>,
    )
  })
}

/** Los rótulos de las filas, en el orden en que se ven. */
function filas(): string[] {
  return [...document.querySelectorAll('fieldset > span')].map((rotulo) => rotulo.textContent ?? '')
}

describe('el menú de la web', () => {
  it('empieza por el modo', async () => {
    await abrir()

    expect(filas()[0]).toBe('Mode')
  })

  it('en la práctica pregunta el nivel de la máquina y los goles', async () => {
    await abrir()

    expect(screen.getByRole('button', { name: 'Impossible' })).toBeDefined()
    expect(screen.getByLabelText(/^Goals/)).toBeDefined()
  })

  it('en el reto no pregunta nada de la partida: se le da a jugar', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS.challenge }))

    expect(screen.queryByRole('button', { name: 'Impossible' })).toBeNull()
    expect(screen.queryByLabelText(/^Goals/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined()
  })

  it('en niveles solo se elige qué nivel desbloqueado se juega', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS.levels }))

    expect(screen.queryByRole('button', { name: 'Impossible' })).toBeNull()
    expect(screen.queryByLabelText(/^Goals/)).toBeNull()
    expect(screen.getByRole('button', { name: /^Level 1,/ })).toBeDefined()
  })

  it('no tiene fila de mano: el mazo se coge con la que esté libre', async () => {
    await abrir()

    expect(filas().some((rotulo) => /hand/i.test(rotulo))).toBe(false)
  })
})
