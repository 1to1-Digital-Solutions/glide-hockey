/**
 * El roce del disco en Godot: el bucle se renderizó a la velocidad máxima y se escala con las
 * cuentas de la web (`slideSound.ts`). Corre en el motor, con los tests de dominio.
 */
import { describe, expect, it } from 'vitest'

import { MAX_PUCK_SPEED } from '@/lib/gameConfig'
import { STALL_SPEED } from '@/lib/puckPhysics'
import { SLIDE_PITCH_MAX, SLIDE_PITCH_MIN, slideLevel } from '@/lib/slideSound'

import { roceDelDisco } from './sucesos'

describe('el roce del disco', () => {
  it('a la velocidad máxima suena el bucle tal cual se renderizó', () => {
    expect(roceDelDisco(MAX_PUCK_SPEED)).toEqual({ volume: 1, pitch: 1 })
  })

  it('parado calla, y más despacio es más flojo y más grave, en la proporción de la web', () => {
    expect(roceDelDisco(0).volume).toBe(0)
    expect(roceDelDisco(STALL_SPEED).volume).toBe(0)
    expect(roceDelDisco(0).pitch).toBeCloseTo(SLIDE_PITCH_MIN / SLIDE_PITCH_MAX, 12)
    const lento = roceDelDisco(1.5)
    const rapido = roceDelDisco(4)
    expect(lento.volume).toBeLessThan(rapido.volume)
    expect(lento.pitch).toBeLessThan(rapido.pitch)
    expect(lento.volume).toBeCloseTo(slideLevel(1.5) / slideLevel(MAX_PUCK_SPEED), 12)
  })

  it('más rápido que el tope no sube de ahí', () => {
    expect(roceDelDisco(MAX_PUCK_SPEED * 3)).toEqual({ volume: 1, pitch: 1 })
  })
})
