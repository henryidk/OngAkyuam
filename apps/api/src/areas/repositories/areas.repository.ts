import { Injectable } from '@nestjs/common';
import type { Rol } from '@prisma/client';
import {
  fechaColumnaISO,
  type ExpedienteDetalleArea,
  type ExpedienteResumenArea,
} from '@akyuam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  DocumentoParaDescargaArea,
  IAreasRepository,
} from '../interfaces/areas-repository.interface';

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

  async buscarConAcceso(
    expedienteId: string,
    area: Rol,
  ): Promise<ExpedienteDetalleArea | null> {
    const expediente = await this.prisma.expediente.findFirst({
      where: { id: expedienteId, referidos: { some: { area } } },
      include: {
        usuaria: true,
        agresor: true,
        ninos: true,
        documentos: { where: { visibilidadAreas: { some: { area } } } },
      },
    });
    if (!expediente) {
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
        tipologiaDelito: expediente.tipologiaDelito,
        ubicacionGeografica: expediente.usuaria.ubicacionGeografica,
        departamentoOtro: expediente.usuaria.departamentoOtro,
        municipioOtro: expediente.usuaria.municipioOtro,
      },
      agresor: expediente.agresor
        ? {
            nombres: expediente.agresor.nombres,
            apellidos: expediente.agresor.apellidos,
            telefono: expediente.agresor.telefono,
            direccion: expediente.agresor.direccion,
          }
        : null,
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
        tamanioBytes: documento.tamanioBytes,
        createdAt: documento.createdAt.toISOString(),
      })),
    };
  }

  async buscarDocumentoVisible(
    documentoId: string,
    expedienteId: string,
    area: Rol,
  ): Promise<DocumentoParaDescargaArea | null> {
    return this.prisma.documento.findFirst({
      where: {
        id: documentoId,
        expedienteId,
        visibilidadAreas: { some: { area } },
      },
      select: { claveR2: true, nombreArchivo: true },
    });
  }
}
