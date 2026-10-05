import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  ReferenciaBandejaDto,
  VistaBandejaJuridico,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { REFERENCIA_PENDIENTE } from '../compartido/acceso-juridico';
import type {
  DevolverReferenciaParams,
  IReferenciasRepository,
} from '../interfaces/referencias-repository.interface';
import { nombreCompleto } from './mapeo-proceso';

const INCLUDE_REFERENCIA = {
  otorgadoPor: { select: { nombreCompleto: true } },
  expediente: {
    select: {
      numero: true,
      usuaria: {
        select: { id: true, nombres: true, apellidos: true, dpi: true },
      },
    },
  },
} satisfies Prisma.ReferidoAreaInclude;

type ReferenciaConDatos = Prisma.ReferidoAreaGetPayload<{
  include: typeof INCLUDE_REFERENCIA;
}>;

function mapearReferencia(
  referencia: ReferenciaConDatos,
): ReferenciaBandejaDto {
  const { usuaria } = referencia.expediente;
  return {
    referidoId: referencia.id,
    expedienteId: referencia.expedienteId,
    expedienteNumero: referencia.expediente.numero,
    usuaria: {
      id: usuaria.id,
      nombreCompleto: nombreCompleto(usuaria),
      dpi: usuaria.dpi,
    },
    motivo: referencia.motivo,
    referidoEn: referencia.createdAt.toISOString(),
    referidoPor: referencia.otorgadoPor.nombreCompleto,
    procesosSugeridos: referencia.procesosSugeridos,
    devueltoEn: referencia.devueltoEn?.toISOString() ?? null,
    motivoDevolucion: referencia.motivoDevolucion,
  };
}

@Injectable()
export class ReferenciasRepository implements IReferenciasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(vista: VistaBandejaJuridico): Promise<ReferenciaBandejaDto[]> {
    const consulta: Pick<Prisma.ReferidoAreaFindManyArgs, 'where' | 'orderBy'> =
      vista === 'pendientes'
        ? {
            where: REFERENCIA_PENDIENTE,
            // Las más antiguas primero: nadie espera más que quien llegó antes.
            orderBy: { createdAt: 'asc' },
          }
        : {
            where: { area: 'JURIDICO', devueltoEn: { not: null } },
            orderBy: { devueltoEn: 'desc' },
          };
    const referencias = await this.prisma.referidoArea.findMany({
      ...consulta,
      include: INCLUDE_REFERENCIA,
    });
    return referencias.map(mapearReferencia);
  }

  async buscarPendientePorExpediente(
    expedienteId: string,
  ): Promise<ReferenciaBandejaDto | null> {
    const referencia = await this.prisma.referidoArea.findFirst({
      where: { ...REFERENCIA_PENDIENTE, expedienteId },
      include: INCLUDE_REFERENCIA,
    });
    return referencia ? mapearReferencia(referencia) : null;
  }

  async devolver(
    params: DevolverReferenciaParams,
  ): Promise<{ expedienteId: string } | null> {
    // El "sigue pendiente" va en el WHERE del UPDATE: si dos personas actúan a la vez sobre
    // la misma referencia, solo una la cambia.
    const { count } = await this.prisma.referidoArea.updateMany({
      where: { ...REFERENCIA_PENDIENTE, id: params.referidoId },
      data: {
        devueltoEn: new Date(),
        motivoDevolucion: params.motivo,
        devueltoPorId: params.devueltoPorId,
      },
    });
    if (count !== 1) {
      return null;
    }
    return this.prisma.referidoArea.findUnique({
      where: { id: params.referidoId },
      select: { expedienteId: true },
    });
  }
}
