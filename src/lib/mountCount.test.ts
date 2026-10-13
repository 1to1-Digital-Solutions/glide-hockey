import { afterEach, describe, expect, it } from 'vitest'
import { recordPrograms, countMount, isMountCountRequested } from './mountCount'

afterEach(() => {
  delete window.__mounts
  delete window.__programs
})

describe('counting mounts', () => {
  it('counts nothing if nobody has asked for it', () => {
    expect(isMountCountRequested()).toBe(false)
    countMount('world')
    expect(window.__mounts).toBeUndefined()
  })

  it('and counts every time, separately, if it is asked for', () => {
    window.__mounts = {}
    expect(isMountCountRequested()).toBe(true)

    countMount('world')
    countMount('world')
    countMount('scene')

    expect(window.__mounts).toEqual({ world: 2, scene: 1 })
  })
})

describe('recording the compiled programs', () => {
  it('records nothing either if nobody has asked for it', () => {
    recordPrograms(21)
    expect(window.__programs).toBeUndefined()
  })

  it('and records the last number if it is asked for', () => {
    window.__mounts = {}
    recordPrograms(18)
    recordPrograms(21)
    expect(window.__programs).toBe(21)
  })
})
