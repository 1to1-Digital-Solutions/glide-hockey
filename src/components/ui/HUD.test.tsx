import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { GameProvider } from '../GameProvider'
import { useGame } from '../../lib/gameStore'
import { HUD } from './HUD'

/**
 * The dialog that asks before leaving a match, driven with the keyboard alone.
 *
 * It is the one modal of the web screens: while it is open nothing behind it may take the focus,
 * Escape has to answer it with the choice that loses nothing, and closing it must leave the focus
 * where it was, not at the top of the page.
 */

afterEach(() => {
  cleanup()
  localStorage.clear()
})

/** What the menu does when Play is pressed, without mounting the menu. */
function Start() {
  const { startGame, gameState } = useGame()
  return gameState === 'menu' ? (
    <button type="button" onClick={startGame}>
      start
    </button>
  ) : null
}

/** A match under way with the quit dialog open, opened from its button as a player would. */
async function openQuitDialog(wrap: (tree: ReactNode) => ReactNode = (tree) => tree): Promise<HTMLElement> {
  await act(async () => {
    render(
      wrap(
        <GameProvider>
          <Start />
          <HUD />
        </GameProvider>,
      ),
    )
  })
  fireEvent.click(screen.getByRole('button', { name: 'start' }))
  const opener = screen.getByRole('button', { name: 'Leave the game' })
  opener.focus()
  fireEvent.click(opener)
  return opener
}

const keepPlaying = () => screen.getByRole('button', { name: 'Keep playing' })
const leave = () => screen.getByRole('button', { name: 'Leave' })

describe('the quit dialog with the keyboard', () => {
  it('opens with the focus on the choice that loses nothing', async () => {
    await openQuitDialog()

    expect(screen.getByRole('alertdialog')).toBeDefined()
    expect(document.activeElement).toBe(keepPlaying())
  })

  it('keeps that focus under StrictMode, whose rehearsed unmount must not hand it back early', async () => {
    await openQuitDialog((tree) => <StrictMode>{tree}</StrictMode>)

    expect(document.activeElement).toBe(keepPlaying())
  })

  it('closes on Escape without leaving the match, and gives the focus back to the button that opened it', async () => {
    const opener = await openQuitDialog()

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })

    expect(screen.queryByRole('alertdialog')).toBeNull()
    // Still in the match: the button that asks to leave is there, and it has the focus again.
    expect(screen.getByRole('button', { name: 'Leave the game' })).toBe(opener)
    expect(document.activeElement).toBe(opener)
  })

  it('gives the focus back when it is answered with its own button too', async () => {
    const opener = await openQuitDialog()

    fireEvent.click(keepPlaying())

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('keeps Tab inside: after the last control comes the first, and before the first, the last', async () => {
    await openQuitDialog()

    leave().focus()
    const forward = fireEvent.keyDown(leave(), { key: 'Tab' })
    expect(document.activeElement).toBe(keepPlaying())
    // The browser's own move is cancelled: otherwise it would go on to whatever is behind.
    expect(forward).toBe(false)

    const backward = fireEvent.keyDown(keepPlaying(), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(leave())
    expect(backward).toBe(false)
  })

  it('leaves Tab alone between its own controls', async () => {
    await openQuitDialog()

    const notCancelled = fireEvent.keyDown(keepPlaying(), { key: 'Tab' })

    expect(notCancelled).toBe(true)
    expect(document.activeElement).toBe(keepPlaying())
  })

  it('pulls the focus back in when Tab is pressed from behind it', async () => {
    const opener = await openQuitDialog()

    opener.focus()
    fireEvent.keyDown(opener, { key: 'Tab' })
    expect(document.activeElement).toBe(keepPlaying())

    opener.focus()
    fireEvent.keyDown(opener, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(leave())
  })

  it('ignores every other key', async () => {
    await openQuitDialog()

    fireEvent.keyDown(keepPlaying(), { key: 'a' })

    expect(screen.getByRole('alertdialog')).toBeDefined()
    expect(document.activeElement).toBe(keepPlaying())
  })

  it('stops listening once closed: Escape afterwards does nothing', async () => {
    const opener = await openQuitDialog()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })

    const notCancelled = fireEvent.keyDown(opener, { key: 'Tab' })

    expect(notCancelled).toBe(true)
    expect(document.activeElement).toBe(opener)
  })
})
