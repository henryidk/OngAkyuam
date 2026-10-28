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
  PersonaAjenaError,
  PersonasPrimeraConsultaError,
  ReferenciaYaAtendidaError,
  SinReferenciaPendienteError,
  VersionCambioError,
} from '../interfaces/errores-medica';
import { columnaFecha, crearCitaEnTx } from './crear-cita';
import { SERIALIZABLE, conReintentosHorario } from './transaccion';

@Injectable()
export class CitasMedicasRepository implements ICitasMedicasRepository {
  constructor(private readonly prisma: PrismaService) {}

  programar(params: ProgramarCitaParams): Promise<CitaProgramada> {
    return conReintentosHorario(() =>
      this.prisma.$transaction(async (tx) => {
        // Serializa la apertura por expediente: dos "Agendar primera consulta" simultáneos no
        // pueden calcular el mismo consecutivo.
        await tx.$queryRaw`SELECT id FROM "Expediente" WHERE id = ${params.expedienteId} FOR UPDATE`;

        const atencion = await this.atencionParaCita(tx, params);
        await this.exigirPersonas(tx, params, atencion.atencionAbierta);
        const citaId = await crearCitaEnTx(tx, {
          atencionId: atencion.atencionId,
          personas: params.personas,
          inicio: params.inicio,
          duracionMin: params.duracionMin,
          creadoPorId: params.creadoPorId,
        });
        return { ...atencion, citaId };
      }, SERIALIZABLE),
    );
  }

  registrarInasistencia(
    params: RegistrarInasistenciaParams,
  ): Promise<string | null> {
    return conReintentosHorario(() =>
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
          personas: cita.personas.map((persona) => persona.ninoId),
          inicio: params.reprogramarA,
          duracionMin: cita.duracionMin,
          creadoPorId: params.creadoPorId,
          reprogramadaDesdeId: params.citaId,
        });
      }, SERIALIZABLE),
    );
  }

  reprogramar(params: ReprogramarCitaParams): Promise<string> {
    return conReintentosHorario(() =>
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
          personas: cita.personas.map((persona) => persona.ninoId),
          inicio: params.inicio,
          duracionMin: cita.duracionMin,
          creadoPorId: params.creadoPorId,
          reprogramadaDesdeId: params.citaId,
        });
      }, SERIALIZABLE),
    );
  }

  listarOcupadas(
    desde: Date,
    hasta: Date,
  ): Promise<{ inicio: Date; duracionMin: number }[]> {
    return this.prisma.citaMedica.findMany({
      where: {
        inicio: { gte: desde, lte: hasta },
        estado: { in: ['PROGRAMADA', 'ATENDIDA'] },
      },
      select: { inicio: true, duracionMin: true },
    });
  }

  /**
   * Los hijos/as de la cita son del expediente y, si la cita abre la atención (primera
   * consulta), van la usuaria y todos los hijos/as registrados. Se lee dentro de la transacción
   * (con el expediente bloqueado) para comparar con los hijos/as de ese momento.
   */
  private async exigirPersonas(
    tx: Prisma.TransactionClient,
    params: ProgramarCitaParams,
    abreAtencion: boolean,
  ): Promise<void> {
    const ninos = await tx.nino.findMany({
      where: { expedienteId: params.expedienteId },
      select: { id: true },
    });
    const delExpediente = new Set(ninos.map((nino) => nino.id));
    const ninosCita = params.personas.filter(
      (persona): persona is string => persona !== null,
    );
    if (ninosCita.some((ninoId) => !delExpediente.has(ninoId))) {
      throw new PersonaAjenaError();
    }
    if (
      abreAtencion &&
      (!params.personas.includes(null) ||
        ninosCita.length !== delExpediente.size)
    ) {
      throw new PersonasPrimeraConsultaError();
    }
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
        duracionMin: true,
        personas: { select: { ninoId: true } },
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
