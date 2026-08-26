import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import console from 'node:console';
import process from 'node:process';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiDir = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(apiDir, '../..');
const require = createRequire(import.meta.url);

/**
 * Validates that a hostname is a local loopback address.
 */
export function isLoopbackHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '::ffff:127.0.0.1' ||
    h.startsWith('127.') ||
    h.startsWith('::ffff:127.')
  );
}

/**
 * Strictly parses and validates the PostgreSQL connection URL for E2E testing.
 * Enforces loopback host and exact schema "qlkp_e2e" to prevent accidental data loss.
 */
export function validateDatabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('E2E Postgres validation failed: DATABASE_URL is missing or empty.');
  }
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`E2E Postgres validation failed: Invalid URL: ${errorMsg}`);
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(
      `E2E Postgres validation failed: Protocol must be postgresql: or postgres:, got "${parsed.protocol}"`,
    );
  }
  if (!isLoopbackHost(parsed.hostname)) {
    throw new Error(
      `E2E Postgres validation failed: Hostname "${parsed.hostname}" is not loopback. Destructive reset on non-local database is forbidden.`,
    );
  }
  const schema = parsed.searchParams.get('schema');
  if (schema !== 'qlkp_e2e') {
    throw new Error(
      `E2E Postgres validation failed: Target schema must be exactly "qlkp_e2e", got "${schema || ''}". Destructive reset on other schemas is forbidden.`,
    );
  }
  return parsed.toString();
}

/**
 * Strictly parses and validates the Redis connection URL for E2E testing.
 * Enforces loopback host and exact DB 15 to isolate test keys from development keys.
 */
export function validateRedisUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('E2E Redis validation failed: REDIS_URL is missing or empty.');
  }
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`E2E Redis validation failed: Invalid URL: ${errorMsg}`);
  }
  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error(
      `E2E Redis validation failed: Protocol must be redis: or rediss:, got "${parsed.protocol}"`,
    );
  }
  if (!isLoopbackHost(parsed.hostname)) {
    throw new Error(
      `E2E Redis validation failed: Hostname "${parsed.hostname}" is not loopback. Destructive reset on non-local Redis is forbidden.`,
    );
  }
  const dbPath = parsed.pathname.replace(/^\//, '');
  if (dbPath !== '15') {
    throw new Error(
      `E2E Redis validation failed: Target database must be exactly DB 15 (e.g. redis://localhost:6379/15), got "${parsed.pathname}". Resetting other Redis databases is forbidden.`,
    );
  }
  return parsed.toString();
}

/**
 * Executes Prisma migrations on the isolated schema.
 */
function runPrismaMigrate(databaseUrl) {
  const schemaPath = path.join(apiDir, 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Prisma schema file not found at: ${schemaPath}`);
  }

  let prismaBinPath = null;
  try {
    prismaBinPath = require.resolve('prisma/build/index.js');
  } catch {
    const candidate = path.join(apiDir, 'node_modules', 'prisma', 'build', 'index.js');
    if (fs.existsSync(candidate)) {
      prismaBinPath = candidate;
    }
  }

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
  };

  let result;
  if (prismaBinPath && fs.existsSync(prismaBinPath)) {
    result = spawnSync(
      process.execPath,
      [prismaBinPath, 'migrate', 'deploy', '--schema', schemaPath],
      {
        cwd: apiDir,
        env,
        stdio: 'inherit',
      },
    );
  } else {
    const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    result = spawnSync(
      pnpmCmd,
      ['--filter', '@quanlykhupho/api', 'exec', 'prisma', 'migrate', 'deploy'],
      {
        cwd: repoRoot,
        env,
        stdio: 'inherit',
      },
    );
  }

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Prisma migrate deploy failed with exit code ${result.status}`);
  }
}

/**
 * Executes an API CLI command via node apps/api/dist/main.js.
 */
function runCliCommand(args, envOverrides = {}) {
  const mainPath = path.join(apiDir, 'dist', 'main.js');
  if (!fs.existsSync(mainPath)) {
    throw new Error(
      `Built API entrypoint not found at: ${mainPath}. Run "pnpm build" before preparing E2E.`,
    );
  }

  const env = {
    ...process.env,
    NODE_ENV: 'development',
    ...envOverrides,
  };

  const result = spawnSync(process.execPath, [mainPath, ...args], {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Command "node dist/main.js ${args.join(' ')}" failed with exit code ${result.status}`,
    );
  }
}

/**
 * Main preparation procedure for isolated full-stack E2E tests.
 */
export async function prepare() {
  const rawDbUrl =
    process.env.E2E_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5433/quanlykhupho?schema=qlkp_e2e';

  const rawRedisUrl =
    process.env.E2E_REDIS_URL ||
    process.env.REDIS_URL ||
    'redis://localhost:6379/15';

  const rabbitMqUrl =
    process.env.E2E_RABBITMQ_URL ||
    process.env.RABBITMQ_URL ||
    'amqp://guest:guest@localhost:5672';

  const officerPhone = process.env.BOOTSTRAP_OFFICER_PHONE || '0901234567';
  const officerFullName = process.env.BOOTSTRAP_OFFICER_FULL_NAME || 'Cán bộ Kiểm thử E2E';

  // 1. Strict pre-flight safety validations
  const dbUrl = validateDatabaseUrl(rawDbUrl);
  const redisUrl = validateRedisUrl(rawRedisUrl);

  console.log('[prepare] Safety checks passed for isolated E2E targets (schema: qlkp_e2e, redis db: 15)');

  // 2. Reset PostgreSQL schema qlkp_e2e
  console.log('[prepare] Resetting isolated PostgreSQL schema "qlkp_e2e"...');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

  try {
    await prisma.$connect();
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS "qlkp_e2e" CASCADE;');
    await prisma.$executeRawUnsafe('CREATE SCHEMA "qlkp_e2e";');
  } finally {
    await prisma.$disconnect();
  }
  console.log('[prepare] PostgreSQL schema "qlkp_e2e" reset successfully.');

  // 3. Flush Redis DB 15
  console.log('[prepare] Flushing Redis DB 15...');
  const RedisClient = Redis.default || Redis;
  const redis = new RedisClient(redisUrl);
  try {
    await redis.flushdb();
  } finally {
    await redis.quit();
  }
  console.log('[prepare] Redis DB 15 flushed successfully.');

  // 4. Apply Prisma migrations to the isolated schema
  console.log('[prepare] Applying Prisma migrations to "qlkp_e2e"...');
  runPrismaMigrate(dbUrl);
  console.log('[prepare] Prisma migrations applied successfully.');

  // 5. Initialize confirmed E2E deployment profile
  console.log('[prepare] Initializing deployment profile "e2e"...');
  runCliCommand(['--deployment-init', '--profile', 'e2e', '--apply'], {
    DATABASE_URL: dbUrl,
    REDIS_URL: redisUrl,
    RABBITMQ_URL: rabbitMqUrl,
    SMS_PROVIDER: 'memory',
  });
  console.log('[prepare] Deployment profile "e2e" initialized successfully.');

  // 6. Bootstrap initial officer account
  console.log('[prepare] Bootstrapping initial officer account...');
  runCliCommand(['--bootstrap-officer'], {
    DATABASE_URL: dbUrl,
    REDIS_URL: redisUrl,
    RABBITMQ_URL: rabbitMqUrl,
    SMS_PROVIDER: 'memory',
    BOOTSTRAP_OFFICER_PHONE: officerPhone,
    BOOTSTRAP_OFFICER_FULL_NAME: officerFullName,
  });
  console.log('[prepare] Initial officer account bootstrapped successfully.');

  console.log('[prepare] Isolated full-stack E2E environment preparation complete.');
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isDirectRun) {
  prepare().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[prepare] Preparation failed: ${message}`);
    process.exit(1);
  });
}
