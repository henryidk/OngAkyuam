import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DURACION_CITA_MEDICA_MIN,
  fechaCalendarioGT,
  fechaColumnaISO,
  horaGT,
  etiquetaAtencion,
} from '@akyuam/shared';
import type {
  CitaAgendaMedicaDto,
  PacienteProgramableDto,
  ReferenciaBandejaMedicaDto,
  SinProximaConsultaDto,
} from '@akyuam/shared';
import {
  SELECT_INGRESO_USUARIA,
  ingresoDeUsuaria,
} from '../../common/ingreso-area';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SELECT_HIJO,
  SELECT_PERSONA,
  edad,
  nombreCompleto,
  personasDelExpediente,
} from '../../psicologia/repositories/personas';
import { derivarEstadoCita } from '../dominio/estado-cita';
import { horaFin } from '../dominio/horario';
import {
  puedeReprogramar,
  referenciaPendiente,
} from '../dominio/reglas-atencion';
import type {
  CitaResumida,
  FiltroProgramables,
  ILectorCitasMedicas,
  ILectorPendientesMedica,
} from '../interfaces/agenda-medica-repository.interface';
import { EXPEDIENTE_REFERIDO_A_MEDICA } from './acceso-medica.repository';
import { SELECT_PERSONAS_CITA, personasDeCita } from './mapeo';
import { consecutivoSiguiente } from '../../common/consecutivo';

const SELECT_NINOS = {
  select: { id: true, ...SELECT_HIJO },
  orderBy: { consecutivo: 'asc' },
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
    // Una consulta para "Ver consulta": la de la usuaria si vino.
    consultas: {
      select: { id: true },
      orderBy: [{ ninoId: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
      take: 1,
    },
    reprogramadaA: { select: { id: true, inicio: true } },
    personas: SELECT_PERSONAS_CITA,
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
        // ¿La paciente ya tiene otra cita futura? Decide si se ofrece "Reprogramar" en una
        // inasistencia.
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
    personas: personasDeCita(expediente.usuaria, fila.personas),
    inicio: fila.inicio.toISOString(),
    fecha: fechaCalendarioGT(fila.inicio),
    hora,
    horaFin: horaFin(hora, fila.duracionMin),
    duracionMin: fila.duracionMin,
    estado: fila.estado,
    estadoVista: derivarEstadoCita(fila, ahora),
    consultaId: fila.consultas[0]?.id ?? null,
    reprogramadaA: fila.reprogramadaA
      ? {
          id: fila.reprogramadaA.id,
          fecha: fechaCalendarioGT(fila.reprogramadaA.inicio),
          hora: horaGT(fila.reprogramadaA.inicio),
        }
      : null,
    puedeReprogramar: puedeReprogramar(
      {
        estado: fila.estado,
        inicio: fila.inicio,
        tieneConsultas: fila.consultas.length > 0,
        reprogramadaA: fila.reprogramadaA,
        atencionActiva: atencion.estado === 'ACTIVA',
        tieneCitaFutura: atencion.citas.length > 0,
      },
      ahora,
    ),
  };
}

@Injectable()
export class AgendaMedicaRepository
  implements ILectorCitasMedicas, ILectorPendientesMedica
{
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
    // Ninguna cita dura menos que el bloque: las que empezaron después aún no terminan. Las más
    // largas se terminan de filtrar con su propia duración.
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
    return filas
      .filter((fila) => derivarEstadoCita(fila, ahora) === 'SIN_REGISTRAR')
      .map((fila) => aCitaAgenda(fila, ahora));
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
        ...SELECT_INGRESO_USUARIA,
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
        ingreso: ingresoDeUsuaria(r),
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
        version: true,
        consecutivo: true,
        fechaInicio: true,
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
        // La última inasistencia: si es posterior a la última consulta, faltó y sigue sin fecha.
        citas: {
          where: { estado: 'NO_ASISTIO' },
          select: { inicio: true },
          orderBy: { inicio: 'desc' },
          take: 1,
        },
      },
    });
    return atenciones
      .map((a): SinProximaConsultaDto => {
        const consulta = a.consultas[0]?.fechaHora;
        const falta = a.citas[0]?.inicio;
        const faltoDespues =
          falta !== undefined &&
          (consulta === undefined || falta.getTime() > consulta.getTime());
        let desde = fechaColumnaISO(a.fechaInicio);
        if (faltoDespues) {
          desde = fechaCalendarioGT(falta);
        } else if (consulta) {
          desde = fechaCalendarioGT(consulta);
        }
        return {
          usuariaId: a.expediente.usuaria.id,
          expedienteId: a.expediente.id,
          atencionId: a.id,
          atencionVersion: a.version,
          codigoAtencion: etiquetaAtencion(a.expediente.numero, a.consecutivo),
          usuariaNombreCompleto: nombreCompleto(a.expediente.usuaria),
          motivo: faltoDespues ? 'NO_ASISTIO' : 'SIN_FECHA',
          desde,
        };
      })
      .sort((x, y) => y.desde.localeCompare(x.desde));
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
        const siguiente = consecutivoSiguiente(
          expediente.atencionesMedicas.map((a) => a.consecutivo),
        );
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
