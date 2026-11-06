import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { fechaColumnaISO, type TipoIngresoArea } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { ConsultaParaAgregado } from '../dominio/indicadores';
import type { ConsultaParaInforme } from '../dominio/informe-atencion';
import type { IReportesMedicaRepository } from '../interfaces/reportes-medica-repository.interface';
import { EXPEDIENTE_REFERIDO_A_MEDICA } from './acceso-medica.repository';

@Injectable()
export class ReportesMedicaRepository implements IReportesMedicaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async consultasEntre(
    desde: Date,
    hasta: Date,
    registradaPorId?: string,
  ): Promise<ConsultaParaAgregado[]> {
    const filas = await this.prisma.consultaMedica.findMany({
      where: {
        fechaHora: { gte: desde, lte: hasta },
        ...(registradaPorId && { registradaPorId }),
        atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      // Sin diagnóstico, plan, receta ni nombres: solo lo que se agrega.
      select: {
        id: true,
        fechaHora: true,
        nino: {
          select: { id: true, hijo: { select: { fechaNacimiento: true } } },
        },
        atencion: {
          select: {
            consultas: {
              select: { id: true },
              orderBy: [{ fechaHora: 'asc' }, { id: 'asc' }],
              take: 1,
            },
            expediente: {
              select: {
                tipologiaDelito: true,
                usuaria: {
                  select: {
                    id: true,
                    fechaNacimiento: true,
                    grupoEtnico: true,
                    municipio: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ fechaHora: 'asc' }, { id: 'asc' }],
    });
    return filas.map((fila) => {
      const { expediente } = fila.atencion;
      const { usuaria } = expediente;
      return {
        fechaHora: fila.fechaHora,
        usuariaId: usuaria.id,
        ninoId: fila.nino?.id ?? null,
        fechaNacimiento: fechaColumnaISO(
          (fila.nino?.hijo ?? usuaria).fechaNacimiento,
        ),
        grupoEtnico: usuaria.grupoEtnico,
        municipio: usuaria.municipio,
        tipologias: expediente.tipologiaDelito,
        esPrimera: fila.atencion.consultas[0]?.id === fila.id,
      };
    });
  }

  async consultasParaInforme(
    desde: Date,
    hasta: Date,
  ): Promise<ConsultaParaInforme[]> {
    const ingresoUsuaria = {
      ingresos: {
        where: { hijoId: null },
        select: { ingreso: true },
        take: 1,
      },
    } as const;
    const filas = await this.prisma.consultaMedica.findMany({
      where: {
        fechaHora: { gte: desde, lte: hasta },
        atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      // Sin diagnóstico, plan, receta ni nombres: solo lo que se agrega.
      select: {
        fechaHora: true,
        modalidad: true,
        nino: {
          select: {
            hijo: {
              select: { id: true, genero: true, fechaNacimiento: true },
            },
          },
        },
        atencion: {
          select: {
            referido: { select: ingresoUsuaria },
            expediente: {
              select: {
                fechaIngresoAlbergue: true,
                fechaEgresoAlbergue: true,
                // Por si la atención perdió su referencia: la primera a Médica del expediente.
                referidos: {
                  where: { area: 'MEDICA' },
                  select: ingresoUsuaria,
                  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                  take: 1,
                },
                usuaria: {
                  select: {
                    id: true,
                    fechaNacimiento: true,
                    grupoEtnico: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ fechaHora: 'asc' }, { id: 'asc' }],
    });

    const usuarias = [
      ...new Set(filas.map((f) => f.atencion.expediente.usuaria.id)),
    ];
    const atendidasAntes = new Set(
      usuarias.length === 0
        ? []
        : (
            await this.prisma.$queryRaw<{ usuariaId: string }[]>(Prisma.sql`
              SELECT DISTINCT e."usuariaId"
              FROM "ConsultaMedica" c
              JOIN "AtencionMedica" a ON a.id = c."atencionId"
              JOIN "Expediente" e ON e.id = a."expedienteId"
              WHERE c."ninoId" IS NULL
                AND c."fechaHora" < ${desde}
                AND e."usuariaId" IN (${Prisma.join(usuarias)})
            `)
          ).map((f) => f.usuariaId),
    );

    return filas.map((fila) => {
      const { expediente } = fila.atencion;
      const { usuaria } = expediente;
      const hijo = fila.nino?.hijo ?? null;
      const referencia = fila.atencion.referido ?? expediente.referidos[0];
      // La base escribe el ingreso al crear la referencia; sin él, no se presume primer ingreso.
      const ingreso: TipoIngresoArea =
        referencia?.ingresos[0]?.ingreso ?? 'SEGUIMIENTO';
      return {
        fechaHora: fila.fechaHora,
        modalidad: fila.modalidad,
        usuariaId: usuaria.id,
        hijoId: hijo?.id ?? null,
        sexo: hijo?.genero ?? 'MUJER',
        fechaNacimiento: fechaColumnaISO((hijo ?? usuaria).fechaNacimiento),
        grupoEtnico: usuaria.grupoEtnico,
        ingresoUsuaria: ingreso,
        usuariaAtendidaAntes: atendidasAntes.has(usuaria.id),
        ingresoAlbergue: expediente.fechaIngresoAlbergue
          ? fechaColumnaISO(expediente.fechaIngresoAlbergue)
          : null,
        egresoAlbergue: expediente.fechaEgresoAlbergue
          ? fechaColumnaISO(expediente.fechaEgresoAlbergue)
          : null,
      };
    });
  }

  contarActivas(): Promise<number> {
    return this.prisma.atencionMedica.count({
      where: { estado: 'ACTIVA', expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
    });
  }
}
