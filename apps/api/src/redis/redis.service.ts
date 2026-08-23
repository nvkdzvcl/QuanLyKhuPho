import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private memoryStore: Map<string, { value: string; expireAt?: number }> = new Map();
  private memorySets: Map<string, Set<string>> = new Map();
  private isMemoryMode = false;
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
  }

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      if (this.isProduction) {
        throw new Error('Redis configuration is required in production');
      }
      this.logger.warn('REDIS_URL not configured; running in in-memory fallback mode');
      this.isMemoryMode = true;
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: () => null, // don't retry endlessly in testing
      });

      await this.client.connect();
      this.logger.log('Connected to Redis server');
    } catch (err) {
      if (this.isProduction) {
        this.logger.error('Redis connection failed');
        throw new Error('Redis connection failed', { cause: err });
      }
      this.logger.warn('Redis connection failed; using in-memory development fallback');
      this.isMemoryMode = true;
      this.client = null;
    }
  }

  private handleOperationFailure(operation: string, error: unknown): void {
    if (this.isProduction) {
      this.logger.error(`Redis ${operation} failed`);
      throw new Error(`Redis ${operation} failed`, { cause: error });
    }
    this.logger.warn(`Redis ${operation} failed; using in-memory development fallback`);
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  /**
   * Cleans expired keys from in-memory store.
   */
  private cleanMemoryStore() {
    const now = Date.now();
    for (const [key, item] of this.memoryStore.entries()) {
      if (item.expireAt && item.expireAt <= now) {
        this.memoryStore.delete(key);
      }
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.client && !this.isMemoryMode) {
      try {
        return await this.client.get(key);
      } catch (err) {
        this.handleOperationFailure('get', err);
      }
    }

    this.cleanMemoryStore();
    const item = this.memoryStore.get(key);
    if (!item) return null;
    if (item.expireAt && item.expireAt <= Date.now()) {
      this.memoryStore.delete(key);
      return null;
    }
    return item.value;
  }

  async getdel(key: string): Promise<string | null> {
    if (this.client && !this.isMemoryMode) {
      try {
        return await this.client.getdel(key);
      } catch (err) {
        this.handleOperationFailure('getdel', err);
      }
    }

    this.cleanMemoryStore();
    const item = this.memoryStore.get(key);
    this.memoryStore.delete(key);
    if (!item || (item.expireAt && item.expireAt <= Date.now())) return null;
    return item.value;
  }

  async set(key: string, value: string): Promise<void> {
    if (this.client && !this.isMemoryMode) {
      try {
        await this.client.set(key, value);
        return;
      } catch (err) {
        this.handleOperationFailure('set', err);
      }
    }
    this.memoryStore.set(key, { value });
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    if (this.client && !this.isMemoryMode) {
      try {
        await this.client.setex(key, seconds, value);
        return;
      } catch (err) {
        this.handleOperationFailure('setex', err);
      }
    }
    this.memoryStore.set(key, {
      value,
      expireAt: Date.now() + seconds * 1000,
    });
  }

  /**
   * Atomic SET NX EX for distributed lock / claim pattern.
   * Returns true if key was set, false if key already exists.
   */
  async setNxEx(key: string, value: string, seconds: number): Promise<boolean> {
    if (this.client && !this.isMemoryMode) {
      try {
        const res = await this.client.set(key, value, 'EX', seconds, 'NX');
        return res === 'OK';
      } catch (err) {
        this.handleOperationFailure('setNxEx', err);
      }
    }

    this.cleanMemoryStore();
    const item = this.memoryStore.get(key);
    const now = Date.now();
    if (item && (!item.expireAt || item.expireAt > now)) {
      return false;
    }
    this.memoryStore.set(key, {
      value,
      expireAt: now + seconds * 1000,
    });
    return true;
  }

  async del(key: string): Promise<void> {
    if (this.client && !this.isMemoryMode) {
      try {
        await this.client.del(key);
        return;
      } catch (err) {
        this.handleOperationFailure('del', err);
      }
    }
    this.memoryStore.delete(key);
    this.memorySets.delete(key);
  }

  async incr(key: string): Promise<number> {
    if (this.client && !this.isMemoryMode) {
      try {
        return await this.client.incr(key);
      } catch (err) {
        this.handleOperationFailure('incr', err);
      }
    }
    this.cleanMemoryStore();
    const item = this.memoryStore.get(key);
    let val = 1;
    const expireAt = item?.expireAt;
    if (item) {
      val = parseInt(item.value, 10) + 1;
    }
    this.memoryStore.set(key, { value: String(val), expireAt });
    return val;
  }

  async ttl(key: string): Promise<number> {
    if (this.client && !this.isMemoryMode) {
      try {
        return await this.client.ttl(key);
      } catch (err) {
        this.handleOperationFailure('ttl', err);
      }
    }
    this.cleanMemoryStore();
    const item = this.memoryStore.get(key);
    if (!item) return -2;
    if (!item.expireAt) return -1;
    const remainingMs = item.expireAt - Date.now();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : -2;
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (this.client && !this.isMemoryMode) {
      try {
        await this.client.expire(key, seconds);
        return;
      } catch (err) {
        this.handleOperationFailure('expire', err);
      }
    }
    const item = this.memoryStore.get(key);
    if (item) {
      item.expireAt = Date.now() + seconds * 1000;
      this.memoryStore.set(key, item);
    }
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (this.client && !this.isMemoryMode) {
      try {
        await this.client.sadd(key, ...members);
        return;
      } catch (err) {
        this.handleOperationFailure('sadd', err);
      }
    }
    let set = this.memorySets.get(key);
    if (!set) {
      set = new Set<string>();
      this.memorySets.set(key, set);
    }
    members.forEach((m) => set!.add(m));
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    if (this.client && !this.isMemoryMode) {
      try {
        await this.client.srem(key, ...members);
        return;
      } catch (err) {
        this.handleOperationFailure('srem', err);
      }
    }
    const set = this.memorySets.get(key);
    if (set) {
      members.forEach((m) => set.delete(m));
    }
  }

  async smembers(key: string): Promise<string[]> {
    if (this.client && !this.isMemoryMode) {
      try {
        return await this.client.smembers(key);
      } catch (err) {
        this.handleOperationFailure('smembers', err);
      }
    }
    const set = this.memorySets.get(key);
    return set ? Array.from(set) : [];
  }

  /**
   * Atomic check and increment for OTP rate-limiting.
   * Allows at most `limit` sends per `windowSeconds`.
   * Returns { allowed: boolean, remainingTtl: number, currentCount: number }
   */
  async checkAndIncrementRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; retryAfter: number; count: number }> {
    if (this.client && !this.isMemoryMode) {
      try {
        const luaScript = `
          local key = KEYS[1]
          local limit = tonumber(ARGV[1])
          local window = tonumber(ARGV[2])
          local current = redis.call('get', key)
          if current and tonumber(current) >= limit then
            local remainingTtl = redis.call('ttl', key)
            return {0, remainingTtl, tonumber(current)}
          else
            local count = redis.call('incr', key)
            if count == 1 then
              redis.call('expire', key, window)
            end
            local remainingTtl = redis.call('ttl', key)
            return {1, remainingTtl, count}
          end
        `;
        const res = (await this.client.eval(luaScript, 1, key, limit, windowSeconds)) as [
          number,
          number,
          number,
        ];
        return {
          allowed: res[0] === 1,
          retryAfter: res[1] > 0 ? res[1] : windowSeconds,
          count: res[2],
        };
      } catch (err) {
        this.handleOperationFailure('rate-limit script', err);
      }
    }

    // In-memory fallback
    this.cleanMemoryStore();
    const item = this.memoryStore.get(key);
    const now = Date.now();

    if (item && item.expireAt && item.expireAt > now) {
      const current = parseInt(item.value, 10);
      const remainingSec = Math.ceil((item.expireAt - now) / 1000);
      if (current >= limit) {
        return { allowed: false, retryAfter: remainingSec, count: current };
      }
      const nextVal = current + 1;
      this.memoryStore.set(key, { value: String(nextVal), expireAt: item.expireAt });
      return { allowed: true, retryAfter: remainingSec, count: nextVal };
    } else {
      const expireAt = now + windowSeconds * 1000;
      this.memoryStore.set(key, { value: '1', expireAt });
      return { allowed: true, retryAfter: windowSeconds, count: 1 };
    }
  }

  /**
   * Atomic recording of failed OTP attempt and locking if maximum attempts exceeded.
   * Returns { isLocked: boolean, count: number, remainingAttempts: number, lockoutTtl: number }
   */
  async recordFailedOtpAttempt(
    failedKey: string,
    lockoutKey: string,
    otpHashKey: string,
    maxAttempts: number,
    lockoutSeconds: number,
  ): Promise<{ isLocked: boolean; count: number; remainingAttempts: number }> {
    if (this.client && !this.isMemoryMode) {
      try {
        const luaScript = `
          local failedKey = KEYS[1]
          local lockoutKey = KEYS[2]
          local otpHashKey = KEYS[3]
          local maxAttempts = tonumber(ARGV[1])
          local lockoutTtl = tonumber(ARGV[2])

          local count = redis.call('incr', failedKey)
          if count == 1 then
            redis.call('expire', failedKey, 300)
          end

          if count >= maxAttempts then
            redis.call('set', lockoutKey, '1', 'EX', lockoutTtl)
            redis.call('del', failedKey)
            redis.call('del', otpHashKey)
            return {1, count, 0}
          else
            return {0, count, maxAttempts - count}
          end
        `;
        const res = (await this.client.eval(
          luaScript,
          3,
          failedKey,
          lockoutKey,
          otpHashKey,
          maxAttempts,
          lockoutSeconds,
        )) as [number, number, number];
        return {
          isLocked: res[0] === 1,
          count: res[1],
          remainingAttempts: res[2],
        };
      } catch (err) {
        this.handleOperationFailure('failed-attempt script', err);
      }
    }

    // In-memory fallback
    this.cleanMemoryStore();
    const item = this.memoryStore.get(failedKey);
    const now = Date.now();
    let count = 1;

    if (item && item.expireAt && item.expireAt > now) {
      count = parseInt(item.value, 10) + 1;
    }

    if (count >= maxAttempts) {
      this.memoryStore.set(lockoutKey, {
        value: '1',
        expireAt: now + lockoutSeconds * 1000,
      });
      this.memoryStore.delete(failedKey);
      this.memoryStore.delete(otpHashKey);
      return { isLocked: true, count, remainingAttempts: 0 };
    } else {
      this.memoryStore.set(failedKey, {
        value: String(count),
        expireAt: now + 300 * 1000,
      });
      return {
        isLocked: false,
        count,
        remainingAttempts: maxAttempts - count,
      };
    }
  }
}
