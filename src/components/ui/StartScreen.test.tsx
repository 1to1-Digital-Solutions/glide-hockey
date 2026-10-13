import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider } from '../GameProvider'
import { GAME_MODE_LABELS } from '../../lib/gameMode'
import { saveDuelResult } from '../../lib/duelTally'
import { StartScreen } from './StartScreen'

// Without a headset there is no way into the headset: what is tested is what the menu asks.
vi.mock('../xr/useImmersiveSupport', () => ({ useImmersiveSupport: () => null }))
vi.mock('../xr/xrStore', () => ({ getXrStore: () => null, endXrSession: () => undefined }))

/**
 * The web menu starts with the mode, and **only practice asks**: in levels and in challenge
 * the ladder sets the level of the machine and the goals, so the match is already made and
 * Jugar is pressed.
 */

afterEach(() => {
  cleanup()
  localStorage.clear()
})

async function openMenu() {
  await act(async () => {
    render(
      <GameProvider>
        <StartScreen />
      </GameProvider>,
    )
  })
}

/** The labels of the rows, in the order they are seen. */
function rows(): string[] {
  return [...document.querySelectorAll('fieldset > span')].map((label) => label.textContent ?? '')
}

describe('the web menu', () => {
  it('starts with the mode', async () => {
    await openMenu()

    expect(rows()[0]).toBe('Mode')
  })

  it('opens with the challenge chosen: Jugar without touching anything, and practice one tap away', async () => {
    await openMenu()

    expect(screen.getByRole('button', { name: GAME_MODE_LABELS.challenge }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/The first game you lose ends it/)).toBeDefined()
    expect(screen.queryByLabelText(/^Goals/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS.practice }))

    expect(screen.getByRole('button', { name: GAME_MODE_LABELS.practice }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    expect(screen.getByLabelText(/^Goals/)).toBeDefined()
  })

  it('says of each mode whether it counts for a medal: only the challenge', async () => {
    await openMenu()

    expect(screen.getByText(/The first game you lose ends it\. Counts for a medal\./)).toBeDefined()
    for (const mode of ['practice', 'levels', 'duel'] as const) {
      fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS[mode] }))
      expect(screen.getByText(/Does not count for a medal\./), mode).toBeDefined()
      expect(screen.queryByText(/Counts for a medal\./), mode).toBeNull()
    }
    // And the challenge button carries its mark, without changing its name for whoever hears it.
    expect(document.querySelectorAll('fieldset button span[aria-hidden]')).toHaveLength(1)
    expect(screen.getByRole('button', { name: GAME_MODE_LABELS.challenge }).textContent).toContain('●')
  })

  it('in practice it asks the level of the machine and the goals', async () => {
    await openMenu()
    fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS.practice }))
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))

    expect(screen.getByRole('button', { name: 'Impossible' })).toBeDefined()
    expect(screen.getByLabelText(/^Goals/)).toBeDefined()
  })

  it('what does not belong to the mode, folded behind «Más opciones», as in the other games', async () => {
    await openMenu()
    // In the challenge there is nothing to choose that counts: no button, no scenery, no comfort.
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull()
    expect(screen.queryByText('Around you')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS.practice }))
    const button = screen.getByRole('button', { name: 'More options' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Impossible' })).toBeNull()
    expect(screen.queryByText('Around you')).toBeNull()
    expect(screen.queryByText('When hit')).toBeNull()

    fireEvent.click(button)
    expect(screen.getByRole('button', { name: 'Fewer options' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Around you')).toBeDefined()
    expect(screen.getAllByText('When hit').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Fewer options' }))
    expect(screen.queryByRole('button', { name: 'Impossible' })).toBeNull()
  })

  it('in the challenge it asks nothing about the match: play is pressed', async () => {
    await openMenu()
    fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS.challenge }))

    expect(screen.queryByRole('button', { name: 'Impossible' })).toBeNull()
    expect(screen.queryByLabelText(/^Goals/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined()
  })

  it('in levels only which unlocked level is played gets chosen', async () => {
    await openMenu()
    fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS.levels }))

    expect(screen.queryByRole('button', { name: 'Impossible' })).toBeNull()
    expect(screen.queryByLabelText(/^Goals/)).toBeNull()
    expect(screen.getByRole('button', { name: /^Level 1,/ })).toBeDefined()
  })

  it('the duel does not ask anything either: both play against the same machine', async () => {
    await openMenu()
    fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS.duel }))

    expect(screen.getByText(/whoever beats it by more wins/)).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Impossible' })).toBeNull()
    expect(screen.queryByLabelText(/^Goals/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Endless' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined()
    // With no duels played there is no tally of the pair to show.
    expect(screen.queryByText(/^Duels won/)).toBeNull()
  })

  it('and shows the tally of the pair', async () => {
    saveDuelResult(0)
    saveDuelResult(null)
    await openMenu()
    fireEvent.click(screen.getByRole('button', { name: GAME_MODE_LABELS.duel }))

    expect(screen.getByText('Duels won: 1–0 · tied: 1')).toBeDefined()
  })

  it('has no hand row: the mallet is picked up with whichever one is free', async () => {
    await openMenu()

    expect(rows().some((label) => /hand/i.test(label))).toBe(false)
  })
})
