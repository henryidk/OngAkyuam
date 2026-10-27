import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type {
  UrlDocumentoMedicoQuery,
  VistaMedicaParaJuridico,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { VISIBILIDAD_MEDICA_READER } from '../../medica/interfaces/visibilidad-medica-reader.interface';
import type { IVisibilidadMedicaReader } from '../../medica/interfaces/visibilidad-medica-reader.interface';
import { OBJECT_STORAGE } from '../../storage/interfaces/object-storage.interface';
import type { IObjectStorage } from '../../storage/interfaces/object-storage.interface';
import { eventoAuditoria } from '../compartido/auditoria';
import { MENSAJE_SIN_ACCESO_DOCUMENTO } from '../compartido/mensajes';

/**
 * Lo que Medicina compartió con Jurídico sobre una usuaria: fechas de consulta y documentos.
 * Qué se ve lo decide la médica (visibilidad por atención) y el lector de Medicina ya filtra
 * por la referencia a Jurídico; aquí solo se firma y se audita.
 */
@Injectable()
export class VistaMedicaJuridicoService {
  constructor(
    @Inject(VISIBILIDAD_MEDICA_READER)
    private readonly visibilidadMedica: IVisibilidadMedicaReader,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: IObjectStorage,
    private readonly auditService: AuditService,
  ) {}

  async listar(
    usuariaId: string,
    contexto: ContextoAuditoria,
  ): Promise<VistaMedicaParaJuridico[]> {
    const atenciones = await this.visibilidadMedica.paraJuridico(usuariaId);
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'VISTA_MEDICA_CONSULTADA_POR_JURIDICO',
        entidad: 'Usuaria',
        entidadId: usuariaId,
        detalles: { atenciones: atenciones.length },
      }),
    );
    return atenciones;
  }

  async url(
    usuariaId: string,
    documentoId: string,
    query: UrlDocumentoMedicoQuery,
    contexto: ContextoAuditoria,
  ): Promise<{ url: string }> {
    const documento = await this.visibilidadMedica.documentoParaJuridico(
      usuariaId,
      documentoId,
    );
    // Mismo 403 si no existe, es de otra usuaria o Medicina no compartió su atención.
    if (!documento) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_DOCUMENTO);
    }
    const url =
      query.modo === 'vista'
        ? await this.objectStorage.generarUrlVistaPrevia(
            documento.claveObjeto,
            documento.mimeType,
          )
        : await this.objectStorage.generarUrlDescarga(
            documento.claveObjeto,
            documento.nombreArchivo,
          );
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'DOCUMENTO_MEDICO_VISTO_POR_JURIDICO',
        entidad: 'DocumentoMedico',
        entidadId: documentoId,
        detalles: { expedienteId: documento.expedienteId, modo: query.modo },
      }),
    );
    return { url };
  }
}
