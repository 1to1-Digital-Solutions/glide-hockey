// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * La CSP de `next.config.ts` tiene dos ramas y solo una se despliega.
 *
 * `next dev` necesita `'unsafe-eval'`: el React de desarrollo usa `eval` para rehacer las
 * pilas de llamadas y, sin él, cada carga deja un error en la consola y el aviso rojo de Next.
 * Lo que se sirve de verdad —el build, que es también lo que prueban los e2e— tiene que seguir
 * sin él: es la misma CSP que la del salón, que no deja compilar WebAssembly, y un `eval`
 * permitido aquí escondería hasta el visor lo que allí revienta.
 */
async function cspCon(entorno: string): Promise<string> {
  vi.stubEnv('NODE_ENV', entorno)
  vi.resetModules()
  const { default: config } = await import('../next.config')
  const [reglas] = await config.headers!()
  return reglas.headers.find((cabecera) => cabecera.key === 'Content-Security-Policy')!.value
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('la CSP de next.config.ts', () => {
  it('en producción no lleva `unsafe-eval` en ninguna forma', async () => {
    const csp = await cspCon('production')
    expect(csp).not.toMatch(/unsafe-eval/)
    expect(csp).toContain("script-src 'self' 'unsafe-inline';")
  })

  it('en `next dev` deja evaluar, que lo necesita el React de desarrollo', async () => {
    expect(await cspCon('development')).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval';")
  })

  it('fuera de `next dev` (los tests, cualquier otro entorno) se queda la de producción', async () => {
    expect(await cspCon('test')).toBe(await cspCon('production'))
  })
})
