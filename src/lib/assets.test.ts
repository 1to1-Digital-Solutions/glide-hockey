import { describe, expect, it } from 'vitest'
import { assetUrl, setAssetsBase } from './assets'

describe('las rutas de los ficheros estáticos', () => {
  it('cuelgan de la raíz mientras nadie diga otra cosa', () => {
    expect(assetUrl('webxr-profiles/')).toBe('/webxr-profiles/')
  })

  it('se pegan a la base sin comerse la barra', () => {
    setAssetsBase('/juegos/glide-hockey')

    expect(assetUrl('webxr-profiles/')).toBe('/juegos/glide-hockey/webxr-profiles/')
  })

  it('no duplican la barra si la base ya la trae', () => {
    setAssetsBase('/juegos/glide-hockey/')

    expect(assetUrl('/webxr-profiles/')).toBe('/juegos/glide-hockey/webxr-profiles/')
  })

  it('vuelven a la raíz con una base vacía', () => {
    setAssetsBase('   ')

    expect(assetUrl('webxr-profiles/')).toBe('/webxr-profiles/')
  })
})
