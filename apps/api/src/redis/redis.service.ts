import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { EnvVars } from '../config/env.schema';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;

  constructor(configService: ConfigService<EnvVars, true>) {
    this.client = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  /** Escribe solo si la clave no existe (SET NX), de forma atómica. `true` si la escribió. */
  async setSiNoExiste(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    return (await this.client.set(key, value, 'EX', ttlSeconds, 'NX')) === 'OK';
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /** Corre un script Lua: lo que lee y escribe pasa de forma atómica en Redis. */
  async evaluar(
    script: string,
    claves: string[],
    argumentos: (string | number)[],
  ): Promise<unknown> {
    return this.client.eval(script, claves.length, ...claves, ...argumentos);
  }

  /** Lee varios hashes en un solo viaje; uno que no existe llega como `{}`. */
  async hashes(claves: string[]): Promise<Record<string, string>[]> {
    if (claves.length === 0) {
      return [];
    }
    const pipeline = this.client.pipeline();
    claves.forEach((clave) => pipeline.hgetall(clave));
    const resultados = (await pipeline.exec()) ?? [];
    return resultados.map(([error, hash]) => {
      if (error) {
        throw error;
      }
      return hash as Record<string, string>;
    });
  }
}
