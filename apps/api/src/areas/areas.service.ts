import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  mimeTypePermitido,
  type AreaAtencion,
  type ExpedienteDetalleArea,
  type ExpedienteResumenArea,
  type UrlDocumentoProcesoQuery,
} from '@akyuam/shared';
import { AuditService } from '../auth/services/audit.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import type { ContextoAuditoria } from '../common/types/contexto-auditoria';
import { OBJECT_STORAGE } from '../storage/interfaces/object-storage.interface';
import type { IObjectStorage } from '../storage/interfaces/object-storage.interface';
import { AREAS_REPOSITORY } from './interfaces/areas-repository.interface';
import type {
  ExpedienteReferidoArea,
  IAreasRepository,
} from './interfaces/areas-repository.interface';
import type { IPoliticaAccesoArea } from './politicas/politica-acceso-area.interface';
import { PoliticasAcceso } from './politicas/politicas-acceso';

const MENSAJE_SIN_ACCESO_DOCUMENTO = 'No tiene acceso a este documento';

@Injectable()
export class AreasService {
  constructor(
    @Inject(AREAS_REPOSITORY)
    private readonly areasRepository: IAreasRepository,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: IObjectStorage,
    private readonly auditService: AuditService,
    private readonly politicasAcceso: PoliticasAcceso,
  ) {}

  async listarReferidos(
    area: AuthenticatedUser['rol'],
  ): Promise<ExpedienteResumenArea[]> {
    return this.areasRepository.listarPorArea(area);
  }

  async obtenerDetalle(
    id: string,
    usuario: AuthenticatedUser,
    contexto: ContextoAuditoria,
  ): Promise<ExpedienteDetalleArea> {
    const expediente = await this.areasRepository.buscarReferido(
      id,
      usuario.rol,
    );
    if (!expediente) {
      // Mismo mensaje/código tanto si el expediente no existe como si existe pero no fue
      // referido a esta área — no debe ser posible distinguir ambos casos desde afuera.
      throw new ForbiddenException('No tiene acceso a este expediente');
    }

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'EXPEDIENTE_CONSULTADO',
      entidad: 'Expediente',
      entidadId: id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { area: usuario.rol },
    });

    return aplicarPolitica(expediente, this.politicaDe(usuario));
  }

  async obtenerUrlDescarga(
    expedienteId: string,
    documentoId: string,
    usuario: AuthenticatedUser,
    contexto: ContextoAuditoria,
    modo: UrlDocumentoProcesoQuery['modo'] = 'descarga',
  ): Promise<{ url: string }> {
    const documento = await this.areasRepository.buscarDocumentoDeReferido(
      documentoId,
      expedienteId,
      usuario.rol,
    );
    if (!documento || !this.politicaDe(usuario).puedeVerDocumento(documento)) {
      // Mismo criterio uniforme que `obtenerDetalle`: no distinguir "no existe" de "existe
      // pero no visible para esta área" (sin IDOR).
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_DOCUMENTO);
    }

    // La vista dentro de la app solo existe para tipos que el navegador muestra sin ejecutar
    // nada; cualquier otro se entrega siempre como descarga.
    const comoVista = modo === 'vista' && mimeTypePermitido(documento.mimeType);
    const url = comoVista
      ? await this.objectStorage.generarUrlVistaPrevia(
          documento.claveR2,
          documento.mimeType,
        )
      : await this.objectStorage.generarUrlDescarga(
          documento.claveR2,
          documento.nombreArchivo,
        );

    // Leer un archivo sensible se audita igual que subirlo (ver planjuridico.md, punto 12).
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: comoVista ? 'DOCUMENTO_VISUALIZADO' : 'DOCUMENTO_DESCARGADO',
      entidad: 'Documento',
      entidadId: documentoId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { expedienteId, area: usuario.rol },
    });

    return { url };
  }

  /** El controller solo admite roles de `AREAS_ATENCION` (`@Roles`), así que el rol es un área. */
  private politicaDe(usuario: AuthenticatedUser): IPoliticaAccesoArea {
    return this.politicasAcceso.para(usuario.rol as AreaAtencion);
  }
}

/** Quita del expediente lo que la política del área no le permite ver. */
function aplicarPolitica(
  expediente: ExpedienteReferidoArea,
  politica: IPoliticaAccesoArea,
): ExpedienteDetalleArea {
  const { referido, datosCaso, documentos, ...resto } = expediente;
  return {
    ...resto,
    datosCaso: politica.puedeVerDatosCaso(referido) ? datosCaso : null,
    documentos: documentos
      .filter((documento) => politica.puedeVerDocumento(documento))
      // `areasVisibles` es un dato interno de Trabajo Social: no se le muestra a las áreas.
      .map((documento) => ({
        id: documento.id,
        tipo: documento.tipo,
        nombreArchivo: documento.nombreArchivo,
        mimeType: documento.mimeType,
        tamanioBytes: documento.tamanioBytes,
        createdAt: documento.createdAt,
      })),
  };
}
