import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DURACION_CITA_MEDICA_MIN,
  fechaCalendarioGT,
  horaGT,
} from '@akyuam/shared';
import type {
  CitaAgendaMedicaDto,
  PacienteProgramableDto,
  ReferenciaBandejaMedicaDto,
  SinProximaConsultaDto,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SELECT_PERSONA,
  edad,
  nombreCompleto,
  personaAtendida,
  personasDelExpediente,
} from '../../psicologia/repositories/personas';
import { etiquetaAtencion } from '@akyuam/shared';
import { derivarEstadoCita } from '../dominio/estado-cita';
import { horaFin } from '../dominio/horario';
import {
  puedeReprogramar,
  referenciaPendiente,
} from '../dominio/reglas-atencion';
import type {
  CitaResumida,
  FiltroProgramables,
  IAgendaMedicaRepository,
} from '../interfaces/agenda-medica-repository.interface';
import { EXPEDIENTE_REFERIDO_A_MEDICA } from './acceso-medica.repository';

const SELECT_NINOS = {
  select: { id: true, ...SELECT_PERSONA },
  orderBy: { fechaNacimiento: 'asc' },
} as const;

/** La cita de la Agenda: nunca trae datos clínicos (ni motivo ni diagnóstico). */
function selectCitaAgenda(ahora: Date) {
  return {
    id: true,
    version: true,
    atencionId: true,
    inicio: true,
    duracionMin: true,
    estado: true,
    consulta: { select: { id: true } },
    reprogramadaA: { select: { id: true, inicio: true } },
    nino: { select: { id: true, ...SELECT_PERSONA } },
    atencion: {
      select: {
        consecutivo: true,
        estado: true,
        expediente: {
          select: {
            id: true,
            numero: true,
            usuaria: { select: { id: true, ...SELECT_PERSONA } },
          },
        },
        // ¿La paciente ya tiene otra cita futura? Decide si se ofrece "Reprogramar".
        citas: {
          where: { estado: 'PROGRAMADA', inicio: { gt: ahora } },
          select: { id: true },
          take: 1,
        },
      },
    },
  } satisfies Prisma.CitaMedicaSelect;
}

type FilaCitaAgenda = Prisma.CitaMedicaGetPayload<{
  select: ReturnType<typeof selectCitaAgenda>;
}>;

function aCitaAgenda(fila: FilaCitaAgenda, ahora: Date): CitaAgendaMedicaDto {
  const { atencion } = fila;
  const { expediente } = atencion;
  const hora = horaGT(fila.inicio);
  return {
    id: fila.id,
    version: fila.version,
    atencionId: fila.atencionId,
    codigoAtencion: etiquetaAtencion(expediente.numero, atencion.consecutivo),
    expedienteId: expediente.id,
    usuariaId: expediente.usuaria.id,
    usuariaNombreCompleto: nombreCompleto(expediente.usuaria),
    persona: personaAtendida(expediente.usuaria, fila.nino),
    inicio: fila.inicio.toISOString(),
    fecha: fechaCalendarioGT(fila.inicio),
    hora,
    horaFin: horaFin(hora, fila.duracionMin),
    estado: fila.estado,
    estadoVista: derivarEstadoCita(fila, ahora),
    consultaId: fila.consulta?.id ?? null,
    reprogramadaA: fila.reprogramadaA
      ? {
          id: fila.reprogramadaA.id,
          fecha: fechaCalendarioGT(fila.reprogramadaA.inicio),
          hora: horaGT(fila.reprogramadaA.inicio),
        }
      : null,
    puedeReprogramar: puedeReprogramar({
      estado: fila.estado,
      reprogramadaA: fila.reprogramadaA,
      atencionActiva: atencion.estado === 'ACTIVA',
      tieneCitaFutura: atencion.citas.length > 0,
    }),
  };
}

@Injectable()
export class AgendaMedicaRepository implements IAgendaMedicaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async citasEntre(
    desde: Date,
    hasta: Date,
    ahora: Date,
  ): Promise<CitaAgendaMedicaDto[]> {
    const filas = await this.prisma.citaMedica.findMany({
      where: {
        inicio: { gte: desde, lt: hasta },
        estado: { not: 'CANCELADA' },
        atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      select: selectCitaAgenda(ahora),
      orderBy: [{ inicio: 'asc' }, { id: 'asc' }],
    });
    return filas.map((fila) => aCitaAgenda(fila, ahora));
  }

  async citasSinRegistrar(
    ahora: Date,
    excluirDesde: Date,
    excluirHasta: Date,
  ): Promise<CitaAgendaMedicaDto[]> {
    const terminadasAntesDe = new Date(
      ahora.getTime() - DURACION_CITA_MEDICA_MIN * 60_000,
    );
    const filas = await this.prisma.citaMedica.findMany({
      where: {
        estado: 'PROGRAMADA',
        inicio: { lte: terminadasAntesDe },
        NOT: { inicio: { gte: excluirDesde, lt: excluirHasta } },
        atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      select: selectCitaAgenda(ahora),
      orderBy: [{ inicio: 'asc' }, { id: 'asc' }],
    });
    return filas.map((fila) => aCitaAgenda(fila, ahora));
  }

  resumenEntre(desde: Date, hasta: Date): Promise<CitaResumida[]> {
    return this.prisma.citaMedica.findMany({
      where: {
        inicio: { gte: desde, lt: hasta },
        estado: { not: 'CANCELADA' },
        atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
      },
      select: { inicio: true, estado: true, duracionMin: true },
    });
  }

  async referenciasPendientes(): Promise<ReferenciaBandejaMedicaDto[]> {
    // Prisma no compara columnas entre relaciones: la regla "sin atención posterior a la
    // referencia" se termina de aplicar con `referenciaPendiente`, la misma función del dominio.
    const referidos = await this.prisma.referidoArea.findMany({
      where: {
        area: 'MEDICA',
        expediente: { atencionesMedicas: { none: { estado: 'ACTIVA' } } },
      },
      select: {
        id: true,
        createdAt: true,
        motivo: true,
        otorgadoPor: { select: { nombreCompleto: true } },
        expediente: {
          select: {
            id: true,
            numero: true,
            usuaria: { select: { id: true, ...SELECT_PERSONA } },
            ninos: SELECT_NINOS,
            atencionesMedicas: { select: { estado: true, createdAt: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return referidos
      .filter((r) =>
        referenciaPendiente(r.createdAt, r.expediente.atencionesMedicas),
      )
      .map((r) => ({
        referidoId: r.id,
        expedienteId: r.expediente.id,
        expedienteNumero: r.expediente.numero,
        usuariaId: r.expediente.usuaria.id,
        usuariaNombreCompleto: nombreCompleto(r.expediente.usuaria),
        edad: edad(r.expediente.usuaria),
        motivo: r.motivo,
        referidoEn: r.createdAt.toISOString(),
        referidoPor: r.otorgadoPor.nombreCompleto,
        personas: personasDelExpediente(r.expediente),
      }));
  }

  async sinProxima(): Promise<SinProximaConsultaDto[]> {
    const atenciones = await this.prisma.atencionMedica.findMany({
      where: {
        estado: 'ACTIVA',
        expediente: EXPEDIENTE_REFERIDO_A_MEDICA,
        citas: { none: { estado: 'PROGRAMADA' } },
      },
      select: {
        id: true,
        consecutivo: true,
        expediente: {
          select: {
            id: true,
            numero: true,
            usuaria: { select: { id: true, nombres: true, apellidos: true } },
          },
        },
        consultas: {
          select: { fechaHora: true },
          orderBy: { fechaHora: 'desc' },
          take: 1,
        },
      },
    });
    return atenciones
      .map((a) => ({
        usuariaId: a.expediente.usuaria.id,
        expedienteId: a.expediente.id,
        atencionId: a.id,
        codigoAtencion: etiquetaAtencion(a.expediente.numero, a.consecutivo),
        usuariaNombreCompleto: nombreCompleto(a.expediente.usuaria),
        ultimaConsulta: a.consultas[0]
          ? fechaCalendarioGT(a.consultas[0].fechaHora)
          : null,
      }))
      .sort((x, y) =>
        (x.ultimaConsulta ?? '').localeCompare(y.ultimaConsulta ?? ''),
      );
  }

  async programables(
    filtro: FiltroProgramables,
  ): Promise<PacienteProgramableDto[]> {
    const expedientes = await this.prisma.expediente.findMany({
      where: {
        ...EXPEDIENTE_REFERIDO_A_MEDICA,
        ...(filtro.usuariaId ? { usuariaId: filtro.usuariaId } : {}),
        ...(filtro.referidoId
          ? { referidos: { some: { id: filtro.referidoId, area: 'MEDICA' } } }
          : {}),
      },
      select: {
        id: true,
        numero: true,
        usuaria: { select: { id: true, ...SELECT_PERSONA } },
        ninos: SELECT_NINOS,
        referidos: {
          where: { area: 'MEDICA' },
          select: { id: true, createdAt: true, motivo: true },
        },
        atencionesMedicas: {
          select: {
            id: true,
            consecutivo: true,
            estado: true,
            createdAt: true,
          },
        },
      },
    });

    const programables: PacienteProgramableDto[] = [];
    for (const expediente of expedientes) {
      const base = {
        usuariaId: expediente.usuaria.id,
        usuariaNombreCompleto: nombreCompleto(expediente.usuaria),
        expedienteId: expediente.id,
        expedienteNumero: expediente.numero,
        personas: personasDelExpediente(expediente),
      };
      const activa = expediente.atencionesMedicas.find(
        (a) => a.estado === 'ACTIVA',
      );
      if (activa) {
        programables.push({
          ...base,
          referidoId: null,
          atencionActiva: {
            id: activa.id,
            codigo: etiquetaAtencion(expediente.numero, activa.consecutivo),
          },
          codigoNuevaAtencion: null,
          motivoReferencia: null,
        });
        continue;
      }
      const referencia = expediente.referidos.find((r) =>
        referenciaPendiente(r.createdAt, expediente.atencionesMedicas),
      );
      if (referencia) {
        const siguiente =
          Math.max(
            0,
            ...expediente.atencionesMedicas.map((a) => a.consecutivo),
          ) + 1;
        programables.push({
          ...base,
          referidoId: referencia.id,
          atencionActiva: null,
          codigoNuevaAtencion: etiquetaAtencion(expediente.numero, siguiente),
          motivoReferencia: referencia.motivo,
        });
      }
    }
    return programables.sort((a, b) =>
      a.usuariaNombreCompleto.localeCompare(b.usuariaNombreCompleto, 'es'),
    );
  }
}
