import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { fechaColumnaISO } from '@akyuam/shared';
import type {
  CitaResumen,
  ClinicaPsicologia,
  EstadoAtencionPsicologica,
} from '@akyuam/shared';
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
  RegistrarSesionSinCitaParams,
} from '../interfaces/citas-psicologicas-repository.interface';
import { nombreProfesional } from '../dominio/indicadores';
import {
  citaRegistrable,
  PROCESO_LEGIBLE,
  procesoGestionable,
} from './acceso-expediente';
import { codigoProceso, SELECT_CODIGO_PROCESO } from './codigo-proceso';
import { INCLUDE_CITA, mapearCita } from './citas-psicologicas.mapper';
import { guardarRegistroEnTx } from './registro-sesion-tx';

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
        select: { atencionId: true, ninoId: true, fechaHora: true },
      });
      if (!actual) {
        return null;
      }
      const { ahora, ...registro } = params;
      // Registrar es de quien atendió; agendar la próxima cita, además, de la responsable.
      const soloResponsable = params.proximaCita !== null;
      if (
        !(await this.bloquearProcesoAbierto(
          tx,
          actual.atencionId,
          soloResponsable ? params.psicologaId : null,
        ))
      ) {
        return null;
      }
      return guardarRegistroEnTx(tx, {
        ...registro,
        atencionId: actual.atencionId,
        ninoId: actual.ninoId,
        // Se atendió antes de la fecha agendada: queda con la fecha real.
        fechaReal:
          params.estado === 'ATENDIDA' && actual.fechaHora > ahora
            ? ahora
            : undefined,
      });
    });
  }

  registrarSesionSinCita(
    params: RegistrarSesionSinCitaParams,
  ): Promise<ConsultaRegistrada | null> {
    return this.prisma.$transaction(async (tx) => {
      // Solo la responsable del proceso abre una sesión nueva en él, como al programar una cita.
      const proceso = await this.bloquearProcesoAbierto(
        tx,
        params.procesoId,
        params.psicologaId,
      );
      if (!proceso) {
        return null;
      }
      const cita = await tx.citaPsicologica.create({
        data: {
          atencionId: params.procesoId,
          fechaHora: params.fechaHora,
          duracionMinutos: params.duracionMinutos,
          // La primera sesión atendida del proceso es su primera atención, llegue con cita o sin ella.
          tipo:
            proceso.estado === 'INICIO' ? 'PRIMERA_ATENCION' : 'SEGUIMIENTO',
          ninoId: proceso.ninoId,
          atendidoPorId: params.psicologaId,
        },
        select: { id: true },
      });
      return guardarRegistroEnTx(tx, {
        ...params,
        citaId: cita.id,
        atencionId: params.procesoId,
        ninoId: proceso.ninoId,
      });
    });
  }

  /**
   * Bloquea la fila del proceso abierto: un cierre simultáneo espera, y no queda una sesión ni
   * una cita nueva colgando de un proceso cerrado. Con `responsableId`, además exige que esa
   * psicóloga sea la responsable. `null` si el proceso no cumple: no se escribe nada. Devuelve
   * a quién atiende el proceso y su etapa, leídos en el mismo SELECT.
   */
  private async bloquearProcesoAbierto(
    tx: Prisma.TransactionClient,
    procesoId: string,
    responsableId: string | null,
  ): Promise<{
    ninoId: string | null;
    estado: EstadoAtencionPsicologica;
  } | null> {
    const soloResponsable = responsableId
      ? Prisma.sql`AND "psicologaAsignadaId" = ${responsableId}`
      : Prisma.empty;
    const bloqueados = await tx.$queryRaw<
      { ninoId: string | null; estado: EstadoAtencionPsicologica }[]
    >`
      SELECT "ninoId", estado FROM "AtencionPsicologica"
      WHERE id = ${procesoId} AND estado <> 'CIERRE' ${soloResponsable}
      FOR UPDATE`;
    return bloqueados[0] ?? null;
  }

  async listarCitasEnRango(
    params: ListarCitasEnRangoParams,
  ): Promise<CitaParaAgregado[]> {
    const citas = await this.prisma.citaPsicologica.findMany({
      where: {
        fechaHora: { gte: params.desde, lte: params.hasta },
        ...(params.psicologaId
          ? { atencion: { psicologaAsignadaId: params.psicologaId } }
          : {}),
      },
      orderBy: [{ fechaHora: 'asc' }, { id: 'asc' }],
      select: {
        fechaHora: true,
        estado: true,
        ninoId: true,
        atencionId: true,
        diagnostico: true,
        enfoqueTerapeutico: true,
        atendidoPor: { select: { nombreCompleto: true, puesto: true } },
        nino: { select: { hijo: { select: { fechaNacimiento: true } } } },
        atencion: {
          select: {
            ...SELECT_CODIGO_PROCESO,
            estado: true,
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
      const persona = cita.nino?.hijo ?? expediente.usuaria;
      return {
        fechaHora: cita.fechaHora,
        estado: cita.estado,
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
        codigoProceso: codigoProceso(expediente.numero, cita.atencion),
        procesoId: cita.atencionId,
        procesoConcluido: cita.atencion.estado === 'CIERRE',
        expedienteNumero: expediente.numero,
        diagnostico: cita.diagnostico,
        enfoqueTerapeutico: cita.enfoqueTerapeutico,
        profesional: nombreProfesional(cita.atendidoPor),
      };
    });
  }

  async primerasSesionesAtendidas(
    procesoIds: string[],
  ): Promise<Map<string, Date>> {
    if (procesoIds.length === 0) return new Map();
    const grupos = await this.prisma.citaPsicologica.groupBy({
      by: ['atencionId'],
      where: { atencionId: { in: procesoIds }, estado: 'ATENDIDA' },
      _min: { fechaHora: true },
    });
    return new Map(
      grupos.flatMap((grupo) =>
        grupo._min.fechaHora
          ? [[grupo.atencionId, grupo._min.fechaHora] as const]
          : [],
      ),
    );
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
        nino: {
          select: { hijo: { select: { nombres: true, apellidos: true } } },
        },
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
      codigoProceso: codigoProceso(
        cita.atencion.expediente.numero,
        cita.atencion,
      ),
      procesoEtapa: cita.atencion.estado,
      ninoNombreCompleto: cita.nino
        ? `${cita.nino.hijo.nombres} ${cita.nino.hijo.apellidos}`
        : null,
      usuariaNombreCompleto: `${cita.atencion.expediente.usuaria.nombres} ${cita.atencion.expediente.usuaria.apellidos}`,
    };
  }
}
