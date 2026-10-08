import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CitaAgendaDto, ProcesoParaAgendarDto } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { codigoProceso } from '../dominio/codigo-proceso';
import { citaSinRegistrar, estaCerrado } from '../dominio/etapa-proceso';
import type {
  CitaOcupada,
  IAgendaPsicologiaRepository,
  MoverCitaParams,
  ProgramarCitaParams,
  RangoAgendaParams,
} from '../interfaces/agenda-psicologia-repository.interface';
import {
  nombreCompleto,
  personaAtendida,
  personasDelExpediente,
  SELECT_PERSONA,
} from './personas';

/** Tope de seguridad: el servicio ya acota el rango a unas semanas. */
const LIMITE_CITAS = 500;
/** Tope de seguridad: una psicóloga lleva decenas de procesos abiertos, no cientos. */
const LIMITE_PROCESOS = 300;

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

  async listarProcesosParaAgendar(
    psicologaId: string,
    ahora: Date,
  ): Promise<ProcesoParaAgendarDto[]> {
    const procesos = await this.prisma.atencionPsicologica.findMany({
      where: {
        psicologaAsignadaId: psicologaId,
        estado: { not: 'CIERRE' },
        // Sin fecha de inicio todavía es un "caso por agendar": su primera cita va por otro lado.
        fechaInicio: { not: null },
      },
      select: {
        id: true,
        consecutivo: true,
        expediente: {
          select: {
            numero: true,
            usuaria: { select: { id: true, ...SELECT_PERSONA } },
            ninos: {
              select: { id: true, ...SELECT_PERSONA },
              orderBy: { fechaNacimiento: 'asc' },
            },
          },
        },
        citas: {
          where: { estado: 'PROGRAMADA', fechaHora: { gte: ahora } },
          select: { id: true, fechaHora: true },
          orderBy: { fechaHora: 'asc' },
          take: 1,
        },
      },
      orderBy: [
        { expediente: { usuaria: { nombres: 'asc' } } },
        { expediente: { usuaria: { apellidos: 'asc' } } },
        { id: 'asc' },
      ],
      take: LIMITE_PROCESOS,
    });

    return procesos.map((proceso) => {
      const { expediente } = proceso;
      const proxima = proceso.citas.at(0);
      return {
        procesoId: proceso.id,
        codigo: codigoProceso(proceso.consecutivo, expediente.numero),
        usuariaId: expediente.usuaria.id,
        usuariaNombreCompleto: nombreCompleto(expediente.usuaria),
        personas: personasDelExpediente(expediente),
        proximaCita: proxima
          ? { id: proxima.id, fechaHora: proxima.fechaHora.toISOString() }
          : null,
      };
    });
  }

  programarCita(params: ProgramarCitaParams): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      if (!(await this.bloquearProcesoAbierto(tx, params))) {
        return null;
      }
      const cita = await tx.citaPsicologica.create({
        data: {
          atencionId: params.procesoId,
          fechaHora: params.fechaHora,
          duracionMinutos: params.duracionMinutos,
          tipo: 'SEGUIMIENTO',
          ninoId: params.ninoId,
          atendidoPorId: params.psicologaId,
        },
        select: { id: true },
      });
      return cita.id;
    });
  }

  moverCita(params: MoverCitaParams): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      const origen = await tx.citaPsicologica.findUnique({
        where: { id: params.citaId },
        select: {
          atencionId: true,
          tipo: true,
          ninoId: true,
          modalidad: true,
          lugar: true,
          motivo: true,
        },
      });
      if (
        !origen ||
        !(await this.bloquearProcesoAbierto(tx, {
          procesoId: origen.atencionId,
          psicologaId: params.psicologaId,
        }))
      ) {
        return null;
      }

      // La condición va en el WHERE: si otra pestaña ya la movió o la registró, no se duplica.
      const movidas = await tx.citaPsicologica.updateMany({
        where: { id: params.citaId, estado: 'PROGRAMADA' },
        data: { estado: 'REPROGRAMADA' },
      });
      if (movidas.count !== 1) {
        return null;
      }

      const nueva = await tx.citaPsicologica.create({
        data: {
          atencionId: origen.atencionId,
          fechaHora: params.fechaHora,
          duracionMinutos: params.duracionMinutos,
          tipo: origen.tipo,
          ninoId: origen.ninoId,
          modalidad: origen.modalidad,
          lugar: origen.lugar,
          motivo: origen.motivo,
          atendidoPorId: params.psicologaId,
          reprogramadaDesdeId: params.citaId,
        },
        select: { id: true },
      });
      return nueva.id;
    });
  }

  /**
   * Confirma dentro de la transacción que el proceso sigue siendo de esta psicóloga y sin
   * cerrar, y de paso bloquea su fila: un cierre simultáneo espera y no deja una cita colgada
   * en un proceso cerrado. La escritura no cambia ningún dato.
   */
  private async bloquearProcesoAbierto(
    tx: Prisma.TransactionClient,
    params: { procesoId: string; psicologaId: string },
  ): Promise<boolean> {
    const bloqueados = await tx.atencionPsicologica.updateMany({
      where: {
        id: params.procesoId,
        psicologaAsignadaId: params.psicologaId,
        estado: { not: 'CIERRE' },
      },
      data: { psicologaAsignadaId: params.psicologaId },
    });
    return bloqueados.count === 1;
  }
}
