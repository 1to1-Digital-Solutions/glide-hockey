import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { INITIAL_COMFORT, COMFORT_KEY, getComfort, saveComfort, useComfort } from './comfort'

/**
 * The bridge with the browser, written by hand: if the key changes, what each
 * person chose silently stops being read.
 */
describe('the comfort of the hit feedback', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage'))
  })

  it('is saved with the game prefix, and one starts with the full hit', () => {
    expect(COMFORT_KEY).toBe('glide-hockey:confort')
    expect(INITIAL_COMFORT).toBe('normal')
    expect(getComfort()).toBe('normal')
    saveComfort('gentle')
    expect(window.localStorage.getItem('glide-hockey:confort')).toBe('gentle')
    expect(getComfort()).toBe('gentle')
  })

  it('what does not exist falls back to the starting one', () => {
    window.localStorage.setItem('glide-hockey:confort', 'a lot')
    expect(getComfort()).toBe('normal')
  })

  it('both menus see it change at once', () => {
    const one = renderHook(() => useComfort())
    const other = renderHook(() => useComfort())
    act(() => one.result.current[1]('off'))
    expect(other.result.current[0]).toBe('off')
    act(() => other.result.current[1]('normal'))
    expect(one.result.current[0]).toBe('normal')
  })
})
