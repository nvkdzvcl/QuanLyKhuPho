import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for deterministic API security authorization and IDOR acceptance testing.
 *
 * Runs a request-only test suite against the built real NestJS API backed by
 * PostgreSQL (qlkp_e2e schema), Redis (DB 15), and RabbitMQ.
 */
export default defineConfig({
  testDir: './apps/api/test/security',
  testMatch: /authorization-idor\.spec\.ts$/,
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-security' }],
  ],
  outputDir: 'test-results-security',
  use: {
    baseURL:
      process.env.PLAYWRIGHT_API_BASE_URL ||
      process.env.API_BASE_URL ||
      'http://localhost:4100',
    extraHTTPHeaders: {
      Accept: 'application/json',
      Origin: 'http://localhost:4100',
    },
    // Tracing is disabled to ensure failure artifacts never retain OTPs, session cookies, or sensitive payloads.
    trace: 'off',
  },
  webServer: {
    command: 'node apps/api/dist/main.js',
    url: 'http://localhost:4100/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: '4100',
      NODE_ENV: 'development',
      CORS_ORIGIN:
        'http://127.0.0.1:3100,http://localhost:3100,http://localhost:4100,http://127.0.0.1:4100',
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
});
