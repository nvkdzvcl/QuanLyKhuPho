import { describe, it, expect, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@quanlykhupho/shared-types';
import { OperationalMetricsService } from './operational-metrics.service';
import { ObservabilityController } from './observability.controller';
import { ROLES_KEY } from '../security/decorators/roles.decorator';
import { AuthGuard } from '../security/guards/auth.guard';
import { RolesGuard } from '../security/guards/roles.guard';

describe('OperationalMetricsService', () => {
  let service: OperationalMetricsService;

  beforeEach(() => {
    service = new OperationalMetricsService();
  });

  describe('Zero / Initial State', () => {
    it('returns zero aggregates and null push success rate on fresh initialization', () => {
      const snapshot = service.getSnapshot();

      expect(typeof snapshot.startedAt).toBe('string');
      expect(new Date(snapshot.startedAt).getTime()).not.toBeNaN();
      expect(snapshot.uptimeSeconds).toBeGreaterThanOrEqual(0);

      expect(snapshot.http.totalRequests).toBe(0);
      expect(snapshot.http.serverErrorRequests).toBe(0);
      expect(snapshot.http.averageLatencyMs).toBe(0);
      expect(snapshot.http.maxLatencyMs).toBe(0);

      expect(snapshot.push.attempts).toBe(0);
      expect(snapshot.push.successes).toBe(0);
      expect(snapshot.push.failures).toBe(0);
      expect(snapshot.push.stalePruned).toBe(0);
      expect(snapshot.push.successRatePercent).toBeNull();
      expect(service.getSnapshot().startedAt).toBe(snapshot.startedAt);
    });
  });

  describe('HTTP Metrics Tracking and Arithmetic', () => {
    it('records successful (non-5xx) requests accurately without incrementing server errors', () => {
      service.recordHttpRequest(45, false);
      service.recordHttpRequest(55, false);

      const snapshot = service.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(2);
      expect(snapshot.http.serverErrorRequests).toBe(0);
      expect(snapshot.http.averageLatencyMs).toBe(50);
      expect(snapshot.http.maxLatencyMs).toBe(55);
    });

    it('records 5xx server errors and updates both totalRequests and serverErrorRequests', () => {
      service.recordHttpRequest(100, true);
      service.recordHttpRequest(200, false);
      service.recordHttpRequest(300, true);

      const snapshot = service.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(3);
      expect(snapshot.http.serverErrorRequests).toBe(2);
      expect(snapshot.http.averageLatencyMs).toBe(200);
      expect(snapshot.http.maxLatencyMs).toBe(300);
    });

    it('correctly computes average and max latency across multiple varying durations', () => {
      service.recordHttpRequest(10.5, false);
      service.recordHttpRequest(20.5, false);
      service.recordHttpRequest(30.2, true);

      const snapshot = service.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(3);
      expect(snapshot.http.serverErrorRequests).toBe(1);
      // (10.5 + 20.5 + 30.2) / 3 = 61.2 / 3 = 20.4
      expect(snapshot.http.averageLatencyMs).toBe(20.4);
      expect(snapshot.http.maxLatencyMs).toBe(30.2);
    });

    it('handles negative or invalid durations safely by clamping to zero', () => {
      service.recordHttpRequest(-50, false);
      service.recordHttpRequest(Number.NaN, true);

      const snapshot = service.getSnapshot();
      expect(snapshot.http.totalRequests).toBe(2);
      expect(snapshot.http.serverErrorRequests).toBe(1);
      expect(snapshot.http.averageLatencyMs).toBe(0);
      expect(snapshot.http.maxLatencyMs).toBe(0);
    });
  });

  describe('Web Push Metrics Tracking and Rate Calculation', () => {
    it('returns null successRatePercent when there are zero push attempts', () => {
      expect(service.getSnapshot().push.successRatePercent).toBeNull();
    });

    it('calculates 100% successRatePercent when all attempts succeed', () => {
      service.recordPushAttempt();
      service.recordPushSuccess();
      service.recordPushAttempt();
      service.recordPushSuccess();

      const snapshot = service.getSnapshot();
      expect(snapshot.push.attempts).toBe(2);
      expect(snapshot.push.successes).toBe(2);
      expect(snapshot.push.failures).toBe(0);
      expect(snapshot.push.successRatePercent).toBe(100);
    });

    it('calculates 0% successRatePercent when all attempts fail', () => {
      service.recordPushAttempt();
      service.recordPushFailure();
      service.recordPushAttempt();
      service.recordPushFailure();

      const snapshot = service.getSnapshot();
      expect(snapshot.push.attempts).toBe(2);
      expect(snapshot.push.successes).toBe(0);
      expect(snapshot.push.failures).toBe(2);
      expect(snapshot.push.successRatePercent).toBe(0);
    });

    it('increments failures only on recordPushFailure and does not alter stalePruned', () => {
      service.recordPushAttempt();
      service.recordPushFailure();

      const snapshot = service.getSnapshot();
      expect(snapshot.push.attempts).toBe(1);
      expect(snapshot.push.failures).toBe(1);
      expect(snapshot.push.stalePruned).toBe(0);
      expect(snapshot.push.successRatePercent).toBe(0);
    });

    it('tracks standalone stale pruned calls via recordPushStalePruned after successful deletion', () => {
      service.recordPushStalePruned();

      const snapshot = service.getSnapshot();
      expect(snapshot.push.stalePruned).toBe(1);
    });

    it('calculates rounded percentage success rates accurately to two decimal places', () => {
      // 3 successes out of 4 attempts -> 75%
      service.recordPushAttempt();
      service.recordPushSuccess();
      service.recordPushAttempt();
      service.recordPushSuccess();
      service.recordPushAttempt();
      service.recordPushSuccess();
      service.recordPushAttempt();
      service.recordPushFailure();

      const snapshot = service.getSnapshot();
      expect(snapshot.push.attempts).toBe(4);
      expect(snapshot.push.successes).toBe(3);
      expect(snapshot.push.failures).toBe(1);
      expect(snapshot.push.successRatePercent).toBe(75);
    });

    it('correctly rounds non-terminating percentage rates to two decimal places', () => {
      // 1 success out of 3 attempts -> 33.33%
      service.recordPushAttempt();
      service.recordPushSuccess();
      service.recordPushAttempt();
      service.recordPushFailure();
      service.recordPushAttempt();
      service.recordPushFailure();

      const snapshot = service.getSnapshot();
      expect(snapshot.push.attempts).toBe(3);
      expect(snapshot.push.successes).toBe(1);
      expect(snapshot.push.failures).toBe(2);
      expect(snapshot.push.successRatePercent).toBe(33.33);
    });
  });

  describe('Privacy Invariant Verification', () => {
    it('contains strictly aggregate counters and no sensitive or personal information', () => {
      service.recordHttpRequest(50, false);
      service.recordPushAttempt();
      service.recordPushSuccess();

      const snapshot = service.getSnapshot();
      const serialized = JSON.stringify(snapshot);

      // Verify no sensitive keys or identifiable payload attributes
      expect(serialized).not.toContain('route');
      expect(serialized).not.toContain('path');
      expect(serialized).not.toContain('url');
      expect(serialized).not.toContain('header');
      expect(serialized).not.toContain('token');
      expect(serialized).not.toContain('secret');
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('phone');
      expect(serialized).not.toContain('citizenId');
    });
  });
});

describe('ObservabilityController', () => {
  let controller: ObservabilityController;
  let service: OperationalMetricsService;

  beforeEach(() => {
    service = new OperationalMetricsService();
    controller = new ObservabilityController(service);
  });

  it('returns the operational metrics snapshot on controller calls', () => {
    service.recordHttpRequest(30, false);
    const operationalSnapshot = controller.getOperationalMetrics();

    expect(operationalSnapshot.http.totalRequests).toBe(1);
    expect(operationalSnapshot.http.serverErrorRequests).toBe(0);
    expect(operationalSnapshot.http.averageLatencyMs).toBe(30);
  });

  it('is decorated with Officer role authorization requirement', () => {
    const reflector = new Reflector();
    const roles = reflector.get<UserRole[]>(ROLES_KEY, ObservabilityController);
    expect(roles).toEqual([UserRole.OFFICER]);
  });

  it('has AuthGuard and RolesGuard defined at controller level', () => {
    const guards = Reflect.getMetadata('__guards__', ObservabilityController);
    expect(guards).toBeDefined();
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(RolesGuard);
  });
});
