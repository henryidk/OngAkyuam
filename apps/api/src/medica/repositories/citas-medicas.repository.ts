import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CitaProgramada,
  ICitasMedicasRepository,
  ProgramarCitaParams,
  RegistrarInasistenciaParams,
  ReprogramarCitaParams,
} from '../interfaces/citas-medicas-repository.interface';
import {
  AtencionNoActivaError,
  CitaNoDisponibleError,
  HorarioOcupadoError,
  ReferenciaYaAtendidaError,
  SinReferenciaPendienteError,
  VersionCambioError,
} from '../interfaces/errores-medica';
import { columnaFecha, crearCitaEnTx } from './crear-cita';
import { SERIALIZABLE, conReintentos, esChoqueUnico } from './transaccion';

/**
 * Si tras los reintentos sigue chocando con un índice único, es el horario: otra petición tomó
 * la misma hora en el mismo instante.
 */
async function traducirChoque<T>(operacion: () => Promise<T>): Promise<T> {
  try {
    return await conReintentos(operacion);
  } catch (error) {
    if (esChoqueUnico(error)) {
      throw new HorarioOcupadoError();
    }
    throw error;
  }
}

@Injectable()
export class CitasMedicasRepository implements ICitasMedicasRepository {
  constructor(private readonly prisma: PrismaService) {}

  programar(params: ProgramarCitaParams): Promise<CitaProgramada> {
    return traducirChoque(() =>
      this.prisma.$transaction(async (tx) => {
        // Serializa la apertura por expediente: dos "Agendar primera consulta" simultáneos no
        // pueden calcular el mismo consecutivo.
        await tx.$queryRaw`SELECT id FROM "Expediente" WHERE id = ${params.expedienteId} FOR UPDATE`;

        const atencion = await this.atencionParaCita(tx, params);
        const citaId = await crearCitaEnTx(tx, {
          atencionId: atencion.atencionId,
          ninoId: params.ninoId,
          inicio: params.inicio,
          creadoPorId: params.creadoPorId,
        });
        return { ...atencion, citaId };
      }, SERIALIZABLE),
    );
  }

  registrarInasistencia(
    params: RegistrarInasistenciaParams,
  ): Promise<string | null> {
    return traducirChoque(() =>
      this.prisma.$transaction(async (tx) => {
        // Versión, estado y que ya haya empezado van en el WHERE: si otra pestaña la registró,
        // no se actualiza ninguna fila.
        const { count } = await tx.citaMedica.updateMany({
          where: {
            id: params.citaId,
            version: params.version,
            estado: 'PROGRAMADA',
            inicio: { lte: params.ahora },
          },
          data: { estado: 'NO_ASISTIO', version: { increment: 1 } },
        });
        if (count === 0) {
          throw new VersionCambioError();
        }
        if (!params.reprogramarA) {
          return null;
        }
        const cita = await this.citaConAtencion(tx, params.citaId);
        if (cita.atencion.estado !== 'ACTIVA') {
          throw new AtencionNoActivaError();
        }
        return crearCitaEnTx(tx, {
          atencionId: cita.atencionId,
          ninoId: cita.ninoId,
          inicio: params.reprogramarA,
          creadoPorId: params.creadoPorId,
          reprogramadaDesdeId: params.citaId,
        });
      }, SERIALIZABLE),
    );
  }

  reprogramar(params: ReprogramarCitaParams): Promise<string> {
    return traducirChoque(() =>
      this.prisma.$transaction(async (tx) => {
        const cita = await this.citaConAtencion(tx, params.citaId);
        if (cita.version !== params.version) {
          throw new VersionCambioError();
        }
        if (cita.estado !== 'NO_ASISTIO' || cita.reprogramadaA !== null) {
          throw new CitaNoDisponibleError();
        }
        if (cita.atencion.estado !== 'ACTIVA') {
          throw new AtencionNoActivaError();
        }
        const { count } = await tx.citaMedica.updateMany({
          where: { id: params.citaId, version: params.version },
          data: { version: { increment: 1 } },
        });
        if (count === 0) {
          throw new VersionCambioError();
        }
        return crearCitaEnTx(tx, {
          atencionId: cita.atencionId,
          ninoId: cita.ninoId,
          inicio: params.inicio,
          creadoPorId: params.creadoPorId,
          reprogramadaDesdeId: params.citaId,
        });
      }, SERIALIZABLE),
    );
  }

  async listarOcupadas(desde: Date, hasta: Date): Promise<Date[]> {
    const citas = await this.prisma.citaMedica.findMany({
      where: {
        inicio: { gte: desde, lte: hasta },
        estado: { in: ['PROGRAMADA', 'ATENDIDA'] },
      },
      select: { inicio: true },
    });
    return citas.map((cita) => cita.inicio);
  }

  /**
   * La atención a la que va la cita: la activa del expediente o, si no hay, una nueva abierta a
   * partir de la referencia pendiente. Pendiente = referencia a MEDICA sin atención creada
   * después de ella (la misma regla que la bandeja).
   */
  private async atencionParaCita(
    tx: Prisma.TransactionClient,
    params: ProgramarCitaParams,
  ): Promise<Omit<CitaProgramada, 'citaId'>> {
    const activa = await tx.atencionMedica.findFirst({
      where: { expedienteId: params.expedienteId, estado: 'ACTIVA' },
      select: { id: true, consecutivo: true },
    });
    if (activa) {
      if (params.referidoId !== null) {
        throw new ReferenciaYaAtendidaError();
      }
      return {
        atencionId: activa.id,
        consecutivo: activa.consecutivo,
        atencionAbierta: false,
      };
    }

    const referencia = await tx.referidoArea.findFirst({
      where: {
        expedienteId: params.expedienteId,
        area: 'MEDICA',
        ...(params.referidoId !== null ? { id: params.referidoId } : {}),
      },
      select: { id: true, createdAt: true },
    });
    if (!referencia) {
      throw new SinReferenciaPendienteError();
    }
    const posterior = await tx.atencionMedica.findFirst({
      where: {
        expedienteId: params.expedienteId,
        createdAt: { gte: referencia.createdAt },
      },
      select: { id: true },
    });
    if (posterior) {
      throw params.referidoId !== null
        ? new ReferenciaYaAtendidaError()
        : new SinReferenciaPendienteError();
    }

    const { _max } = await tx.atencionMedica.aggregate({
      where: { expedienteId: params.expedienteId },
      _max: { consecutivo: true },
    });
    const consecutivo = (_max.consecutivo ?? 0) + 1;
    const nueva = await tx.atencionMedica.create({
      data: {
        expedienteId: params.expedienteId,
        consecutivo,
        referidoId: referencia.id,
        medicaId: params.creadoPorId,
        fechaInicio: columnaFecha(params.hoy),
        creadoPorId: params.creadoPorId,
      },
      select: { id: true },
    });
    return { atencionId: nueva.id, consecutivo, atencionAbierta: true };
  }

  private async citaConAtencion(tx: Prisma.TransactionClient, citaId: string) {
    const cita = await tx.citaMedica.findUnique({
      where: { id: citaId },
      select: {
        atencionId: true,
        ninoId: true,
        estado: true,
        version: true,
        reprogramadaA: { select: { id: true } },
        atencion: { select: { estado: true } },
      },
    });
    if (!cita) {
      throw new CitaNoDisponibleError();
    }
    return cita;
  }
}
