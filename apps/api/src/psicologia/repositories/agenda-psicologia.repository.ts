import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CitaAgendaDto } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { codigoProceso } from '../dominio/codigo-proceso';
import { citaSinRegistrar, estaCerrado } from '../dominio/etapa-proceso';
import type {
  CitaOcupada,
  IAgendaPsicologiaRepository,
  RangoAgendaParams,
} from '../interfaces/agenda-psicologia-repository.interface';
import { nombreCompleto, personaAtendida, SELECT_PERSONA } from './personas';

/** Tope de seguridad: el servicio ya acota el rango a unas semanas. */
const LIMITE_CITAS = 500;

function ocupanAgenda(
  params: RangoAgendaParams,
): Prisma.CitaPsicologicaWhereInput {
  return {
    atencion: { psicologaAsignadaId: params.psicologaId },
    fechaHora: { gte: params.desde, lte: params.hasta },
    estado: { notIn: ['CANCELADA', 'REPROGRAMADA'] },
  };
}

@Injectable()
export class AgendaPsicologiaRepository implements IAgendaPsicologiaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarCitas(
    params: RangoAgendaParams & { ahora: Date },
  ): Promise<CitaAgendaDto[]> {
    // Sin texto clínico: la agenda solo necesita saber quién, cuándo y en qué estado.
    const citas = await this.prisma.citaPsicologica.findMany({
      where: ocupanAgenda(params),
      select: {
        id: true,
        fechaHora: true,
        duracionMinutos: true,
        tipo: true,
        estado: true,
        borrador: true,
        nino: { select: { id: true, ...SELECT_PERSONA } },
        atencion: {
          select: {
            id: true,
            consecutivo: true,
            estado: true,
            expediente: {
              select: {
                numero: true,
                usuaria: { select: { id: true, ...SELECT_PERSONA } },
              },
            },
          },
        },
      },
      orderBy: [{ fechaHora: 'asc' }, { id: 'asc' }],
      take: LIMITE_CITAS,
    });

    return citas.map((cita) => {
      const { atencion } = cita;
      const { usuaria } = atencion.expediente;
      return {
        id: cita.id,
        procesoId: atencion.id,
        procesoCodigo: codigoProceso(
          atencion.consecutivo,
          atencion.expediente.numero,
        ),
        usuariaId: usuaria.id,
        usuariaNombreCompleto: nombreCompleto(usuaria),
        persona: personaAtendida(usuaria, cita.nino),
        fechaHora: cita.fechaHora.toISOString(),
        duracionMinutos: cita.duracionMinutos,
        tipo: cita.tipo,
        estado: cita.estado,
        // En un proceso cerrado ya no se registra nada: no se pide lo que no se puede hacer.
        sinRegistrar:
          !estaCerrado(atencion.estado) && citaSinRegistrar(cita, params.ahora),
        borrador: cita.borrador,
      };
    });
  }

  listarOcupadas(params: RangoAgendaParams): Promise<CitaOcupada[]> {
    return this.prisma.citaPsicologica.findMany({
      where: ocupanAgenda(params),
      select: { fechaHora: true, duracionMinutos: true },
      orderBy: { fechaHora: 'asc' },
      take: LIMITE_CITAS,
    });
  }

  async marcarNoAsistio(citaId: string, ahora: Date): Promise<boolean> {
    // Las condiciones van en el WHERE: si otra pestaña ya registró la cita, no se pisa nada.
    const marcadas = await this.prisma.citaPsicologica.updateMany({
      where: {
        id: citaId,
        estado: 'PROGRAMADA',
        fechaHora: { lte: ahora },
        atencion: { estado: { not: 'CIERRE' } },
      },
      data: { estado: 'NO_ASISTIO', borrador: false },
    });
    return marcadas.count === 1;
  }
}
