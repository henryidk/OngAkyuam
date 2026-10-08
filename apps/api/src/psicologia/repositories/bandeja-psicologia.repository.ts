import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  diasDesdeGT,
  edadEnAniosGT,
  fechaColumnaISO,
  nombreMunicipio,
  type CasoPorAgendarDto,
  type PersonaAtendidaDto,
  type ReferenciaBandejaPsicologiaDto,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IBandejaPsicologiaRepository,
  ReferenciaPsicologia,
} from '../interfaces/bandeja-psicologia-repository.interface';
import { EXPEDIENTE_SIN_TOMAR } from './atencion-psicologica.repository';

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

type ExpedienteCola = Prisma.ExpedienteGetPayload<{
  select: typeof SELECT_EXPEDIENTE_COLA;
}>;

interface PersonaConNacimiento {
  nombres: string;
  apellidos: string;
  fechaNacimiento: Date;
}

function nombreCompleto(persona: PersonaConNacimiento): string {
  return `${persona.nombres} ${persona.apellidos}`;
}

function edad(persona: PersonaConNacimiento): number {
  return edadEnAniosGT(fechaColumnaISO(persona.fechaNacimiento));
}

/** La usuaria primero y luego sus hijos/as: las personas a quienes se puede dar la cita. */
function personasDelExpediente(
  expediente: ExpedienteCola,
): PersonaAtendidaDto[] {
  return [
    {
      ninoId: null,
      nombreCompleto: nombreCompleto(expediente.usuaria),
      edad: edad(expediente.usuaria),
    },
    ...expediente.ninos.map((nino) => ({
      ninoId: nino.id,
      nombreCompleto: nombreCompleto(nino),
      edad: edad(nino),
    })),
  ];
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
      where: {
        psicologaAsignadaId: psicologaId,
        estado: { not: 'CIERRE' },
        referidoId: { not: null },
        citas: { none: {} },
      },
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
