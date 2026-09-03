import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface RegistrarAuditoriaParams {
  usuarioId?: string;
  username?: string;
  accion: string;
  ipAddress?: string;
  userAgent?: string;
  detalles?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(params: RegistrarAuditoriaParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        usuarioId: params.usuarioId,
        username: params.username,
        accion: params.accion,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        detalles: params.detalles,
      },
    });
  }
}
