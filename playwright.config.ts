import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // 0.83 ships personal planning/reservations/finance, not the archived guide UI.
  // Old guide/discovery specs remain in Git for their historical versions.
  testMatch: [
    '**/travel-planning-upgrade.spec.ts',
    '**/post-guide-cleanup.spec.ts',
    '**/travel-photos.spec.ts',
    '**/planner-workspace.spec.ts',
    '**/planner-reminders.spec.ts',
    '**/storage-safety.spec.ts',
    '**/drive-sync.spec.ts',
    '**/expense-upgrade.spec.ts',
    '**/google-routes.spec.ts',
    '**/finance.spec.ts',
    '**/travel-reminders.spec.ts',
  ],
  fullyParallel: true,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
  },
})
