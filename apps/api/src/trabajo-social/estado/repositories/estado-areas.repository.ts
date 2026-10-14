import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { fechaColumnaISO } from '@akyuam/shared';
import type {
  AtencionMedicaParaEstado,
  AtencionPsicologicaParaEstado,
  IEstadoAreasRepository,
  ProcesoJuridicoParaEstado,
} from '../interfaces/estado-areas-repository.interface';

@Injectable()
export class EstadoAreasRepository implements IEstadoAreasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async procesosJuridicos(
    expedienteId: string,
  ): Promise<ProcesoJuridicoParaEstado[]> {
    return this.prisma.procesoJuridico.findMany({
      where: { expedienteId },
      select: { fase: true, situacion: true },
    });
  }

  async atencionPsicologica(
    expedienteId: string,
  ): Promise<AtencionPsicologicaParaEstado | null> {
    // Con varios procesos en el expediente manda el más reciente: si la usuaria regresó y hay
    // uno abierto, el área vuelve a estar en atención aunque el anterior esté cerrado.
    const atencion = await this.prisma.atencionPsicologica.findFirst({
      where: { expedienteId },
      orderBy: { consecutivo: 'desc' },
      select: {
        estado: true,
        psicologaAsignada: { select: { nombreCompleto: true } },
        citas: {
          where: { estado: 'PROGRAMADA', fechaHora: { gte: new Date() } },
          orderBy: { fechaHora: 'asc' },
          take: 1,
          select: { fechaHora: true },
        },
      },
    });
    if (!atencion) {
      return null;
    }
    return {
      estado: atencion.estado,
      psicologa: atencion.psicologaAsignada?.nombreCompleto ?? null,
      proximaCita: atencion.citas[0]?.fechaHora ?? null,
    };
  }

  async atencionMedica(
    expedienteId: string,
  ): Promise<AtencionMedicaParaEstado | null> {
    const ahora = new Date();
    const [atencion, referencia] = await Promise.all([
      this.prisma.atencionMedica.findFirst({
        where: { expedienteId },
        orderBy: { consecutivo: 'desc' },
        select: {
          estado: true,
          motivoAlta: true,
          fechaAlta: true,
          createdAt: true,
          citas: {
            where: { estado: 'PROGRAMADA' },
            orderBy: { inicio: 'asc' },
            select: { inicio: true, duracionMin: true },
          },
        },
      }),
      this.prisma.referidoArea.findFirst({
        where: { expedienteId, area: 'MEDICA' },
        select: { createdAt: true },
      }),
    ]);
    if (!atencion) {
      return null;
    }
    const terminada = (cita: { inicio: Date; duracionMin: number }) =>
      cita.inicio.getTime() + cita.duracionMin * 60_000 <= ahora.getTime();
    return {
      estado: atencion.estado,
      motivoAlta: atencion.motivoAlta,
      fechaAlta: atencion.fechaAlta
        ? fechaColumnaISO(atencion.fechaAlta)
        : null,
      posteriorAReferencia:
        !referencia || atencion.createdAt >= referencia.createdAt,
      proximaCita:
        atencion.citas.find((c) => c.inicio >= ahora)?.inicio ?? null,
      citaSinRegistrar: atencion.citas.some(terminada),
    };
  }
}
