import { Injectable } from '@nestjs/common';
import { fechaColumnaISO } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { ConsultaParaAgregado } from '../dominio/indicadores';
import type { IReportesMedicaRepository } from '../interfaces/reportes-medica-repository.interface';
import { EXPEDIENTE_REFERIDO_A_MEDICA } from './acceso-medica.repository';

@Injectable()
export class ReportesMedicaRepository implements IReportesMedicaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async consultasEntre(
    desde: Date,
    hasta: Date,
  ): Promise<ConsultaParaAgregado[]> {
    const filas = await this.prisma.consultaMedica.findMany({
      where: {
        fechaHora: { gte: desde, lte: hasta },
        atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      // Sin diagnóstico, plan, receta ni nombres: solo lo que se agrega.
      select: {
        id: true,
        fechaHora: true,
        nino: { select: { id: true, fechaNacimiento: true } },
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
          (fila.nino ?? usuaria).fechaNacimiento,
        ),
        grupoEtnico: usuaria.grupoEtnico,
        municipio: usuaria.municipio,
        tipologias: expediente.tipologiaDelito,
        esPrimera: fila.atencion.consultas[0]?.id === fila.id,
      };
    });
  }

  contarActivas(): Promise<number> {
    return this.prisma.atencionMedica.count({
      where: { estado: 'ACTIVA', expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
    });
  }

  async primeraConsulta(): Promise<Date | null> {
    const primera = await this.prisma.consultaMedica.findFirst({
      select: { fechaHora: true },
      orderBy: { fechaHora: 'asc' },
    });
    return primera?.fechaHora ?? null;
  }
}
