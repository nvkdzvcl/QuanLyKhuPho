export interface HttpMetricsSummaryDto {
  totalRequests: number;
  serverErrorRequests: number;
  averageLatencyMs: number;
  maxLatencyMs: number;
}

export interface WebPushMetricsSummaryDto {
  attempts: number;
  successes: number;
  failures: number;
  stalePruned: number;
  successRatePercent: number | null;
}

export interface OperationalMetricsSnapshotDto {
  startedAt: string;
  uptimeSeconds: number;
  http: HttpMetricsSummaryDto;
  push: WebPushMetricsSummaryDto;
}

export type HttpMetricsSummary = HttpMetricsSummaryDto;
export type WebPushMetricsSummary = WebPushMetricsSummaryDto;
export type OperationalMetricsSnapshot = OperationalMetricsSnapshotDto;
