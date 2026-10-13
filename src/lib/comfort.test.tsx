import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CONFORT_INICIAL, CONFORT_KEY, getConfort, saveConfort, useConfort } from './comfort'

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
    expect(CONFORT_KEY).toBe('glide-hockey:confort')
    expect(CONFORT_INICIAL).toBe('normal')
    expect(getConfort()).toBe('normal')
    saveConfort('gentle')
    expect(window.localStorage.getItem('glide-hockey:confort')).toBe('gentle')
    expect(getConfort()).toBe('gentle')
  })

  it('lo que no existe cae al de partida', () => {
    window.localStorage.setItem('glide-hockey:confort', 'mucho')
    expect(getConfort()).toBe('normal')
  })

  it('los dos menús lo ven cambiar a la vez', () => {
    const uno = renderHook(() => useConfort())
    const otro = renderHook(() => useConfort())
    act(() => uno.result.current[1]('off'))
    expect(otro.result.current[0]).toBe('off')
    act(() => otro.result.current[1]('normal'))
    expect(uno.result.current[0]).toBe('normal')
  })
})
