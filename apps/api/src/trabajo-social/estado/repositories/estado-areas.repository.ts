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
    // Cada persona del expediente (la usuaria y cada hijo/a) lleva sus propios procesos: el área
    // sigue en atención mientras alguno esté abierto, aunque el de otra persona ya se cerró.
    const procesos = await this.prisma.atencionPsicologica.findMany({
      where: { expedienteId },
      orderBy: { createdAt: 'desc' },
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
    const abiertos = procesos.filter((proceso) => proceso.estado !== 'CIERRE');
    if (abiertos.length === 0) {
      const ultimo = procesos[0];
      return ultimo
        ? {
            estado: ultimo.estado,
            psicologa: ultimo.psicologaAsignada?.nombreCompleto ?? null,
            proximaCita: null,
          }
        : null;
    }
    const proximas = abiertos
      .flatMap((proceso) => proceso.citas.map((cita) => cita.fechaHora))
      .sort((a, b) => a.getTime() - b.getTime());
    const conPsicologa = abiertos.find((proceso) => proceso.psicologaAsignada);
    return {
      estado: (conPsicologa ?? abiertos[0]).estado,
      psicologa: conPsicologa?.psicologaAsignada?.nombreCompleto ?? null,
      proximaCita: proximas[0] ?? null,
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
