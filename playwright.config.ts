import { defineConfig, devices } from '@playwright/test';

// Ziel ist WebKit (iPhone 13). Wo WebKit nicht installiert ist (z. B. in manchen
// Entwicklungs-Containern), kann mit PW_BROWSER=chromium auf Chromium ausgewichen werden.
const browser = process.env.PW_BROWSER === 'chromium' ? 'chromium' : 'webkit';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/learn-music/',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: `iphone-13-${browser}`,
      use: { ...devices['iPhone 13'], defaultBrowserType: browser },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/learn-music/',
    reuseExistingServer: !process.env.CI,
  },
});
