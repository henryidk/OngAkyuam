import { Injectable } from '@nestjs/common';
import type { ProcesoPsicologiaCompartidoDto } from '@akyuam/shared';
import type { Rol } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { codigoProceso } from '../../../psicologia/dominio/codigo-proceso';
import type {
  ICompartidoRepository,
  ProcesoJuridicoCompartido,
} from '../interfaces/compartido-repository.interface';

@Injectable()
export class CompartidoRepository implements ICompartidoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async areasReferidas(expedienteId: string): Promise<Rol[] | null> {
    const expediente = await this.prisma.expediente.findUnique({
      where: { id: expedienteId },
      select: { referidos: { select: { area: true } } },
    });
    return expediente
      ? expediente.referidos.map((referido) => referido.area)
      : null;
  }

  async procesosJuridicos(
    expedienteId: string,
  ): Promise<ProcesoJuridicoCompartido[]> {
    const procesos = await this.prisma.procesoJuridico.findMany({
      where: { expedienteId },
      orderBy: { fechaInicio: 'asc' },
      select: {
        tipo: true,
        fase: true,
        situacion: true,
        abogada: { select: { nombre: true } },
        procuradora: { select: { nombre: true } },
      },
    });
    return procesos.map((proceso) => ({
      tipo: proceso.tipo,
      fase: proceso.fase,
      situacion: proceso.situacion,
      abogada: proceso.abogada?.nombre ?? null,
      procuradora: proceso.procuradora?.nombre ?? null,
    }));
  }

  async procesosPsicologicos(
    expedienteId: string,
  ): Promise<ProcesoPsicologiaCompartidoDto[]> {
    const ahora = new Date();
    // `select` columna por columna: las notas de sesión, el motivo de cierre y el contenido de
    // las citas nunca salen de la base de datos por este camino.
    const procesos = await this.prisma.atencionPsicologica.findMany({
      where: { expedienteId, psicologaAsignadaId: { not: null } },
      orderBy: { consecutivo: 'asc' },
      select: {
        consecutivo: true,
        estado: true,
        fechaInicio: true,
        fechaCierre: true,
        expediente: { select: { numero: true } },
        citas: {
          select: {
            estado: true,
            fechaHora: true,
            documentos: {
              select: { id: true, tipo: true, createdAt: true },
            },
          },
          orderBy: { fechaHora: 'asc' },
        },
      },
    });

    return procesos.map((proceso) => {
      const proxima = proceso.citas.find(
        (cita) => cita.estado === 'PROGRAMADA' && cita.fechaHora >= ahora,
      );
      const documentos = proceso.citas
        .flatMap((cita) => cita.documentos)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return {
        codigo: codigoProceso(proceso.consecutivo, proceso.expediente.numero),
        etapa: proceso.estado,
        fechaInicio: proceso.fechaInicio?.toISOString() ?? null,
        fechaCierre: proceso.fechaCierre?.toISOString() ?? null,
        proximaCita: proxima?.fechaHora.toISOString() ?? null,
        documentos: documentos.map((documento) => ({
          id: documento.id,
          tipo: documento.tipo,
          subidoEn: documento.createdAt.toISOString(),
        })),
      };
    });
  }
}
