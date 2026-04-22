import { defineConfig } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

// Load .env.local so globalSetup can reach SUPABASE_SERVICE_ROLE_KEY when
// minting the test FM session. `npm run dev` already loads these via Next,
// but Playwright's own node process needs an explicit load.
loadEnvConfig(process.cwd())

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    storageState: 'e2e/.auth/fm.json',
  },
  globalSetup: './e2e/global-setup.ts',
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
