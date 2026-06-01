import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

const chromiumExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  (existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined)

const webServer = process.env.VIDEO_CREATOR_E2E === '1'
  ? [
      {
        command: 'VIDEO_CREATOR_TEST_MODE=1 npm run server',
        url: 'http://127.0.0.1:8787/api/health',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
      {
        command: 'npm run dev',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
    ]
  : undefined

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: process.env.VIDEO_CREATOR_E2E === '1' ? 1 : undefined,
  projects: [
    { name: 'unit', testMatch: /tests\/unit\/.*\.(spec|test)\.(ts|js)/ },
    {
      name: 'chromium',
      testMatch: /tests\/e2e\/.*\.(spec|test)\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5173', launchOptions: { executablePath: chromiumExecutablePath } },
    },
  ],
  webServer,
})
