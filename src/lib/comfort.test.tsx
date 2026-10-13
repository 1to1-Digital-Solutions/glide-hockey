import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { INITIAL_COMFORT, COMFORT_KEY, getComfort, saveComfort, useComfort } from './comfort'

/**
 * El puente con el navegador, escrito a mano: si la clave cambia, lo que cada
 * cual eligió deja de leerse en silencio.
 */
describe('el confort del golpe recibido', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage'))
  })

  it('se guarda con el prefijo del juego, y se entra con el golpe entero', () => {
    expect(COMFORT_KEY).toBe('glide-hockey:confort')
    expect(INITIAL_COMFORT).toBe('normal')
    expect(getComfort()).toBe('normal')
    saveComfort('gentle')
    expect(window.localStorage.getItem('glide-hockey:confort')).toBe('gentle')
    expect(getComfort()).toBe('gentle')
  })

  it('lo que no existe cae al de partida', () => {
    window.localStorage.setItem('glide-hockey:confort', 'mucho')
    expect(getComfort()).toBe('normal')
  })

  it('los dos menús lo ven cambiar a la vez', () => {
    const uno = renderHook(() => useComfort())
    const otro = renderHook(() => useComfort())
    act(() => uno.result.current[1]('off'))
    expect(otro.result.current[0]).toBe('off')
    act(() => otro.result.current[1]('normal'))
    expect(uno.result.current[0]).toBe('normal')
  })
})
