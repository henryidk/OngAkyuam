import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { fechaColumnaISO } from '@akyuam/shared';
import type { CitaResumen, ClinicaPsicologia } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AccesoCitaPsicologica,
  BuscarSolapamientoParams,
  CitaParaAgregado,
  ConsultaRegistrada,
  DetalleCitaGuardado,
  ICitasPsicologicasRepository,
  LecturaCitaPsicologica,
  ListarCitasEnRangoParams,
  RegistrarConsultaParams,
} from '../interfaces/citas-psicologicas-repository.interface';
import { etapaTrasSesionAtendida } from '../dominio/etapa-proceso';
import {
  citaRegistrable,
  PROCESO_LEGIBLE,
  procesoGestionable,
} from './acceso-expediente';
import { codigoProceso, SELECT_CODIGO_PROCESO } from './codigo-proceso';
import { INCLUDE_CITA, mapearCita } from './citas-psicologicas.mapper';

/** Margen amplio de sobra sobre cualquier duración real de consulta, para acotar la ventana de candidatas sin riesgo de descartar un traslape real. */
const MARGEN_SOLAPAMIENTO_MS = 12 * 60 * 60 * 1000;

const SELECT_ACCESO_CITA = {
  id: true,
  atencionId: true,
  atencion: { select: { expedienteId: true } },
} as const;

function mapearAcceso(cita: {
  id: string;
  atencionId: string;
  atencion: { expedienteId: string };
}): AccesoCitaPsicologica {
  return {
    id: cita.id,
    atencionId: cita.atencionId,
    expedienteId: cita.atencion.expedienteId,
  };
}

@Injectable()
export class CitasPsicologicasRepository implements ICitasPsicologicasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarAccesoCita(
    citaId: string,
    psicologaId: string,
  ): Promise<AccesoCitaPsicologica | null> {
    const cita = await this.prisma.citaPsicologica.findFirst({
      where: { id: citaId, atencion: procesoGestionable(psicologaId) },
      select: SELECT_ACCESO_CITA,
    });
    return cita ? mapearAcceso(cita) : null;
  }

  async buscarAutoriaCita(
    citaId: string,
    psicologaId: string,
  ): Promise<AccesoCitaPsicologica | null> {
    const cita = await this.prisma.citaPsicologica.findFirst({
      where: { id: citaId, ...citaRegistrable(psicologaId) },
      select: SELECT_ACCESO_CITA,
    });
    return cita ? mapearAcceso(cita) : null;
  }

  async buscarLecturaCita(
    citaId: string,
    psicologaId: string,
  ): Promise<LecturaCitaPsicologica | null> {
    const cita = await this.prisma.citaPsicologica.findFirst({
      where: { id: citaId, atencion: PROCESO_LEGIBLE },
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

  registrarConsulta(
    params: RegistrarConsultaParams,
  ): Promise<ConsultaRegistrada | null> {
    return this.prisma.$transaction(async (tx) => {
      const actual = await tx.citaPsicologica.findUnique({
        where: { id: params.citaId },
        select: { atencionId: true, ninoId: true },
      });
      if (!actual) {
        return null;
      }
      // Bloquea la fila del proceso: un cierre simultáneo espera, y no queda una sesión ni una
      // cita nueva colgando de un proceso cerrado. Registrar es de quien atendió; agendar la
      // próxima cita, además, de la responsable del proceso.
      const soloResponsable = params.proximaCita
        ? Prisma.sql`AND "psicologaAsignadaId" = ${params.psicologaId}`
        : Prisma.empty;
      const bloqueados = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "AtencionPsicologica"
        WHERE id = ${actual.atencionId} AND estado <> 'CIERRE' ${soloResponsable}
        FOR UPDATE`;
      if (bloqueados.length !== 1) {
        return null;
      }

      // La condición va en el WHERE: una cita que se movió a otra fecha ya no se registra.
      const registradas = await tx.citaPsicologica.updateMany({
        where: {
          id: params.citaId,
          atendidoPorId: params.psicologaId,
          estado: { not: 'REPROGRAMADA' },
        },
        data: {
          estado: params.estado,
          temas: params.temas,
          intervencion: params.intervencion,
          recomendaciones: params.recomendaciones,
          acuerdos: params.acuerdos,
          observaciones: params.observaciones,
          motivoNoAsistencia: params.motivoNoAsistencia,
          clinica: params.clinica,
          enfoqueTerapeutico: params.enfoqueTerapeutico,
          borrador: params.borrador,
        },
      });
      if (registradas.count !== 1) {
        return null;
      }

      let pasoASeguimiento = false;
      if (params.estado === 'ATENDIDA') {
        const avanzados = await tx.atencionPsicologica.updateMany({
          where: { id: actual.atencionId, estado: 'INICIO' },
          data: {
            estado: etapaTrasSesionAtendida('INICIO'),
            actualizadoPorId: params.psicologaId,
            version: { increment: 1 },
          },
        });
        pasoASeguimiento = avanzados.count === 1;
        if (pasoASeguimiento) {
          await tx.cambioEstadoAtencion.create({
            data: {
              atencionId: actual.atencionId,
              estadoAnterior: 'INICIO',
              estadoNuevo: etapaTrasSesionAtendida('INICIO'),
              registradoPorId: params.psicologaId,
            },
          });
        }
      }

      let proximaCitaId: string | null = null;
      if (params.proximaCita) {
        const proxima = await tx.citaPsicologica.create({
          data: {
            atencionId: actual.atencionId,
            fechaHora: params.proximaCita.fechaHora,
            duracionMinutos: params.proximaCita.duracionMinutos,
            tipo: 'SEGUIMIENTO',
            ninoId: actual.ninoId,
            atendidoPorId: params.psicologaId,
          },
          select: { id: true },
        });
        proximaCitaId = proxima.id;
      }

      const cita = await tx.citaPsicologica.findUniqueOrThrow({
        where: { id: params.citaId },
        include: INCLUDE_CITA,
      });
      return { cita: mapearCita(cita), pasoASeguimiento, proximaCitaId };
    });
  }

  async listarCitasEnRango(
    params: ListarCitasEnRangoParams,
  ): Promise<CitaParaAgregado[]> {
    const citas = await this.prisma.citaPsicologica.findMany({
      where: {
        fechaHora: { gte: params.desde, lte: params.hasta },
        atencion: { psicologaAsignadaId: params.psicologaId },
      },
      orderBy: [{ fechaHora: 'asc' }, { id: 'asc' }],
      select: {
        fechaHora: true,
        estado: true,
        tipo: true,
        ninoId: true,
        nino: { select: { fechaNacimiento: true } },
        atencion: {
          select: {
            ...SELECT_CODIGO_PROCESO,
            expediente: {
              select: {
                numero: true,
                usuariaId: true,
                tipologiaDelito: true,
                referidos: {
                  where: { area: 'PSICOLOGIA' },
                  select: { puedeVerDatosCaso: true },
                },
                usuaria: {
                  select: {
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
    });

    return citas.map((cita) => {
      const { expediente } = cita.atencion;
      const persona = cita.nino ?? expediente.usuaria;
      return {
        fechaHora: cita.fechaHora,
        estado: cita.estado,
        tipo: cita.tipo,
        usuariaId: expediente.usuariaId,
        ninoId: cita.ninoId,
        fechaNacimiento: fechaColumnaISO(persona.fechaNacimiento),
        grupoEtnico: expediente.usuaria.grupoEtnico,
        municipio: expediente.usuaria.municipio,
        // La tipología es parte de los "datos del caso": si Trabajo Social no los compartió
        // con Psicología, tampoco entra en sus reportes.
        tipologias: expediente.referidos[0]?.puedeVerDatosCaso
          ? expediente.tipologiaDelito
          : [],
        procesoCodigo: codigoProceso(expediente.numero, cita.atencion),
      };
    });
  }

  async buscarUltimaClinica(
    psicologaId: string,
  ): Promise<ClinicaPsicologia | null> {
    const ultima = await this.prisma.citaPsicologica.findFirst({
      where: { atendidoPorId: psicologaId, clinica: { not: null } },
      orderBy: [{ fechaHora: 'desc' }, { id: 'desc' }],
      select: { clinica: true },
    });
    return ultima?.clinica ?? null;
  }

  async obtenerDetalle(citaId: string): Promise<DetalleCitaGuardado | null> {
    const cita = await this.prisma.citaPsicologica.findUnique({
      where: { id: citaId },
      include: {
        ...INCLUDE_CITA,
        nino: { select: { nombres: true, apellidos: true } },
        atencion: {
          select: {
            ...SELECT_CODIGO_PROCESO,
            expedienteId: true,
            estado: true,
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
      procesoId: cita.atencionId,
      procesoCodigo: codigoProceso(
        cita.atencion.expediente.numero,
        cita.atencion,
      ),
      procesoEtapa: cita.atencion.estado,
      ninoNombreCompleto: cita.nino
        ? `${cita.nino.nombres} ${cita.nino.apellidos}`
        : null,
      usuariaNombreCompleto: `${cita.atencion.expediente.usuaria.nombres} ${cita.atencion.expediente.usuaria.apellidos}`,
    };
  }
}
