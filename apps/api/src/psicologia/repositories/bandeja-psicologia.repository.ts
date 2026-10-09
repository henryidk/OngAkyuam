import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  diasDesdeGT,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_TIPOLOGIA_DELITO,
  nombreMunicipio,
  type CasoPorAgendarDto,
  type CasoPorReasignarDto,
  type ExpedientePreviaTomaDto,
  type ReferenciaBandejaPsicologiaDto,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { codigoProceso } from '../dominio/codigo-proceso';
import type {
  IBandejaPsicologiaRepository,
  ProcesoReasignado,
  ReasignarProcesoParams,
  ReferenciaPsicologia,
} from '../interfaces/bandeja-psicologia-repository.interface';
import {
  EXPEDIENTE_SIN_TOMAR,
  PROCESO_POR_REASIGNAR,
} from './acceso-expediente';
import { edad, nombreCompleto, personasDelExpediente } from './personas';

/** Tope de seguridad de las dos colas: son listas de trabajo, no un historial. */
const LIMITE_COLA = 200;

// Solo lo que la tarjeta muestra: ni dirección, ni teléfono, ni datos del agresor.
const SELECT_EXPEDIENTE_COLA = {
  id: true,
  numero: true,
  usuaria: {
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      fechaNacimiento: true,
      municipio: true,
      municipioOtro: true,
    },
  },
  ninos: {
    select: { id: true, nombres: true, apellidos: true, fechaNacimiento: true },
    orderBy: { fechaNacimiento: 'asc' },
  },
} satisfies Prisma.ExpedienteSelect;

// Vista previa antes de tomar el caso. Lista cerrada a propósito: lo que no está aquí no sale
// de la base, así que no puede colarse en la respuesta (agresor, dirección, teléfono, DPI,
// ubicación y observaciones quedan fuera).
const SELECT_PREVIA_TOMA = {
  id: true,
  motivo: true,
  createdAt: true,
  puedeVerDatosCaso: true,
  otorgadoPor: { select: { nombreCompleto: true } },
  expediente: {
    select: {
      numero: true,
      tipologiaDelito: true,
      usuaria: {
        select: {
          nombres: true,
          apellidos: true,
          fechaNacimiento: true,
          municipio: true,
          municipioOtro: true,
          grupoEtnico: true,
        },
      },
      ninos: SELECT_EXPEDIENTE_COLA.ninos,
    },
  },
} satisfies Prisma.ReferidoAreaSelect;

/** Caso que la psicóloga tomó y al que todavía no le agenda la primera cita. */
export function casoPorAgendar(psicologaId: string) {
  return {
    psicologaAsignadaId: psicologaId,
    estado: { not: 'CIERRE' },
    referidoId: { not: null },
    citas: { none: {} },
  } satisfies Prisma.AtencionPsicologicaWhereInput;
}

@Injectable()
export class BandejaPsicologiaRepository implements IBandejaPsicologiaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarSinTomar(): Promise<ReferenciaBandejaPsicologiaDto[]> {
    const referidos = await this.prisma.referidoArea.findMany({
      where: { area: 'PSICOLOGIA', expediente: EXPEDIENTE_SIN_TOMAR },
      select: {
        id: true,
        motivo: true,
        createdAt: true,
        otorgadoPor: { select: { nombreCompleto: true } },
        expediente: { select: SELECT_EXPEDIENTE_COLA },
      },
      orderBy: { createdAt: 'asc' },
      take: LIMITE_COLA,
    });

    const atendidasAntes = await this.usuariasAtendidasAntes(
      referidos.map((referido) => referido.expediente.usuaria.id),
    );

    return referidos.map((referido) => {
      const { expediente } = referido;
      const referidoEn = referido.createdAt.toISOString();
      return {
        referidoId: referido.id,
        expedienteId: expediente.id,
        expedienteNumero: expediente.numero,
        usuariaId: expediente.usuaria.id,
        usuariaNombreCompleto: nombreCompleto(expediente.usuaria),
        edad: edad(expediente.usuaria),
        municipio: nombreMunicipio(
          expediente.usuaria.municipio,
          expediente.usuaria.municipioOtro,
        ),
        motivo: referido.motivo,
        referidoEn,
        referidoPor: referido.otorgadoPor.nombreCompleto,
        diasEsperando: diasDesdeGT(referidoEn),
        personas: personasDelExpediente(expediente),
        atendidaAntes: atendidasAntes.has(expediente.usuaria.id),
      };
    });
  }

  async listarPorAgendar(psicologaId: string): Promise<CasoPorAgendarDto[]> {
    const atenciones = await this.prisma.atencionPsicologica.findMany({
      where: casoPorAgendar(psicologaId),
      select: {
        referidoId: true,
        tomadaEn: true,
        createdAt: true,
        expediente: { select: SELECT_EXPEDIENTE_COLA },
      },
      orderBy: { tomadaEn: 'asc' },
      take: LIMITE_COLA,
    });

    return atenciones.map((atencion) => ({
      // No-null: el `where` ya exige `referidoId`.
      referidoId: atencion.referidoId!,
      expedienteId: atencion.expediente.id,
      expedienteNumero: atencion.expediente.numero,
      usuariaId: atencion.expediente.usuaria.id,
      usuariaNombreCompleto: nombreCompleto(atencion.expediente.usuaria),
      tomadaEn: (atencion.tomadaEn ?? atencion.createdAt).toISOString(),
      personas: personasDelExpediente(atencion.expediente),
    }));
  }

  async listarPorReasignar(): Promise<CasoPorReasignarDto[]> {
    const atenciones = await this.prisma.atencionPsicologica.findMany({
      where: PROCESO_POR_REASIGNAR,
      select: {
        id: true,
        consecutivo: true,
        estado: true,
        fechaInicio: true,
        psicologaAsignada: { select: { nombreCompleto: true } },
        expediente: { select: SELECT_EXPEDIENTE_COLA },
        _count: { select: { citas: { where: { estado: 'ATENDIDA' } } } },
        citas: { where: { estado: 'PROGRAMADA' }, select: { id: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: LIMITE_COLA,
    });

    return atenciones.map((atencion) => {
      const { expediente } = atencion;
      return {
        procesoId: atencion.id,
        expedienteNumero: expediente.numero,
        usuariaId: expediente.usuaria.id,
        usuariaNombreCompleto: nombreCompleto(expediente.usuaria),
        edad: edad(expediente.usuaria),
        municipio: nombreMunicipio(
          expediente.usuaria.municipio,
          expediente.usuaria.municipioOtro,
        ),
        codigo: atencion.fechaInicio
          ? codigoProceso(atencion.consecutivo, expediente.numero)
          : null,
        etapa: atencion.estado,
        sesionesAtendidas: atencion._count.citas,
        fechaInicio: atencion.fechaInicio?.toISOString() ?? null,
        // No-null: el `where` exige una psicóloga asignada (y desactivada).
        psicologaAnterior: atencion.psicologaAsignada!.nombreCompleto,
        citasProgramadas: atencion.citas.length,
        personas: personasDelExpediente(expediente),
      };
    });
  }

  async reasignar(
    params: ReasignarProcesoParams,
  ): Promise<ProcesoReasignado | null> {
    return this.prisma.$transaction(async (tx) => {
      const anterior = await tx.atencionPsicologica.findFirst({
        where: { id: params.procesoId, ...PROCESO_POR_REASIGNAR },
        select: {
          expedienteId: true,
          psicologaAsignadaId: true,
          fechaInicio: true,
          referidoId: true,
        },
      });
      if (!anterior?.psicologaAsignadaId) {
        return null;
      }

      // La dueña anterior va en el WHERE: si dos psicólogas llegan aquí a la vez, Postgres
      // bloquea la fila, deja pasar a la primera y, al re-evaluar la condición para la segunda,
      // la dueña ya cambió: no afecta ninguna fila y no se cancela ni registra nada.
      const tomados = await tx.atencionPsicologica.updateMany({
        where: {
          id: params.procesoId,
          psicologaAsignadaId: anterior.psicologaAsignadaId,
          ...PROCESO_POR_REASIGNAR,
        },
        data: {
          psicologaAsignadaId: params.psicologaId,
          tomadaEn: new Date(),
          actualizadoPorId: params.psicologaId,
          version: { increment: 1 },
        },
      });
      if (tomados.count === 0) {
        return null;
      }

      // Las citas no se heredan: las había acordado la psicóloga anterior. Todas las que sigan
      // programadas, pasadas o futuras, se cancelan; la nueva dueña agenda las suyas.
      const canceladas = await tx.citaPsicologica.updateMany({
        where: { atencionId: params.procesoId, estado: 'PROGRAMADA' },
        data: { estado: 'CANCELADA' },
      });

      await tx.reasignacionAtencionPsicologica.create({
        data: {
          atencionId: params.procesoId,
          dePsicologaId: anterior.psicologaAsignadaId,
          aPsicologaId: params.psicologaId,
        },
      });

      return {
        procesoId: params.procesoId,
        expedienteId: anterior.expedienteId,
        psicologaAnteriorId: anterior.psicologaAsignadaId,
        referidoIdPorAgendar: anterior.fechaInicio ? null : anterior.referidoId,
        citasCanceladas: canceladas.count,
      };
    });
  }

  async obtenerPreviaToma(
    referidoId: string,
  ): Promise<ExpedientePreviaTomaDto | null> {
    const referido = await this.prisma.referidoArea.findFirst({
      where: { id: referidoId, area: 'PSICOLOGIA' },
      select: SELECT_PREVIA_TOMA,
    });
    if (!referido) {
      return null;
    }

    const { expediente } = referido;
    return {
      referidoId: referido.id,
      expedienteNumero: expediente.numero,
      usuariaNombreCompleto: nombreCompleto(expediente.usuaria),
      edad: edad(expediente.usuaria),
      municipio: nombreMunicipio(
        expediente.usuaria.municipio,
        expediente.usuaria.municipioOtro,
      ),
      grupoEtnico: ETIQUETAS_GRUPO_ETNICO[expediente.usuaria.grupoEtnico],
      // La tipología es parte de los "datos del caso": solo sale si Trabajo Social los compartió.
      tipologias: referido.puedeVerDatosCaso
        ? expediente.tipologiaDelito.map(
            (tipologia) => ETIQUETAS_TIPOLOGIA_DELITO[tipologia],
          )
        : null,
      motivo: referido.motivo,
      referidoEn: referido.createdAt.toISOString(),
      referidoPor: referido.otorgadoPor.nombreCompleto,
      personas: personasDelExpediente(expediente),
    };
  }

  async buscarReferencia(
    referidoId: string,
    psicologaId: string,
  ): Promise<ReferenciaPsicologia | null> {
    const referido = await this.prisma.referidoArea.findFirst({
      where: { id: referidoId, area: 'PSICOLOGIA' },
      select: {
        id: true,
        expediente: {
          select: {
            id: true,
            numero: true,
            usuariaId: true,
            atencionesPsicologicas: {
              where: { psicologaAsignadaId: { not: null } },
              select: { id: true, estado: true, psicologaAsignadaId: true },
            },
          },
        },
      },
    });
    if (!referido) {
      return null;
    }

    const tomadas = referido.expediente.atencionesPsicologicas;
    const mia = tomadas.find(
      (atencion) =>
        atencion.psicologaAsignadaId === psicologaId &&
        atencion.estado !== 'CIERRE',
    );
    return {
      referidoId: referido.id,
      expedienteId: referido.expediente.id,
      expedienteNumero: referido.expediente.numero,
      usuariaId: referido.expediente.usuariaId,
      situacion:
        tomadas.length === 0 ? 'SIN_TOMAR' : mia ? 'MIA' : 'NO_DISPONIBLE',
      procesoId: mia?.id ?? null,
    };
  }

  /** Usuarias que ya tuvieron algún proceso psicológico, en cualquier expediente. */
  private async usuariasAtendidasAntes(
    usuariaIds: string[],
  ): Promise<Set<string>> {
    if (usuariaIds.length === 0) {
      return new Set();
    }
    const expedientes = await this.prisma.expediente.findMany({
      where: {
        usuariaId: { in: usuariaIds },
        atencionesPsicologicas: {
          some: { psicologaAsignadaId: { not: null } },
        },
      },
      select: { usuariaId: true },
      distinct: ['usuariaId'],
    });
    return new Set(expedientes.map((expediente) => expediente.usuariaId));
  }
}
