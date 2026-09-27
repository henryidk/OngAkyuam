import { Injectable } from '@nestjs/common';
import { ESTADOS_CITA_PSICOLOGICA, MODALIDADES_CITA } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { RangoFechas } from '../interfaces/citas-psicologicas-repository.interface';
import type {
  IIndicadoresPsicologiaRepository,
  ReporteAgregado,
} from '../interfaces/indicadores-psicologia-repository.interface';

@Injectable()
export class IndicadoresPsicologiaRepository implements IIndicadoresPsicologiaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerReporte(rango: RangoFechas): Promise<ReporteAgregado> {
    const citas = await this.prisma.citaPsicologica.findMany({
      where: {
        fechaHora: { gte: rango.desde, lte: rango.hasta },
        atencion: {
          expediente: { referidos: { some: { area: 'PSICOLOGIA' } } },
        },
      },
      select: {
        estado: true,
        modalidad: true,
        atencion: { select: { expedienteId: true } },
      },
    });

    const porEstado = Object.fromEntries(
      ESTADOS_CITA_PSICOLOGICA.map((estado) => [estado, 0]),
    ) as ReporteAgregado['porEstado'];
    const porModalidad = Object.fromEntries(
      MODALIDADES_CITA.map((modalidad) => [modalidad, 0]),
    ) as ReporteAgregado['porModalidad'];

    const expedientesUnicos = new Set<string>();
    for (const cita of citas) {
      porEstado[cita.estado] += 1;
      porModalidad[cita.modalidad] += 1;
      expedientesUnicos.add(cita.atencion.expedienteId);
    }

    return {
      totalCitas: citas.length,
      porEstado,
      porModalidad,
      usuariasAtendidas: expedientesUnicos.size,
    };
  }
}
