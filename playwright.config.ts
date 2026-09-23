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
      grepInvert: /@offline/,
    },
    {
      // Playwright-WebKit bricht context.setOffline() mit aktivem Service Worker
      // mit „WebKit encountered an internal error“ ab. Der Offline-Start wird daher
      // in Chromium geprüft (gleicher Service Worker, gleiches Precache);
      // auf dem echten iPhone wird er in MS7 manuell abgenommen.
      name: 'offline-chromium',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
      grep: /@offline/,
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/learn-music/',
    reuseExistingServer: !process.env.CI,
  },
});
