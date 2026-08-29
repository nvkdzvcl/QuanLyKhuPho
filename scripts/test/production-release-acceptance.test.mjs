import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DEFAULT_BASE_COMPOSE_FILE,
  DEFAULT_SMOKE_COMPOSE_FILE,
  DEFAULT_SMOKE_PROJECT_NAME,
  DEFAULT_APP_IMAGE_TAG,
  DEFAULT_API_PORT,
  DEFAULT_WEB_PORT,
  DEFAULT_CONFIG_TIMEOUT_MS,
  DEFAULT_BUILD_TIMEOUT_MS,
  DEFAULT_UP_TIMEOUT_MS,
  DEFAULT_PS_TIMEOUT_MS,
  DEFAULT_LOGS_TIMEOUT_MS,
  DEFAULT_DOWN_TIMEOUT_MS,
  parseArgs,
  validateSmokeOptions,
  generateSmokeEnvironment,
  createTempEnvFile,
  cleanupTempEnvFile,
  redactSensitiveOutput,
  validateSmokeProjectIdentity,
  parseComposeConfig,
  validateRenderedComposeConfig,
  parseComposePsOutput,
  normalizeServicePsEntry,
  checkServicesReadiness,
  unwrapApiResponse,
  assertHttpContracts,
  collectRedactedDiagnostics,
  cleanupSmokeStack,
  runProductionReleaseAcceptance,
} from '../lib/production-release-acceptance.mjs';

const sampleValidRenderedConfig = {
  name: 'quanlykhupho-production-smoke',
  services: {
    postgres: { container_name: 'quanlykhupho-postgres-smoke' },
    redis: { container_name: 'quanlykhupho-redis-smoke' },
    rabbitmq: { container_name: 'quanlykhupho-rabbitmq-smoke' },
    migrate: { container_name: 'quanlykhupho-migrate-smoke' },
    api: {
      container_name: 'quanlykhupho-api-smoke',
      ports: [
        {
          mode: 'ingress',
          target: 4000,
          published: '4010',
          protocol: 'tcp',
          host_ip: '127.0.0.1',
        },
      ],
    },
    'sms-worker': { container_name: 'quanlykhupho-worker-smoke' },
    web: {
      container_name: 'quanlykhupho-web-smoke',
      ports: [
        {
          mode: 'ingress',
          target: 3000,
          published: '3010',
          protocol: 'tcp',
          host_ip: '127.0.0.1',
        },
      ],
    },
  },
  volumes: {
    postgres_data: { name: 'quanlykhupho_postgres_smoke_data' },
    redis_data: { name: 'quanlykhupho_redis_smoke_data' },
    rabbitmq_data: { name: 'quanlykhupho_rabbitmq_smoke_data' },
    uploads_data: { name: 'quanlykhupho_uploads_smoke_data' },
  },
  networks: {
    application: { name: 'quanlykhupho_application_smoke' },
    data: { name: 'quanlykhupho_data_smoke' },
  },
};

const sampleValidPsEntries = [
  { Service: 'postgres', Name: 'quanlykhupho-postgres-smoke', State: 'running', Health: 'healthy' },
  { Service: 'redis', Name: 'quanlykhupho-redis-smoke', State: 'running', Health: 'healthy' },
  { Service: 'rabbitmq', Name: 'quanlykhupho-rabbitmq-smoke', State: 'running', Health: 'healthy' },
  { Service: 'migrate', Name: 'quanlykhupho-migrate-smoke', State: 'exited', ExitCode: 0 },
  { Service: 'api', Name: 'quanlykhupho-api-smoke', State: 'running', Health: 'healthy' },
  { Service: 'sms-worker', Name: 'quanlykhupho-worker-smoke', State: 'running', Health: '', Restarts: 0 },
  { Service: 'web', Name: 'quanlykhupho-web-smoke', State: 'running', Health: 'healthy' },
];

function createMockHttpRunner(overrides = {}) {
  return async (url, options = {}) => {
    const headers = options.headers || {};
    const forwardedProto = headers['x-forwarded-proto'];

    if (overrides[url]) {
      return overrides[url](url, options);
    }

    if (url.includes('/api/health/live')) {
      if (forwardedProto !== 'https') {
        return {
          status: 403,
          ok: false,
          json: async () => ({ statusCode: 403, message: 'HTTPS connection is required' }),
          text: async () => JSON.stringify({ statusCode: 403, message: 'HTTPS connection is required' }),
        };
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({ status: 'ok', version: '0.1.0' }),
        text: async () => JSON.stringify({ status: 'ok', version: '0.1.0' }),
      };
    }

    if (url.includes('/api/health/ready') || url.includes('/api/health')) {
      if (forwardedProto !== 'https') {
        return {
          status: 403,
          ok: false,
          json: async () => ({ statusCode: 403, message: 'HTTPS connection is required' }),
          text: async () => JSON.stringify({ statusCode: 403, message: 'HTTPS connection is required' }),
        };
      }
      return {
        status: 503,
        ok: false,
        json: async () => ({
          status: 'down',
          services: {
            database: { status: 'ok' },
            redis: { status: 'ok' },
            rabbitmq: { status: 'ok' },
            deployment: { status: 'down', message: 'Deployment profile is not initialized' },
          },
        }),
        text: async () =>
          JSON.stringify({
            status: 'down',
            services: {
              database: { status: 'ok' },
              redis: { status: 'ok' },
              rabbitmq: { status: 'ok' },
              deployment: { status: 'down', message: 'Deployment profile is not initialized' },
            },
          }),
      };
    }

    if (url.endsWith('/') || url.includes(':3010')) {
      return {
        status: 200,
        ok: true,
        text: async () => '<!DOCTYPE html><html><body>QuanLyKhuPho</body></html>',
      };
    }

    return {
      status: 404,
      ok: false,
      text: async () => 'Not Found',
    };
  };
}

describe('Production Release Acceptance Suite', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qlkp-smoke-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('CLI Argument Parsing', () => {
    it('parses flags and positional arguments accurately', () => {
      const args = [
        '--no-build',
        '--tag=verify-1.0',
        '--api-port=4020',
        '--web-port=3020',
        '--timeout=45000',
        '--poll-interval=500',
      ];
      const parsed = parseArgs(args);

      assert.strictEqual(parsed.flags['no-build'], true);
      assert.strictEqual(parsed.flags.tag, 'verify-1.0');
      assert.strictEqual(parsed.flags['api-port'], '4020');
      assert.strictEqual(parsed.flags['web-port'], '3020');
      assert.strictEqual(parsed.flags.timeout, '45000');
      assert.strictEqual(parsed.flags['poll-interval'], '500');
    });

    it('identifies help flags', () => {
      assert.strictEqual(parseArgs(['--help']).flags.help, true);
      assert.strictEqual(parseArgs(['-h']).flags.help, true);
    });
  });

  describe('Smoke Option and Input Validation', () => {
    it('validates compliant smoke options without throwing', () => {
      assert.strictEqual(
        validateSmokeOptions({
          imageTag: 'verify-1.0.0',
          apiPort: 4010,
          webPort: 3010,
          timeoutMs: 120000,
          pollIntervalMs: 1000,
          build: true,
          noBuild: false,
        }),
        true
      );
    });

    it('rejects conflicting build and no-build flags', () => {
      assert.throws(
        () => validateSmokeOptions({ build: true, noBuild: true }),
        /Conflicting options: cannot specify both --build and --no-build/
      );
    });

    it('rejects invalid image tags', () => {
      const invalidTags = ['', '   ', 'tag with spaces', 'invalid$tag', 'invalid;tag', 'invalid/tag:with:colons'];
      for (const tag of invalidTags) {
        assert.throws(
          () => validateSmokeOptions({ imageTag: tag }),
          /Invalid image tag/
        );
      }
    });

    it('rejects out-of-range or non-integer API and Web ports', () => {
      const invalidPorts = [0, -1, 65536, 70000, 4010.5, NaN, Infinity, 'abc'];
      for (const port of invalidPorts) {
        assert.throws(
          () => validateSmokeOptions({ apiPort: port }),
          /Invalid API port/
        );
        assert.throws(
          () => validateSmokeOptions({ webPort: port }),
          /Invalid Web port/
        );
      }
    });

    it('rejects port collision between API and Web ports', () => {
      assert.throws(
        () => validateSmokeOptions({ apiPort: 4010, webPort: 4010 }),
        /Port collision: API port and Web port cannot be the same/
      );
    });

    it('rejects non-positive or non-integer timeouts and poll intervals', () => {
      const invalidValues = [0, -100, NaN, Infinity, 100.5];
      for (const val of invalidValues) {
        assert.throws(
          () => validateSmokeOptions({ timeoutMs: val }),
          /Invalid timeout/
        );
        assert.throws(
          () => validateSmokeOptions({ pollIntervalMs: val }),
          /Invalid poll interval/
        );
      }
    });
  });

  describe('Environment Generation and Temp File Management', () => {
    it('generates a complete smoke environment map with cryptographic keys and safe ports', () => {
      const env = generateSmokeEnvironment({
        projectName: 'quanlykhupho-production-smoke',
        imageTag: 'smoke-tag',
        apiPort: 4015,
        webPort: 3015,
      });

      assert.strictEqual(env.COMPOSE_PROJECT_NAME, 'quanlykhupho-production-smoke');
      assert.strictEqual(env.APP_IMAGE_TAG, 'smoke-tag');
      assert.strictEqual(env.API_PORT, '4015');
      assert.strictEqual(env.WEB_PORT, '3015');
      assert.strictEqual(env.CORS_ORIGIN, 'http://127.0.0.1:3015');
      assert.strictEqual(env.NEXT_PUBLIC_API_URL, 'http://127.0.0.1:4015');
      assert.strictEqual(env.TRUST_PROXY, '1');
      assert.strictEqual(env.SMS_PROVIDER, 'webhook');
      assert.strictEqual(env.PHONE_ENCRYPTION_KEY.length, 64);
      assert.strictEqual(env.PHONE_HASH_KEY.length, 64);
      assert.strictEqual(env.OTP_PEPPER.length, 64);
      assert.strictEqual(env.SMS_QUEUE_ENCRYPTION_KEY.length, 64);
      assert.strictEqual(env.DATABASE_URL.includes(env.POSTGRES_USER), true);
      assert.strictEqual(env.DATABASE_URL.includes(env.POSTGRES_PASSWORD), true);
      assert.strictEqual(env.RABBITMQ_URL.includes(env.RABBITMQ_USER), true);
      assert.strictEqual(env.RABBITMQ_URL.includes(env.RABBITMQ_PASSWORD), true);
    });

    it('creates temporary .env file and unlinks it cleanly', () => {
      const envMap = { KEY1: 'val1', KEY2: 'val2' };
      const filePath = createTempEnvFile(envMap, tempDir);

      assert.strictEqual(fs.existsSync(filePath), true);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.strictEqual(content.includes('KEY1=val1'), true);
      assert.strictEqual(content.includes('KEY2=val2'), true);

      cleanupTempEnvFile(filePath);
      assert.strictEqual(fs.existsSync(filePath), false);
    });
  });

  describe('Sensitive Data Redaction', () => {
    it('redacts sensitive URLs, passwords, encryption keys, and tokens', () => {
      const raw = `
        DATABASE_URL=postgresql://secret_user:super_secret_pw@postgres:5432/quanlykhupho?schema=public
        RABBITMQ_URL=amqp://rmq_user:rmq_pass123@rabbitmq:5672
        REDIS_URL=redis://redis_user:redis_pass@redis:6379
        PHONE_ENCRYPTION_KEY=11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff
        PHONE_HASH_KEY=aabbccddeeff11223344556677889900aabbccddeeff11223344556677889900
        OTP_PEPPER=feedbeef11223344556677889900aabbccddeeff11223344556677889900aabb
        SMS_QUEUE_ENCRYPTION_KEY=cafebabe11223344556677889900aabbccddeeff11223344556677889900aabb
        POSTGRES_PASSWORD=my_db_password
        RABBITMQ_PASSWORD=my_rmq_password
        SMS_PROVIDER_API_KEY=my_secret_sms_api_key_12345
        Connection failed with password=some_random_pass;
      `;

      const sanitized = redactSensitiveOutput(raw, ['my_secret_sms_api_key_12345']);

      assert.strictEqual(sanitized.includes('super_secret_pw'), false);
      assert.strictEqual(sanitized.includes('rmq_pass123'), false);
      assert.strictEqual(sanitized.includes('redis_pass'), false);
      assert.strictEqual(sanitized.includes('11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'), false);
      assert.strictEqual(sanitized.includes('my_db_password'), false);
      assert.strictEqual(sanitized.includes('my_secret_sms_api_key_12345'), false);
      assert.strictEqual(sanitized.includes('some_random_pass'), false);

      assert.strictEqual(sanitized.includes('postgresql://***@postgres:5432/***'), true);
      assert.strictEqual(sanitized.includes('amqp://***@rabbitmq:5672'), true);
      assert.strictEqual(sanitized.includes('redis://***@redis:6379'), true);
    });
  });

  describe('Project Safety & Target Identity Verification', () => {
    it('accepts valid smoke project names and compose files', () => {
      assert.strictEqual(
        validateSmokeProjectIdentity({
          projectName: 'quanlykhupho-production-smoke',
          composeFiles: [DEFAULT_BASE_COMPOSE_FILE, DEFAULT_SMOKE_COMPOSE_FILE],
        }),
        true
      );
    });

    it('rejects unsafe production and development project names', () => {
      const unsafeNames = [
        'quanlykhupho-production',
        'quanlykhupho',
        'production',
        'prod',
        'development',
        'dev',
        'default',
        'main',
      ];

      for (const name of unsafeNames) {
        assert.throws(
          () => validateSmokeProjectIdentity({ projectName: name }),
          /Dangerous project name rejected/
        );
      }
    });

    it('rejects execution when smoke override compose file is missing', () => {
      assert.throws(
        () =>
          validateSmokeProjectIdentity({
            projectName: 'quanlykhupho-production-smoke',
            composeFiles: ['docker/docker-compose.production.yml'],
          }),
        /Dangerous Compose execution rejected/
      );
    });
  });

  describe('Rendered Compose Configuration Validation', () => {
    it('accepts a fully compliant smoke Compose configuration', () => {
      assert.strictEqual(validateRenderedComposeConfig(sampleValidRenderedConfig), true);
    });

    it('rejects configuration if project name does not contain smoke', () => {
      const invalid = { ...sampleValidRenderedConfig, name: 'quanlykhupho-production' };
      assert.throws(() => validateRenderedComposeConfig(invalid), /not isolated for smoke testing/);
    });

    it('rejects configuration if any container name contains -prod', () => {
      const invalid = JSON.parse(JSON.stringify(sampleValidRenderedConfig));
      invalid.services.postgres.container_name = 'quanlykhupho-postgres-prod';
      assert.throws(() => validateRenderedComposeConfig(invalid), /has unsafe container name/);
    });

    it('rejects configuration if any volume name contains prod', () => {
      const invalid = JSON.parse(JSON.stringify(sampleValidRenderedConfig));
      invalid.volumes.postgres_data.name = 'quanlykhupho_postgres_prod_data';
      assert.throws(() => validateRenderedComposeConfig(invalid), /has unsafe volume name/);
    });

    it('rejects configuration if any network name contains prod', () => {
      const invalid = JSON.parse(JSON.stringify(sampleValidRenderedConfig));
      invalid.networks.application.name = 'quanlykhupho_application_prod';
      assert.throws(() => validateRenderedComposeConfig(invalid), /has unsafe network name/);
    });

    it('rejects configuration with non-loopback host port binding', () => {
      const invalid = JSON.parse(JSON.stringify(sampleValidRenderedConfig));
      invalid.services.api.ports = [{ host_ip: '0.0.0.0', published: '4010', target: 4000 }];
      assert.throws(() => validateRenderedComposeConfig(invalid), /exposes port on non-loopback interface/);
    });

    it('parses JSON string into configuration object', () => {
      const parsed = parseComposeConfig(JSON.stringify(sampleValidRenderedConfig));
      assert.strictEqual(parsed.name, 'quanlykhupho-production-smoke');
    });
  });

  describe('Service Readiness Checking', () => {
    it('reports ready when all services satisfy smoke contracts', () => {
      const result = checkServicesReadiness(sampleValidPsEntries);
      assert.strictEqual(result.ready, true);
      assert.strictEqual(result.failures.length, 0);
      assert.strictEqual(result.pending.length, 0);
    });

    it('reports pending when services are starting or migrate is running', () => {
      const entries = [
        { Service: 'postgres', State: 'running', Health: 'starting' },
        { Service: 'redis', State: 'running', Health: 'healthy' },
        { Service: 'rabbitmq', State: 'running', Health: 'healthy' },
        { Service: 'migrate', State: 'running' },
        { Service: 'api', State: 'running', Health: 'starting' },
        { Service: 'sms-worker', State: 'running', Restarts: 0 },
        { Service: 'web', State: 'running', Health: 'starting' },
      ];

      const result = checkServicesReadiness(entries);
      assert.strictEqual(result.ready, false);
      assert.strictEqual(result.pending.length > 0, true);
      assert.strictEqual(result.failures.length, 0);
    });

    it('reports failure if migrate container exits with non-zero exit code', () => {
      const entries = [
        ...sampleValidPsEntries.filter((e) => e.Service !== 'migrate'),
        { Service: 'migrate', State: 'exited', ExitCode: 1 },
      ];

      const result = checkServicesReadiness(entries);
      assert.strictEqual(result.ready, false);
      assert.strictEqual(result.failures.some((f) => f.includes('migrate')), true);
    });

    it('reports failure if sms-worker has restarted', () => {
      const entries = [
        ...sampleValidPsEntries.filter((e) => e.Service !== 'sms-worker'),
        { Service: 'sms-worker', State: 'running', Restarts: 2 },
      ];

      const result = checkServicesReadiness(entries);
      assert.strictEqual(result.ready, false);
      assert.strictEqual(result.failures.some((f) => f.includes('sms-worker has restarted')), true);
    });

    it('reports failure if a core service is unhealthy', () => {
      const entries = [
        ...sampleValidPsEntries.filter((e) => e.Service !== 'api'),
        { Service: 'api', State: 'running', Health: 'unhealthy' },
      ];

      const result = checkServicesReadiness(entries);
      assert.strictEqual(result.ready, false);
      assert.strictEqual(result.failures.some((f) => f.includes('api healthcheck failed')), true);
    });

    it('parses docker compose ps newline-delimited json output', () => {
      const jsonLines = sampleValidPsEntries.map((e) => JSON.stringify(e)).join('\n');
      const parsed = parseComposePsOutput(jsonLines);
      assert.strictEqual(parsed.length, 7);
    });
  });

  describe('HTTP Contract Assertions', () => {
    it('unwraps the API success envelope and preserves direct payloads', () => {
      const data = { status: 'ok' };
      assert.deepStrictEqual(
        unwrapApiResponse({ success: true, data, timestamp: new Date().toISOString() }),
        data
      );
      assert.deepStrictEqual(unwrapApiResponse(data), data);
    });

    it('accepts enveloped health responses emitted by the global interceptor', async () => {
      const mockHttp = async (url, options = {}) => {
        const headers = options.headers || {};
        if (url.includes('/api/health/live')) {
          if (headers['x-forwarded-proto'] !== 'https') {
            return { status: 403, json: async () => ({}) };
          }
          return {
            status: 200,
            json: async () => ({
              success: true,
              data: { status: 'ok' },
              timestamp: new Date().toISOString(),
            }),
          };
        }
        if (url.includes('/api/health/ready')) {
          return {
            status: 503,
            json: async () => ({
              success: true,
              data: {
                status: 'down',
                services: {
                  database: { status: 'ok' },
                  redis: { status: 'ok' },
                  rabbitmq: { status: 'ok' },
                  deployment: {
                    status: 'down',
                    message: 'Deployment profile is not initialized',
                  },
                },
              },
              timestamp: new Date().toISOString(),
            }),
          };
        }
        return { status: 200, text: async () => 'ok' };
      };

      const results = await assertHttpContracts({
        apiPort: 4010,
        webPort: 3010,
        httpRunner: mockHttp,
      });

      assert.strictEqual(results.liveness.body.status, 'ok');
      assert.strictEqual(
        results.readiness.body.services.deployment.message,
        'Deployment profile is not initialized'
      );
    });

    it('passes all 4 runtime contract checks when endpoints conform', async () => {
      const mockHttp = createMockHttpRunner();
      const results = await assertHttpContracts({
        apiPort: 4010,
        webPort: 3010,
        httpRunner: mockHttp,
      });

      assert.strictEqual(results.plainHttp.status, 403);
      assert.strictEqual(results.liveness.status, 200);
      assert.strictEqual(results.readiness.status, 503);
      assert.strictEqual(results.webRoot.status, 200);
    });

    it('fails if plain HTTP is not rejected with 403 Forbidden', async () => {
      const mockHttp = createMockHttpRunner({
        'http://127.0.0.1:4010/api/health/live': async () => ({
          status: 200,
          json: async () => ({ status: 'ok' }),
        }),
      });

      await assert.rejects(
        () => assertHttpContracts({ apiPort: 4010, webPort: 3010, httpRunner: mockHttp }),
        /Plain HTTP contract violation/
      );
    });

    it('fails if HTTPS readiness does not return expected 503 pre-locality status', async () => {
      const mockHttp = async (url, options = {}) => {
        const headers = options.headers || {};
        if (url.includes('/api/health/ready')) {
          return {
            status: 200,
            json: async () => ({ status: 'ok' }),
            text: async () => JSON.stringify({ status: 'ok' }),
          };
        }
        if (url.includes('/api/health/live')) {
          if (headers['x-forwarded-proto'] !== 'https') {
            return { status: 403, json: async () => ({}) };
          }
          return { status: 200, json: async () => ({ status: 'ok' }), text: async () => JSON.stringify({ status: 'ok' }) };
        }
        return { status: 200, text: async () => 'ok' };
      };

      await assert.rejects(
        () => assertHttpContracts({ apiPort: 4010, webPort: 3010, httpRunner: mockHttp }),
        /HTTPS readiness contract violation: expected 503/
      );
    });

    it('fails if Web root does not return 200 OK', async () => {
      const mockHttp = async (url, options = {}) => {
        const headers = options.headers || {};
        if (url.endsWith(':3010/') || url === 'http://127.0.0.1:3010/') {
          return { status: 500, text: async () => 'Internal Error' };
        }
        if (url.includes('/api/health/live')) {
          if (headers['x-forwarded-proto'] !== 'https') {
            return { status: 403, json: async () => ({}) };
          }
          return { status: 200, json: async () => ({ status: 'ok' }), text: async () => JSON.stringify({ status: 'ok' }) };
        }
        if (url.includes('/api/health/ready')) {
          return {
            status: 503,
            json: async () => ({
              status: 'down',
              services: {
                database: { status: 'ok' },
                redis: { status: 'ok' },
                rabbitmq: { status: 'ok' },
                deployment: {
                  status: 'down',
                  message: 'Deployment profile is not initialized',
                },
              },
            }),
            text: async () => JSON.stringify({ status: 'down' }),
          };
        }
        return { status: 200 };
      };

      await assert.rejects(
        () => assertHttpContracts({ apiPort: 4010, webPort: 3010, httpRunner: mockHttp }),
        /Web root contract violation/
      );
    });
  });

  describe('Subprocess Timeouts and Command Execution', () => {
    it('passes bounded timeouts to all docker subprocess runner calls', async () => {
      const recordedTimeouts = [];
      const mockRunner = async ({ command, args, timeout }) => {
        recordedTimeouts.push({ command, args, timeout });
        if (args.includes('config')) {
          return { exitCode: 0, stdout: JSON.stringify(sampleValidRenderedConfig), stderr: '' };
        }
        if (args.includes('ps')) {
          return { exitCode: 0, stdout: JSON.stringify(sampleValidPsEntries), stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      await runProductionReleaseAcceptance({
        projectName: 'quanlykhupho-production-smoke',
        tempDir,
        runner: mockRunner,
        httpRunner: createMockHttpRunner(),
        build: true,
        noBuild: false,
        timeoutMs: 5000,
        pollIntervalMs: 10,
      });

      assert.strictEqual(recordedTimeouts.length >= 4, true);
      for (const entry of recordedTimeouts) {
        assert.strictEqual(typeof entry.timeout, 'number');
        assert.strictEqual(entry.timeout > 0, true);
      }
    });

    it('collectRedactedDiagnostics passes bounded timeouts to ps and logs subprocesses', async () => {
      const calls = [];
      const mockRunner = async (opts) => {
        calls.push(opts);
        return { exitCode: 0, stdout: 'ok', stderr: '' };
      };

      await collectRedactedDiagnostics({
        composeArgs: ['compose'],
        runner: mockRunner,
        secretsToRedact: [],
      });

      assert.strictEqual(calls.length, 2);
      assert.strictEqual(calls[0].timeout, DEFAULT_PS_TIMEOUT_MS);
      assert.strictEqual(calls[1].timeout, DEFAULT_LOGS_TIMEOUT_MS);
    });

    it('cleanupSmokeStack passes bounded timeout to down subprocess', async () => {
      let passedTimeout = null;
      const mockRunner = async (opts) => {
        passedTimeout = opts.timeout;
        return { exitCode: 0, stdout: 'ok', stderr: '' };
      };

      await cleanupSmokeStack({
        composeArgs: ['compose'],
        projectName: 'quanlykhupho-production-smoke',
        runner: mockRunner,
      });

      assert.strictEqual(passedTimeout, DEFAULT_DOWN_TIMEOUT_MS);
    });
  });

  describe('End-to-End Orchestrator (runProductionReleaseAcceptance)', () => {
    it('executes full successful smoke acceptance lifecycle and cleans up', async () => {
      const executedCommands = [];
      const mockRunner = async ({ command, args }) => {
        executedCommands.push({ command, args });

        if (args.includes('config')) {
          return { exitCode: 0, stdout: JSON.stringify(sampleValidRenderedConfig), stderr: '' };
        }
        if (args.includes('up')) {
          return { exitCode: 0, stdout: 'Started', stderr: '' };
        }
        if (args.includes('ps')) {
          return { exitCode: 0, stdout: JSON.stringify(sampleValidPsEntries), stderr: '' };
        }
        if (args.includes('down')) {
          return { exitCode: 0, stdout: 'Cleaned', stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      const mockHttp = createMockHttpRunner();

      const result = await runProductionReleaseAcceptance({
        projectName: 'quanlykhupho-production-smoke',
        tempDir,
        runner: mockRunner,
        httpRunner: mockHttp,
        noBuild: true,
        timeoutMs: 5000,
        pollIntervalMs: 10,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.projectName, 'quanlykhupho-production-smoke');

      // Verify sequence of Docker commands
      const actions = executedCommands.map((c) => c.args[c.args.length - 2] || c.args[c.args.length - 1]);
      assert.strictEqual(executedCommands.some((c) => c.args.includes('config')), true);
      assert.strictEqual(executedCommands.some((c) => c.args.includes('up')), true);
      assert.strictEqual(executedCommands.some((c) => c.args.includes('ps')), true);
      assert.strictEqual(executedCommands.some((c) => c.args.includes('down') && c.args.includes('-v')), true);

      // Verify down command does NOT have --remove-orphans
      const downCommand = executedCommands.find((c) => c.args.includes('down'));
      assert.strictEqual(downCommand.args.includes('--remove-orphans'), false);
      assert.strictEqual(downCommand.args.includes('-v'), true);

      // Verify temporary env file is removed from tempDir
      const remainingFiles = fs.readdirSync(tempDir);
      assert.strictEqual(remainingFiles.length, 0);
    });

    it('defaults to building images when no-build option is omitted', async () => {
      const executedCommands = [];
      const mockRunner = async ({ command, args }) => {
        executedCommands.push({ command, args });
        if (args.includes('config')) {
          return { exitCode: 0, stdout: JSON.stringify(sampleValidRenderedConfig), stderr: '' };
        }
        if (args.includes('ps')) {
          return { exitCode: 0, stdout: JSON.stringify(sampleValidPsEntries), stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      const mockHttp = createMockHttpRunner();

      await runProductionReleaseAcceptance({
        projectName: 'quanlykhupho-production-smoke',
        tempDir,
        runner: mockRunner,
        httpRunner: mockHttp,
        timeoutMs: 5000,
        pollIntervalMs: 10,
      });

      // Only the two unique images are built. migrate and sms-worker reuse api.
      const buildCommand = executedCommands.find((c) => c.args.includes('build'));
      assert.deepStrictEqual(buildCommand.args.slice(-3), ['build', 'api', 'web']);
    });

    it('builds images when build flag is set', async () => {
      const executedCommands = [];
      const mockRunner = async ({ command, args }) => {
        executedCommands.push({ command, args });
        if (args.includes('config')) {
          return { exitCode: 0, stdout: JSON.stringify(sampleValidRenderedConfig), stderr: '' };
        }
        if (args.includes('ps')) {
          return { exitCode: 0, stdout: JSON.stringify(sampleValidPsEntries), stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      const mockHttp = createMockHttpRunner();

      await runProductionReleaseAcceptance({
        projectName: 'quanlykhupho-production-smoke',
        tempDir,
        runner: mockRunner,
        httpRunner: mockHttp,
        build: true,
        noBuild: false,
        timeoutMs: 5000,
        pollIntervalMs: 10,
      });

      const buildCommand = executedCommands.find((c) => c.args.includes('build'));
      assert.deepStrictEqual(buildCommand.args.slice(-3), ['build', 'api', 'web']);
    });

    it('rejects conflicting build and no-build options', async () => {
      await assert.rejects(
        () =>
          runProductionReleaseAcceptance({
            projectName: 'quanlykhupho-production-smoke',
            tempDir,
            runner: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
            httpRunner: createMockHttpRunner(),
            build: true,
            noBuild: true,
          }),
        /Conflicting options: cannot specify both --build and --no-build/
      );
    });

    it('rejects invalid port input before invoking docker subprocesses', async () => {
      let runnerCalled = false;
      const mockRunner = async () => {
        runnerCalled = true;
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      await assert.rejects(
        () =>
          runProductionReleaseAcceptance({
            projectName: 'quanlykhupho-production-smoke',
            tempDir,
            runner: mockRunner,
            httpRunner: createMockHttpRunner(),
            apiPort: NaN,
          }),
        /Invalid API port/
      );

      assert.strictEqual(runnerCalled, false);
    });

    it('guarantees cleanup and collects redacted diagnostics on startup failure', async () => {
      const executedCommands = [];
      const mockRunner = async ({ command, args }) => {
        executedCommands.push({ command, args });
        if (args.includes('config')) {
          return { exitCode: 0, stdout: JSON.stringify(sampleValidRenderedConfig), stderr: '' };
        }
        if (args.includes('up')) {
          throw new Error('Database container failed: password=super_secret_123456');
        }
        if (args.includes('logs')) {
          return { exitCode: 0, stdout: 'Container error with secret password=super_secret_123456', stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      await assert.rejects(
        () =>
          runProductionReleaseAcceptance({
            projectName: 'quanlykhupho-production-smoke',
            tempDir,
            runner: mockRunner,
            httpRunner: createMockHttpRunner(),
            noBuild: true,
          }),
        /Database container failed: password=\*\*\*/
      );

      // Cleanup should still be called
      const downCommand = executedCommands.find((c) => c.args.includes('down'));
      assert.strictEqual(Boolean(downCommand), true);

      // Temp env file should still be deleted
      const remainingFiles = fs.readdirSync(tempDir);
      assert.strictEqual(remainingFiles.length, 0);
    });

    it('guarantees cleanup and fails when polling readiness times out', async () => {
      const executedCommands = [];
      const mockRunner = async ({ command, args }) => {
        executedCommands.push({ command, args });
        if (args.includes('config')) {
          return { exitCode: 0, stdout: JSON.stringify(sampleValidRenderedConfig), stderr: '' };
        }
        if (args.includes('ps')) {
          // Always starting (never healthy)
          return {
            exitCode: 0,
            stdout: JSON.stringify([
              { Service: 'postgres', State: 'running', Health: 'starting' },
              { Service: 'redis', State: 'running', Health: 'healthy' },
              { Service: 'rabbitmq', State: 'running', Health: 'healthy' },
              { Service: 'migrate', State: 'running' },
              { Service: 'api', State: 'running', Health: 'starting' },
              { Service: 'sms-worker', State: 'running', Restarts: 0 },
              { Service: 'web', State: 'running', Health: 'starting' },
            ]),
            stderr: '',
          };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      await assert.rejects(
        () =>
          runProductionReleaseAcceptance({
            projectName: 'quanlykhupho-production-smoke',
            tempDir,
            runner: mockRunner,
            httpRunner: createMockHttpRunner(),
            noBuild: true,
            timeoutMs: 50,
            pollIntervalMs: 10,
          }),
        /Timeout \(50ms\) waiting for smoke services readiness/
      );

      const downCommand = executedCommands.find((c) => c.args.includes('down'));
      assert.strictEqual(Boolean(downCommand), true);
      assert.strictEqual(fs.readdirSync(tempDir).length, 0);
    });

    it('fails closed when smoke stack cleanup fails after successful checks', async () => {
      const mockRunner = async ({ args }) => {
        if (args.includes('config')) {
          return { exitCode: 0, stdout: JSON.stringify(sampleValidRenderedConfig), stderr: '' };
        }
        if (args.includes('ps')) {
          return { exitCode: 0, stdout: JSON.stringify(sampleValidPsEntries), stderr: '' };
        }
        if (args.includes('down')) {
          throw new Error('cleanup refused');
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      await assert.rejects(
        () =>
          runProductionReleaseAcceptance({
            projectName: 'quanlykhupho-production-smoke',
            tempDir,
            runner: mockRunner,
            httpRunner: createMockHttpRunner(),
            noBuild: true,
            timeoutMs: 5000,
            pollIntervalMs: 10,
          }),
        /Smoke stack cleanup failed: cleanup refused/
      );

      assert.strictEqual(fs.readdirSync(tempDir).length, 0);
    });
  });
});
