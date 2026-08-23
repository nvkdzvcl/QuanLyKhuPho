import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { AccountStatus, UserRole } from '@quanlykhupho/shared-types';
import { RedisService } from '../redis/redis.service';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let sessionService: SessionService;
  let redisService: RedisService;

  beforeEach(async () => {
    const configService = {
      get: () => undefined,
    } as unknown as ConfigService;

    redisService = new RedisService(configService);
    await redisService.onModuleInit();

    sessionService = new SessionService(redisService);
  });

  describe('7-Day Renewable Session', () => {
    it('should create a 7-day session in Redis and allow retrieval and touch', async () => {
      const userId = 'user-uuid-123';
      const sessionId = await sessionService.createSession(
        userId,
        UserRole.RESIDENT,
        AccountStatus.ACTIVE,
        'neighborhood-uuid-456',
      );

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');

      const session = await sessionService.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.userId).toBe(userId);
      expect(session?.role).toBe(UserRole.RESIDENT);
      expect(session?.status).toBe(AccountStatus.ACTIVE);

      // Touch session
      const prevActivity = session!.lastActivityAt;
      await new Promise((r) => setTimeout(r, 10));
      await sessionService.touchSession(sessionId);

      const touched = await sessionService.getSession(sessionId);
      expect(touched?.lastActivityAt).toBeGreaterThanOrEqual(prevActivity);
    });

    it('should destroy session on logout', async () => {
      const sessionId = await sessionService.createSession(
        'user-uuid-1',
        UserRole.RESIDENT,
        AccountStatus.ACTIVE,
        null,
      );

      await sessionService.destroySession(sessionId);
      const session = await sessionService.getSession(sessionId);
      expect(session).toBeNull();
    });

    it('should revoke all active sessions for a user when account is locked/rejected', async () => {
      const userId = 'user-uuid-multi-session';

      // User logged in on 2 devices
      const session1 = await sessionService.createSession(
        userId,
        UserRole.RESIDENT,
        AccountStatus.ACTIVE,
        null,
      );
      const session2 = await sessionService.createSession(
        userId,
        UserRole.RESIDENT,
        AccountStatus.ACTIVE,
        null,
      );

      expect(await sessionService.getSession(session1)).not.toBeNull();
      expect(await sessionService.getSession(session2)).not.toBeNull();

      // Revoke all sessions for this user
      await sessionService.revokeUserSessions(userId);

      expect(await sessionService.getSession(session1)).toBeNull();
      expect(await sessionService.getSession(session2)).toBeNull();
    });
  });

  describe('Register Token', () => {
    it('should create an opaque single-use register token with no plaintext phone embedded', async () => {
      const phone = '+84912345678';
      const phoneHash = 'hash123';
      const phoneEncrypted = 'enc123';

      const token = await sessionService.createRegisterToken(
        phoneHash,
        phoneEncrypted,
      );

      // Token is opaque random string
      expect(token).not.toContain(phone);

      // First consume -> returns data
      const tokenData = await sessionService.consumeRegisterToken(token);
      expect(tokenData).toBeDefined();
      expect(tokenData?.phoneEncrypted).toBe(phoneEncrypted);
      expect(JSON.stringify(tokenData)).not.toContain(phone);

      // Second consume (replay) -> must return null
      const replay = await sessionService.consumeRegisterToken(token);
      expect(replay).toBeNull();
    });

    it('should allow only one winner when a register token is consumed concurrently', async () => {
      const token = await sessionService.createRegisterToken('hash456', 'enc456');
      const results = await Promise.all([
        sessionService.consumeRegisterToken(token),
        sessionService.consumeRegisterToken(token),
      ]);

      expect(results.filter((result) => result !== null)).toHaveLength(1);
    });
  });
});
