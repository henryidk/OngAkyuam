import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/** Cuánto se recuerda una respuesta para no repetir la escritura por un doble envío. */
const TTL_IDEMPOTENCIA_SEGUNDOS = 600;
const FORMATO_CLAVE_IDEMPOTENCIA = /^[A-Za-z0-9-]{8,64}$/;
/** Lo que puede tardar como mucho una escritura; si el proceso muere, la reserva caduca sola. */
const TTL_RESERVA_SEGUNDOS = 30;

/**
 * Header `Idempotency-Key`: la misma petición enviada dos veces (doble clic, reintento de red)
 * devuelve la primera respuesta en vez de escribir dos veces. Cada área la extiende con su
 * `ambito`, que separa sus claves en Redis.
 */
@Injectable()
export abstract class IdempotenciaPorUsuario {
  protected abstract readonly ambito: string;

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
    return `${this.ambito}:${operacion}:${usuarioId}:${clave}`;
  }

  async recuperar<T>(claveRedis: string | null): Promise<T | null> {
    if (!claveRedis) {
      return null;
    }
    const guardada = await this.redisService.get(claveRedis);
    return guardada ? (JSON.parse(guardada) as T) : null;
  }

  /**
   * Reserva atómica de la clave mientras se escribe: dos envíos simultáneos con la misma clave
   * (ninguno encuentra todavía respuesta guardada) no escriben los dos. `false` si otro envío
   * ya la tiene; sin clave, siempre `true`.
   */
  async reservar(claveRedis: string | null): Promise<boolean> {
    if (!claveRedis) {
      return true;
    }
    return this.redisService.setSiNoExiste(
      `${claveRedis}:en-curso`,
      '1',
      TTL_RESERVA_SEGUNDOS,
    );
  }

  async liberar(claveRedis: string | null): Promise<void> {
    if (claveRedis) {
      await this.redisService.del(`${claveRedis}:en-curso`);
    }
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
