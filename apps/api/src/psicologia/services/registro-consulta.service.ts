import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  mimeTypePermitido,
  type ActualizarCitaInput,
  type CitaResumen,
  type DocumentoCitaDto,
  type RegistroConsultaInput,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { OBJECT_STORAGE } from '../../storage/interfaces/object-storage.interface';
import type { IObjectStorage } from '../../storage/interfaces/object-storage.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import { DOCUMENTOS_CITA_REPOSITORY } from '../interfaces/documentos-cita-repository.interface';
import type { IDocumentosCitaRepository } from '../interfaces/documentos-cita-repository.interface';
import { AccesoPsicologiaService } from './acceso-psicologia.service';

const MENSAJE_SIN_ACCESO_DOCUMENTO = 'No tiene acceso a este documento';

/** "" (campo opcional sin llenar) -> null para la base de datos, mismo criterio que juridico.service.ts. */
function vacioANulo(valor: string): string | null {
  return valor === '' ? null : valor;
}

@Injectable()
export class RegistroConsultaService {
  constructor(
    private readonly acceso: AccesoPsicologiaService,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
    @Inject(DOCUMENTOS_CITA_REPOSITORY)
    private readonly documentosRepository: IDocumentosCitaRepository,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: IObjectStorage,
    private readonly auditService: AuditService,
  ) {}

  async actualizarCita(
    citaId: string,
    datos: ActualizarCitaInput,
    contexto: ContextoAuditoria,
  ): Promise<CitaResumen> {
    await this.acceso.exigirAccesoCita(citaId, contexto.usuarioId);

    const cita = await this.citasRepository.actualizar({
      citaId,
      estado: datos.estado,
      observaciones: vacioANulo(datos.observaciones),
      acuerdos: vacioANulo(datos.acuerdos),
    });

    // Nunca observaciones/acuerdos en `detalles` — mismo criterio que las notas de avance
    // en jurídico: el audit log guarda IDs/enums, nunca texto libre personal.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'CITA_PSICOLOGICA_ACTUALIZADA',
      entidad: 'CitaPsicologica',
      entidadId: citaId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { estado: datos.estado },
    });

    return cita;
  }

  /**
   * Registro clínico completo de la consulta (§5.4, §7.3 del plan). `borrador: true` no cambia
   * el estado de la cita todavía — solo persiste el avance del formulario.
   */
  async registrarConsulta(
    citaId: string,
    datos: RegistroConsultaInput,
    contexto: ContextoAuditoria,
  ): Promise<CitaResumen> {
    await this.acceso.exigirAccesoCita(citaId, contexto.usuarioId);

    const cita = await this.citasRepository.registrarConsulta({
      citaId,
      estado: datos.borrador ? undefined : datos.estado,
      temas: vacioANulo(datos.temas),
      intervencion: vacioANulo(datos.intervencion),
      recomendaciones: vacioANulo(datos.recomendaciones),
      acuerdos: vacioANulo(datos.acuerdos),
      observaciones: vacioANulo(datos.observaciones),
      motivoNoAsistencia: vacioANulo(datos.motivoNoAsistencia),
      borrador: datos.borrador,
    });

    // Nunca temas/intervención/recomendaciones/motivoNoAsistencia en `detalles` — texto clínico
    // libre, mismo criterio que observaciones/acuerdos en `actualizarCita`.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'REGISTRO_CONSULTA_GUARDADO',
      entidad: 'CitaPsicologica',
      entidadId: citaId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { borrador: datos.borrador },
    });

    return cita;
  }

  async subirDocumentoCita(
    citaId: string,
    archivo: Express.Multer.File,
    contexto: ContextoAuditoria,
  ): Promise<DocumentoCitaDto> {
    if (!archivo) {
      throw new BadRequestException('Debe adjuntar un archivo');
    }
    // Reusa la misma lista blanca de MIME y el mismo límite de tamaño que el resto del
    // sistema — nunca se confía en el `accept` del `<input>` del navegador.
    if (!mimeTypePermitido(archivo.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido');
    }

    const acceso = await this.acceso.exigirAccesoCita(
      citaId,
      contexto.usuarioId,
    );

    const claveR2 = `citas-psicologicas/${acceso.expedienteId}/${citaId}/${randomUUID()}`;
    await this.objectStorage.subirObjeto(
      claveR2,
      archivo.buffer,
      archivo.mimetype,
    );

    let documento: DocumentoCitaDto;
    try {
      documento = await this.documentosRepository.crearDocumento({
        citaId,
        expedienteId: acceso.expedienteId,
        nombreArchivo: archivo.originalname,
        claveR2,
        mimeType: archivo.mimetype,
        tamanioBytes: archivo.size,
        subidoPorId: contexto.usuarioId,
      });
    } catch (error) {
      await this.objectStorage.eliminarObjeto(claveR2).catch(() => undefined);
      throw error;
    }

    // Nunca nombreArchivo en `detalles` — mismo criterio que DOCUMENTO_PROCESO_SUBIDO.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'DOCUMENTO_CITA_PSICOLOGICA_SUBIDO',
      entidad: 'Documento',
      entidadId: documento.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { citaId },
    });

    return documento;
  }

  async obtenerUrlDescargaDocumentoCita(
    citaId: string,
    contexto: ContextoAuditoria,
  ): Promise<{ url: string }> {
    // Leer, no escribir: también vale el documento de un proceso cerrado de una colega.
    const cita = await this.acceso.exigirLecturaCita(
      citaId,
      contexto.usuarioId,
    );

    const documento =
      await this.documentosRepository.buscarDocumentoParaDescarga(citaId);
    if (!documento) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_DOCUMENTO);
    }

    const url = await this.objectStorage.generarUrlDescarga(
      documento.claveR2,
      documento.nombreArchivo,
    );

    // Leer un archivo sensible se audita igual que subirlo (mismo criterio que jurídico).
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'DOCUMENTO_CITA_PSICOLOGICA_DESCARGADO',
      entidad: 'Documento',
      entidadId: documento.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { citaId, deColega: !cita.propia },
    });

    return { url };
  }
}
