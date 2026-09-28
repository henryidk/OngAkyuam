import { Injectable } from '@nestjs/common';
import { TIPOS_DOCUMENTO_RESTRINGIBLES } from '@akyuam/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  ActualizarAccesoParams,
  ExpedienteParaAccesos,
  IAccesosRepository,
} from '../interfaces/accesos-repository.interface';

@Injectable()
export class AccesosRepository implements IAccesosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarExpediente(
    expedienteId: string,
  ): Promise<ExpedienteParaAccesos | null> {
    const expediente = await this.prisma.expediente.findUnique({
      where: { id: expedienteId },
      select: {
        id: true,
        numero: true,
        tipoRegistro: true,
        referidos: { select: { area: true, puedeVerDatosCaso: true } },
        documentos: {
          where: {
            vigente: true,
            tipo: { in: [...TIPOS_DOCUMENTO_RESTRINGIBLES] },
          },
          select: {
            id: true,
            tipo: true,
            version: true,
            visibilidadAreas: { select: { area: true } },
          },
        },
      },
    });
    if (!expediente) {
      return null;
    }
    return {
      id: expediente.id,
      numero: expediente.numero,
      tipoRegistro: expediente.tipoRegistro,
      referidos: expediente.referidos,
      documentos: expediente.documentos.map((documento) => ({
        id: documento.id,
        tipo: documento.tipo,
        version: documento.version,
        areasVisibles: documento.visibilidadAreas.map(
          (visibilidad) => visibilidad.area,
        ),
      })),
    };
  }

  async actualizar(params: ActualizarAccesoParams): Promise<void> {
    const otorgar = params.documentos
      .filter((documento) => documento.visible)
      .map((documento) => documento.documentoId);
    const revocar = params.documentos
      .filter((documento) => !documento.visible)
      .map((documento) => documento.documentoId);

    await this.prisma.$transaction(async (tx) => {
      if (params.datosCaso !== undefined) {
        await tx.referidoArea.update({
          where: {
            expedienteId_area: {
              expedienteId: params.expedienteId,
              area: params.area,
            },
          },
          data: { puedeVerDatosCaso: params.datosCaso },
        });
      }
      if (otorgar.length > 0) {
        await tx.documentoVisibilidadArea.createMany({
          data: otorgar.map((documentoId) => ({
            documentoId,
            area: params.area,
            otorgadoPorId: params.otorgadoPorId,
          })),
          skipDuplicates: true,
        });
      }
      if (revocar.length > 0) {
        await tx.documentoVisibilidadArea.deleteMany({
          where: { documentoId: { in: revocar }, area: params.area },
        });
      }
    });
  }
}
