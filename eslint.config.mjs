import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Los empaquetados que genera `e2e/support/globalSetup.ts` para los tests de
  // navegador: código de terceros, no del proyecto.
  globalIgnores(['e2e/support/*.bundle.js']),
])

export default eslintConfig
