export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface ServiceHealth {
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
}

export interface HealthResponseDto {
  status: HealthStatus;
  version: string;
  timestamp: string;
  environment: string;
  services: {
    database?: ServiceHealth;
    redis?: ServiceHealth;
    rabbitmq?: ServiceHealth;
  };
}

/**
 * Determines whether the overall system status is healthy.
 */
export function isSystemHealthy(health: HealthResponseDto): boolean {
  return health.status === 'ok';
}
