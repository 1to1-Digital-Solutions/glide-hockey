import { describe, expect, it } from 'vitest'
import { assetUrl, setAssetsBase } from './assets'

describe('the paths of the static files', () => {
  it('hang from the root as long as nobody says otherwise', () => {
    expect(assetUrl('webxr-profiles/')).toBe('/webxr-profiles/')
  })

  it('are joined to the base without eating the slash', () => {
    setAssetsBase('/juegos/glide-hockey')

    expect(assetUrl('webxr-profiles/')).toBe('/juegos/glide-hockey/webxr-profiles/')
  })

  it('do not double the slash if the base already has it', () => {
    setAssetsBase('/juegos/glide-hockey/')

    expect(assetUrl('/webxr-profiles/')).toBe('/juegos/glide-hockey/webxr-profiles/')
  })

  it('go back to the root with an empty base', () => {
    setAssetsBase('   ')

    expect(assetUrl('webxr-profiles/')).toBe('/webxr-profiles/')
  })
})
