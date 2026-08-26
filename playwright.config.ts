import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E configuration for QuanLyKhuPho.
 * Covers 6 browser engine and viewport permutations:
 * - Desktop (1920x1080): Chromium, Firefox, WebKit
 * - Mobile (320x568): Chromium, Firefox, WebKit
 *
 * NOTE: Chromium and WebKit mobile projects serve as browser engine proxies
 * for mobile rendering layouts and do not substitute for physical device testing
 * on branded Microsoft Edge or real Apple iOS Safari hardware.
 */
export default defineConfig({
  testDir: './apps/web/e2e',
  testIgnore: /fullstack-role-flows\.spec\.ts$/,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Keep the page-load budget isolated from artificial local browser contention.
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop-1920x1080',
      use: {
        browserName: 'chromium',
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'chromium-mobile-320x568',
      use: {
        browserName: 'chromium',
        viewport: { width: 320, height: 568 },
        isMobile: true,
      },
    },
    {
      name: 'firefox-desktop-1920x1080',
      use: {
        browserName: 'firefox',
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'firefox-mobile-320x568',
      use: {
        browserName: 'firefox',
        viewport: { width: 320, height: 568 },
      },
    },
    {
      name: 'webkit-desktop-1920x1080',
      use: {
        browserName: 'webkit',
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'webkit-mobile-320x568',
      use: {
        browserName: 'webkit',
        viewport: { width: 320, height: 568 },
        isMobile: true,
      },
    },
  ],
  webServer: {
    command: 'pnpm --filter @quanlykhupho/web exec next start --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
