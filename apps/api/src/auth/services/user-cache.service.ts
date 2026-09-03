import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import {
  REDIS_KEYS,
  USER_CACHE_TTL_SECONDS,
} from '../constants/auth.constants';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

// Dueño único del ciclo de vida de user_cache:{id} — JwtStrategy lo consulta/
// llena, y cualquier flujo que cambie datos cacheados (password, rol, estado)
// debe invalidar por acá en vez de llamar a RedisService directo.
@Injectable()
export class UserCacheService {
  constructor(private readonly redis: RedisService) {}

  async get(usuarioId: string): Promise<AuthenticatedUser | null> {
    const cached = await this.redis.get(REDIS_KEYS.userCache(usuarioId));
    return cached ? (JSON.parse(cached) as AuthenticatedUser) : null;
  }

  async set(usuarioId: string, usuario: AuthenticatedUser): Promise<void> {
    await this.redis.set(
      REDIS_KEYS.userCache(usuarioId),
      JSON.stringify(usuario),
      USER_CACHE_TTL_SECONDS,
    );
  }

  async invalidate(usuarioId: string): Promise<void> {
    await this.redis.del(REDIS_KEYS.userCache(usuarioId));
  }
}
