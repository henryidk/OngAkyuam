import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { Rol } from '@prisma/client';
import {
  MOTIVOS_RESERVA_CASO,
  VIGENCIA_RESERVA_CASO_SEGUNDOS,
  type MotivoReservaCaso,
  type ReservaCasoDto,
} from '@akyuam/shared';
import {
  NOVEDADES_AREA_NOTIFIER,
  type INovedadesAreaNotifier,
} from '../areas/interfaces/novedades-area-notifier.interface';
import { RedisService } from '../redis/redis.service';

/** Quien reserva: solo su id y su nombre, que es lo que ven las demás en el botón ocupado. */
export interface PersonalQueReserva {
  id: string;
  nombreCompleto: string;
}

/** Solo el nombre del personal y qué está haciendo: nunca nada de la usuaria. */
export function mensajeCasoReservado(reserva: ReservaCasoDto | null): string {
  if (!reserva) {
    return 'Otra persona está trabajando este caso. Espera a que termine.';
  }
  const haciendo =
    reserva.motivo === 'ATENDIENDO'
      ? 'lo está atendiendo'
      : 'le está agendando cita';
  return `${reserva.nombre} ${haciendo}. Espera a que termine.`;
}

// Devuelve 1 si quien reserva ya la tenía con el mismo motivo (solo se renueva), 2 si es nueva o
// cambió de motivo (las demás deben enterarse) o el hash completo de quien la tiene.
const SCRIPT_RESERVAR = `
local duena = redis.call('HGET', KEYS[1], 'usuarioId')
if duena and duena ~= ARGV[1] then
  return redis.call('HGETALL', KEYS[1])
end
redis.call('EXPIRE', KEYS[1], ARGV[5])
if duena then
  if redis.call('HGET', KEYS[1], 'motivo') == ARGV[4] then
    return 1
  end
  redis.call('HSET', KEYS[1], 'motivo', ARGV[4])
  return 2
end
redis.call('HSET', KEYS[1], 'usuarioId', ARGV[1], 'nombre', ARGV[2], 'desde', ARGV[3], 'motivo', ARGV[4])
redis.call('EXPIRE', KEYS[1], ARGV[5])
return 2
`;

// Solo borra si la reserva es de quien la libera: nadie puede soltar la de otra persona.
const SCRIPT_LIBERAR = `
if redis.call('HGET', KEYS[1], 'usuarioId') == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

/**
 * Reserva de una referencia del Área de atención mientras alguien agenda su primera cita o la
 * atiende ahora. No toma el caso: solo avisa a las demás y les impide guardar encima. Vive en
 * Redis con vencimiento corto; la pantalla que la tiene la renueva y, si se cierra sin avisar,
 * vence sola. Cada área la extiende con su `ambito` y su `area` (la sala del socket).
 */
@Injectable()
export abstract class ReservasCasoArea {
  protected abstract readonly ambito: string;
  protected abstract readonly area: Rol;

  constructor(
    private readonly redisService: RedisService,
    @Inject(NOVEDADES_AREA_NOTIFIER)
    private readonly notificador: INovedadesAreaNotifier,
  ) {}

  /** Reserva o renueva. Si es de otra persona, no cambia nada y responde 409 con quién la tiene. */
  async reservar(
    referidoId: string,
    personal: PersonalQueReserva,
    motivo: MotivoReservaCaso,
  ): Promise<void> {
    const resultado = await this.redisService.evaluar(
      SCRIPT_RESERVAR,
      [this.clave(referidoId)],
      [
        personal.id,
        personal.nombreCompleto,
        new Date().toISOString(),
        motivo,
        VIGENCIA_RESERVA_CASO_SEGUNDOS,
      ],
    );
    if (Array.isArray(resultado)) {
      throw new ConflictException(
        mensajeCasoReservado(
          this.aDto(pares(resultado as string[]), personal.id),
        ),
      );
    }
    if (resultado === 2) {
      this.notificador.notificarNovedades(this.area);
    }
  }

  /** Suelta la reserva propia; la de otra persona queda intacta. */
  async liberar(referidoId: string, usuarioId: string): Promise<void> {
    const borradas = await this.redisService.evaluar(
      SCRIPT_LIBERAR,
      [this.clave(referidoId)],
      [usuarioId],
    );
    if (borradas === 1) {
      this.notificador.notificarNovedades(this.area);
    }
  }

  /**
   * Al guardar: 409 si otra persona tiene la referencia reservada. La reserva propia no tiene que
   * seguir viva; si venció y nadie más la tomó, se guarda igual.
   */
  async exigirSinReservaAjena(
    referidoId: string,
    usuarioId: string,
  ): Promise<void> {
    const [reserva] = await this.vigentes([referidoId], usuarioId);
    if (reserva && !reserva.propia) {
      throw new ConflictException(mensajeCasoReservado(reserva));
    }
  }

  /** Las reservas vigentes de varias referencias, en el mismo orden; null = libre. */
  async vigentes(
    referidoIds: string[],
    usuarioId: string,
  ): Promise<(ReservaCasoDto | null)[]> {
    const hashes = await this.redisService.hashes(
      referidoIds.map((id) => this.clave(id)),
    );
    return hashes.map((hash) => this.aDto(hash, usuarioId));
  }

  /** Solo el id de la referencia: nada que identifique a la usuaria va en la clave. */
  private clave(referidoId: string): string {
    return `reserva-caso:${this.ambito}:${referidoId}`;
  }

  private aDto(
    hash: Record<string, string>,
    usuarioId: string,
  ): ReservaCasoDto | null {
    const motivo = MOTIVOS_RESERVA_CASO.find((m) => m === hash.motivo);
    if (!hash.usuarioId || !hash.nombre || !hash.desde || !motivo) {
      return null;
    }
    return {
      nombre: hash.nombre,
      desde: hash.desde,
      motivo,
      propia: hash.usuarioId === usuarioId,
    };
  }
}

/** `HGETALL` desde Lua llega como lista plana `[campo, valor, campo, valor…]`. */
function pares(lista: string[]): Record<string, string> {
  const hash: Record<string, string> = {};
  for (let i = 0; i + 1 < lista.length; i += 2) {
    hash[lista[i]] = lista[i + 1];
  }
  return hash;
}
