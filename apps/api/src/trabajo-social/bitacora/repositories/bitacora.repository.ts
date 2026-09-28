import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { cteEventos } from '../../eventos/sql-eventos';
import type {
  EventoBitacoraRow,
  IBitacoraRepository,
} from '../interfaces/bitacora-repository.interface';

@Injectable()
export class BitacoraRepository implements IBitacoraRepository {
  constructor(private readonly prisma: PrismaService) {}

  async existeUsuaria(usuariaId: string): Promise<boolean> {
    const usuaria = await this.prisma.usuaria.findUnique({
      where: { id: usuariaId },
      select: { id: true },
    });
    return usuaria !== null;
  }

  eventosDeUsuaria(
    usuariaId: string,
    acciones: string[],
    limite: number,
  ): Promise<EventoBitacoraRow[]> {
    return this.prisma.$queryRaw<EventoBitacoraRow[]>(Prisma.sql`
      WITH ${cteEventos(acciones, Prisma.sql`e."usuariaId" = ${usuariaId}`)},
      todos AS (
        SELECT ev.id, ev.accion, ev.detalles, ev."createdAt", ev."usuarioId", x.numero AS "numeroExpediente"
        FROM eventos ev
        JOIN "Expediente" x ON x.id = ev."expedienteId"
        UNION ALL
        -- Cambios de los datos personales: se auditan sobre la usuaria, no sobre un caso.
        SELECT a.id, a.accion, a.detalles, a."createdAt", a."usuarioId", NULL
        FROM "AuditLog" a
        WHERE a.entidad = 'Usuaria' AND a."entidadId" = ${usuariaId}
          AND a.accion IN (${Prisma.join(acciones)})
      )
      SELECT t.id, t.accion, t.detalles, t."createdAt", t."numeroExpediente", us."nombreCompleto" AS autor
      FROM todos t
      LEFT JOIN "Usuario" us ON us.id = t."usuarioId"
      ORDER BY t."createdAt" DESC, t.id
      LIMIT ${limite}
    `);
  }
}
