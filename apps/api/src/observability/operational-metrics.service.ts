import { Injectable } from '@nestjs/common';
import {
  HttpMetricsSummaryDto,
  OperationalMetricsSnapshotDto,
  WebPushMetricsSummaryDto,
} from '@quanlykhupho/shared-types';

@Injectable()
export class OperationalMetricsService {
  private readonly startedAt = new Date(
    Date.now() - process.uptime() * 1000,
  ).toISOString();

  // Low-cardinality monotonic HTTP aggregates
  private httpTotalRequests = 0;
  private httpServerErrorRequests = 0;
  private httpTotalDurationMs = 0;
  private httpMaxLatencyMs = 0;

  // Web Push delivery aggregates (process-local health signals)
  private pushAttempts = 0;
  private pushSuccesses = 0;
  private pushFailures = 0;
  private pushStalePruned = 0;

  /**
   * Records a single completed HTTP request.
   * Privacy invariant: records only numeric duration and 5xx flag; never retains
   * URL, route, query, headers, body, identity, IP, or error message.
   */
  recordHttpRequest(durationMs: number, isServerError: boolean): void {
    const validDuration = Math.max(0, Number.isFinite(durationMs) ? durationMs : 0);
    this.httpTotalRequests += 1;
    if (isServerError) {
      this.httpServerErrorRequests += 1;
    }
    this.httpTotalDurationMs += validDuration;
    if (validDuration > this.httpMaxLatencyMs) {
      this.httpMaxLatencyMs = validDuration;
    }
  }

  /**
   * Records an outbound Web Push delivery attempt.
   */
  recordPushAttempt(): void {
    this.pushAttempts += 1;
  }

  /**
   * Records a successful Web Push dispatch.
   */
  recordPushSuccess(): void {
    this.pushSuccesses += 1;
  }

  /**
   * Records a failed Web Push dispatch.
   */
  recordPushFailure(): void {
    this.pushFailures += 1;
  }

  /**
   * Records that an expired/invalid Web Push subscription was pruned.
   */
  recordPushStalePruned(): void {
    this.pushStalePruned += 1;
  }

  /**
   * Builds a privacy-safe, process-local operational metrics snapshot.
   */
  getSnapshot(): OperationalMetricsSnapshotDto {
    const averageLatencyMs =
      this.httpTotalRequests > 0
        ? Math.round((this.httpTotalDurationMs / this.httpTotalRequests) * 100) / 100
        : 0;

    const httpSummary: HttpMetricsSummaryDto = {
      totalRequests: this.httpTotalRequests,
      serverErrorRequests: this.httpServerErrorRequests,
      averageLatencyMs,
      maxLatencyMs: Math.round(this.httpMaxLatencyMs * 100) / 100,
    };

    const successRatePercent =
      this.pushAttempts > 0
        ? Math.round((this.pushSuccesses / this.pushAttempts) * 10000) / 100
        : null;

    const pushSummary: WebPushMetricsSummaryDto = {
      attempts: this.pushAttempts,
      successes: this.pushSuccesses,
      failures: this.pushFailures,
      stalePruned: this.pushStalePruned,
      successRatePercent,
    };

    return {
      startedAt: this.startedAt,
      uptimeSeconds: Math.floor(process.uptime()),
      http: httpSummary,
      push: pushSummary,
    };
  }
}
