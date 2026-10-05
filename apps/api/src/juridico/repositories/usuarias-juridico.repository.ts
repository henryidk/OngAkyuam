import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MAX_RESULTADOS_BUSQUEDA_USUARIAS,
  type EstadoReferenciaJuridico,
  type UsuariaJuridicoResumen,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EXPEDIENTE_REFERIDO_A_JURIDICO,
  REFERENCIA_PENDIENTE,
} from '../compartido/acceso-juridico';
import { escaparLike } from '../compartido/sql';
import { contarProcesos } from '../dominio/contadores-usuaria';
import type { EstadoProceso } from '../dominio/maquina-estado-proceso';
import type {
  FichaUsuariaJuridico,
  IUsuariasJuridicoRepository,
} from '../interfaces/usuarias-repository.interface';
import { nombreCompleto } from './mapeo-proceso';

function estadoReferencia(referencia: {
  atendidoEn: Date | null;
  devueltoEn: Date | null;
}): EstadoReferenciaJuridico {
  if (referencia.devueltoEn) return 'DEVUELTA';
  if (referencia.atendidoEn) return 'ATENDIDA';
  return 'PENDIENTE';
}

@Injectable()
export class UsuariasJuridicoRepository implements IUsuariasJuridicoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscar(texto: string): Promise<UsuariaJuridicoResumen[]> {
    const patron = `%${escaparLike(texto)}%`;
    // El DPI se compara sin espacios en ambos lados: "1234 56789 0101" = "1234567890101".
    const patronDpi = `%${escaparLike(texto.replace(/\s/g, ''))}%`;

    const filas = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT u.id
      FROM "Usuaria" u
      WHERE EXISTS (
          SELECT 1 FROM "Expediente" e
          JOIN "ReferidoArea" r ON r."expedienteId" = e.id AND r.area = 'JURIDICO'
          WHERE e."usuariaId" = u.id
        )
        AND (
          (u.nombres || ' ' || u.apellidos) ILIKE ${patron}
          OR regexp_replace(coalesce(u.dpi, ''), '\\s', '', 'g') ILIKE ${patronDpi}
        )
      ORDER BY u.apellidos, u.nombres, u.id
      LIMIT ${MAX_RESULTADOS_BUSQUEDA_USUARIAS}
    `);
    const ids = filas.map((fila) => fila.id);
    if (ids.length === 0) {
      return [];
    }

    const delasUsuarias = {
      usuariaId: { in: ids },
      ...EXPEDIENTE_REFERIDO_A_JURIDICO,
    } satisfies Prisma.ExpedienteWhereInput;

    const [usuarias, procesos, pendientes] = await Promise.all([
      this.prisma.usuaria.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          dpi: true,
          telefono: true,
        },
      }),
      this.prisma.procesoJuridico.findMany({
        where: { expediente: delasUsuarias },
        select: {
          fase: true,
          situacion: true,
          expediente: { select: { usuariaId: true } },
        },
      }),
      this.prisma.referidoArea.findMany({
        where: { ...REFERENCIA_PENDIENTE, expediente: delasUsuarias },
        select: { expediente: { select: { usuariaId: true } } },
      }),
    ]);

    const procesosPorUsuaria = new Map<string, EstadoProceso[]>();
    for (const proceso of procesos) {
      const lista = procesosPorUsuaria.get(proceso.expediente.usuariaId) ?? [];
      lista.push({ fase: proceso.fase, situacion: proceso.situacion });
      procesosPorUsuaria.set(proceso.expediente.usuariaId, lista);
    }
    const conPendiente = new Set(
      pendientes.map((referencia) => referencia.expediente.usuariaId),
    );
    const porId = new Map(usuarias.map((usuaria) => [usuaria.id, usuaria]));

    // Se respeta el orden que ya calculó la base.
    return ids.flatMap((id) => {
      const usuaria = porId.get(id);
      if (!usuaria) return [];
      return [
        {
          id: usuaria.id,
          nombreCompleto: nombreCompleto(usuaria),
          dpi: usuaria.dpi,
          telefono: usuaria.telefono,
          contadores: contarProcesos(procesosPorUsuaria.get(id) ?? []),
          referenciaPendiente: conPendiente.has(id),
        },
      ];
    });
  }

  async obtenerFicha(usuariaId: string): Promise<FichaUsuariaJuridico | null> {
    const usuaria = await this.prisma.usuaria.findFirst({
      where: {
        id: usuariaId,
        expedientes: { some: EXPEDIENTE_REFERIDO_A_JURIDICO },
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        dpi: true,
        telefono: true,
      },
    });
    if (!usuaria) {
      return null;
    }

    const referencias = await this.prisma.referidoArea.findMany({
      where: { area: 'JURIDICO', expediente: { usuariaId } },
      select: {
        id: true,
        expedienteId: true,
        createdAt: true,
        motivo: true,
        procesosSugeridos: true,
        atendidoEn: true,
        devueltoEn: true,
        expediente: { select: { numero: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      usuaria: {
        id: usuaria.id,
        nombreCompleto: nombreCompleto(usuaria),
        dpi: usuaria.dpi,
        telefono: usuaria.telefono,
      },
      referencias: referencias.map((referencia) => ({
        referidoId: referencia.id,
        expedienteId: referencia.expedienteId,
        expedienteNumero: referencia.expediente.numero,
        referidoEn: referencia.createdAt.toISOString(),
        motivo: referencia.motivo,
        procesosSugeridos: referencia.procesosSugeridos,
        estado: estadoReferencia(referencia),
      })),
    };
  }
}
