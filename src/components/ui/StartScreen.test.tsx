import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider } from '../GameProvider'
import { GAME_MODE_LABELS } from '../../lib/gameMode'
import { saveDuelResult } from '../../lib/duelTally'
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

  it('abre con el reto elegido: Jugar sin tocar nada, y la práctica a un toque', async () => {
    await abrir()

    expect(screen.getByRole('button', { name: GAME_MODE_LABELS.challenge }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/The first game you lose ends it/)).toBeDefined()
    expect(screen.queryByLabelText(/^Goals/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS.practice }))

    expect(screen.getByRole('button', { name: GAME_MODE_LABELS.practice }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    expect(screen.getByLabelText(/^Goals/)).toBeDefined()
  })

  it('dice de cada modo si cuenta para medalla: solo el reto', async () => {
    await abrir()

    expect(screen.getByText(/The first game you lose ends it\. Counts for a medal\./)).toBeDefined()
    for (const modo of ['practice', 'levels', 'duel'] as const) {
      fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS[modo] }))
      expect(screen.getByText(/Does not count for a medal\./), modo).toBeDefined()
      expect(screen.queryByText(/Counts for a medal\./), modo).toBeNull()
    }
    // Y el botón del reto lleva su marca, sin cambiarle el nombre a quien lo oye.
    expect(document.querySelectorAll('fieldset button span[aria-hidden]')).toHaveLength(1)
    expect(screen.getByRole('button', { name: GAME_MODE_LABELS.challenge }).textContent).toContain('●')
  })

  it('en la práctica pregunta el nivel de la máquina y los goles', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS.practice }))
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))

    expect(screen.getByRole('button', { name: 'Impossible' })).toBeDefined()
    expect(screen.getByLabelText(/^Goals/)).toBeDefined()
  })

  it('lo que no es del modo, plegado tras «Más opciones», como en los demás juegos', async () => {
    await abrir()
    // En el reto no hay nada que elegir que cuente: ni botón, ni decorado, ni confort.
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull()
    expect(screen.queryByText('Around you')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS.practice }))
    const boton = screen.getByRole('button', { name: 'More options' })
    expect(boton.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Impossible' })).toBeNull()
    expect(screen.queryByText('Around you')).toBeNull()
    expect(screen.queryByText('When hit')).toBeNull()

    fireEvent.click(boton)
    expect(screen.getByRole('button', { name: 'Fewer options' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Around you')).toBeDefined()
    expect(screen.getAllByText('When hit').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Fewer options' }))
    expect(screen.queryByRole('button', { name: 'Impossible' })).toBeNull()
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

  it('el duelo tampoco pregunta nada: los dos juegan contra la misma máquina', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS.duel }))

    expect(screen.getByText(/whoever beats it by more wins/)).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Impossible' })).toBeNull()
    expect(screen.queryByLabelText(/^Goals/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Endless' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined()
    // Sin duelos jugados no hay marcador de la pareja que enseñar.
    expect(screen.queryByText(/^Duels won/)).toBeNull()
  })

  it('y enseña lo que lleva la pareja', async () => {
    saveDuelResult(0)
    saveDuelResult(null)
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS.duel }))

    expect(screen.getByText('Duels won: 1–0 · tied: 1')).toBeDefined()
  })

  it('no tiene fila de mano: el mazo se coge con la que esté libre', async () => {
    await abrir()

    expect(filas().some((rotulo) => /hand/i.test(rotulo))).toBe(false)
  })
})
