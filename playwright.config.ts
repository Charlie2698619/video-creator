import { defineConfig, devices } from '@playwright/test'

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
  projects: [
    { name: 'unit', testMatch: /tests\/unit\/.*\.(spec|test)\.(ts|js)/ },
    {
      name: 'chromium',
      testMatch: /tests\/e2e\/.*\.(spec|test)\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5173' },
    },
  ],
  webServer,
})
