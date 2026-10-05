import { Injectable } from '@nestjs/common';
import type { Rol } from '@prisma/client';
import { fechaColumnaISO, type ExpedienteResumenArea } from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  DocumentoParaDescargaArea,
  ExpedienteReferidoArea,
  IAreasRepository,
} from '../interfaces/areas-repository.interface';

const SELECT_AREAS_VISIBLES = {
  visibilidadAreas: { select: { area: true } },
} as const;

@Injectable()
export class AreasRepository implements IAreasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorArea(area: Rol): Promise<ExpedienteResumenArea[]> {
    const expedientes = await this.prisma.expediente.findMany({
      where: { referidos: { some: { area } } },
      include: { usuaria: true },
      orderBy: { createdAt: 'desc' },
    });

    return expedientes.map((expediente) => ({
      id: expediente.id,
      numero: expediente.numero,
      fecha: fechaColumnaISO(expediente.fecha),
      municipio: expediente.usuaria.municipio,
      tipoRegistro: expediente.tipoRegistro,
      usuariaNombreCompleto: `${expediente.usuaria.nombres} ${expediente.usuaria.apellidos}`,
    }));
  }

  async buscarReferido(
    expedienteId: string,
    area: Rol,
  ): Promise<ExpedienteReferidoArea | null> {
    const expediente = await this.prisma.expediente.findFirst({
      where: { id: expedienteId, referidos: { some: { area } } },
      include: {
        usuaria: true,
        agresor: true,
        ninos: true,
        referidos: { where: { area }, select: { puedeVerDatosCaso: true } },
        // Las áreas nunca ven versiones reemplazadas: solo Trabajo Social ve el historial.
        documentos: {
          where: { vigente: true },
          include: SELECT_AREAS_VISIBLES,
        },
      },
    });
    const referido = expediente?.referidos[0];
    if (!expediente || !referido) {
      return null;
    }

    return {
      id: expediente.id,
      numero: expediente.numero,
      fecha: fechaColumnaISO(expediente.fecha),
      municipio: expediente.usuaria.municipio,
      tipoRegistro: expediente.tipoRegistro,
      usuariaNombreCompleto: `${expediente.usuaria.nombres} ${expediente.usuaria.apellidos}`,
      usuaria: {
        nombres: expediente.usuaria.nombres,
        apellidos: expediente.usuaria.apellidos,
        dpi: expediente.usuaria.dpi,
        telefono: expediente.usuaria.telefono,
        direccion: expediente.usuaria.direccion,
        fechaNacimiento: fechaColumnaISO(expediente.usuaria.fechaNacimiento),
        grupoEtnico: expediente.usuaria.grupoEtnico,
        ubicacionGeografica: expediente.usuaria.ubicacionGeografica,
        departamentoOtro: expediente.usuaria.departamentoOtro,
        municipioOtro: expediente.usuaria.municipioOtro,
      },
      referido: { puedeVerDatosCaso: referido.puedeVerDatosCaso },
      datosCaso: {
        tipologiaDelito: expediente.tipologiaDelito,
        observaciones: expediente.observaciones,
        agresor: expediente.agresor
          ? {
              nombres: expediente.agresor.nombres,
              apellidos: expediente.agresor.apellidos,
              telefono: expediente.agresor.telefono,
              direccion: expediente.agresor.direccion,
            }
          : null,
      },
      ninos: expediente.ninos.map((nino) => ({
        nombres: nino.nombres,
        apellidos: nino.apellidos,
        fechaNacimiento: fechaColumnaISO(nino.fechaNacimiento),
        genero: nino.genero === 'MUJER' ? 'M' : 'H',
      })),
      documentos: expediente.documentos.map((documento) => ({
        id: documento.id,
        tipo: documento.tipo,
        nombreArchivo: documento.nombreArchivo,
        mimeType: documento.mimeType,
        tamanioBytes: documento.tamanioBytes,
        createdAt: documento.createdAt.toISOString(),
        areasVisibles: documento.visibilidadAreas.map(
          (visibilidad) => visibilidad.area,
        ),
      })),
    };
  }

  async buscarDocumentoDeReferido(
    documentoId: string,
    expedienteId: string,
    area: Rol,
  ): Promise<DocumentoParaDescargaArea | null> {
    const documento = await this.prisma.documento.findFirst({
      where: {
        id: documentoId,
        expedienteId,
        vigente: true,
        expediente: { referidos: { some: { area } } },
      },
      select: {
        claveR2: true,
        nombreArchivo: true,
        mimeType: true,
        tipo: true,
        ...SELECT_AREAS_VISIBLES,
      },
    });
    if (!documento) {
      return null;
    }
    return {
      claveR2: documento.claveR2,
      nombreArchivo: documento.nombreArchivo,
      mimeType: documento.mimeType,
      tipo: documento.tipo,
      areasVisibles: documento.visibilidadAreas.map(
        (visibilidad) => visibilidad.area,
      ),
    };
  }
}
