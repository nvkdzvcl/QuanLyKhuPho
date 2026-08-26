import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  AccountStatus,
  type ApiResponseEnvelope,
  type CurrentUserResponseDto,
  type DevSmsInboxItemDto,
  type SendOtpResponseDto,
  UserRole,
  type VerifyOtpResponseDto,
} from '@quanlykhupho/shared-types';

/**
 * SRS NFR-03 API Latency Benchmark and Acceptance Specification.
 *
 * Requirements:
 * - Real-stack measurement against running NestJS HTTP API, PostgreSQL (qlkp_e2e), and Redis (DB 15).
 * - Bounded concurrency between 2 and 10.
 * - Warm-up phase followed by >= 20 measured request samples per representative endpoint.
 * - Deterministic percentile calculations (p50, p95, p99) using the Nearest-Rank method.
 * - Zero unexpected HTTP errors or failed response envelopes.
 * - Strictly enforce per-endpoint and aggregate p95 < 500 ms.
 * - Never log or leak sensitive credentials (phone numbers, OTPs, session cookies, raw payloads).
 */

const NFR_03_MAX_P95_MS = 500;
const WARM_UP_REQUESTS = 5;
const SAMPLE_REQUESTS = 30;
const CONCURRENCY = 5;

export interface RequestSample {
  latencyMs: number;
  statusCode: number;
  successEnvelope: boolean;
  errorMessage?: string;
}

export interface EndpointBenchmarkResult {
  endpoint: string;
  method: string;
  isProtected: boolean;
  sampleCount: number;
  failureCount: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  latencies: number[];
  failures: string[];
}

/**
 * Deterministic percentile calculation using the Nearest-Rank method.
 *
 * Mathematical Definition:
 * 1. Let L = [l_0, l_1, ..., l_{N-1}] be the list of N measured response durations in ascending order.
 * 2. For any desired percentile P in the interval (0, 100]:
 *    - Compute the 1-based rank: rank = Math.ceil((P / 100) * N)
 *    - Compute the 0-based array index: index = Math.max(0, Math.min(N - 1, rank - 1))
 *    - The percentile value is: P_val = L[index]
 *
 * Properties:
 * - Deterministic: identical sample inputs always yield identical percentile outputs.
 * - Exact: returned values correspond directly to real observed latency measurements.
 * - Monotonic: P_1 <= P_2 for all 0 < P_1 <= P_2 <= 100.
 */
export function calculatePercentile(
  sortedLatencies: number[],
  percentile: number,
): number {
  if (sortedLatencies.length === 0) {
    return 0;
  }
  if (percentile <= 0) {
    return sortedLatencies[0]!;
  }
  if (percentile >= 100) {
    return sortedLatencies[sortedLatencies.length - 1]!;
  }
  const rank = Math.ceil((percentile / 100) * sortedLatencies.length);
  const index = Math.max(0, Math.min(sortedLatencies.length - 1, rank - 1));
  return sortedLatencies[index]!;
}

/**
 * Executes requests with bounded concurrency, recording per-request latency and status.
 */
async function executeConcurrentSamples(
  apiContext: APIRequestContext,
  endpoint: string,
  totalRequests: number,
  concurrency: number,
): Promise<RequestSample[]> {
  const samples: RequestSample[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < totalRequests) {
      nextIndex += 1;
      let latencyMs = 0;
      let statusCode = 0;
      let successEnvelope = false;
      let errorMessage: string | undefined;

      try {
        const start = performance.now();
        const response = await apiContext.get(endpoint);
        latencyMs = performance.now() - start;
        statusCode = response.status();

        if (response.ok()) {
          const body = (await response.json()) as { success?: boolean };
          successEnvelope = body?.success === true;
          if (!successEnvelope) {
            errorMessage = 'Response envelope success was not true';
          }
        } else {
          errorMessage = `HTTP status ${statusCode}`;
        }
      } catch (err) {
        const errorText = err instanceof Error ? err.message : String(err);
        errorMessage = `Request exception: ${errorText}`;
      }

      samples.push({
        latencyMs,
        statusCode,
        successEnvelope,
        errorMessage,
      });
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), totalRequests);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  return samples;
}

/**
 * Warms up an endpoint before measuring to prime JIT compilation and database connection pools.
 */
async function warmUpEndpoint(
  apiContext: APIRequestContext,
  endpoint: string,
  count: number,
): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    try {
      await apiContext.get(endpoint);
    } catch {
      // Warm-up primes runtime and DB connections; errors during warm-up are non-fatal
    }
  }
}

/**
 * Runs warm-up and bounded concurrent sampling for a single endpoint.
 */
async function benchmarkEndpoint(
  apiContext: APIRequestContext,
  endpoint: string,
  options: {
    method?: string;
    isProtected?: boolean;
    warmUpCount?: number;
    sampleCount?: number;
    concurrency?: number;
  } = {},
): Promise<EndpointBenchmarkResult> {
  const method = options.method || 'GET';
  const isProtected = options.isProtected ?? false;
  const warmUpCount = options.warmUpCount ?? WARM_UP_REQUESTS;
  const sampleCount = options.sampleCount ?? SAMPLE_REQUESTS;
  const concurrency = options.concurrency ?? CONCURRENCY;

  // 1. Warm up
  await warmUpEndpoint(apiContext, endpoint, warmUpCount);

  // 2. Measure bounded concurrent samples
  const samples = await executeConcurrentSamples(
    apiContext,
    endpoint,
    sampleCount,
    concurrency,
  );

  const latencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
  const failures: string[] = [];

  for (const sample of samples) {
    if (
      sample.statusCode !== 200 ||
      !sample.successEnvelope ||
      sample.errorMessage
    ) {
      failures.push(sample.errorMessage || `HTTP ${sample.statusCode}`);
    }
  }

  const minMs = latencies[0] ?? 0;
  const maxMs = latencies[latencies.length - 1] ?? 0;
  const avgMs =
    latencies.length > 0
      ? latencies.reduce((sum, v) => sum + v, 0) / latencies.length
      : 0;
  const p50Ms = calculatePercentile(latencies, 50);
  const p95Ms = calculatePercentile(latencies, 95);
  const p99Ms = calculatePercentile(latencies, 99);

  return {
    endpoint,
    method,
    isProtected,
    sampleCount: samples.length,
    failureCount: failures.length,
    p50Ms,
    p95Ms,
    p99Ms,
    minMs,
    maxMs,
    avgMs,
    latencies,
    failures,
  };
}

/**
 * Authenticates the bootstrapped officer via OTP without leaking credentials.
 */
async function authenticateOfficer(
  apiContext: APIRequestContext,
): Promise<void> {
  const phoneNumber = process.env.BOOTSTRAP_OFFICER_PHONE || '0901234567';

  // Snapshot existing dev SMS inbox command IDs before requesting OTP
  const initialInboxRes = await apiContext.get('/api/dev/sms-inbox');
  expect(initialInboxRes.status()).toBe(200);
  const initialInboxEnvelope =
    (await initialInboxRes.json()) as ApiResponseEnvelope<DevSmsInboxItemDto[]>;
  expect(initialInboxEnvelope.success).toBe(true);
  const initialCommandIds = new Set(
    initialInboxEnvelope.data.map((item) => item.commandId),
  );

  // 1. Request OTP via public endpoint
  const sendOtpRes = await apiContext.post('/api/auth/send-otp', {
    data: { phoneNumber },
  });
  expect(sendOtpRes.status()).toBe(200);
  const sendOtpEnvelope =
    (await sendOtpRes.json()) as ApiResponseEnvelope<SendOtpResponseDto>;
  expect(sendOtpEnvelope.success).toBe(true);
  expect(sendOtpEnvelope.data.expiresIn).toBe(300);

  // 2. Retrieve newly dispatched OTP from loopback-only dev SMS inbox
  const inboxRes = await apiContext.get('/api/dev/sms-inbox');
  expect(inboxRes.status()).toBe(200);
  const inboxEnvelope =
    (await inboxRes.json()) as ApiResponseEnvelope<DevSmsInboxItemDto[]>;
  expect(inboxEnvelope.success).toBe(true);

  const matchedItem = inboxEnvelope.data.find(
    (item) => !initialCommandIds.has(item.commandId),
  );
  expect(
    matchedItem,
    'Expected to find matching OTP in development SMS inbox for the sent command',
  ).toBeDefined();

  const otpCode = matchedItem!.otpCode;
  expect(otpCode).toMatch(/^\d{6}$/);

  // 3. Verify OTP to establish authenticated session (cookie captured by apiContext)
  const verifyOtpRes = await apiContext.post('/api/auth/verify-otp', {
    data: { phoneNumber, otpCode },
  });
  expect(verifyOtpRes.status()).toBe(200);
  const verifyOtpEnvelope =
    (await verifyOtpRes.json()) as ApiResponseEnvelope<VerifyOtpResponseDto>;
  expect(verifyOtpEnvelope.success).toBe(true);
  expect(verifyOtpEnvelope.data.isRegistered).toBe(true);

  // 4. Verify officer session via /api/auth/me
  const meRes = await apiContext.get('/api/auth/me');
  expect(meRes.status()).toBe(200);
  const meEnvelope =
    (await meRes.json()) as ApiResponseEnvelope<CurrentUserResponseDto>;
  expect(meEnvelope.success).toBe(true);
  expect(meEnvelope.data.user.role).toBe(UserRole.OFFICER);
  expect(meEnvelope.data.user.status).toBe(AccountStatus.ACTIVE);
}

function formatReportRow(
  endpoint: string,
  samples: number | string,
  failures: number | string,
  p50: number | string,
  p95: number | string,
  p99: number | string,
  status: string,
): string {
  const epCol = String(endpoint).padEnd(36);
  const sCol = String(samples).padStart(9);
  const fCol = String(failures).padStart(10);
  const p50Col = (typeof p50 === 'number' ? p50.toFixed(2) : p50).padStart(11);
  const p95Col = (typeof p95 === 'number' ? p95.toFixed(2) : p95).padStart(11);
  const p99Col = (typeof p99 === 'number' ? p99.toFixed(2) : p99).padStart(11);
  const stCol = status.padStart(8);
  return `| ${epCol} | ${sCol} | ${fCol} | ${p50Col} | ${p95Col} | ${p99Col} | ${stCol} |`;
}

function generateSummaryReport(
  results: EndpointBenchmarkResult[],
  aggregate: {
    totalSamples: number;
    totalFailures: number;
    aggregateP50: number;
    aggregateP95: number;
    aggregateP99: number;
    aggregateMin: number;
    aggregateMax: number;
    aggregateAvg: number;
  },
): string {
  const separator =
    '+' +
    '-'.repeat(38) +
    '+' +
    '-'.repeat(11) +
    '+' +
    '-'.repeat(12) +
    '+' +
    '-'.repeat(13) +
    '+' +
    '-'.repeat(13) +
    '+' +
    '-'.repeat(13) +
    '+' +
    '-'.repeat(10) +
    '+';

  const lines: string[] = [
    '',
    '========================================================================================================================',
    '                        SRS NFR-03 REAL-STACK API LATENCY ACCEPTANCE REPORT (LAB HARNESS)                               ',
    ` Threshold: p95 < ${NFR_03_MAX_P95_MS}.00 ms | Sample Size: >= 20 / endpoint | Concurrency: ${CONCURRENCY} (Bounded) | Scope: Lab/CI `,
    '========================================================================================================================',
    separator,
    formatReportRow(
      'Endpoint',
      'Samples',
      'Failures',
      'p50 (ms)',
      'p95 (ms)',
      'p99 (ms)',
      'Status',
    ),
    separator,
  ];

  for (const r of results) {
    const passed = r.failureCount === 0 && r.p95Ms < NFR_03_MAX_P95_MS;
    lines.push(
      formatReportRow(
        `${r.method} ${r.endpoint}`,
        r.sampleCount,
        r.failureCount,
        r.p50Ms,
        r.p95Ms,
        r.p99Ms,
        passed ? 'PASS' : 'FAIL',
      ),
    );
  }

  lines.push(separator);
  const aggregatePassed =
    aggregate.totalFailures === 0 && aggregate.aggregateP95 < NFR_03_MAX_P95_MS;
  lines.push(
    formatReportRow(
      `AGGREGATE (${results.length} endpoints)`,
      aggregate.totalSamples,
      aggregate.totalFailures,
      aggregate.aggregateP50,
      aggregate.aggregateP95,
      aggregate.aggregateP99,
      aggregatePassed ? 'PASS' : 'FAIL',
    ),
  );
  lines.push(separator);
  lines.push(
    ` Latency summary: Min = ${aggregate.aggregateMin.toFixed(2)} ms | Avg = ${aggregate.aggregateAvg.toFixed(2)} ms | Max = ${aggregate.aggregateMax.toFixed(2)} ms`,
  );
  lines.push(
    ` Deterministic rule: Nearest-Rank Percentile (rank = ceil((P/100)*N), index = max(0, min(N-1, rank-1)))`,
  );
  lines.push(
    ` Acceptance decision: ${aggregatePassed ? 'ACCEPTED (p95 < 500 ms across all endpoints)' : 'REJECTED (p95 >= 500 ms or failures detected)'}`,
  );
  lines.push(
    '========================================================================================================================',
  );
  lines.push('');

  return lines.join('\n');
}

test.describe.serial(
  'API Latency Acceptance Harness (SRS NFR-03: p95 < 500 ms)',
  () => {
    let apiContext: APIRequestContext;
    const benchmarkResults: EndpointBenchmarkResult[] = [];

    test.beforeAll(async ({ playwright, baseURL }) => {
      apiContext = await playwright.request.newContext({
        baseURL: baseURL || 'http://localhost:4000',
        extraHTTPHeaders: {
          Accept: 'application/json',
          Origin: baseURL || 'http://localhost:4000',
        },
      });

      // Authenticate officer session via dev OTP flow
      await authenticateOfficer(apiContext);
    });

    test.afterAll(async () => {
      await apiContext?.dispose();
    });

    test('GET /api/deployment-profile meets SRS NFR-03 (p95 < 500 ms)', async () => {
      const result = await benchmarkEndpoint(
        apiContext,
        '/api/deployment-profile',
        {
          isProtected: false,
        },
      );
      benchmarkResults.push(result);

      expect(
        result.failureCount,
        `Failures on ${result.endpoint}: ${result.failures.join(', ')}`,
      ).toBe(0);
      expect(result.sampleCount).toBeGreaterThanOrEqual(20);
      expect(
        result.p95Ms,
        `${result.endpoint} p95 (${result.p95Ms.toFixed(2)} ms) must be < ${NFR_03_MAX_P95_MS} ms`,
      ).toBeLessThan(NFR_03_MAX_P95_MS);
    });

    test('GET /api/neighborhoods meets SRS NFR-03 (p95 < 500 ms)', async () => {
      const result = await benchmarkEndpoint(apiContext, '/api/neighborhoods', {
        isProtected: false,
      });
      benchmarkResults.push(result);

      expect(
        result.failureCount,
        `Failures on ${result.endpoint}: ${result.failures.join(', ')}`,
      ).toBe(0);
      expect(result.sampleCount).toBeGreaterThanOrEqual(20);
      expect(
        result.p95Ms,
        `${result.endpoint} p95 (${result.p95Ms.toFixed(2)} ms) must be < ${NFR_03_MAX_P95_MS} ms`,
      ).toBeLessThan(NFR_03_MAX_P95_MS);
    });

    test('GET /api/auth/me meets SRS NFR-03 (p95 < 500 ms)', async () => {
      const result = await benchmarkEndpoint(apiContext, '/api/auth/me', {
        isProtected: true,
      });
      benchmarkResults.push(result);

      expect(
        result.failureCount,
        `Failures on ${result.endpoint}: ${result.failures.join(', ')}`,
      ).toBe(0);
      expect(result.sampleCount).toBeGreaterThanOrEqual(20);
      expect(
        result.p95Ms,
        `${result.endpoint} p95 (${result.p95Ms.toFixed(2)} ms) must be < ${NFR_03_MAX_P95_MS} ms`,
      ).toBeLessThan(NFR_03_MAX_P95_MS);
    });

    test('GET /api/dashboard/ward-overview meets SRS NFR-03 (p95 < 500 ms)', async () => {
      const result = await benchmarkEndpoint(
        apiContext,
        '/api/dashboard/ward-overview',
        {
          isProtected: true,
        },
      );
      benchmarkResults.push(result);

      expect(
        result.failureCount,
        `Failures on ${result.endpoint}: ${result.failures.join(', ')}`,
      ).toBe(0);
      expect(result.sampleCount).toBeGreaterThanOrEqual(20);
      expect(
        result.p95Ms,
        `${result.endpoint} p95 (${result.p95Ms.toFixed(2)} ms) must be < ${NFR_03_MAX_P95_MS} ms`,
      ).toBeLessThan(NFR_03_MAX_P95_MS);
    });

    test('GET /api/petitions meets SRS NFR-03 (p95 < 500 ms)', async () => {
      const result = await benchmarkEndpoint(apiContext, '/api/petitions', {
        isProtected: true,
      });
      benchmarkResults.push(result);

      expect(
        result.failureCount,
        `Failures on ${result.endpoint}: ${result.failures.join(', ')}`,
      ).toBe(0);
      expect(result.sampleCount).toBeGreaterThanOrEqual(20);
      expect(
        result.p95Ms,
        `${result.endpoint} p95 (${result.p95Ms.toFixed(2)} ms) must be < ${NFR_03_MAX_P95_MS} ms`,
      ).toBeLessThan(NFR_03_MAX_P95_MS);
    });

    test('Aggregate latency across all endpoints satisfies SRS NFR-03 (p95 < 500 ms)', async () => {
      const testInfo = test.info();
      expect(benchmarkResults.length).toBe(5);

      const allLatencies = benchmarkResults
        .flatMap((r) => r.latencies)
        .sort((a, b) => a - b);
      const totalFailures = benchmarkResults.reduce(
        (sum, r) => sum + r.failureCount,
        0,
      );
      const totalSamples = allLatencies.length;

      const aggregateP50 = calculatePercentile(allLatencies, 50);
      const aggregateP95 = calculatePercentile(allLatencies, 95);
      const aggregateP99 = calculatePercentile(allLatencies, 99);
      const aggregateMin = allLatencies[0] ?? 0;
      const aggregateMax = allLatencies[allLatencies.length - 1] ?? 0;
      const aggregateAvg =
        totalSamples > 0
          ? allLatencies.reduce((sum, v) => sum + v, 0) / totalSamples
          : 0;

      const summaryReport = generateSummaryReport(benchmarkResults, {
        totalSamples,
        totalFailures,
        aggregateP50,
        aggregateP95,
        aggregateP99,
        aggregateMin,
        aggregateMax,
        aggregateAvg,
      });

      // Output report to test runner and attach artifact
      console.log(summaryReport);
      await testInfo.attach('api-latency-acceptance-summary.txt', {
        body: summaryReport,
        contentType: 'text/plain',
      });

      expect(
        totalFailures,
        'Total request failures across all benchmarked endpoints must be 0',
      ).toBe(0);
      expect(
        aggregateP95,
        `Aggregate p95 (${aggregateP95.toFixed(2)} ms) must be strictly below ${NFR_03_MAX_P95_MS} ms (SRS NFR-03)`,
      ).toBeLessThan(NFR_03_MAX_P95_MS);
    });
  },
);
