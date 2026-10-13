// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The CSP of `next.config.ts` has two branches and only one is deployed.
 *
 * `next dev` needs `'unsafe-eval'`: the development React uses `eval` to rebuild the
 * call stacks and, without it, every load leaves an error in the console and Next's red warning.
 * What is really served —the build, which is also what the e2e test— has to stay
 * without it: it is the same CSP as the hall's, which does not let WebAssembly compile, and an `eval`
 * allowed here would hide until the headset what blows up there.
 */
async function cspFor(env: string): Promise<string> {
  vi.stubEnv('NODE_ENV', env)
  vi.resetModules()
  const { default: config } = await import('../next.config')
  const [rules] = await config.headers!()
  return rules.headers.find((header) => header.key === 'Content-Security-Policy')!.value
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the CSP of next.config.ts', () => {
  it('in production it carries no `unsafe-eval` in any form', async () => {
    const csp = await cspFor('production')
    expect(csp).not.toMatch(/unsafe-eval/)
    expect(csp).toContain("script-src 'self' 'unsafe-inline';")
  })

  it('in `next dev` it lets evaluate, which the development React needs', async () => {
    expect(await cspFor('development')).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval';")
  })

  it('outside `next dev` (the tests, any other environment) the production one stays', async () => {
    expect(await cspFor('test')).toBe(await cspFor('production'))
  })
})
