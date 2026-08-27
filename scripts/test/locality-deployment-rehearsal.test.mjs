import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DEFAULT_BASE_COMPOSE_FILE,
  DEFAULT_REHEARSAL_COMPOSE_FILE,
  DEFAULT_REHEARSAL_PROJECT_NAME,
  DEFAULT_APP_IMAGE_TAG,
  DEFAULT_REHEARSAL_API_PORT,
  DEFAULT_REHEARSAL_WEB_PORT,
  DEFAULT_PROFILE_SLUG,
  AUTOMATED_REHEARSAL_CONFIRMED_BY,
  parseArgs,
  validateRehearsalOptions,
  validateSourceDraftPackage,
  loadAndValidateSourceDraft,
  materializeTemporaryRehearsalClone,
  cleanupTemporaryRehearsalClone,
  generateRehearsalEnvironment,
  createTempEnvFile,
  cleanupTempEnvFile,
  redactSensitiveOutput,
  validateRehearsalProjectIdentity,
  parseComposeConfig,
  validateRenderedRehearsalComposeConfig,
  parseComposePsOutput,
  normalizeServicePsEntry,
  checkRehearsalServicesReadiness,
  unwrapApiResponse,
  assertRehearsalRuntimeContracts,
  collectRehearsalRedactedDiagnostics,
  cleanupRehearsalStack,
  runLocalityDeploymentRehearsal,
} from '../lib/locality-deployment-rehearsal.mjs';

const sampleValidDraftPackage = {
  schemaVersion: 1,
  slug: 'cho-quan',
  confirmed: false,
  locality: {
    code: '27301',
    name: 'Phường Chợ Quán',
    level: 'ward',
    provinceCode: '79',
    provinceName: 'Thành phố Hồ Chí Minh',
  },
  branding: {
    brandName: 'UBND Phường Chợ Quán',
  },
  contact: {
    hotline: '028 39555555',
    portalUrl: 'https://phuongchoquan.vn',
  },
  settings: {
    timezone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
  },
  neighborhoods: Array.from({ length: 25 }, (_, i) => {
    const num = String(i + 1).padStart(2, '0');
    return { code: `KP-${num}`, name: `Khu phố ${i + 1}` };
  }),
};

const sampleValidRenderedConfig = {
  name: 'quanlykhupho-locality-rehearsal',
  services: {
    postgres: { container_name: 'quanlykhupho-postgres-rehearsal' },
    redis: { container_name: 'quanlykhupho-redis-rehearsal' },
    rabbitmq: { container_name: 'quanlykhupho-rabbitmq-rehearsal' },
    migrate: { container_name: 'quanlykhupho-migrate-rehearsal' },
    'locality-init': {
      container_name: 'quanlykhupho-locality-init-rehearsal',
      volumes: [
        {
          type: 'bind',
          source: '/tmp/deployments',
          target: '/app/deployments',
          read_only: true,
        },
      ],
    },
    api: {
      container_name: 'quanlykhupho-api-rehearsal',
      ports: [
        {
          mode: 'ingress',
          target: 4000,
          published: '4011',
          protocol: 'tcp',
          host_ip: '127.0.0.1',
        },
      ],
    },
    'sms-worker': { container_name: 'quanlykhupho-worker-rehearsal' },
    web: {
      container_name: 'quanlykhupho-web-rehearsal',
      ports: [
        {
          mode: 'ingress',
          target: 3000,
          published: '3011',
          protocol: 'tcp',
          host_ip: '127.0.0.1',
        },
      ],
    },
  },
  volumes: {
    postgres_data: { name: 'quanlykhupho_postgres_rehearsal_data' },
    redis_data: { name: 'quanlykhupho_redis_rehearsal_data' },
    rabbitmq_data: { name: 'quanlykhupho_rabbitmq_rehearsal_data' },
    uploads_data: { name: 'quanlykhupho_uploads_rehearsal_data' },
  },
  networks: {
    application: { name: 'quanlykhupho_application_rehearsal' },
    data: { name: 'quanlykhupho_data_rehearsal' },
  },
};

const sampleValidPsEntries = [
  { Service: 'postgres', Name: 'quanlykhupho-postgres-rehearsal', State: 'running', Health: 'healthy' },
  { Service: 'redis', Name: 'quanlykhupho-redis-rehearsal', State: 'running', Health: 'healthy' },
  { Service: 'rabbitmq', Name: 'quanlykhupho-rabbitmq-rehearsal', State: 'running', Health: 'healthy' },
  { Service: 'migrate', Name: 'quanlykhupho-migrate-rehearsal', State: 'exited', ExitCode: 0 },
  { Service: 'locality-init', Name: 'quanlykhupho-locality-init-rehearsal', State: 'exited', ExitCode: 0 },
  { Service: 'api', Name: 'quanlykhupho-api-rehearsal', State: 'running', Health: 'healthy' },
  { Service: 'sms-worker', Name: 'quanlykhupho-worker-rehearsal', State: 'running', Health: '', Restarts: 0 },
  { Service: 'web', Name: 'quanlykhupho-web-rehearsal', State: 'running', Health: 'healthy' },
];

function createMockHttpRunner(overrides = {}, pkg = sampleValidDraftPackage) {
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
        json: async () => ({ success: true, data: { status: 'ok', version: '0.1.0' } }),
        text: async () => JSON.stringify({ success: true, data: { status: 'ok', version: '0.1.0' } }),
      };
    }

    if (url.includes('/api/health/ready')) {
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
        json: async () => ({
          success: true,
          data: {
            status: 'ok',
            services: {
              database: { status: 'ok' },
              redis: { status: 'ok' },
              rabbitmq: { status: 'ok' },
              deployment: { status: 'ok', message: 'Deployment profile is confirmed' },
            },
          },
        }),
        text: async () =>
          JSON.stringify({
            success: true,
            data: {
              status: 'ok',
              services: {
                database: { status: 'ok' },
                redis: { status: 'ok' },
                rabbitmq: { status: 'ok' },
                deployment: { status: 'ok', message: 'Deployment profile is confirmed' },
              },
            },
          }),
      };
    }

    if (url.includes('/api/deployment-profile')) {
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
        json: async () => ({
          success: true,
          data: {
            initialized: true,
            profile: {
              schemaVersion: pkg.schemaVersion,
              slug: pkg.slug,
              localityCode: pkg.locality.code,
              localityName: pkg.locality.name,
              localityLevel: pkg.locality.level,
              provinceCode: pkg.locality.provinceCode,
              provinceName: pkg.locality.provinceName,
              districtName: pkg.locality.district ?? null,
              timezone: 'Asia/Ho_Chi_Minh',
              locale: 'vi-VN',
              brandName: pkg.branding.brandName,
              supportEmail: null,
              supportHotline: pkg.contact?.hotline ?? null,
              portalUrl: pkg.contact?.portalUrl ?? null,
              confirmed: true,
              confirmedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        }),
        text: async () =>
          JSON.stringify({
            success: true,
            data: {
              initialized: true,
              profile: {
                schemaVersion: pkg.schemaVersion,
                slug: pkg.slug,
                localityCode: pkg.locality.code,
                localityName: pkg.locality.name,
                localityLevel: pkg.locality.level,
                provinceCode: pkg.locality.provinceCode,
                provinceName: pkg.locality.provinceName,
                districtName: pkg.locality.district ?? null,
                timezone: 'Asia/Ho_Chi_Minh',
                locale: 'vi-VN',
                brandName: pkg.branding.brandName,
                supportEmail: null,
                supportHotline: pkg.contact?.hotline ?? null,
                portalUrl: pkg.contact?.portalUrl ?? null,
                confirmed: true,
                confirmedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          }),
      };
    }

    if (url.includes('/api/neighborhoods')) {
      if (forwardedProto !== 'https') {
        return {
          status: 403,
          ok: false,
          json: async () => ({ statusCode: 403, message: 'HTTPS connection is required' }),
          text: async () => JSON.stringify({ statusCode: 403, message: 'HTTPS connection is required' }),
        };
      }
      const list = pkg.neighborhoods.map((n, idx) => ({
        id: `mock-id-${idx + 1}`,
        code: n.code,
        name: n.name,
        ward: pkg.locality.name,
        district: pkg.locality.district ?? null,
        city: pkg.locality.provinceName,
        description: n.description ?? null,
      }));
      return {
        status: 200,
        ok: true,
        json: async () => ({ success: true, data: list }),
        text: async () => JSON.stringify({ success: true, data: list }),
      };
    }

    if (url.endsWith(':3011/') || url.endsWith(':3000/') || url.endsWith('/')) {
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

describe('Locality Deployment Rehearsal (LDR-1)', () => {
  let tempTestDir;

  beforeEach(() => {
    tempTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ldr-test-'));
  });

  afterEach(() => {
    if (tempTestDir && fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  });

  describe('Option Validation (validateRehearsalOptions)', () => {
    it('accepts valid default and custom options', () => {
      assert.strictEqual(validateRehearsalOptions({}), true);
      assert.strictEqual(
        validateRehearsalOptions({
          build: true,
          imageTag: 'test-v1.0',
          profile: 'cho-quan',
          apiPort: 4011,
          webPort: 3011,
          timeoutMs: 60000,
          pollIntervalMs: 500,
        }),
        true
      );
    });

    it('rejects conflicting --build and --no-build flags', () => {
      assert.throws(
        () => validateRehearsalOptions({ build: true, noBuild: true }),
        /Conflicting options: cannot specify both --build and --no-build/
      );
    });

    it('rejects invalid imageTag format', () => {
      assert.throws(
        () => validateRehearsalOptions({ imageTag: ' ' }),
        /Invalid image tag/
      );
      assert.throws(
        () => validateRehearsalOptions({ imageTag: 'invalid tag with spaces' }),
        /Invalid image tag format/
      );
    });

    it('rejects invalid profile slug', () => {
      assert.throws(
        () => validateRehearsalOptions({ profile: '' }),
        /Invalid profile slug or path/
      );
      assert.throws(
        () => validateRehearsalOptions({ profile: '   ' }),
        /Invalid profile slug or path/
      );
    });

    it('rejects invalid API and Web ports', () => {
      assert.throws(() => validateRehearsalOptions({ apiPort: 0 }), /Invalid API port/);
      assert.throws(() => validateRehearsalOptions({ apiPort: 70000 }), /Invalid API port/);
      assert.throws(() => validateRehearsalOptions({ apiPort: 'abc' }), /Invalid API port/);
      assert.throws(() => validateRehearsalOptions({ webPort: -1 }), /Invalid Web port/);
      assert.throws(() => validateRehearsalOptions({ webPort: 99999 }), /Invalid Web port/);
    });

    it('rejects port collision between API port and Web port', () => {
      assert.throws(
        () => validateRehearsalOptions({ apiPort: 4011, webPort: 4011 }),
        /Port collision: API port and Web port cannot be the same/
      );
    });

    it('rejects invalid timeout and poll interval', () => {
      assert.throws(() => validateRehearsalOptions({ timeoutMs: 0 }), /Invalid timeout/);
      assert.throws(() => validateRehearsalOptions({ timeoutMs: -100 }), /Invalid timeout/);
      assert.throws(() => validateRehearsalOptions({ timeoutMs: 'invalid' }), /Invalid timeout/);
      assert.throws(() => validateRehearsalOptions({ pollIntervalMs: 0 }), /Invalid poll interval/);
      assert.throws(() => validateRehearsalOptions({ pollIntervalMs: -5 }), /Invalid poll interval/);
    });
  });

  describe('Source Draft Safety Gate (validateSourceDraftPackage & loadAndValidateSourceDraft)', () => {
    it('accepts valid unconfirmed draft package', () => {
      assert.strictEqual(validateSourceDraftPackage(sampleValidDraftPackage), true);
    });

    it('refuses rehearsal if source package is already confirmed (confirmed=true)', () => {
      const confirmedPkg = {
        ...sampleValidDraftPackage,
        confirmed: true,
        confirmedAt: '2026-08-27T00:00:00.000Z',
        confirmedBy: 'Officer',
      };
      assert.throws(
        () => validateSourceDraftPackage(confirmedPkg),
        /Rehearsal safety gate violation: source package for "cho-quan" must be an unconfirmed draft \(confirmed=false\)/
      );
    });

    it('refuses rehearsal if source draft contains confirmedAt field', () => {
      const pkgWithConfirmedAt = {
        ...sampleValidDraftPackage,
        confirmed: false,
        confirmedAt: '2026-08-27T00:00:00.000Z',
      };
      assert.throws(
        () => validateSourceDraftPackage(pkgWithConfirmedAt),
        /Rehearsal safety gate violation: source draft package for "cho-quan" must not contain "confirmedAt" field/
      );
    });

    it('refuses rehearsal if source draft contains confirmedBy field', () => {
      const pkgWithConfirmedBy = {
        ...sampleValidDraftPackage,
        confirmed: false,
        confirmedBy: 'Admin',
      };
      assert.throws(
        () => validateSourceDraftPackage(pkgWithConfirmedBy),
        /Rehearsal safety gate violation: source draft package for "cho-quan" must not contain "confirmedBy" field/
      );
    });

    it('rejects corrupted schema or missing required sections', () => {
      assert.throws(() => validateSourceDraftPackage(null), /expected a JSON object/);
      assert.throws(() => validateSourceDraftPackage({ schemaVersion: 2 }), /unsupported schemaVersion/);
      assert.throws(() => validateSourceDraftPackage({ schemaVersion: 1, slug: '' }), /missing or invalid "slug"/);
      assert.throws(
        () => validateSourceDraftPackage({ schemaVersion: 1, slug: 'test', confirmed: false }),
        /missing "locality" object/
      );
      assert.throws(
        () =>
          validateSourceDraftPackage({
            ...sampleValidDraftPackage,
            neighborhoods: [],
          }),
        /"neighborhoods" must be a non-empty array/
      );
    });

    it('loads and verifies the real Cho Quan package from repository as a valid draft', () => {
      const { sourcePath, sourcePackage } = loadAndValidateSourceDraft('cho-quan');
      assert.ok(fs.existsSync(sourcePath));
      assert.strictEqual(sourcePackage.slug, 'cho-quan');
      assert.strictEqual(sourcePackage.confirmed, false);
      assert.strictEqual(sourcePackage.confirmedAt, undefined);
      assert.strictEqual(sourcePackage.confirmedBy, undefined);
      assert.strictEqual(sourcePackage.locality.code, '27301');
      assert.strictEqual(sourcePackage.locality.name, 'Phường Chợ Quán');
      assert.strictEqual(sourcePackage.neighborhoods.length, 25);
    });
  });

  describe('Temporary Clone Materialization & Cleanup', () => {
    it('materializes temporary test-only clone with automated rehearsal confirmation note', () => {
      const { tempDeploymentsDir, clonedPackagePath, clonedPackage } =
        materializeTemporaryRehearsalClone(sampleValidDraftPackage, { tempDir: tempTestDir });

      assert.ok(fs.existsSync(tempDeploymentsDir));
      assert.ok(fs.existsSync(clonedPackagePath));

      // Verifies clone has confirmed=true and clear automated rehearsal statement
      assert.strictEqual(clonedPackage.confirmed, true);
      assert.ok(typeof clonedPackage.confirmedAt === 'string');
      assert.strictEqual(clonedPackage.confirmedBy, AUTOMATED_REHEARSAL_CONFIRMED_BY);
      assert.ok(clonedPackage.confirmedBy.includes('Automated Locality Rehearsal'));
      assert.ok(clonedPackage.confirmedBy.includes('NOT Operational Approval'));

      // Verifies all 25 neighborhoods and locality metadata are identical
      assert.strictEqual(clonedPackage.slug, sampleValidDraftPackage.slug);
      assert.strictEqual(clonedPackage.locality.code, sampleValidDraftPackage.locality.code);
      assert.strictEqual(clonedPackage.neighborhoods.length, 25);
      assert.deepStrictEqual(clonedPackage.neighborhoods, sampleValidDraftPackage.neighborhoods);

      // Verifies on-disk file content
      const diskContent = JSON.parse(fs.readFileSync(clonedPackagePath, 'utf8'));
      assert.strictEqual(diskContent.confirmed, true);
      assert.strictEqual(diskContent.confirmedBy, AUTOMATED_REHEARSAL_CONFIRMED_BY);

      // Cleans up
      cleanupTemporaryRehearsalClone(tempDeploymentsDir);
      assert.strictEqual(fs.existsSync(tempDeploymentsDir), false);
    });

    it('handles cleanup gracefully when directory is missing or invalid', () => {
      assert.strictEqual(cleanupTemporaryRehearsalClone(null), true);
      assert.strictEqual(cleanupTemporaryRehearsalClone(''), true);
      assert.strictEqual(cleanupTemporaryRehearsalClone('/tmp/nonexistent-dir-12345'), true);
    });

    it('refuses to recursively remove a directory without the rehearsal marker', () => {
      const untrustedDir = path.join(tempTestDir, 'locality-rehearsal-untrusted');
      fs.mkdirSync(untrustedDir);
      assert.throws(
        () => cleanupTemporaryRehearsalClone(untrustedDir),
        /Refusing to remove unrecognized rehearsal directory/
      );
      assert.strictEqual(fs.existsSync(untrustedDir), true);
    });
  });

  describe('Environment Generation & Temp Env File', () => {
    it('generates complete ephemeral environment with isolated database and random secrets', () => {
      const env = generateRehearsalEnvironment({
        projectName: 'quanlykhupho-locality-rehearsal',
        imageTag: 'verify',
        apiPort: 4011,
        webPort: 3011,
        profileSlug: 'cho-quan',
        tempDeploymentsDir: '/tmp/test-deployments',
      });

      assert.strictEqual(env.COMPOSE_PROJECT_NAME, 'quanlykhupho-locality-rehearsal');
      assert.strictEqual(env.APP_IMAGE_TAG, 'verify');
      assert.strictEqual(env.API_PORT, '4011');
      assert.strictEqual(env.WEB_PORT, '3011');
      assert.strictEqual(env.DEPLOYMENT_PROFILE, 'cho-quan');
      assert.strictEqual(env.LOCALITY_DEPLOYMENTS_DIR, '/tmp/test-deployments');
      assert.strictEqual(env.DEPLOYMENTS_DIR, '/app/deployments');
      assert.strictEqual(env.POSTGRES_DB, 'quanlykhupho_rehearsal');
      assert.ok(env.DATABASE_URL.includes('quanlykhupho_rehearsal'));
      assert.ok(env.PHONE_ENCRYPTION_KEY.length >= 32);
      assert.ok(env.OTP_PEPPER.length >= 32);

      // Write and cleanup temp env file
      const tempEnvPath = createTempEnvFile(env, tempTestDir);
      assert.ok(fs.existsSync(tempEnvPath));
      const content = fs.readFileSync(tempEnvPath, 'utf8');
      assert.ok(content.includes('COMPOSE_PROJECT_NAME=quanlykhupho-locality-rehearsal'));
      assert.ok(content.includes('DEPLOYMENT_PROFILE=cho-quan'));

      cleanupTempEnvFile(tempEnvPath);
      assert.strictEqual(fs.existsSync(tempEnvPath), false);
    });
  });

  describe('Project Identity & Compose Config Validation', () => {
    it('validates rehearsal project identity strictly', () => {
      assert.strictEqual(
        validateRehearsalProjectIdentity({
          projectName: 'quanlykhupho-locality-rehearsal',
          composeFiles: ['docker/docker-compose.production.yml', 'docker/docker-compose.locality-rehearsal.yml'],
        }),
        true
      );

      assert.throws(
        () => validateRehearsalProjectIdentity({ projectName: 'quanlykhupho-production' }),
        /Dangerous project name rejected/
      );
      assert.throws(
        () => validateRehearsalProjectIdentity({ projectName: 'quanlykhupho' }),
        /Dangerous project name rejected/
      );
      assert.throws(
        () => validateRehearsalProjectIdentity({ projectName: 'quanlykhupho-production-smoke' }),
        /Dangerous project name rejected/
      );
      assert.throws(
        () =>
          validateRehearsalProjectIdentity({
            projectName: 'quanlykhupho-locality-rehearsal',
            composeFiles: ['docker/docker-compose.production.yml'],
          }),
        /Dangerous Compose execution rejected/
      );
    });

    it('validates rendered rehearsal compose configuration correctly', () => {
      assert.strictEqual(validateRenderedRehearsalComposeConfig(sampleValidRenderedConfig), true);

      // Rejects non-rehearsal project name
      assert.throws(
        () => validateRenderedRehearsalComposeConfig({ ...sampleValidRenderedConfig, name: 'production' }),
        /Compose project name "production" is not isolated for locality rehearsal/
      );

      // Rejects missing locality-init service
      const configWithoutInit = {
        ...sampleValidRenderedConfig,
        services: { ...sampleValidRenderedConfig.services },
      };
      delete configWithoutInit.services['locality-init'];
      assert.throws(
        () => validateRenderedRehearsalComposeConfig(configWithoutInit),
        /Missing expected service "locality-init"/
      );

      // Rejects locality-init without read-only volume mount
      const configWithRwInit = {
        ...sampleValidRenderedConfig,
        services: {
          ...sampleValidRenderedConfig.services,
          'locality-init': {
            container_name: 'quanlykhupho-locality-init-rehearsal',
            volumes: [
              {
                type: 'bind',
                source: '/tmp/deployments',
                target: '/app/deployments',
                read_only: false,
              },
            ],
          },
        },
      };
      assert.throws(
        () => validateRenderedRehearsalComposeConfig(configWithRwInit),
        /Service "locality-init" must mount deployments directory in read-only mode/
      );

      // Rejects non-loopback host port
      const configWithPublicPort = {
        ...sampleValidRenderedConfig,
        services: {
          ...sampleValidRenderedConfig.services,
          api: {
            container_name: 'quanlykhupho-api-rehearsal',
            ports: [{ mode: 'ingress', target: 4000, published: '4011', host_ip: '0.0.0.0' }],
          },
        },
      };
      assert.throws(
        () => validateRenderedRehearsalComposeConfig(configWithPublicPort),
        /Service "api" exposes port on non-loopback interface/
      );
    });
  });

  describe('Service Readiness Checks (checkRehearsalServicesReadiness)', () => {
    it('reports ready when all services including locality-init are healthy and completed', () => {
      const readiness = checkRehearsalServicesReadiness(sampleValidPsEntries);
      assert.strictEqual(readiness.ready, true);
      assert.strictEqual(readiness.pending.length, 0);
      assert.strictEqual(readiness.failures.length, 0);
    });

    it('reports pending when locality-init or migrate is still running', () => {
      const runningInitEntries = sampleValidPsEntries.map((e) =>
        e.Service === 'locality-init' ? { ...e, State: 'running' } : e
      );
      const readiness = checkRehearsalServicesReadiness(runningInitEntries);
      assert.strictEqual(readiness.ready, false);
      assert.ok(readiness.pending.some((p) => p.includes('locality-init (running)')));
    });

    it('reports failure when locality-init exits with non-zero code', () => {
      const failedInitEntries = sampleValidPsEntries.map((e) =>
        e.Service === 'locality-init' ? { ...e, State: 'exited', ExitCode: 1 } : e
      );
      const readiness = checkRehearsalServicesReadiness(failedInitEntries);
      assert.strictEqual(readiness.ready, false);
      assert.ok(readiness.failures.some((f) => f.includes('locality-init container exited with error code 1')));
    });

    it('reports failure when migrate exits with non-zero code', () => {
      const failedMigrateEntries = sampleValidPsEntries.map((e) =>
        e.Service === 'migrate' ? { ...e, State: 'exited', ExitCode: 1 } : e
      );
      const readiness = checkRehearsalServicesReadiness(failedMigrateEntries);
      assert.strictEqual(readiness.ready, false);
      assert.ok(readiness.failures.some((f) => f.includes('migrate container exited with error code 1')));
    });

    it('reports failure when sms-worker has restarts > 0', () => {
      const restartedWorkerEntries = sampleValidPsEntries.map((e) =>
        e.Service === 'sms-worker' ? { ...e, Restarts: 2 } : e
      );
      const readiness = checkRehearsalServicesReadiness(restartedWorkerEntries);
      assert.strictEqual(readiness.ready, false);
      assert.ok(readiness.failures.some((f) => f.includes('sms-worker has restarted 2 time(s)')));
    });

    it('reports failure when a service becomes unhealthy', () => {
      const unhealthyEntries = sampleValidPsEntries.map((e) =>
        e.Service === 'api' ? { ...e, Health: 'unhealthy' } : e
      );
      const readiness = checkRehearsalServicesReadiness(unhealthyEntries);
      assert.strictEqual(readiness.ready, false);
      assert.ok(readiness.failures.some((f) => f.includes('api healthcheck failed (unhealthy)')));
    });
  });

  describe('Runtime Contract Assertions (assertRehearsalRuntimeContracts)', () => {
    it('verifies all HTTP runtime contracts successfully against mock HTTP runner', async () => {
      const httpRunner = createMockHttpRunner({}, sampleValidDraftPackage);
      const results = await assertRehearsalRuntimeContracts({
        apiPort: 4011,
        webPort: 3011,
        httpRunner,
        expectedPackage: sampleValidDraftPackage,
      });

      assert.strictEqual(results.plainHttp.status, 403);
      assert.strictEqual(results.liveness.status, 200);
      assert.strictEqual(results.readiness.status, 200);
      assert.strictEqual(results.readiness.body.services.deployment.status, 'ok');
      assert.strictEqual(results.readiness.body.services.deployment.status, 'ok');
      assert.strictEqual(results.deploymentProfile.status, 200);
      assert.strictEqual(results.deploymentProfile.body.initialized, true);
      assert.strictEqual(results.deploymentProfile.body.profile.slug, 'cho-quan');
      assert.strictEqual(results.deploymentProfile.body.profile.localityName, 'Phường Chợ Quán');
      assert.strictEqual(results.neighborhoods.status, 200);
      assert.strictEqual(results.neighborhoods.count, 25);
      assert.strictEqual(results.webRoot.status, 200);
    });

    it('violates plain HTTP contract if plain request is not rejected with 403', async () => {
      const httpRunner = createMockHttpRunner({
        'http://127.0.0.1:4011/api/health/live': async (url, opts) => {
          if (!opts.headers || !opts.headers['x-forwarded-proto']) {
            return { status: 200, ok: true, json: async () => ({ status: 'ok' }), text: async () => '{}' };
          }
          return { status: 200, ok: true, json: async () => ({ status: 'ok' }), text: async () => '{}' };
        },
      });

      await assert.rejects(
        () =>
          assertRehearsalRuntimeContracts({
            apiPort: 4011,
            webPort: 3011,
            httpRunner,
            expectedPackage: sampleValidDraftPackage,
          }),
        /Plain HTTP contract violation: expected 403 Forbidden/
      );
    });

    it('violates readiness contract if deployment service is not initialized', async () => {
      const httpRunner = createMockHttpRunner({
        'http://127.0.0.1:4011/api/health/ready': async () => ({
          status: 503,
          ok: false,
          json: async () => ({
            success: true,
            data: { status: 'down', services: { deployment: { status: 'down' } } },
          }),
          text: async () => '{}',
        }),
      });

      await assert.rejects(
        () =>
          assertRehearsalRuntimeContracts({
            apiPort: 4011,
            webPort: 3011,
            httpRunner,
            expectedPackage: sampleValidDraftPackage,
          }),
        /HTTPS readiness contract violation: expected 200 OK/
      );
    });

    it('violates deployment profile contract if internal singletonKey or confirmedBy is exposed', async () => {
      const httpRunner = createMockHttpRunner({
        'http://127.0.0.1:4011/api/deployment-profile': async () => ({
          status: 200,
          ok: true,
          json: async () => ({
            success: true,
            data: {
              initialized: true,
              profile: {
                slug: 'cho-quan',
                localityCode: '27301',
                localityName: 'Phường Chợ Quán',
                confirmed: true,
                singletonKey: 'SINGLETON', // LEAK!
              },
            },
          }),
          text: async () => '{}',
        }),
      });

      await assert.rejects(
        () =>
          assertRehearsalRuntimeContracts({
            apiPort: 4011,
            webPort: 3011,
            httpRunner,
            expectedPackage: sampleValidDraftPackage,
          }),
        /Deployment profile leak violation/
      );
    });

    it('violates neighborhoods contract if neighborhood count or codes mismatch', async () => {
      const httpRunner = createMockHttpRunner({
        'http://127.0.0.1:4011/api/neighborhoods': async () => ({
          status: 200,
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: '1', code: 'KP-01', name: 'Khu phố 1', ward: 'Phường Chợ Quán' }], // only 1 instead of 25
          }),
          text: async () => '{}',
        }),
      });

      await assert.rejects(
        () =>
          assertRehearsalRuntimeContracts({
            apiPort: 4011,
            webPort: 3011,
            httpRunner,
            expectedPackage: sampleValidDraftPackage,
          }),
        /Neighborhoods count mismatch: expected 25, received 1/
      );
    });
  });

  describe('Diagnostics Redaction (collectRehearsalRedactedDiagnostics)', () => {
    it('redacts database passwords, keys, and pepper from diagnostics output', async () => {
      const secretPass = 'super_secret_pg_pass_12345';
      const secretKey = 'encryption_secret_key_99999';

      const mockRunner = async ({ args }) => {
        if (args.includes('ps')) {
          return { stdout: `ps output: POSTGRES_PASSWORD=${secretPass}` };
        }
        if (args.includes('logs')) {
          return { stdout: `logs output: Connecting to postgresql://user:${secretPass}@postgres:5432 with key ${secretKey}` };
        }
        return { stdout: '' };
      };

      const diagnostics = await collectRehearsalRedactedDiagnostics({
        composeArgs: ['compose'],
        runner: mockRunner,
        secretsToRedact: [secretPass, secretKey],
      });

      assert.ok(!diagnostics.includes(secretPass));
      assert.ok(!diagnostics.includes(secretKey));
      assert.ok(diagnostics.includes('***REDACTED***'));
    });
  });

  describe('Full Rehearsal Orchestration (runLocalityDeploymentRehearsal)', () => {
    it('successfully orchestrates end-to-end rehearsal with mock runner and cleans up in finally', async () => {
      const executedCommands = [];
      const mockRunner = async ({ command, args }) => {
        executedCommands.push({ command, args: args.join(' ') });

        if (args.includes('config')) {
          return {
            exitCode: 0,
            stdout: JSON.stringify(sampleValidRenderedConfig),
            stderr: '',
          };
        }
        if (args.includes('build') || args.includes('up') || args.includes('down')) {
          return { exitCode: 0, stdout: 'ok', stderr: '' };
        }
        if (args.includes('ps')) {
          return {
            exitCode: 0,
            stdout: JSON.stringify(sampleValidPsEntries),
            stderr: '',
          };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      const httpRunner = createMockHttpRunner({}, sampleValidDraftPackage);
      const mockLogger = { log: () => {}, error: () => {} };

      const result = await runLocalityDeploymentRehearsal({
        profile: 'cho-quan',
        runner: mockRunner,
        httpRunner,
        logger: mockLogger,
        tempDir: tempTestDir,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.projectName, DEFAULT_REHEARSAL_PROJECT_NAME);
      assert.strictEqual(result.profile, 'cho-quan');
      assert.strictEqual(result.neighborhoodsCount, 25);
      assert.strictEqual(result.apiPort, DEFAULT_REHEARSAL_API_PORT);
      assert.strictEqual(result.webPort, DEFAULT_REHEARSAL_WEB_PORT);

      // Verifies down -v was executed in finally cleanup
      const hasDown = executedCommands.some((c) => c.args.includes('down -v'));
      assert.strictEqual(hasDown, true);

      // Verifies tracked source file remains draft (confirmed=false)
      const trackedContent = JSON.parse(fs.readFileSync('deployments/cho-quan/deployment.json', 'utf8'));
      assert.strictEqual(trackedContent.confirmed, false);
      assert.strictEqual(trackedContent.confirmedAt, undefined);
      assert.strictEqual(trackedContent.confirmedBy, undefined);
    });

    it('performs guaranteed cleanup in finally when configuration validation fails', async () => {
      const executedCommands = [];
      const mockRunner = async ({ command, args }) => {
        executedCommands.push({ command, args: args.join(' ') });
        if (args.includes('config')) {
          return {
            exitCode: 0,
            stdout: JSON.stringify({ ...sampleValidRenderedConfig, name: 'invalid-name' }),
            stderr: '',
          };
        }
        if (args.includes('down')) {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      const mockLogger = { log: () => {}, error: () => {} };

      await assert.rejects(
        () =>
          runLocalityDeploymentRehearsal({
            profile: 'cho-quan',
            runner: mockRunner,
            httpRunner: createMockHttpRunner(),
            logger: mockLogger,
            tempDir: tempTestDir,
          }),
        /Compose project name "invalid-name" is not isolated for locality rehearsal/
      );
    });

    it('performs guaranteed cleanup and collects diagnostics in finally when service fails', async () => {
      const executedCommands = [];
      const mockRunner = async ({ command, args }) => {
        executedCommands.push({ command, args: args.join(' ') });
        if (args.includes('config')) {
          return { exitCode: 0, stdout: JSON.stringify(sampleValidRenderedConfig), stderr: '' };
        }
        if (args.includes('build') || args.includes('up') || args.includes('down')) {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (args.includes('ps')) {
          const failedPs = sampleValidPsEntries.map((e) =>
            e.Service === 'locality-init' ? { ...e, State: 'exited', ExitCode: 1 } : e
          );
          return { exitCode: 0, stdout: JSON.stringify(failedPs), stderr: '' };
        }
        if (args.includes('logs')) {
          return { exitCode: 0, stdout: 'Locality init error log', stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      const mockLogger = { log: () => {}, error: () => {} };

      await assert.rejects(
        () =>
          runLocalityDeploymentRehearsal({
            profile: 'cho-quan',
            runner: mockRunner,
            httpRunner: createMockHttpRunner(),
            logger: mockLogger,
            tempDir: tempTestDir,
          }),
        /locality-init container exited with error code 1/
      );

      // Verifies down -v was executed
      assert.ok(executedCommands.some((c) => c.args.includes('down -v')));
    });

    it('refuses immediately if source package is confirmed=true without starting stack', async () => {
      const confirmedFakeDir = path.join(tempTestDir, 'fake-confirmed-deployments');
      const fakeSlugDir = path.join(confirmedFakeDir, 'fake-ward');
      fs.mkdirSync(fakeSlugDir, { recursive: true });
      fs.writeFileSync(
        path.join(fakeSlugDir, 'deployment.json'),
        JSON.stringify({ ...sampleValidDraftPackage, slug: 'fake-ward', confirmed: true, confirmedBy: 'Officer' })
      );

      const executedCommands = [];
      const mockRunner = async ({ command, args }) => {
        executedCommands.push({ command, args: args.join(' ') });
        return { exitCode: 0, stdout: '', stderr: '' };
      };

      await assert.rejects(
        () =>
          runLocalityDeploymentRehearsal({
            profile: 'fake-ward',
            customDeploymentsDir: confirmedFakeDir,
            runner: mockRunner,
            httpRunner: createMockHttpRunner(),
            logger: { log: () => {}, error: () => {} },
            tempDir: tempTestDir,
          }),
        /Rehearsal safety gate violation: source package for "fake-ward" must be an unconfirmed draft \(confirmed=false\)/
      );

      // No container command should have executed
      assert.strictEqual(executedCommands.length, 0);
    });
  });

  describe('CLI Help & Argument Parsing', () => {
    it('parses CLI arguments accurately', () => {
      const parsed = parseArgs([
        '--no-build',
        '--tag=v1.2.3',
        '--profile=cho-quan',
        '--api-port=4020',
        '--web-port=3020',
        '--timeout=90000',
        '--poll-interval=2000',
      ]);

      assert.strictEqual(parsed.flags['no-build'], true);
      assert.strictEqual(parsed.flags.tag, 'v1.2.3');
      assert.strictEqual(parsed.flags.profile, 'cho-quan');
      assert.strictEqual(parsed.flags['api-port'], '4020');
      assert.strictEqual(parsed.flags['web-port'], '3020');
      assert.strictEqual(parsed.flags.timeout, '90000');
      assert.strictEqual(parsed.flags['poll-interval'], '2000');
    });
  });
});
