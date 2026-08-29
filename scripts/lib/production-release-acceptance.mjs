import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';

export const DEFAULT_BASE_COMPOSE_FILE = 'docker/docker-compose.production.yml';
export const DEFAULT_SMOKE_COMPOSE_FILE = 'docker/docker-compose.production-smoke.yml';
export const DEFAULT_SMOKE_PROJECT_NAME = 'quanlykhupho-production-smoke';
export const DEFAULT_APP_IMAGE_TAG = 'verify';
export const DEFAULT_API_PORT = 4010;
export const DEFAULT_WEB_PORT = 3010;
export const DEFAULT_TIMEOUT_MS = 120000;
export const DEFAULT_POLL_INTERVAL_MS = 1000;
export const DEFAULT_HTTP_TIMEOUT_MS = 5000;

export const DEFAULT_CONFIG_TIMEOUT_MS = 30000;
export const DEFAULT_BUILD_TIMEOUT_MS = 300000;
export const DEFAULT_UP_TIMEOUT_MS = 60000;
export const DEFAULT_PS_TIMEOUT_MS = 15000;
export const DEFAULT_LOGS_TIMEOUT_MS = 30000;
export const DEFAULT_DOWN_TIMEOUT_MS = 60000;

/**
 * Parse CLI arguments into flags and positional values.
 */
export function parseArgs(rawArgs = process.argv.slice(2)) {
  const parsed = {
    flags: {},
    positionals: [],
  };

  for (const arg of rawArgs) {
    if (arg === '-h' || arg === '--help') {
      parsed.flags.help = true;
    } else if (arg.startsWith('--')) {
      const withoutPrefix = arg.slice(2);
      const eqIdx = withoutPrefix.indexOf('=');
      if (eqIdx !== -1) {
        const key = withoutPrefix.slice(0, eqIdx);
        const value = withoutPrefix.slice(eqIdx + 1);
        parsed.flags[key] = value;
      } else {
        parsed.flags[withoutPrefix] = true;
      }
    } else {
      parsed.positionals.push(arg);
    }
  }

  return parsed;
}

/**
 * Validate smoke testing options and parameters before starting any operations.
 */
export function validateSmokeOptions(options = {}) {
  const {
    imageTag,
    apiPort,
    webPort,
    timeoutMs,
    pollIntervalMs,
    build,
    noBuild,
  } = options;

  if (build === true && noBuild === true) {
    throw new Error('Conflicting options: cannot specify both --build and --no-build.');
  }

  if (imageTag !== undefined) {
    if (typeof imageTag !== 'string' || !imageTag.trim()) {
      throw new Error(`Invalid image tag: "${imageTag}". Image tag must be a non-empty string.`);
    }
    const tagRegex = /^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$/;
    if (!tagRegex.test(imageTag.trim())) {
      throw new Error(`Invalid image tag format: "${imageTag}". Image tag contains invalid characters.`);
    }
  }

  if (apiPort !== undefined) {
    const portNum = Number(apiPort);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      throw new Error(`Invalid API port: "${apiPort}". Port must be an integer between 1 and 65535.`);
    }
  }

  if (webPort !== undefined) {
    const portNum = Number(webPort);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      throw new Error(`Invalid Web port: "${webPort}". Port must be an integer between 1 and 65535.`);
    }
  }

  if (apiPort !== undefined && webPort !== undefined) {
    const apiNum = Number(apiPort);
    const webNum = Number(webPort);
    if (Number.isInteger(apiNum) && Number.isInteger(webNum) && apiNum === webNum) {
      throw new Error(`Port collision: API port and Web port cannot be the same (${apiNum}).`);
    }
  }

  if (timeoutMs !== undefined) {
    const timeoutNum = Number(timeoutMs);
    if (!Number.isFinite(timeoutNum) || timeoutNum <= 0 || !Number.isInteger(timeoutNum)) {
      throw new Error(`Invalid timeout: "${timeoutMs}". Timeout must be a positive integer in milliseconds.`);
    }
  }

  if (pollIntervalMs !== undefined) {
    const pollNum = Number(pollIntervalMs);
    if (!Number.isFinite(pollNum) || pollNum <= 0 || !Number.isInteger(pollNum)) {
      throw new Error(`Invalid poll interval: "${pollIntervalMs}". Poll interval must be a positive integer in milliseconds.`);
    }
  }

  return true;
}

/**
 * Generate a complete, cryptographically random, ephemeral environment map for smoke testing.
 */
export function generateSmokeEnvironment(options = {}) {
  const {
    projectName = DEFAULT_SMOKE_PROJECT_NAME,
    imageTag = process.env.APP_IMAGE_TAG || DEFAULT_APP_IMAGE_TAG,
    apiPort = Number(process.env.API_PORT) || DEFAULT_API_PORT,
    webPort = Number(process.env.WEB_PORT) || DEFAULT_WEB_PORT,
    postgresDb = 'quanlykhupho_smoke',
    postgresUser,
    postgresPassword,
    rabbitmqUser,
    rabbitmqPassword,
    phoneEncryptionKey,
    phoneHashKey,
    otpPepper,
    smsQueueEncryptionKey,
    smsApiKey,
    uploadDir = '/app/uploads',
  } = options;

  const pgUser = postgresUser || `smoke_pg_${randomBytes(4).toString('hex')}`;
  const pgPass = postgresPassword || `smoke_pg_pass_${randomBytes(12).toString('hex')}`;
  const rmqUser = rabbitmqUser || `smoke_rmq_${randomBytes(4).toString('hex')}`;
  const rmqPass = rabbitmqPassword || `smoke_rmq_pass_${randomBytes(12).toString('hex')}`;

  const phoneEncKey = phoneEncryptionKey || randomBytes(32).toString('hex');
  const phoneHKey = phoneHashKey || randomBytes(32).toString('hex');
  const pepper = otpPepper || randomBytes(32).toString('hex');
  const smsEncKey = smsQueueEncryptionKey || randomBytes(32).toString('hex');
  const smsKey = smsApiKey || `smoke_sms_key_${randomBytes(16).toString('hex')}`;

  const databaseUrl = `postgresql://${pgUser}:${pgPass}@postgres:5432/${postgresDb}?schema=public`;
  const redisUrl = 'redis://redis:6379';
  const rabbitmqUrl = `amqp://${rmqUser}:${rmqPass}@rabbitmq:5672`;

  const webUrl = `http://127.0.0.1:${webPort}`;
  const apiUrl = `http://127.0.0.1:${apiPort}`;

  return {
    COMPOSE_PROJECT_NAME: projectName,
    APP_IMAGE_TAG: imageTag,
    POSTGRES_USER: pgUser,
    POSTGRES_PASSWORD: pgPass,
    POSTGRES_DB: postgresDb,
    RABBITMQ_USER: rmqUser,
    RABBITMQ_PASSWORD: rmqPass,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    RABBITMQ_URL: rabbitmqUrl,
    CORS_ORIGIN: webUrl,
    TRUST_PROXY: '1',
    PHONE_ENCRYPTION_KEY: phoneEncKey,
    PHONE_HASH_KEY: phoneHKey,
    OTP_PEPPER: pepper,
    SMS_QUEUE_ENCRYPTION_KEY: smsEncKey,
    SMS_PROVIDER: 'webhook',
    SMS_PROVIDER_WEBHOOK_URL: `https://127.0.0.1:${apiPort}/mock-sms`,
    SMS_PROVIDER_API_KEY: smsKey,
    SMS_PROVIDER_TIMEOUT_MS: '5000',
    HEALTH_PROBE_TIMEOUT_MS: '1000',
    UPLOAD_DIR: uploadDir,
    NEXT_PUBLIC_API_URL: apiUrl,
    API_PORT: String(apiPort),
    WEB_PORT: String(webPort),
    VAPID_PUBLIC_KEY: '',
    VAPID_PRIVATE_KEY: '',
    VAPID_SUBJECT: '',
  };
}

/**
 * Write environment key-values to a safe temporary file.
 */
export function createTempEnvFile(envMap, dir = os.tmpdir()) {
  const tempFileName = `.smoke-env-${Date.now()}-${randomBytes(6).toString('hex')}.env`;
  const tempPath = path.join(dir, tempFileName);

  const lines = [];
  for (const [key, value] of Object.entries(envMap)) {
    lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(tempPath, lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
  return tempPath;
}

/**
 * Safely remove temporary environment file.
 */
export function cleanupTempEnvFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return true;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  return true;
}

/**
 * Redact secrets, keys, and connection strings from output strings.
 */
export function redactSensitiveOutput(text, secrets = []) {
  if (!text || typeof text !== 'string') return '';
  let sanitized = text
    .replace(/(postgres(?:ql)?:\/\/)[^:@\s]+:[^@\s]+@/gi, '$1***@')
    .replace(/(amqp:\/\/)[^:@\s]+:[^@\s]+@/gi, '$1***@')
    .replace(/(redis:\/\/)[^:@\s]+:[^@\s]+@/gi, '$1***@')
    .replace(/(https?:\/\/)[^:@\s]+:[^@\s]+@/gi, '$1***@')
    .replace(/password=[^\s;&]+/gi, 'password=***')
    .replace(/POSTGRES_PASSWORD=[^\s\n]+/gi, 'POSTGRES_PASSWORD=***REDACTED***')
    .replace(/RABBITMQ_PASSWORD=[^\s\n]+/gi, 'RABBITMQ_PASSWORD=***REDACTED***')
    .replace(/PHONE_ENCRYPTION_KEY=[^\s\n]+/gi, 'PHONE_ENCRYPTION_KEY=***REDACTED***')
    .replace(/PHONE_HASH_KEY=[^\s\n]+/gi, 'PHONE_HASH_KEY=***REDACTED***')
    .replace(/OTP_PEPPER=[^\s\n]+/gi, 'OTP_PEPPER=***REDACTED***')
    .replace(/SMS_QUEUE_ENCRYPTION_KEY=[^\s\n]+/gi, 'SMS_QUEUE_ENCRYPTION_KEY=***REDACTED***')
    .replace(/SMS_PROVIDER_API_KEY=[^\s\n]+/gi, 'SMS_PROVIDER_API_KEY=***REDACTED***')
    .replace(/DATABASE_URL=[^\s\n]+/gi, 'DATABASE_URL=postgresql://***@postgres:5432/***')
    .replace(/RABBITMQ_URL=[^\s\n]+/gi, 'RABBITMQ_URL=amqp://***@rabbitmq:5672');

  if (Array.isArray(secrets)) {
    for (const secret of secrets) {
      if (typeof secret === 'string' && secret.length >= 6) {
        sanitized = sanitized.replaceAll(secret, '***REDACTED***');
      }
    }
  }

  return sanitized;
}

/**
 * Validate that target project name and compose files strictly belong to isolated smoke test.
 */
export function validateSmokeProjectIdentity(options = {}) {
  const { projectName, composeFiles = [] } = options;

  if (!projectName || typeof projectName !== 'string') {
    throw new Error('Smoke project validation failed: missing project name.');
  }

  const normalized = projectName.trim().toLowerCase();
  if (
    normalized === 'quanlykhupho-production' ||
    normalized === 'quanlykhupho' ||
    normalized === 'production' ||
    normalized === 'prod' ||
    normalized === 'development' ||
    normalized === 'dev' ||
    normalized === 'default' ||
    !normalized.includes('smoke')
  ) {
    throw new Error(
      `Dangerous project name rejected: "${projectName}". Smoke operations must strictly target a project name containing "smoke" (e.g. "${DEFAULT_SMOKE_PROJECT_NAME}").`
    );
  }

  if (composeFiles.length > 0) {
    const hasSmokeFile = composeFiles.some(
      (f) => typeof f === 'string' && (f.includes('smoke') || f.endsWith('docker-compose.production-smoke.yml'))
    );
    if (!hasSmokeFile) {
      throw new Error(
        'Dangerous Compose execution rejected: smoke override compose file (docker-compose.production-smoke.yml) must be included in compose files list.'
      );
    }
  }

  return true;
}

/**
 * Parse output from docker compose config.
 */
export function parseComposeConfig(rawConfig) {
  if (!rawConfig) {
    throw new Error('Compose configuration output is empty.');
  }
  if (typeof rawConfig === 'object') {
    return rawConfig;
  }
  const trimmed = String(rawConfig).trim();
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`Failed to parse Compose configuration output as JSON: ${err.message}`);
  }
}

/**
 * Validate rendered Compose configuration for smoke isolation.
 */
export function validateRenderedComposeConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid Compose configuration: expected parsed object.');
  }

  const projectName = config.name;
  if (
    !projectName ||
    !projectName.includes('smoke') ||
    projectName === 'quanlykhupho-production' ||
    projectName === 'quanlykhupho'
  ) {
    throw new Error(`Compose project name "${projectName}" is not isolated for smoke testing. Must contain "smoke".`);
  }

  const services = config.services || {};
  const expectedServices = ['postgres', 'redis', 'rabbitmq', 'migrate', 'api', 'sms-worker', 'web'];
  for (const exp of expectedServices) {
    if (!services[exp]) {
      throw new Error(`Missing expected service "${exp}" in rendered Compose config.`);
    }
  }

  for (const [svcName, svcConfig] of Object.entries(services)) {
    const containerName = svcConfig.container_name;
    if (containerName) {
      if (containerName.endsWith('-prod') || !containerName.includes('smoke')) {
        throw new Error(`Service "${svcName}" has unsafe container name "${containerName}". Must be smoke-isolated.`);
      }
    }

    if (svcConfig.ports && Array.isArray(svcConfig.ports)) {
      for (const portDef of svcConfig.ports) {
        let hostIp = '';
        if (typeof portDef === 'string') {
          const parts = portDef.split(':');
          if (parts.length >= 3) {
            hostIp = parts[0];
          }
        } else if (typeof portDef === 'object' && portDef !== null) {
          hostIp = portDef.host_ip || portDef.HostIp || '';
        }

        if (hostIp && hostIp !== '127.0.0.1' && hostIp !== '::1' && hostIp !== 'localhost') {
          throw new Error(`Service "${svcName}" exposes port on non-loopback interface "${hostIp}". Must be 127.0.0.1.`);
        }
      }
    }
  }

  const volumes = config.volumes || {};
  for (const [volKey, volConfig] of Object.entries(volumes)) {
    const volName = volConfig?.name || volKey;
    if (volName.includes('prod') || !volName.includes('smoke')) {
      throw new Error(`Volume "${volKey}" has unsafe volume name "${volName}". Must be smoke-isolated.`);
    }
  }

  const networks = config.networks || {};
  for (const [netKey, netConfig] of Object.entries(networks)) {
    const netName = netConfig?.name || netKey;
    if (netName.includes('prod') || !netName.includes('smoke')) {
      throw new Error(`Network "${netKey}" has unsafe network name "${netName}". Must be smoke-isolated.`);
    }
  }

  return true;
}

/**
 * Parse output from docker compose ps --format json.
 */
export function parseComposePsOutput(output) {
  if (!output || typeof output !== 'string') return [];
  const trimmed = output.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fallback to line parsing
    }
  }
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  const items = [];
  for (const line of lines) {
    try {
      items.push(JSON.parse(line));
    } catch {
      // Ignore non-json lines
    }
  }
  return items;
}

/**
 * Normalize docker compose ps output entry across different Docker versions.
 */
export function normalizeServicePsEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const service = entry.Service || entry.service || entry.Service_name || '';
  const name = entry.Name || entry.name || '';
  const state = (entry.State || entry.state || entry.Status || '').toLowerCase();
  const health = (entry.Health || entry.health || '').toLowerCase();
  const exitCode =
    typeof entry.ExitCode === 'number'
      ? entry.ExitCode
      : typeof entry.exit_code === 'number'
        ? entry.exit_code
        : null;
  const restarts =
    typeof entry.Restarts === 'number'
      ? entry.Restarts
      : typeof entry.RestartCount === 'number'
        ? entry.RestartCount
        : typeof entry.restarts === 'number'
          ? entry.restarts
          : 0;

  return { service, name, state, health, exitCode, restarts, raw: entry };
}

/**
 * Check readiness state of all required services in the smoke stack.
 */
export function checkServicesReadiness(rawEntries = []) {
  const normalized = rawEntries.map(normalizeServicePsEntry).filter(Boolean);
  const expectedServices = ['postgres', 'redis', 'rabbitmq', 'migrate', 'api', 'sms-worker', 'web'];

  const pending = [];
  const failures = [];
  const summary = {};

  for (const expected of expectedServices) {
    const entry = normalized.find(
      (e) => e.service === expected || e.name.includes(`-${expected}-`) || e.name.endsWith(`-${expected}`)
    );

    if (!entry) {
      pending.push(`${expected} (not reported)`);
      summary[expected] = { state: 'missing' };
      continue;
    }

    summary[expected] = {
      name: entry.name,
      state: entry.state,
      health: entry.health,
      exitCode: entry.exitCode,
      restarts: entry.restarts,
    };

    if (expected === 'migrate') {
      if (entry.state === 'running' || entry.state === 'created') {
        pending.push('migrate (running)');
      } else if (entry.state === 'exited') {
        if (entry.exitCode === 0 || (entry.exitCode === null && (entry.raw.Status || '').includes('exited (0)'))) {
          // migrate succeeded
        } else {
          failures.push(`migrate container exited with error code ${entry.exitCode ?? 'non-zero'}`);
        }
      } else if (entry.state === 'dead') {
        failures.push('migrate container is dead');
      } else {
        pending.push(`migrate (${entry.state})`);
      }
      continue;
    }

    if (expected === 'sms-worker') {
      if (entry.restarts > 0) {
        failures.push(`sms-worker has restarted ${entry.restarts} time(s)`);
      } else if (entry.state === 'running') {
        // running with 0 restarts
      } else if (entry.state === 'exited' || entry.state === 'dead') {
        failures.push(`sms-worker unexpectedly stopped (${entry.state})`);
      } else {
        pending.push(`sms-worker (${entry.state})`);
      }
      continue;
    }

    if (entry.state === 'dead' || (entry.state === 'exited' && entry.exitCode !== 0)) {
      failures.push(`${expected} unexpectedly stopped (${entry.state})`);
    } else if (entry.state === 'running') {
      if (entry.health === 'healthy') {
        // healthy
      } else if (entry.health === 'unhealthy') {
        failures.push(`${expected} healthcheck failed (unhealthy)`);
      } else {
        pending.push(`${expected} (${entry.health || 'starting'})`);
      }
    } else {
      pending.push(`${expected} (${entry.state})`);
    }
  }

  const ready = pending.length === 0 && failures.length === 0;
  return { ready, pending, failures, summary };
}

/**
 * Default HTTP runner using native fetch with timeout.
 */
export async function defaultHttpRunner(url, options = {}) {
  const timeoutMs = options.timeout ?? DEFAULT_HTTP_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Unwrap the repository-wide successful API response envelope while keeping
 * direct payloads compatible with injected unit-test runners.
 */
export function unwrapApiResponse(payload) {
  if (
    payload &&
    typeof payload === 'object' &&
    payload.success === true &&
    Object.prototype.hasOwnProperty.call(payload, 'data')
  ) {
    return payload.data;
  }

  return payload;
}

/**
 * Assert all runtime contracts for production release smoke test.
 */
export async function assertHttpContracts(options = {}) {
  const {
    apiPort = DEFAULT_API_PORT,
    webPort = DEFAULT_WEB_PORT,
    httpRunner = defaultHttpRunner,
  } = options;

  const results = {};

  // 1. Plain HTTP request -> must be rejected with 403 Forbidden
  const plainHttpUrl = `http://127.0.0.1:${apiPort}/api/health/live`;
  const plainRes = await httpRunner(plainHttpUrl, { method: 'GET', headers: {} });
  if (plainRes.status !== 403) {
    throw new Error(
      `Plain HTTP contract violation: expected 403 Forbidden from ${plainHttpUrl}, received ${plainRes.status}`
    );
  }
  results.plainHttp = { status: plainRes.status, verified: true };

  // 2. HTTPS forwarded liveness -> must be 200 OK
  const liveUrl = `http://127.0.0.1:${apiPort}/api/health/live`;
  const liveRes = await httpRunner(liveUrl, {
    method: 'GET',
    headers: { 'x-forwarded-proto': 'https' },
  });
  if (liveRes.status !== 200) {
    throw new Error(
      `HTTPS liveness contract violation: expected 200 OK from ${liveUrl}, received ${liveRes.status}`
    );
  }
  const liveJson = typeof liveRes.json === 'function' ? await liveRes.json() : JSON.parse(await liveRes.text());
  const liveData = unwrapApiResponse(liveJson);
  if (liveData?.status !== 'ok') {
    throw new Error(
      `HTTPS liveness body violation: expected status 'ok', received '${liveData?.status}'`
    );
  }
  results.liveness = { status: liveRes.status, body: liveData, verified: true };

  // 3. HTTPS forwarded readiness -> must be 503 Service Unavailable (pre-locality init)
  const readyUrl = `http://127.0.0.1:${apiPort}/api/health/ready`;
  const readyRes = await httpRunner(readyUrl, {
    method: 'GET',
    headers: { 'x-forwarded-proto': 'https' },
  });
  if (readyRes.status !== 503) {
    throw new Error(
      `HTTPS readiness contract violation: expected 503 Service Unavailable (pre-locality init) from ${readyUrl}, received ${readyRes.status}`
    );
  }
  const readyJson = typeof readyRes.json === 'function' ? await readyRes.json() : JSON.parse(await readyRes.text());
  const readyData = unwrapApiResponse(readyJson);
  if (readyData?.status !== 'down') {
    throw new Error(
      `HTTPS readiness body violation: expected overall status 'down', received '${readyData?.status}'`
    );
  }
  if (readyData?.services?.database?.status !== 'ok') {
    throw new Error(
      `HTTPS readiness database violation: expected database 'ok', received '${readyData?.services?.database?.status}'`
    );
  }
  if (readyData?.services?.redis?.status !== 'ok') {
    throw new Error(
      `HTTPS readiness redis violation: expected redis 'ok', received '${readyData?.services?.redis?.status}'`
    );
  }
  if (readyData?.services?.rabbitmq?.status !== 'ok') {
    throw new Error(
      `HTTPS readiness rabbitmq violation: expected rabbitmq 'ok', received '${readyData?.services?.rabbitmq?.status}'`
    );
  }
  if (readyData?.services?.deployment?.status !== 'down') {
    throw new Error(
      `HTTPS readiness deployment violation: expected deployment 'down', received '${readyData?.services?.deployment?.status}'`
    );
  }
  if (readyData?.services?.deployment?.message !== 'Deployment profile is not initialized') {
    throw new Error(
      `HTTPS readiness deployment violation: expected uninitialized deployment message, received '${readyData?.services?.deployment?.message}'`
    );
  }
  results.readiness = { status: readyRes.status, body: readyData, verified: true };

  // 4. Web root -> must be 200 OK
  const webUrl = `http://127.0.0.1:${webPort}/`;
  const webRes = await httpRunner(webUrl, { method: 'GET' });
  if (webRes.status !== 200) {
    throw new Error(`Web root contract violation: expected 200 OK from ${webUrl}, received ${webRes.status}`);
  }
  results.webRoot = { status: webRes.status, verified: true };

  return results;
}

/**
 * Collect failure diagnostics with sensitive information redacted.
 */
export async function collectRedactedDiagnostics(options = {}) {
  const {
    composeArgs = [],
    runner = defaultProcessRunner,
    secretsToRedact = [],
    psTimeout = DEFAULT_PS_TIMEOUT_MS,
    logsTimeout = DEFAULT_LOGS_TIMEOUT_MS,
  } = options;

  let diagnostics = '=== SMOKE ACCEPTANCE FAILURE DIAGNOSTICS ===\n\n';

  try {
    const psRes = await runner({
      command: 'docker',
      args: [...composeArgs, 'ps', '-a'],
      captureOutput: true,
      timeout: psTimeout,
    });
    diagnostics += '--- Container Status (docker compose ps -a) ---\n';
    diagnostics += (psRes.stdout || 'No output') + '\n\n';
  } catch (err) {
    diagnostics += `Failed to get ps: ${err.message}\n\n`;
  }

  try {
    const logsRes = await runner({
      command: 'docker',
      args: [...composeArgs, 'logs', '--tail=50'],
      captureOutput: true,
      timeout: logsTimeout,
    });
    diagnostics += '--- Container Logs (docker compose logs --tail=50) ---\n';
    diagnostics += (logsRes.stdout || logsRes.stderr || 'No output') + '\n';
  } catch (err) {
    diagnostics += `Failed to get logs: ${err.message}\n`;
  }

  return redactSensitiveOutput(diagnostics, secretsToRedact);
}

/**
 * Stop and remove smoke stack resources (containers, networks, volumes).
 */
export async function cleanupSmokeStack(options = {}) {
  const {
    composeArgs = [],
    projectName,
    runner = defaultProcessRunner,
    timeout = DEFAULT_DOWN_TIMEOUT_MS,
  } = options;

  if (projectName) {
    validateSmokeProjectIdentity({ projectName });
  }

  return await runner({
    command: 'docker',
    args: [...composeArgs, 'down', '-v'],
    captureOutput: true,
    timeout,
  });
}

/**
 * Default process runner using child_process.spawn with argument arrays.
 */
export function defaultProcessRunner({ command, args, captureOutput = true, timeout }) {
  return new Promise((resolve, reject) => {
    let stdoutData = '';
    let stderrData = '';
    let settled = false;

    const resolveOnce = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const rejectOnce = (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      timeout,
    });

    if (captureOutput) {
      proc.stdout.on('data', (chunk) => {
        if (stdoutData.length < 1048576) {
          stdoutData += chunk.toString();
        }
      });
    }

    proc.stderr.on('data', (chunk) => {
      if (stderrData.length < 1048576) {
        stderrData += chunk.toString();
      }
    });

    proc.on('error', (err) => {
      rejectOnce(new Error(`Failed to spawn process ${command}: ${err.message}`));
    });

    proc.on('close', (code, signal) => {
      if (code !== 0 || signal) {
        const exitDesc = signal ? `signal ${signal}` : `code ${code}`;
        const output = (stderrData.trim() || stdoutData.trim());
        rejectOnce(new Error(`Process exited with ${exitDesc}${output ? `: ${output}` : ''}`));
      } else {
        resolveOnce({
          exitCode: 0,
          stdout: stdoutData,
          stderr: stderrData.trim(),
        });
      }
    });
  });
}

/**
 * Main orchestrator for production release acceptance gate.
 */
export async function runProductionReleaseAcceptance(options = {}) {
  const {
    baseComposeFile = DEFAULT_BASE_COMPOSE_FILE,
    smokeComposeFile = DEFAULT_SMOKE_COMPOSE_FILE,
    projectName = DEFAULT_SMOKE_PROJECT_NAME,
    runner = defaultProcessRunner,
    httpRunner = defaultHttpRunner,
    logger = console,
    tempDir,
  } = options;

  const hasBuild = options.build === true;
  const hasNoBuild = Boolean(options.noBuild || options['no-build']);

  const resolvedImageTag = options.imageTag !== undefined
    ? options.imageTag
    : (process.env.APP_IMAGE_TAG || DEFAULT_APP_IMAGE_TAG);

  const resolvedApiPort = options.apiPort !== undefined
    ? (typeof options.apiPort === 'string' ? Number(options.apiPort) : options.apiPort)
    : (process.env.API_PORT ? Number(process.env.API_PORT) : DEFAULT_API_PORT);

  const resolvedWebPort = options.webPort !== undefined
    ? (typeof options.webPort === 'string' ? Number(options.webPort) : options.webPort)
    : (process.env.WEB_PORT ? Number(process.env.WEB_PORT) : DEFAULT_WEB_PORT);

  const resolvedTimeoutMs = options.timeoutMs !== undefined
    ? (typeof options.timeoutMs === 'string' ? Number(options.timeoutMs) : options.timeoutMs)
    : DEFAULT_TIMEOUT_MS;

  const resolvedPollIntervalMs = options.pollIntervalMs !== undefined
    ? (typeof options.pollIntervalMs === 'string' ? Number(options.pollIntervalMs) : options.pollIntervalMs)
    : DEFAULT_POLL_INTERVAL_MS;

  validateSmokeOptions({
    build: hasBuild,
    noBuild: hasNoBuild,
    imageTag: resolvedImageTag,
    apiPort: resolvedApiPort,
    webPort: resolvedWebPort,
    timeoutMs: resolvedTimeoutMs,
    pollIntervalMs: resolvedPollIntervalMs,
  });

  validateSmokeProjectIdentity({
    projectName,
    composeFiles: [baseComposeFile, smokeComposeFile],
  });

  const envMap = generateSmokeEnvironment({
    projectName,
    imageTag: resolvedImageTag,
    apiPort: resolvedApiPort,
    webPort: resolvedWebPort,
    ...options,
  });

  const secretsToRedact = Object.values(envMap).filter(
    (v) => typeof v === 'string' && v.length >= 8
  );

  const tempEnvPath = createTempEnvFile(envMap, tempDir);
  const composeArgs = [
    'compose',
    '--project-name',
    projectName,
    '--env-file',
    tempEnvPath,
    '-f',
    baseComposeFile,
    '-f',
    smokeComposeFile,
  ];

  let needsCleanup = false;

  try {
    // 1. Validate merged Compose configuration
    logger.log('1/5 Validating Compose configuration...');
    const configResult = await runner({
      command: 'docker',
      args: [...composeArgs, 'config', '--format', 'json'],
      captureOutput: true,
      timeout: DEFAULT_CONFIG_TIMEOUT_MS,
    });
    const parsedConfig = parseComposeConfig(configResult.stdout);
    validateRenderedComposeConfig(parsedConfig);
    logger.log('✔ Compose configuration rendered with isolated smoke project, services, volumes, networks, and loopback ports.');

    // 2. Build or verify images
    const shouldBuild = !hasNoBuild;
    if (shouldBuild) {
      logger.log('2/5 Building smoke container images...');
      await runner({
        command: 'docker',
        // migrate and sms-worker reuse the API image. Building every service can
        // make BuildKit race while exporting the same image tag on Windows.
        args: [...composeArgs, 'build', 'api', 'web'],
        captureOutput: true,
        timeout: DEFAULT_BUILD_TIMEOUT_MS,
      });
      logger.log('✔ Container images built.');
    } else {
      logger.log('2/5 Using existing container images (build skipped)...');
    }

    // 3. Start smoke stack
    logger.log('3/5 Starting smoke stack containers...');
    needsCleanup = true;
    await runner({
      command: 'docker',
      args: [...composeArgs, 'up', '-d'],
      captureOutput: true,
      timeout: DEFAULT_UP_TIMEOUT_MS,
    });
    logger.log('✔ Smoke stack containers launched.');

    // 4. Polling for readiness
    logger.log('4/5 Waiting for service readiness and migration completion...');
    const startTime = Date.now();
    let isReady = false;
    let lastReadiness = null;

    while (Date.now() - startTime < resolvedTimeoutMs) {
      const psResult = await runner({
        command: 'docker',
        args: [...composeArgs, 'ps', '-a', '--format', 'json'],
        captureOutput: true,
        timeout: DEFAULT_PS_TIMEOUT_MS,
      });
      const entries = parseComposePsOutput(psResult.stdout);
      lastReadiness = checkServicesReadiness(entries);

      if (lastReadiness.failures.length > 0) {
        throw new Error(
          `Smoke service failure detected:\n${lastReadiness.failures.join('\n')}`
        );
      }

      if (lastReadiness.ready) {
        isReady = true;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, resolvedPollIntervalMs));
    }

    if (!isReady) {
      const pendingList = lastReadiness?.pending?.join(', ') || 'none';
      throw new Error(
        `Timeout (${resolvedTimeoutMs}ms) waiting for smoke services readiness. Pending: ${pendingList}`
      );
    }
    logger.log('✔ All services healthy (migration exited 0, SMS worker running with 0 restarts).');

    // 5. Assert runtime HTTP contracts
    logger.log('5/5 Asserting runtime contracts (HTTP/HTTPS, pre-locality readiness, Web root)...');
    const contractResults = await assertHttpContracts({
      apiPort: resolvedApiPort,
      webPort: resolvedWebPort,
      httpRunner,
    });
    logger.log('✔ Runtime contracts verified successfully.');

    return {
      success: true,
      projectName,
      imageTag: resolvedImageTag,
      apiPort: resolvedApiPort,
      webPort: resolvedWebPort,
      contractResults,
    };
  } catch (err) {
    const sanitizedMsg = redactSensitiveOutput(err.message, secretsToRedact);
    logger.error(`\n❌ Error during release acceptance: ${sanitizedMsg}`);

    if (needsCleanup) {
      try {
        logger.log('\n--- Collecting Failure Diagnostics ---');
        const diagnostics = await collectRedactedDiagnostics({
          composeArgs,
          runner,
          secretsToRedact,
        });
        logger.error(diagnostics);
      } catch (diagErr) {
        logger.error(`Failed to collect diagnostics: ${redactSensitiveOutput(diagErr.message, secretsToRedact)}`);
      }
    }

    throw new Error(sanitizedMsg);
  } finally {
    let cleanupFailure = null;
    if (needsCleanup) {
      try {
        logger.log('\nCleaning up smoke stack resources...');
        await cleanupSmokeStack({
          composeArgs,
          projectName,
          runner,
        });
        logger.log('✔ Smoke stack resources stopped and removed.');
      } catch (cleanupErr) {
        const sanitizedCleanupError = redactSensitiveOutput(cleanupErr.message, secretsToRedact);
        logger.error(`Cleanup error: ${sanitizedCleanupError}`);
        cleanupFailure = new Error(`Smoke stack cleanup failed: ${sanitizedCleanupError}`);
      }
    }
    try {
      cleanupTempEnvFile(tempEnvPath);
    } catch (tempCleanupErr) {
      const sanitizedTempError = redactSensitiveOutput(tempCleanupErr.message, secretsToRedact);
      logger.error(`Temporary environment cleanup error: ${sanitizedTempError}`);
      cleanupFailure = new Error(
        cleanupFailure
          ? `${cleanupFailure.message}; temporary environment cleanup failed: ${sanitizedTempError}`
          : `Temporary environment cleanup failed: ${sanitizedTempError}`
      );
    }

    if (cleanupFailure) {
      throw cleanupFailure;
    }
  }
}
