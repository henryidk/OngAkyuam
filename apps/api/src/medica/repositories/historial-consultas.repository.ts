import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PAGINA_HISTORIAL_CONSULTAS_MEDICA,
  etiquetaAtencion,
  fechaCalendarioGT,
  horaGT,
} from '@akyuam/shared';
import type {
  ConsultaHistorialMedicaDto,
  ConsultaMedicaDto,
  HistorialConsultasMedicaPaginaDto,
} from '@akyuam/shared';
import {
  condicionBusqueda,
  type BusquedaListaUsuarias,
} from '../../common/busqueda-usuarias';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SELECT_PERSONA,
  nombreCompleto,
  personaAtendida,
} from '../../psicologia/repositories/personas';
import type {
  FiltroHistorialConsultas,
  IHistorialConsultasRepository,
} from '../interfaces/historial-consultas-repository.interface';
import { EXPEDIENTE_REFERIDO_A_MEDICA } from './acceso-medica.repository';
import { SELECT_CONSULTA, aConsultaDto } from './consulta-completa';
import { codificarCursor, decodificarCursor } from './mapeo';

/** Tope de usuarias que puede devolver una búsqueda por nombre antes de filtrar sus consultas. */
const MAX_USUARIAS_POR_BUSQUEDA = 200;

/**
 * Fila del historial. Sin columnas clínicas (motivo, diagnóstico, plan, receta, signos): ni se
 * piden a la base. El contenido sale solo por `detalle`, que el servicio audita.
 */
const SELECT_HISTORIAL = {
  id: true,
  fechaHora: true,
  citaId: true,
  nino: { select: { id: true, ...SELECT_PERSONA } },
  atencion: {
    select: {
      consecutivo: true,
      expediente: {
        select: {
          numero: true,
          usuaria: { select: { id: true, ...SELECT_PERSONA } },
        },
      },
    },
  },
  _count: { select: { documentos: true } },
} satisfies Prisma.ConsultaMedicaSelect;

type FilaHistorial = Prisma.ConsultaMedicaGetPayload<{
  select: typeof SELECT_HISTORIAL;
}>;

function aFilaHistorial(fila: FilaHistorial): ConsultaHistorialMedicaDto {
  const { expediente } = fila.atencion;
  return {
    id: fila.id,
    fecha: fechaCalendarioGT(fila.fechaHora),
    hora: horaGT(fila.fechaHora),
    usuariaId: expediente.usuaria.id,
    usuariaNombreCompleto: nombreCompleto(expediente.usuaria),
    persona: personaAtendida(expediente.usuaria, fila.nino),
    codigoAtencion: etiquetaAtencion(
      expediente.numero,
      fila.atencion.consecutivo,
    ),
    conCita: fila.citaId !== null,
    totalDocumentos: fila._count.documentos,
  };
}

@Injectable()
export class HistorialConsultasRepository implements IHistorialConsultasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    filtro: FiltroHistorialConsultas,
  ): Promise<HistorialConsultasMedicaPaginaDto> {
    const usuariaIds = filtro.busqueda
      ? await this.usuariasQueCoinciden(filtro.busqueda)
      : undefined;
    if (usuariaIds?.length === 0) {
      return { items: [], siguienteCursor: null };
    }
    const despues = decodificarCursor(filtro.cursor);
    const filas = await this.prisma.consultaMedica.findMany({
      where: {
        fechaHora: { gte: filtro.desde, lt: filtro.hasta },
        atencion: {
          expediente: {
            ...EXPEDIENTE_REFERIDO_A_MEDICA,
            ...(usuariaIds ? { usuariaId: { in: usuariaIds } } : {}),
          },
        },
        ...(despues
          ? {
              OR: [
                { fechaHora: { lt: despues.instante } },
                { fechaHora: despues.instante, id: { lt: despues.id } },
              ],
            }
          : {}),
      },
      select: SELECT_HISTORIAL,
      orderBy: [{ fechaHora: 'desc' }, { id: 'desc' }],
      take: PAGINA_HISTORIAL_CONSULTAS_MEDICA + 1,
    });
    const items = filas.slice(0, PAGINA_HISTORIAL_CONSULTAS_MEDICA);
    const ultima = items.at(-1);
    return {
      items: items.map(aFilaHistorial),
      siguienteCursor:
        filas.length > PAGINA_HISTORIAL_CONSULTAS_MEDICA && ultima
          ? codificarCursor(ultima.fechaHora, ultima.id)
          : null,
    };
  }

  async detalle(consultaId: string): Promise<ConsultaMedicaDto | null> {
    const fila = await this.prisma.consultaMedica.findFirst({
      where: {
        id: consultaId,
        atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      select: SELECT_CONSULTA,
    });
    return fila ? aConsultaDto(fila) : null;
  }

  /** Misma interpretación de "nombre, DPI o expediente" que las listas de pacientes. */
  private async usuariasQueCoinciden(
    busqueda: BusquedaListaUsuarias,
  ): Promise<string[]> {
    const filas = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT u.id FROM "Usuaria" u
      WHERE ${condicionBusqueda(busqueda)}
      LIMIT ${MAX_USUARIAS_POR_BUSQUEDA}
    `);
    return filas.map((fila) => fila.id);
  }
}
