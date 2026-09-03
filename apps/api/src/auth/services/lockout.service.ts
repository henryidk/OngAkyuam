import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import {
  LOCKOUT_TTL_SECONDS,
  LOGIN_FAILURES_TTL_SECONDS,
  MAX_LOGIN_ATTEMPTS,
  REDIS_KEYS,
} from '../constants/auth.constants';

@Injectable()
export class LockoutService {
  constructor(private readonly redis: RedisService) {}

  async getSecondsRemaining(username: string): Promise<number | null> {
    const lockoutUntil = await this.redis.get(
      REDIS_KEYS.loginLockout(username),
    );
    if (!lockoutUntil) {
      return null;
    }
    const secondsRemaining = Math.ceil(
      (Number(lockoutUntil) - Date.now()) / 1000,
    );
    return secondsRemaining > 0 ? secondsRemaining : null;
  }

  async registerFailure(username: string): Promise<void> {
    const key = REDIS_KEYS.loginFailures(username);
    const current = await this.redis.get(key);
    const attempts = current ? Number(current) + 1 : 1;

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      const lockoutUntil = Date.now() + LOCKOUT_TTL_SECONDS * 1000;
      await this.redis.set(
        REDIS_KEYS.loginLockout(username),
        String(lockoutUntil),
        LOCKOUT_TTL_SECONDS,
      );
      await this.redis.del(key);
      return;
    }

    await this.redis.set(key, String(attempts), LOGIN_FAILURES_TTL_SECONDS);
  }

  async reset(username: string): Promise<void> {
    await Promise.all([
      this.redis.del(REDIS_KEYS.loginFailures(username)),
      this.redis.del(REDIS_KEYS.loginLockout(username)),
    ]);
  }
}
