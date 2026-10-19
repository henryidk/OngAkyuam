import { Injectable } from '@nestjs/common';
import type { Prisma, Rol } from '@prisma/client';
import type {
  VistaMedicaParaJuridico,
  VistaMedicaParaPsicologia,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { etiquetaAtencion } from '@akyuam/shared';
import type {
  ConstanciaMedicaParaFirmar,
  IVisibilidadMedicaReader,
} from '../interfaces/visibilidad-medica-reader.interface';

/** Atenciones de la usuaria, en expedientes referidos al área que lee y que Medicina le abrió. */
function atencionesVisibles(
  usuariaId: string,
  area: Extract<Rol, 'JURIDICO' | 'PSICOLOGIA'>,
): Prisma.AtencionMedicaWhereInput {
  return {
    ...(area === 'JURIDICO'
      ? { visibleJuridico: true }
      : { visiblePsicologia: true }),
    expediente: { usuariaId, referidos: { some: { area } } },
  };
}

// `select` columna por columna: diagnóstico, plan, receta, signos y motivo de consulta nunca
// salen de la base de datos por este camino.
const SELECT_ATENCION = {
  consecutivo: true,
  estado: true,
  expediente: { select: { numero: true } },
} as const;

@Injectable()
export class VisibilidadMedicaReader implements IVisibilidadMedicaReader {
  constructor(private readonly prisma: PrismaService) {}

  async paraJuridico(usuariaId: string): Promise<VistaMedicaParaJuridico[]> {
    const atenciones = await this.prisma.atencionMedica.findMany({
      where: atencionesVisibles(usuariaId, 'JURIDICO'),
      orderBy: { createdAt: 'desc' },
      select: {
        ...SELECT_ATENCION,
        consultas: {
          orderBy: { fechaHora: 'asc' },
          select: {
            fechaHora: true,
            documentos: {
              where: { tipo: 'CONSTANCIA' },
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                nombreVisible: true,
                mimeType: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
    return atenciones.map((atencion) => ({
      codigo: etiquetaAtencion(
        atencion.expediente.numero,
        atencion.consecutivo,
      ),
      estado: atencion.estado,
      fechasConsulta: atencion.consultas.map((c) => c.fechaHora.toISOString()),
      constancias: atencion.consultas.flatMap((consulta) =>
        consulta.documentos.map((documento) => ({
          id: documento.id,
          nombreVisible: documento.nombreVisible,
          fecha: documento.createdAt.toISOString(),
          mimeType: documento.mimeType,
        })),
      ),
    }));
  }

  async constanciaParaJuridico(
    usuariaId: string,
    documentoId: string,
  ): Promise<ConstanciaMedicaParaFirmar | null> {
    const documento = await this.prisma.documentoMedico.findFirst({
      where: {
        id: documentoId,
        tipo: 'CONSTANCIA',
        consulta: { atencion: atencionesVisibles(usuariaId, 'JURIDICO') },
      },
      select: {
        id: true,
        claveObjeto: true,
        nombreArchivo: true,
        mimeType: true,
        consulta: { select: { atencion: { select: { expedienteId: true } } } },
      },
    });
    return documento
      ? {
          documentoId: documento.id,
          expedienteId: documento.consulta.atencion.expedienteId,
          claveObjeto: documento.claveObjeto,
          nombreArchivo: documento.nombreArchivo,
          mimeType: documento.mimeType,
        }
      : null;
  }

  async paraPsicologia(
    usuariaId: string,
  ): Promise<VistaMedicaParaPsicologia[]> {
    const atenciones = await this.prisma.atencionMedica.findMany({
      where: atencionesVisibles(usuariaId, 'PSICOLOGIA'),
      orderBy: { createdAt: 'desc' },
      select: {
        ...SELECT_ATENCION,
        consultas: {
          orderBy: { fechaHora: 'asc' },
          select: { fechaHora: true },
        },
      },
    });
    return atenciones.map((atencion) => ({
      codigo: etiquetaAtencion(
        atencion.expediente.numero,
        atencion.consecutivo,
      ),
      estado: atencion.estado,
      fechasConsulta: atencion.consultas.map((c) => c.fechaHora.toISOString()),
    }));
  }
}
