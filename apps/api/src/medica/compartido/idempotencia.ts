import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

/** Cuánto se recuerda una respuesta para no repetir la escritura por un doble envío. */
const TTL_IDEMPOTENCIA_SEGUNDOS = 600;
const FORMATO_CLAVE_IDEMPOTENCIA = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Header `Idempotency-Key`: la misma petición enviada dos veces (doble clic, reintento de red)
 * devuelve la primera respuesta en vez de crear dos citas o dos consultas.
 */
@Injectable()
export class IdempotenciaMedica {
  constructor(private readonly redisService: RedisService) {}

  /** La clave es de quien la envió y de esa operación: no sirve para leer respuestas ajenas. */
  clave(
    clave: string | undefined,
    operacion: string,
    usuarioId: string,
  ): string | null {
    if (clave === undefined) {
      return null;
    }
    if (!FORMATO_CLAVE_IDEMPOTENCIA.test(clave)) {
      throw new BadRequestException('Idempotency-Key inválida');
    }
    return `medica:${operacion}:${usuarioId}:${clave}`;
  }

  async recuperar<T>(claveRedis: string | null): Promise<T | null> {
    if (!claveRedis) {
      return null;
    }
    const guardada = await this.redisService.get(claveRedis);
    return guardada ? (JSON.parse(guardada) as T) : null;
  }

  async guardar<T>(claveRedis: string | null, respuesta: T): Promise<void> {
    if (!claveRedis) {
      return;
    }
    await this.redisService.set(
      claveRedis,
      JSON.stringify(respuesta),
      TTL_IDEMPOTENCIA_SEGUNDOS,
    );
  }
}
