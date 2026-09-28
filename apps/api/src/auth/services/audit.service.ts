import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface RegistrarAuditoriaParams {
  usuarioId?: string;
  username?: string;
  accion: string;
  entidad?: string;
  entidadId?: string;
  ipAddress?: string;
  userAgent?: string;
  detalles?: Prisma.InputJsonValue;
}

/** Recibe cada evento ya guardado — p. ej. para avisar por socket sin acoplar al service que audita. */
export type OyenteAuditoria = (evento: RegistrarAuditoriaParams) => void;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly oyentes: OyenteAuditoria[] = [];

  constructor(private readonly prisma: PrismaService) {}

  alRegistrar(oyente: OyenteAuditoria): void {
    this.oyentes.push(oyente);
  }

  async registrar(params: RegistrarAuditoriaParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        usuarioId: params.usuarioId,
        username: params.username,
        accion: params.accion,
        entidad: params.entidad,
        entidadId: params.entidadId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        detalles: params.detalles,
      },
    });

    for (const oyente of this.oyentes) {
      // Un oyente que falla nunca debe tumbar la operación que se estaba auditando.
      try {
        oyente(params);
      } catch (error) {
        this.logger.error(`Oyente de auditoría falló: ${String(error)}`);
      }
    }
  }
}
