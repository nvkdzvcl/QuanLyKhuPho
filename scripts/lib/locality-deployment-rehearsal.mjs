import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import {
  DEFAULT_BASE_COMPOSE_FILE,
  DEFAULT_APP_IMAGE_TAG,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_HTTP_TIMEOUT_MS,
  DEFAULT_CONFIG_TIMEOUT_MS,
  DEFAULT_BUILD_TIMEOUT_MS,
  DEFAULT_UP_TIMEOUT_MS,
  DEFAULT_PS_TIMEOUT_MS,
  DEFAULT_LOGS_TIMEOUT_MS,
  DEFAULT_DOWN_TIMEOUT_MS,
  parseArgs,
  createTempEnvFile,
  cleanupTempEnvFile,
  redactSensitiveOutput,
  parseComposeConfig,
  parseComposePsOutput,
  normalizeServicePsEntry,
  unwrapApiResponse,
  defaultHttpRunner,
  defaultProcessRunner,
} from './production-release-acceptance.mjs';

export {
  DEFAULT_BASE_COMPOSE_FILE,
  DEFAULT_APP_IMAGE_TAG,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_HTTP_TIMEOUT_MS,
  DEFAULT_CONFIG_TIMEOUT_MS,
  DEFAULT_BUILD_TIMEOUT_MS,
  DEFAULT_UP_TIMEOUT_MS,
  DEFAULT_PS_TIMEOUT_MS,
  DEFAULT_LOGS_TIMEOUT_MS,
  DEFAULT_DOWN_TIMEOUT_MS,
  parseArgs,
  createTempEnvFile,
  cleanupTempEnvFile,
  redactSensitiveOutput,
  parseComposeConfig,
  parseComposePsOutput,
  normalizeServicePsEntry,
  unwrapApiResponse,
  defaultHttpRunner,
  defaultProcessRunner,
};

export const DEFAULT_REHEARSAL_COMPOSE_FILE = 'docker/docker-compose.locality-rehearsal.yml';
export const DEFAULT_REHEARSAL_PROJECT_NAME = 'quanlykhupho-locality-rehearsal';
export const DEFAULT_REHEARSAL_API_PORT = 4011;
export const DEFAULT_REHEARSAL_WEB_PORT = 3011;
export const DEFAULT_PROFILE_SLUG = 'cho-quan';
export const DEFAULT_TIMEOUT_MS = 120000;
export const AUTOMATED_REHEARSAL_CONFIRMED_BY =
  'Automated Locality Rehearsal (Technical Verification Only - NOT Operational Approval)';
const REHEARSAL_TEMP_PREFIX = 'locality-rehearsal-';
const REHEARSAL_MARKER_FILE = '.quanlykhupho-locality-rehearsal';
const REHEARSAL_MARKER_CONTENT = 'temporary-locality-rehearsal\n';

function isPathInside(rootPath, candidatePath) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

/**
 * Validate options for the locality deployment rehearsal runner.
 */
export function validateRehearsalOptions(options = {}) {
  const {
    imageTag,
    apiPort,
    webPort,
    timeoutMs,
    pollIntervalMs,
    build,
    noBuild,
    profile,
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

  if (profile !== undefined) {
    if (typeof profile !== 'string' || !profile.trim()) {
      throw new Error(`Invalid profile slug or path: "${profile}". Profile must be a non-empty string.`);
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
 * Validate that the source package strictly adheres to unconfirmed draft invariants.
 */
export function validateSourceDraftPackage(pkg) {
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    throw new Error('Deployment package validation error: expected a JSON object.');
  }

  if (pkg.schemaVersion !== 1) {
    throw new Error(
      `Deployment package validation error: unsupported schemaVersion "${pkg.schemaVersion}". Expected schemaVersion=1.`
    );
  }

  if (typeof pkg.slug !== 'string' || !pkg.slug.trim()) {
    throw new Error('Deployment package validation error: missing or invalid "slug".');
  }

  // Strict draft-safe gate: source package MUST have confirmed === false and NO confirmedAt/confirmedBy
  if (pkg.confirmed !== false) {
    throw new Error(
      `Rehearsal safety gate violation: source package for "${pkg.slug}" must be an unconfirmed draft (confirmed=false), but found confirmed=${pkg.confirmed}. Rehearsal cannot use an already confirmed package as source.`
    );
  }

  if (pkg.confirmedAt !== undefined && pkg.confirmedAt !== null) {
    throw new Error(
      `Rehearsal safety gate violation: source draft package for "${pkg.slug}" must not contain "confirmedAt" field.`
    );
  }

  if (pkg.confirmedBy !== undefined && pkg.confirmedBy !== null) {
    throw new Error(
      `Rehearsal safety gate violation: source draft package for "${pkg.slug}" must not contain "confirmedBy" field.`
    );
  }

  if (!pkg.locality || typeof pkg.locality !== 'object') {
    throw new Error('Deployment package validation error: missing "locality" object.');
  }

  const { code, name, level, provinceCode, provinceName } = pkg.locality;
  if (!code || !name || !level || !provinceCode || !provinceName) {
    throw new Error('Deployment package validation error: locality is missing required metadata fields.');
  }

  if (!pkg.branding || typeof pkg.branding !== 'object' || !pkg.branding.brandName) {
    throw new Error('Deployment package validation error: missing or invalid "branding.brandName".');
  }

  if (!Array.isArray(pkg.neighborhoods) || pkg.neighborhoods.length === 0) {
    throw new Error('Deployment package validation error: "neighborhoods" must be a non-empty array.');
  }

  return true;
}

/**
 * Load and validate a source draft package from the repository deployments directory.
 */
export function loadAndValidateSourceDraft(slugOrPath = DEFAULT_PROFILE_SLUG, customDeploymentsDir) {
  let deploymentsDir = customDeploymentsDir;
  if (!deploymentsDir) {
    const searchDirs = [process.cwd(), path.resolve(process.cwd(), '..')];
    for (const d of searchDirs) {
      const candidate = path.join(d, 'deployments');
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        deploymentsDir = candidate;
        break;
      }
    }
    if (!deploymentsDir) {
      deploymentsDir = path.resolve(process.cwd(), 'deployments');
    }
  }

  const deploymentsRoot = path.resolve(deploymentsDir);
  let resolvedPath;
  if (path.isAbsolute(slugOrPath)) {
    resolvedPath = path.resolve(slugOrPath);
  } else if (slugOrPath.endsWith('.json')) {
    resolvedPath = path.resolve(deploymentsRoot, slugOrPath);
  } else {
    resolvedPath = path.resolve(deploymentsRoot, slugOrPath, 'deployment.json');
  }

  if (!isPathInside(deploymentsRoot, resolvedPath)) {
    throw new Error(
      `Source deployment package must stay inside the deployments directory: "${deploymentsRoot}".`
    );
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Source deployment package not found at: "${resolvedPath}".`);
  }

  const rawContent = fs.readFileSync(resolvedPath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(`Failed to parse source deployment package JSON at "${resolvedPath}": ${err.message}`);
  }

  validateSourceDraftPackage(parsed);
  return { sourcePath: resolvedPath, sourceContent: rawContent, sourcePackage: parsed };
}

/**
 * Materialize a temporary, test-only clone of the draft package with automated rehearsal confirmation.
 */
export function materializeTemporaryRehearsalClone(sourcePackage, options = {}) {
  validateSourceDraftPackage(sourcePackage);

  const baseTempDir = options.tempDir || os.tmpdir();
  const tempDeploymentsDir = fs.mkdtempSync(path.join(baseTempDir, REHEARSAL_TEMP_PREFIX));
  try {
    fs.writeFileSync(
      path.join(tempDeploymentsDir, REHEARSAL_MARKER_FILE),
      REHEARSAL_MARKER_CONTENT,
      { encoding: 'utf8', mode: 0o600 }
    );
    const profileDir = path.join(tempDeploymentsDir, sourcePackage.slug);
    fs.mkdirSync(profileDir, { recursive: true });

    const confirmedAt = options.confirmedAt || new Date().toISOString();
    const confirmedBy = options.confirmedBy || AUTOMATED_REHEARSAL_CONFIRMED_BY;
    const clonedPackage = {
      ...sourcePackage,
      confirmed: true,
      confirmedAt,
      confirmedBy,
    };

    const clonedPackagePath = path.join(profileDir, 'deployment.json');
    fs.writeFileSync(clonedPackagePath, `${JSON.stringify(clonedPackage, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });

    return { tempDeploymentsDir, clonedPackagePath, clonedPackage };
  } catch (err) {
    fs.rmSync(tempDeploymentsDir, { recursive: true, force: true });
    throw err;
  }
}

/**
 * Safely remove temporary cloned deployment directory and its contents.
 */
export function cleanupTemporaryRehearsalClone(tempDeploymentsDir) {
  if (!tempDeploymentsDir || typeof tempDeploymentsDir !== 'string') return true;
  if (fs.existsSync(tempDeploymentsDir)) {
    const resolvedDir = path.resolve(tempDeploymentsDir);
    const markerPath = path.join(resolvedDir, REHEARSAL_MARKER_FILE);
    if (
      !path.basename(resolvedDir).startsWith(REHEARSAL_TEMP_PREFIX) ||
      !fs.existsSync(markerPath) ||
      fs.readFileSync(markerPath, 'utf8') !== REHEARSAL_MARKER_CONTENT
    ) {
      throw new Error(
        `Refusing to remove unrecognized rehearsal directory: "${resolvedDir}".`
      );
    }
    fs.rmSync(tempDeploymentsDir, { recursive: true, force: true });
  }
  return true;
}

/**
 * Generate a complete, cryptographically random, ephemeral environment map for locality rehearsal.
 */
export function generateRehearsalEnvironment(options = {}) {
  const {
    projectName = DEFAULT_REHEARSAL_PROJECT_NAME,
    imageTag = process.env.APP_IMAGE_TAG || DEFAULT_APP_IMAGE_TAG,
    apiPort = Number(process.env.API_PORT) || DEFAULT_REHEARSAL_API_PORT,
    webPort = Number(process.env.WEB_PORT) || DEFAULT_REHEARSAL_WEB_PORT,
    profileSlug = DEFAULT_PROFILE_SLUG,
    tempDeploymentsDir,
    postgresDb = 'quanlykhupho_rehearsal',
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

  const pgUser = postgresUser || `rehearsal_pg_${randomBytes(4).toString('hex')}`;
  const pgPass = postgresPassword || `rehearsal_pg_pass_${randomBytes(12).toString('hex')}`;
  const rmqUser = rabbitmqUser || `rehearsal_rmq_${randomBytes(4).toString('hex')}`;
  const rmqPass = rabbitmqPassword || `rehearsal_rmq_pass_${randomBytes(12).toString('hex')}`;

  const phoneEncKey = phoneEncryptionKey || randomBytes(32).toString('hex');
  const phoneHKey = phoneHashKey || randomBytes(32).toString('hex');
  const pepper = otpPepper || randomBytes(32).toString('hex');
  const smsEncKey = smsQueueEncryptionKey || randomBytes(32).toString('hex');
  const smsKey = smsApiKey || `rehearsal_sms_key_${randomBytes(16).toString('hex')}`;

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
    DEPLOYMENT_PROFILE: profileSlug,
    LOCALITY_DEPLOYMENTS_DIR: tempDeploymentsDir || './deployments',
    DEPLOYMENTS_DIR: '/app/deployments',
    VAPID_PUBLIC_KEY: '',
    VAPID_PRIVATE_KEY: '',
    VAPID_SUBJECT: '',
  };
}

/**
 * Validate that target project name and compose files strictly belong to isolated locality rehearsal.
 */
export function validateRehearsalProjectIdentity(options = {}) {
  const { projectName, composeFiles = [] } = options;

  if (!projectName || typeof projectName !== 'string') {
    throw new Error('Locality rehearsal project validation failed: missing project name.');
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
    normalized === 'quanlykhupho-production-smoke' ||
    !normalized.includes('rehearsal')
  ) {
    throw new Error(
      `Dangerous project name rejected: "${projectName}". Locality rehearsal operations must strictly target a project name containing "rehearsal" (e.g. "${DEFAULT_REHEARSAL_PROJECT_NAME}").`
    );
  }

  if (composeFiles.length > 0) {
    const hasRehearsalFile = composeFiles.some(
      (f) =>
        typeof f === 'string' &&
        (f.includes('locality-rehearsal') || f.endsWith('docker-compose.locality-rehearsal.yml'))
    );
    if (!hasRehearsalFile) {
      throw new Error(
        'Dangerous Compose execution rejected: rehearsal override compose file (docker-compose.locality-rehearsal.yml) must be included in compose files list.'
      );
    }
  }

  return true;
}

/**
 * Validate rendered Compose configuration for locality rehearsal isolation.
 */
export function validateRenderedRehearsalComposeConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid Compose configuration: expected parsed object.');
  }

  const projectName = config.name;
  if (
    !projectName ||
    !projectName.includes('rehearsal') ||
    projectName === 'quanlykhupho-production' ||
    projectName === 'quanlykhupho'
  ) {
    throw new Error(
      `Compose project name "${projectName}" is not isolated for locality rehearsal. Must contain "rehearsal".`
    );
  }

  const services = config.services || {};
  const expectedServices = [
    'postgres',
    'redis',
    'rabbitmq',
    'migrate',
    'locality-init',
    'api',
    'sms-worker',
    'web',
  ];

  for (const exp of expectedServices) {
    if (!services[exp]) {
      throw new Error(`Missing expected service "${exp}" in rendered rehearsal Compose config.`);
    }
  }

  for (const [svcName, svcConfig] of Object.entries(services)) {
    const containerName = svcConfig.container_name;
    if (containerName) {
      if (containerName.endsWith('-prod') || !containerName.includes('rehearsal')) {
        throw new Error(
          `Service "${svcName}" has unsafe container name "${containerName}". Must be rehearsal-isolated.`
        );
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

  // Verify locality-init has read-only volume mount for deployments
  const initService = services['locality-init'];
  if (initService && initService.volumes && Array.isArray(initService.volumes)) {
    const hasReadOnlyMount = initService.volumes.some((v) => {
      if (typeof v === 'string') {
        return v.includes('/app/deployments') && v.endsWith(':ro');
      }
      if (typeof v === 'object' && v !== null) {
        const target = v.target || v.Target || '';
        const readOnly = v.read_only === true || v.ReadOnly === true;
        return target.includes('/app/deployments') && readOnly;
      }
      return false;
    });

    if (!hasReadOnlyMount) {
      throw new Error('Service "locality-init" must mount deployments directory in read-only mode (:ro).');
    }
  }

  const volumes = config.volumes || {};
  for (const [volKey, volConfig] of Object.entries(volumes)) {
    const volName = volConfig?.name || volKey;
    if (volName.includes('prod') || !volName.includes('rehearsal')) {
      throw new Error(`Volume "${volKey}" has unsafe volume name "${volName}". Must be rehearsal-isolated.`);
    }
  }

  const networks = config.networks || {};
  for (const [netKey, netConfig] of Object.entries(networks)) {
    const netName = netConfig?.name || netKey;
    if (netName.includes('prod') || !netName.includes('rehearsal')) {
      throw new Error(`Network "${netKey}" has unsafe network name "${netName}". Must be rehearsal-isolated.`);
    }
  }

  return true;
}

/**
 * Check readiness state of all required services in the locality rehearsal stack.
 */
export function checkRehearsalServicesReadiness(rawEntries = []) {
  const normalized = rawEntries.map(normalizeServicePsEntry).filter(Boolean);
  const expectedServices = [
    'postgres',
    'redis',
    'rabbitmq',
    'migrate',
    'locality-init',
    'api',
    'sms-worker',
    'web',
  ];

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

    if (expected === 'locality-init') {
      if (entry.state === 'running' || entry.state === 'created') {
        pending.push('locality-init (running)');
      } else if (entry.state === 'exited') {
        if (entry.exitCode === 0 || (entry.exitCode === null && (entry.raw.Status || '').includes('exited (0)'))) {
          // locality-init succeeded
        } else {
          failures.push(`locality-init container exited with error code ${entry.exitCode ?? 'non-zero'}`);
        }
      } else if (entry.state === 'dead') {
        failures.push('locality-init container is dead');
      } else {
        pending.push(`locality-init (${entry.state})`);
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
 * Assert runtime HTTP contracts for post-locality-initialization stack.
 */
export async function assertRehearsalRuntimeContracts(options = {}) {
  const {
    apiPort = DEFAULT_REHEARSAL_API_PORT,
    webPort = DEFAULT_REHEARSAL_WEB_PORT,
    httpRunner = defaultHttpRunner,
    expectedPackage,
  } = options;

  if (!expectedPackage || !expectedPackage.locality) {
    throw new Error('assertRehearsalRuntimeContracts requires expectedPackage metadata.');
  }

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
    throw new Error(`HTTPS liveness body violation: expected status 'ok', received '${liveData?.status}'`);
  }
  results.liveness = { status: liveRes.status, body: liveData, verified: true };

  // 3. HTTPS forwarded readiness -> must be 200 OK (post-locality init)
  const readyUrl = `http://127.0.0.1:${apiPort}/api/health/ready`;
  const readyRes = await httpRunner(readyUrl, {
    method: 'GET',
    headers: { 'x-forwarded-proto': 'https' },
  });
  if (readyRes.status !== 200) {
    throw new Error(
      `HTTPS readiness contract violation: expected 200 OK (post-locality init) from ${readyUrl}, received ${readyRes.status}`
    );
  }
  const readyJson = typeof readyRes.json === 'function' ? await readyRes.json() : JSON.parse(await readyRes.text());
  const readyData = unwrapApiResponse(readyJson);
  if (readyData?.status !== 'ok') {
    throw new Error(`HTTPS readiness body violation: expected overall status 'ok', received '${readyData?.status}'`);
  }
  if (readyData?.services?.database?.status !== 'ok') {
    throw new Error(
      `HTTPS readiness database violation: expected database 'ok', received '${readyData?.services?.database?.status}'`
    );
  }
  if (readyData?.services?.deployment?.status !== 'ok') {
    throw new Error(
      `HTTPS readiness deployment violation: expected deployment 'ok', received '${readyData?.services?.deployment?.status}'`
    );
  }
  results.readiness = { status: readyRes.status, body: readyData, verified: true };

  // 4. Public Deployment Profile -> must be 200 OK, initialized=true, slug match, no secrets/internal IDs
  const profileUrl = `http://127.0.0.1:${apiPort}/api/deployment-profile`;
  const profileRes = await httpRunner(profileUrl, {
    method: 'GET',
    headers: { 'x-forwarded-proto': 'https' },
  });
  if (profileRes.status !== 200) {
    throw new Error(
      `Deployment profile contract violation: expected 200 OK from ${profileUrl}, received ${profileRes.status}`
    );
  }
  const profileJson =
    typeof profileRes.json === 'function' ? await profileRes.json() : JSON.parse(await profileRes.text());
  const profileData = unwrapApiResponse(profileJson);
  if (profileData?.initialized !== true) {
    throw new Error(
      `Deployment profile initialized contract violation: expected initialized=true, received ${profileData?.initialized}`
    );
  }
  if (profileData?.profile?.slug !== expectedPackage.slug) {
    throw new Error(
      `Deployment profile slug mismatch: expected '${expectedPackage.slug}', received '${profileData?.profile?.slug}'`
    );
  }
  if (profileData?.profile?.localityCode !== expectedPackage.locality.code) {
    throw new Error(
      `Deployment profile locality code mismatch: expected '${expectedPackage.locality.code}', received '${profileData?.profile?.localityCode}'`
    );
  }
  if (profileData?.profile?.localityName !== expectedPackage.locality.name) {
    throw new Error(
      `Deployment profile locality name mismatch: expected '${expectedPackage.locality.name}', received '${profileData?.profile?.localityName}'`
    );
  }
  if (profileData?.profile?.confirmed !== true) {
    throw new Error(
      `Deployment profile confirmation mismatch: expected confirmed=true in rehearsal database, received ${profileData?.profile?.confirmed}`
    );
  }
  if (profileData?.profile?.singletonKey !== undefined || profileData?.profile?.id !== undefined) {
    throw new Error('Deployment profile leak violation: database internal singletonKey or id exposed in public endpoint.');
  }
  if (profileData?.profile?.confirmedBy !== undefined) {
    throw new Error('Deployment profile leak violation: confirmedBy field exposed in public endpoint.');
  }
  results.deploymentProfile = { status: profileRes.status, body: profileData, verified: true };

  // 5. Neighborhoods list -> must be 200 OK, returning exact neighborhoods count and items
  const neighborhoodsUrl = `http://127.0.0.1:${apiPort}/api/neighborhoods`;
  const neighborhoodsRes = await httpRunner(neighborhoodsUrl, {
    method: 'GET',
    headers: { 'x-forwarded-proto': 'https' },
  });
  if (neighborhoodsRes.status !== 200) {
    throw new Error(
      `Neighborhoods contract violation: expected 200 OK from ${neighborhoodsUrl}, received ${neighborhoodsRes.status}`
    );
  }
  const neighborhoodsJson =
    typeof neighborhoodsRes.json === 'function'
      ? await neighborhoodsRes.json()
      : JSON.parse(await neighborhoodsRes.text());
  const neighborhoodsList = unwrapApiResponse(neighborhoodsJson);
  if (!Array.isArray(neighborhoodsList)) {
    throw new Error('Neighborhoods contract violation: expected an array of neighborhoods.');
  }
  if (neighborhoodsList.length !== expectedPackage.neighborhoods.length) {
    throw new Error(
      `Neighborhoods count mismatch: expected ${expectedPackage.neighborhoods.length}, received ${neighborhoodsList.length}`
    );
  }
  for (const expN of expectedPackage.neighborhoods) {
    const found = neighborhoodsList.find((n) => n.code === expN.code);
    if (!found) {
      throw new Error(`Neighborhood code "${expN.code}" missing from /api/neighborhoods response.`);
    }
    if (found.name !== expN.name) {
      throw new Error(
        `Neighborhood name mismatch for code "${expN.code}": expected "${expN.name}", received "${found.name}"`
      );
    }
    if (found.ward !== expectedPackage.locality.name) {
      throw new Error(
        `Neighborhood ward mismatch for code "${expN.code}": expected "${expectedPackage.locality.name}", received "${found.ward}"`
      );
    }
  }
  results.neighborhoods = {
    status: neighborhoodsRes.status,
    count: neighborhoodsList.length,
    verified: true,
  };

  // 6. Web root -> must be 200 OK
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
export async function collectRehearsalRedactedDiagnostics(options = {}) {
  const {
    composeArgs = [],
    runner = defaultProcessRunner,
    secretsToRedact = [],
    psTimeout = DEFAULT_PS_TIMEOUT_MS,
    logsTimeout = DEFAULT_LOGS_TIMEOUT_MS,
  } = options;

  let diagnostics = '=== LOCALITY REHEARSAL FAILURE DIAGNOSTICS ===\n\n';

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
 * Stop and remove locality rehearsal stack resources (containers, networks, volumes).
 */
export async function cleanupRehearsalStack(options = {}) {
  const {
    composeArgs = [],
    projectName,
    runner = defaultProcessRunner,
    timeout = DEFAULT_DOWN_TIMEOUT_MS,
  } = options;

  if (projectName) {
    validateRehearsalProjectIdentity({ projectName });
  }

  return await runner({
    command: 'docker',
    args: [...composeArgs, 'down', '-v'],
    captureOutput: true,
    timeout,
  });
}

/**
 * Main orchestrator for locality deployment rehearsal runner.
 */
export async function runLocalityDeploymentRehearsal(options = {}) {
  const {
    baseComposeFile = DEFAULT_BASE_COMPOSE_FILE,
    rehearsalComposeFile = DEFAULT_REHEARSAL_COMPOSE_FILE,
    projectName = DEFAULT_REHEARSAL_PROJECT_NAME,
    profile = DEFAULT_PROFILE_SLUG,
    runner = defaultProcessRunner,
    httpRunner = defaultHttpRunner,
    logger = console,
    tempDir,
    customDeploymentsDir,
  } = options;

  const hasBuild = options.build === true;
  const hasNoBuild = Boolean(options.noBuild || options['no-build']);

  const resolvedImageTag =
    options.imageTag !== undefined
      ? options.imageTag
      : (process.env.APP_IMAGE_TAG || DEFAULT_APP_IMAGE_TAG);

  const resolvedApiPort =
    options.apiPort !== undefined
      ? (typeof options.apiPort === 'string' ? Number(options.apiPort) : options.apiPort)
      : (process.env.API_PORT ? Number(process.env.API_PORT) : DEFAULT_REHEARSAL_API_PORT);

  const resolvedWebPort =
    options.webPort !== undefined
      ? (typeof options.webPort === 'string' ? Number(options.webPort) : options.webPort)
      : (process.env.WEB_PORT ? Number(process.env.WEB_PORT) : DEFAULT_REHEARSAL_WEB_PORT);

  const resolvedTimeoutMs =
    options.timeoutMs !== undefined
      ? (typeof options.timeoutMs === 'string' ? Number(options.timeoutMs) : options.timeoutMs)
      : DEFAULT_TIMEOUT_MS;

  const resolvedPollIntervalMs =
    options.pollIntervalMs !== undefined
      ? (typeof options.pollIntervalMs === 'string' ? Number(options.pollIntervalMs) : options.pollIntervalMs)
      : DEFAULT_POLL_INTERVAL_MS;

  validateRehearsalOptions({
    build: hasBuild,
    noBuild: hasNoBuild,
    imageTag: resolvedImageTag,
    apiPort: resolvedApiPort,
    webPort: resolvedWebPort,
    timeoutMs: resolvedTimeoutMs,
    pollIntervalMs: resolvedPollIntervalMs,
    profile,
  });

  validateRehearsalProjectIdentity({
    projectName,
    composeFiles: [baseComposeFile, rehearsalComposeFile],
  });

  // 1. Load and validate source draft package (Strict draft gate)
  logger.log(`1/6 Loading and verifying draft source package for "${profile}"...`);
  const { sourcePath, sourceContent, sourcePackage } = loadAndValidateSourceDraft(profile, customDeploymentsDir);
  logger.log(
    `✔ Source package "${sourcePackage.slug}" verified as draft (confirmed=false, ${sourcePackage.neighborhoods.length} neighborhoods).`
  );

  let tempDeploymentsDir;
  let tempEnvPath;
  let clonedPackage;
  let composeArgs = [];
  let secretsToRedact = [];
  let needsCleanup = false;

  try {
    // 2. Materialize temporary test-only clone with automated rehearsal confirmation
    logger.log('2/6 Materializing temporary test-only clone...');
    const materialized = materializeTemporaryRehearsalClone(sourcePackage, { tempDir });
    tempDeploymentsDir = materialized.tempDeploymentsDir;
    clonedPackage = materialized.clonedPackage;
    logger.log('✔ Temporary clone materialized with automated rehearsal confirmation.');

    const envMap = generateRehearsalEnvironment({
      projectName,
      imageTag: resolvedImageTag,
      apiPort: resolvedApiPort,
      webPort: resolvedWebPort,
      profileSlug: sourcePackage.slug,
      tempDeploymentsDir,
      ...options,
    });
    secretsToRedact = Object.values(envMap).filter(
      (v) => typeof v === 'string' && v.length >= 8
    );
    tempEnvPath = createTempEnvFile(envMap, tempDir);
    composeArgs = [
      'compose',
      '--project-name',
      projectName,
      '--env-file',
      tempEnvPath,
      '-f',
      baseComposeFile,
      '-f',
      rehearsalComposeFile,
    ];

    // 3. Validate merged Compose configuration
    logger.log('3/6 Validating Compose configuration...');
    const configResult = await runner({
      command: 'docker',
      args: [...composeArgs, 'config', '--format', 'json'],
      captureOutput: true,
      timeout: DEFAULT_CONFIG_TIMEOUT_MS,
    });
    const parsedConfig = parseComposeConfig(configResult.stdout);
    validateRenderedRehearsalComposeConfig(parsedConfig);
    logger.log('✔ Compose configuration rendered with isolated rehearsal project, one-shot init service, and loopback ports.');

    // 4. Build or verify images
    const shouldBuild = !hasNoBuild;
    if (shouldBuild) {
      logger.log('4/6 Building rehearsal container images...');
      await runner({
        command: 'docker',
        args: [...composeArgs, 'build'],
        captureOutput: true,
        timeout: DEFAULT_BUILD_TIMEOUT_MS,
      });
      logger.log('✔ Container images built.');
    } else {
      logger.log('4/6 Using existing container images (build skipped)...');
    }

    // 5. Start rehearsal stack
    logger.log('5/6 Starting rehearsal stack containers...');
    needsCleanup = true;
    await runner({
      command: 'docker',
      args: [...composeArgs, 'up', '-d'],
      captureOutput: true,
      timeout: DEFAULT_UP_TIMEOUT_MS,
    });
    logger.log('✔ Rehearsal stack containers launched.');

    // 6. Polling for readiness (locality-init completed successfully)
    logger.log('6/6 Waiting for locality initialization and service readiness...');
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
      lastReadiness = checkRehearsalServicesReadiness(entries);

      if (lastReadiness.failures.length > 0) {
        throw new Error(`Rehearsal service failure detected:\n${lastReadiness.failures.join('\n')}`);
      }

      if (lastReadiness.ready) {
        isReady = true;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, resolvedPollIntervalMs));
    }

    if (!isReady) {
      const pendingList = lastReadiness?.pending?.join(', ') || 'none';
      throw new Error(`Timeout (${resolvedTimeoutMs}ms) waiting for rehearsal services readiness. Pending: ${pendingList}`);
    }
    logger.log('✔ All services healthy (migration exited 0, locality-init exited 0, SMS worker running).');

    // 7. Assert runtime HTTP contracts
    logger.log('Asserting post-initialization runtime contracts (profile, readiness, 25 neighborhoods, Web)...');
    const contractResults = await assertRehearsalRuntimeContracts({
      apiPort: resolvedApiPort,
      webPort: resolvedWebPort,
      httpRunner,
      expectedPackage: clonedPackage,
    });
    logger.log('✔ Runtime contracts verified successfully.');

    // 8. Verify evidence boundary (tracked package is unchanged)
    const currentTrackedContent = fs.readFileSync(sourcePath, 'utf8');
    if (currentTrackedContent !== sourceContent) {
      throw new Error('Evidence boundary violation: source deployment package changed during rehearsal!');
    }

    return {
      success: true,
      projectName,
      imageTag: resolvedImageTag,
      profile: sourcePackage.slug,
      localityName: sourcePackage.locality.name,
      neighborhoodsCount: sourcePackage.neighborhoods.length,
      apiPort: resolvedApiPort,
      webPort: resolvedWebPort,
      contractResults,
    };
  } catch (err) {
    const sanitizedMsg = redactSensitiveOutput(err.message, secretsToRedact);
    logger.error(`\n❌ Error during locality deployment rehearsal: ${sanitizedMsg}`);

    if (needsCleanup) {
      try {
        logger.log('\n--- Collecting Failure Diagnostics ---');
        const diagnostics = await collectRehearsalRedactedDiagnostics({
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
        logger.log('\nCleaning up rehearsal stack resources...');
        await cleanupRehearsalStack({
          composeArgs,
          projectName,
          runner,
        });
        logger.log('✔ Rehearsal stack resources stopped and removed.');
      } catch (cleanupErr) {
        const sanitizedCleanupError = redactSensitiveOutput(cleanupErr.message, secretsToRedact);
        logger.error(`Cleanup error: ${sanitizedCleanupError}`);
        cleanupFailure = new Error(`Rehearsal stack cleanup failed: ${sanitizedCleanupError}`);
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
    try {
      cleanupTemporaryRehearsalClone(tempDeploymentsDir);
    } catch (cloneCleanupErr) {
      const sanitizedCloneError = redactSensitiveOutput(cloneCleanupErr.message, secretsToRedact);
      logger.error(`Temporary clone cleanup error: ${sanitizedCloneError}`);
      cleanupFailure = new Error(
        cleanupFailure
          ? `${cleanupFailure.message}; temporary clone cleanup failed: ${sanitizedCloneError}`
          : `Temporary clone cleanup failed: ${sanitizedCloneError}`
      );
    }

    if (cleanupFailure) {
      throw cleanupFailure;
    }
  }
}
