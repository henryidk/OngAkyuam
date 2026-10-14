import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ActualizarVisibilidadParams,
  DarAltaParams,
  IAtencionesMedicasRepository,
  VisibilidadActualizada,
} from '../interfaces/atenciones-medicas-repository.interface';
import {
  AtencionNoActivaError,
  VersionCambioError,
} from '../interfaces/errores-medica';
import { columnaFecha } from './crear-cita';
import { SERIALIZABLE, conReintentos } from './transaccion';

@Injectable()
export class AtencionesMedicasRepository implements IAtencionesMedicasRepository {
  constructor(private readonly prisma: PrismaService) {}

  darAlta(params: DarAltaParams): Promise<number> {
    return conReintentos(() =>
      this.prisma.$transaction(async (tx) => {
        const actual = await tx.atencionMedica.findUnique({
          where: { id: params.atencionId },
          select: { estado: true, version: true },
        });
        if (actual?.estado !== 'ACTIVA') {
          throw new AtencionNoActivaError();
        }
        const { count } = await tx.atencionMedica.updateMany({
          where: {
            id: params.atencionId,
            version: params.version,
            estado: 'ACTIVA',
          },
          data: {
            estado: 'ALTA',
            motivoAlta: params.motivo,
            notaAlta: params.nota,
            fechaAlta: columnaFecha(params.fechaAlta),
            version: { increment: 1 },
          },
        });
        if (count === 0) {
          throw new VersionCambioError();
        }
        // Las citas ya empezadas quedan como están: se registran o se marcan como inasistencia.
        const canceladas = await tx.citaMedica.updateMany({
          where: {
            atencionId: params.atencionId,
            estado: 'PROGRAMADA',
            inicio: { gt: params.ahora },
          },
          data: { estado: 'CANCELADA', version: { increment: 1 } },
        });
        return canceladas.count;
      }, SERIALIZABLE),
    );
  }

  async actualizarVisibilidad(
    params: ActualizarVisibilidadParams,
  ): Promise<VisibilidadActualizada> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.atencionMedica.updateMany({
        where: { id: params.atencionId, version: params.version },
        data: {
          ...(params.juridico !== undefined
            ? { visibleJuridico: params.juridico }
            : {}),
          ...(params.psicologia !== undefined
            ? { visiblePsicologia: params.psicologia }
            : {}),
          version: { increment: 1 },
        },
      });
      if (count === 0) {
        throw new VersionCambioError();
      }
      return tx.atencionMedica.findUniqueOrThrow({
        where: { id: params.atencionId },
        select: {
          version: true,
          visibleJuridico: true,
          visiblePsicologia: true,
        },
      });
    });
  }
}
