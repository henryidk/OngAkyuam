import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type {
  ExpedienteDetalleArea,
  ExpedienteResumenArea,
} from '@akyuam/shared';
import { AuditService } from '../auth/services/audit.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { OBJECT_STORAGE } from '../storage/interfaces/object-storage.interface';
import type { IObjectStorage } from '../storage/interfaces/object-storage.interface';
import { AREAS_REPOSITORY } from './interfaces/areas-repository.interface';
import type { IAreasRepository } from './interfaces/areas-repository.interface';

const MENSAJE_SIN_ACCESO_DOCUMENTO = 'No tiene acceso a este documento';

interface ContextoAuditoria {
  usuarioId: string;
  username: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AreasService {
  constructor(
    @Inject(AREAS_REPOSITORY)
    private readonly areasRepository: IAreasRepository,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: IObjectStorage,
    private readonly auditService: AuditService,
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
    const expediente = await this.areasRepository.buscarConAcceso(
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

    return expediente;
  }

  async obtenerUrlDescarga(
    expedienteId: string,
    documentoId: string,
    usuario: AuthenticatedUser,
    contexto: ContextoAuditoria,
  ): Promise<{ url: string }> {
    const documento = await this.areasRepository.buscarDocumentoVisible(
      documentoId,
      expedienteId,
      usuario.rol,
    );
    if (!documento) {
      // Mismo criterio uniforme que `obtenerDetalle`: no distinguir "no existe" de "existe
      // pero no visible para esta área" (sin IDOR).
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_DOCUMENTO);
    }

    const url = await this.objectStorage.generarUrlDescarga(
      documento.claveR2,
      documento.nombreArchivo,
    );

    // Leer un archivo sensible se audita igual que subirlo (ver planjuridico.md, punto 12).
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'DOCUMENTO_DESCARGADO',
      entidad: 'Documento',
      entidadId: documentoId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { expedienteId, area: usuario.rol },
    });

    return { url };
  }
}
