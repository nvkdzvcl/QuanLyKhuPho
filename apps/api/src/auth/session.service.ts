import { Injectable, Logger } from '@nestjs/common';
import { AccountStatus, UserRole } from '@quanlykhupho/shared-types';
import {
  REGISTER_TOKEN_TTL_SECONDS,
  SESSION_TTL_SECONDS,
} from '../core/constants';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

export interface SessionData {
  sessionId: string;
  userId: string;
  role: UserRole;
  status: AccountStatus;
  neighborhoodId: string | null;
  createdAt: number;
  lastActivityAt: number;
}

export interface RegisterTokenData {
  token: string;
  phoneHash: string;
  phoneEncrypted: string;
  createdAt: number;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Creates a new 7-day session in Redis.
   */
  async createSession(
    userId: string,
    role: UserRole,
    status: AccountStatus,
    neighborhoodId: string | null,
  ): Promise<string> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    const sessionData: SessionData = {
      sessionId,
      userId,
      role,
      status,
      neighborhoodId,
      createdAt: now,
      lastActivityAt: now,
    };

    const sessionKey = `session:${sessionId}`;
    const userSessionsKey = `user:sessions:${userId}`;

    await this.redisService.setex(
      sessionKey,
      SESSION_TTL_SECONDS,
      JSON.stringify(sessionData),
    );
    await this.redisService.sadd(userSessionsKey, sessionId);
    await this.redisService.expire(userSessionsKey, SESSION_TTL_SECONDS);

    return sessionId;
  }

  /**
   * Retrieves active session from Redis.
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const raw = await this.redisService.get(`session:${sessionId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  }

  /**
   * Renews the 7-day session inactivity window on authenticated activity.
   */
  async touchSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.lastActivityAt = Date.now();
    const sessionKey = `session:${sessionId}`;
    const userSessionsKey = `user:sessions:${session.userId}`;

    await this.redisService.setex(
      sessionKey,
      SESSION_TTL_SECONDS,
      JSON.stringify(session),
    );
    await this.redisService.expire(userSessionsKey, SESSION_TTL_SECONDS);
  }

  /**
   * Destroys a single session upon logout.
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      await this.redisService.srem(`user:sessions:${session.userId}`, sessionId);
    }
    await this.redisService.del(`session:${sessionId}`);
  }

  /**
   * Revokes all active sessions for a user (e.g. upon lock or rejection).
   */
  async revokeUserSessions(userId: string): Promise<void> {
    const userSessionsKey = `user:sessions:${userId}`;
    const sessionIds = await this.redisService.smembers(userSessionsKey);

    if (sessionIds && sessionIds.length > 0) {
      for (const id of sessionIds) {
        await this.redisService.del(`session:${id}`);
      }
    }
    await this.redisService.del(userSessionsKey);
    this.logger.log(`Revoked all active sessions for user ${userId}`);
  }

  /**
   * Generates a short-lived single-use register token for unknown phones.
   * Token does NOT embed plaintext phone numbers.
   */
  async createRegisterToken(
    phoneHash: string,
    phoneEncrypted: string,
  ): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenData: RegisterTokenData = {
      token,
      phoneHash,
      phoneEncrypted,
      createdAt: Date.now(),
    };

    await this.redisService.setex(
      `register_token:${token}`,
      REGISTER_TOKEN_TTL_SECONDS,
      JSON.stringify(tokenData),
    );

    return token;
  }

  /**
   * Atomically consumes a register token (single-use).
   */
  async consumeRegisterToken(token: string): Promise<RegisterTokenData | null> {
    const key = `register_token:${token}`;
    const raw = await this.redisService.getdel(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as RegisterTokenData;
    } catch {
      return null;
    }
  }
}
