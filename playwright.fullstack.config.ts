import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E configuration for full-stack integration testing.
 * Exercises real Next.js web application, NestJS HTTP API, PostgreSQL (qlkp_e2e),
 * Redis (DB 15), and RabbitMQ across serial multi-role user journeys.
 */
export default defineConfig({
  testDir: './apps/web/e2e',
  testMatch: /fullstack-role-flows\.spec\.ts$/,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  // The journey mutates real isolated state; preparation runs once per command,
  // so an in-process retry must not reuse partially mutated fixtures.
  retries: 0,
  // Keep the full-stack journey serial and isolated from test contention.
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-fullstack' }],
  ],
  outputDir: 'test-results-fullstack',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100',
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
  ],
  webServer: [
    {
      command: 'node apps/api/dist/main.js',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: '4000',
        NODE_ENV: 'development',
        CORS_ORIGIN: 'http://127.0.0.1:3100,http://localhost:3100',
        TRUST_PROXY: 'loopback',
        DATABASE_URL:
          process.env.E2E_DATABASE_URL ||
          process.env.DATABASE_URL ||
          'postgresql://postgres:postgres@localhost:5433/quanlykhupho?schema=qlkp_e2e',
        REDIS_URL:
          process.env.E2E_REDIS_URL ||
          process.env.REDIS_URL ||
          'redis://localhost:6379/15',
        RABBITMQ_URL:
          process.env.E2E_RABBITMQ_URL ||
          process.env.RABBITMQ_URL ||
          'amqp://guest:guest@localhost:5672',
        SMS_PROVIDER: 'memory',
      },
    },
    {
      // The visible OTP inbox is intentionally development-only; the existing
      // public E2E suite separately exercises the production Next.js build.
      command: 'pnpm --filter @quanlykhupho/web exec next dev --port 3100',
      url: 'http://localhost:3100',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: '3100',
        NEXT_PUBLIC_API_URL: 'http://localhost:4000/api',
      },
    },
  ],
});
