import { Injectable } from '@nestjs/common';
import type {
  AgendaCita,
  CitaPsicologicaDetalle,
  CitaResumen,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AccesoCitaPsicologica,
  ActualizarCitaParams,
  BuscarSolapamientoParams,
  CitaParaAgregado,
  CrearCitaParams,
  DatosCitaOrigen,
  ICitasPsicologicasRepository,
  LecturaCitaPsicologica,
  ListarAgendaParams,
  ListarCitasEnRangoParams,
  ListarHistorialParams,
  RegistrarConsultaParams,
  ReprogramarCitaParams,
} from '../interfaces/citas-psicologicas-repository.interface';
import type { PaginaConCursorRepo } from '../interfaces/atencion-psicologica-repository.interface';
import { procesoLegible } from './acceso-expediente';
import { INCLUDE_CITA, mapearCita } from './citas-psicologicas.mapper';

/** Margen amplio de sobra sobre cualquier duración real de consulta, para acotar la ventana de candidatas sin riesgo de descartar un traslape real. */
const MARGEN_SOLAPAMIENTO_MS = 12 * 60 * 60 * 1000;

/** Un elemento de sobra para saber si hay siguiente página, sin un segundo `count` (§7.5 del plan). */
const LIMITE_EXTRA_CURSOR = 1;

@Injectable()
export class CitasPsicologicasRepository implements ICitasPsicologicasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarAccesoCita(
    citaId: string,
    psicologaId: string,
  ): Promise<AccesoCitaPsicologica | null> {
    const cita = await this.prisma.citaPsicologica.findFirst({
      where: {
        id: citaId,
        atencion: {
          expediente: { referidos: { some: { area: 'PSICOLOGIA' } } },
          psicologaAsignadaId: psicologaId,
        },
      },
      select: {
        id: true,
        atencionId: true,
        atencion: { select: { expedienteId: true } },
      },
    });
    if (!cita) return null;
    return {
      id: cita.id,
      atencionId: cita.atencionId,
      expedienteId: cita.atencion.expedienteId,
    };
  }

  async buscarLecturaCita(
    citaId: string,
    psicologaId: string,
  ): Promise<LecturaCitaPsicologica | null> {
    const cita = await this.prisma.citaPsicologica.findFirst({
      where: {
        id: citaId,
        atencion: {
          expediente: { referidos: { some: { area: 'PSICOLOGIA' } } },
          ...procesoLegible(psicologaId),
        },
      },
      select: {
        id: true,
        atencionId: true,
        atencion: { select: { expedienteId: true, psicologaAsignadaId: true } },
      },
    });
    if (!cita) return null;
    return {
      id: cita.id,
      atencionId: cita.atencionId,
      expedienteId: cita.atencion.expedienteId,
      propia: cita.atencion.psicologaAsignadaId === psicologaId,
    };
  }

  async crear(params: CrearCitaParams): Promise<CitaResumen> {
    // La primera cita es la que abre el proceso: si aún no tenía fecha de inicio, se fija aquí.
    await this.prisma.atencionPsicologica.updateMany({
      where: { id: params.atencionId, fechaInicio: null },
      data: { fechaInicio: new Date() },
    });
    const cita = await this.prisma.citaPsicologica.create({
      data: {
        atencionId: params.atencionId,
        fechaHora: params.fechaHora,
        modalidad: params.modalidad,
        lugar: params.lugar,
        motivo: params.motivo,
        tipo: params.tipo,
        duracionMinutos: params.duracionMinutos,
        atendidoPorId: params.atendidoPorId,
      },
      include: INCLUDE_CITA,
    });
    return mapearCita(cita);
  }

  async actualizar(params: ActualizarCitaParams): Promise<CitaResumen> {
    const cita = await this.prisma.citaPsicologica.update({
      where: { id: params.citaId },
      data: {
        estado: params.estado,
        observaciones: params.observaciones,
        acuerdos: params.acuerdos,
      },
      include: INCLUDE_CITA,
    });
    return mapearCita(cita);
  }

  async listarAgenda(params: ListarAgendaParams): Promise<AgendaCita[]> {
    const citas = await this.prisma.citaPsicologica.findMany({
      where: {
        fechaHora: { gte: params.desde, lte: params.hasta },
        atencion: {
          expediente: { referidos: { some: { area: 'PSICOLOGIA' } } },
          psicologaAsignadaId: params.psicologaId,
        },
      },
      include: {
        ...INCLUDE_CITA,
        atencion: {
          select: {
            expedienteId: true,
            expediente: {
              select: {
                usuaria: { select: { nombres: true, apellidos: true } },
              },
            },
          },
        },
      },
      orderBy: { fechaHora: 'asc' },
    });

    return citas.map((cita) => ({
      ...mapearCita(cita),
      expedienteId: cita.atencion.expedienteId,
      usuariaNombreCompleto: `${cita.atencion.expediente.usuaria.nombres} ${cita.atencion.expediente.usuaria.apellidos}`,
    }));
  }

  async buscarCitasSolapadas(
    params: BuscarSolapamientoParams,
  ): Promise<CitaResumen[]> {
    const finPropuesto = new Date(
      params.fechaHora.getTime() + params.duracionMinutos * 60_000,
    );

    const candidatas = await this.prisma.citaPsicologica.findMany({
      where: {
        id: params.excluirCitaId ? { not: params.excluirCitaId } : undefined,
        estado: 'PROGRAMADA',
        fechaHora: {
          lt: finPropuesto,
          gte: new Date(params.fechaHora.getTime() - MARGEN_SOLAPAMIENTO_MS),
        },
        atencion: { psicologaAsignadaId: params.psicologaId },
      },
      include: INCLUDE_CITA,
    });

    // El filtro de arriba solo acota candidatas por inicio; el fin real depende de su propia
    // duracionMinutos, así que el solapamiento exacto se calcula en memoria.
    return candidatas
      .filter(
        (cita) =>
          cita.fechaHora.getTime() + cita.duracionMinutos * 60_000 >
          params.fechaHora.getTime(),
      )
      .map(mapearCita);
  }

  async obtenerDatosParaReprogramar(
    citaId: string,
  ): Promise<DatosCitaOrigen | null> {
    const cita = await this.prisma.citaPsicologica.findUnique({
      where: { id: citaId },
      select: {
        atencionId: true,
        tipo: true,
        duracionMinutos: true,
        estado: true,
      },
    });
    return cita ?? null;
  }

  async reprogramar(params: ReprogramarCitaParams): Promise<CitaResumen> {
    const nueva = await this.prisma.$transaction(async (tx) => {
      await tx.citaPsicologica.update({
        where: { id: params.citaAnteriorId },
        data: { estado: 'REPROGRAMADA' },
      });
      return tx.citaPsicologica.create({
        data: {
          atencionId: params.atencionId,
          fechaHora: params.fechaHora,
          modalidad: params.modalidad,
          lugar: params.lugar,
          motivo: params.motivo,
          tipo: params.tipo,
          duracionMinutos: params.duracionMinutos,
          atendidoPorId: params.atendidoPorId,
          reprogramadaDesdeId: params.citaAnteriorId,
        },
        include: INCLUDE_CITA,
      });
    });
    return mapearCita(nueva);
  }

  async registrarConsulta(
    params: RegistrarConsultaParams,
  ): Promise<CitaResumen> {
    const cita = await this.prisma.citaPsicologica.update({
      where: { id: params.citaId },
      data: {
        estado: params.estado,
        temas: params.temas,
        intervencion: params.intervencion,
        recomendaciones: params.recomendaciones,
        acuerdos: params.acuerdos,
        observaciones: params.observaciones,
        motivoNoAsistencia: params.motivoNoAsistencia,
        borrador: params.borrador,
      },
      include: INCLUDE_CITA,
    });
    return mapearCita(cita);
  }

  async listarCitasEnRango(
    params: ListarCitasEnRangoParams,
  ): Promise<CitaParaAgregado[]> {
    const citas = await this.prisma.citaPsicologica.findMany({
      where: {
        fechaHora: { gte: params.desde, lte: params.hasta },
        atencion: { psicologaAsignadaId: params.psicologaId },
      },
      select: {
        fechaHora: true,
        estado: true,
        tipo: true,
        atencion: {
          select: {
            expediente: {
              select: {
                usuariaId: true,
                usuaria: { select: { municipio: true } },
              },
            },
          },
        },
      },
    });

    return citas.map((cita) => ({
      fechaHora: cita.fechaHora,
      estado: cita.estado,
      tipo: cita.tipo,
      usuariaId: cita.atencion.expediente.usuariaId,
      municipio: cita.atencion.expediente.usuaria.municipio,
    }));
  }

  async listarHistorial(
    params: ListarHistorialParams,
  ): Promise<PaginaConCursorRepo<CitaResumen>> {
    const citas = await this.prisma.citaPsicologica.findMany({
      where: {
        atencionId: params.atencionId,
        estado: params.estado,
      },
      include: INCLUDE_CITA,
      orderBy: { fechaHora: 'desc' },
      take: params.limite + LIMITE_EXTRA_CURSOR,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hayMas = citas.length > params.limite;
    const pagina = hayMas ? citas.slice(0, params.limite) : citas;

    return {
      items: pagina.map(mapearCita),
      siguienteCursor: hayMas ? pagina[pagina.length - 1].id : null,
    };
  }

  async obtenerDetalle(citaId: string): Promise<CitaPsicologicaDetalle | null> {
    const cita = await this.prisma.citaPsicologica.findUnique({
      where: { id: citaId },
      include: {
        ...INCLUDE_CITA,
        atencion: {
          select: {
            expedienteId: true,
            expediente: {
              select: {
                numero: true,
                usuaria: { select: { nombres: true, apellidos: true } },
              },
            },
          },
        },
      },
    });
    if (!cita) return null;

    return {
      ...mapearCita(cita),
      expedienteId: cita.atencion.expedienteId,
      numero: cita.atencion.expediente.numero,
      usuariaNombreCompleto: `${cita.atencion.expediente.usuaria.nombres} ${cita.atencion.expediente.usuaria.apellidos}`,
    };
  }
}
