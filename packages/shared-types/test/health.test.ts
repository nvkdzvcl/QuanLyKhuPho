import { describe, it, expect } from 'vitest';
import { isSystemHealthy, HealthResponseDto, LivenessResponseDto } from '../src';

describe('Shared Health Types and Utilities', () => {
  it('should identify a healthy system response', () => {
    const health: HealthResponseDto = {
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      environment: 'development',
      services: {
        database: { status: 'ok', latencyMs: 2 },
        redis: { status: 'ok', latencyMs: 1 },
      },
    };

    expect(isSystemHealthy(health)).toBe(true);
  });

  it('should identify a degraded or down system response', () => {
    const degradedHealth: HealthResponseDto = {
      status: 'degraded',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      environment: 'production',
      services: {
        database: { status: 'ok', latencyMs: 2 },
        redis: { status: 'down', message: 'Connection refused' },
      },
    };

    expect(isSystemHealthy(degradedHealth)).toBe(false);

    const downHealth: HealthResponseDto = {
      status: 'down',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      environment: 'production',
      services: {
        database: { status: 'down' },
      },
    };

    expect(isSystemHealthy(downHealth)).toBe(false);
  });

  it('should support liveness response shape', () => {
    const liveness: LivenessResponseDto = {
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: 123,
    };

    expect(liveness.status).toBe('ok');
    expect(liveness.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
