import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  finDiaGT,
  inicioDiaGT,
  mimeTypePermitido,
  parseLocalGT,
  type ActualizarCitaInput,
  type ActualizarEstadoAtencionInput,
  type AgendaCita,
  type AtencionPsicologicaDetalle,
  type CitaResumen,
  type DocumentoCitaDto,
  type ProgramarCitaInput,
  type RangoFechasQuery,
  type ReportePsicologia,
} from '@akyuam/shared';
import { AuditService } from '../auth/services/audit.service';
import { OBJECT_STORAGE } from '../storage/interfaces/object-storage.interface';
import type { IObjectStorage } from '../storage/interfaces/object-storage.interface';
import { ATENCION_PSICOLOGICA_REPOSITORY } from './interfaces/atencion-psicologica-repository.interface';
import type { IAtencionPsicologicaRepository } from './interfaces/atencion-psicologica-repository.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from './interfaces/citas-psicologicas-repository.interface';
import type {
  AccesoCitaPsicologica,
  ICitasPsicologicasRepository,
} from './interfaces/citas-psicologicas-repository.interface';

interface ContextoAuditoria {
  usuarioId: string;
  username: string;
  ipAddress?: string;
  userAgent?: string;
}

/** "" (campo opcional sin llenar) -> null para la base de datos, mismo criterio que juridico.service.ts. */
function vacioANulo(valor: string): string | null {
  return valor === '' ? null : valor;
}

const MENSAJE_SIN_ACCESO_EXPEDIENTE = 'No tiene acceso a este expediente';
const MENSAJE_SIN_ACCESO_CITA = 'No tiene acceso a esta cita';
const MENSAJE_SIN_ACCESO_DOCUMENTO = 'No tiene acceso a este documento';

@Injectable()
export class PsicologiaService {
  constructor(
    @Inject(ATENCION_PSICOLOGICA_REPOSITORY)
    private readonly atencionRepository: IAtencionPsicologicaRepository,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: IObjectStorage,
    private readonly auditService: AuditService,
  ) {}

  async obtenerAtencion(
    expedienteId: string,
    contexto: ContextoAuditoria,
  ): Promise<AtencionPsicologicaDetalle> {
    await this.exigirAccesoExpediente(expedienteId);

    const atencion = await this.atencionRepository.obtenerOCrear({
      expedienteId,
      creadaPorId: contexto.usuarioId,
    });

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'ATENCION_PSICOLOGICA_CONSULTADA',
      entidad: 'AtencionPsicologica',
      entidadId: atencion.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { expedienteId },
    });

    return atencion;
  }

  async actualizarEstadoAtencion(
    expedienteId: string,
    datos: ActualizarEstadoAtencionInput,
    contexto: ContextoAuditoria,
  ): Promise<AtencionPsicologicaDetalle> {
    await this.exigirAccesoExpediente(expedienteId);

    const atencion = await this.atencionRepository.actualizarEstado({
      expedienteId,
      estado: datos.estado,
      actualizadoPorId: contexto.usuarioId,
    });

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'ATENCION_PSICOLOGICA_ESTADO_ACTUALIZADO',
      entidad: 'AtencionPsicologica',
      entidadId: atencion.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { expedienteId, estado: datos.estado },
    });

    return atencion;
  }

  async programarCita(
    expedienteId: string,
    datos: ProgramarCitaInput,
    contexto: ContextoAuditoria,
  ): Promise<CitaResumen> {
    await this.exigirAccesoExpediente(expedienteId);

    // Creación perezosa: si esta es la primera cita del expediente, la atención (estado
    // INICIO) todavía no existe — se asegura antes de colgar la cita de ella.
    const atencion = await this.atencionRepository.obtenerOCrear({
      expedienteId,
      creadaPorId: contexto.usuarioId,
    });

    const cita = await this.citasRepository.crear({
      atencionId: atencion.id,
      fechaHora: parseLocalGT(datos.fechaHora),
      modalidad: datos.modalidad,
      lugar: vacioANulo(datos.lugar),
      motivo: datos.motivo,
      atendidoPorId: contexto.usuarioId,
    });

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'CITA_PSICOLOGICA_PROGRAMADA',
      entidad: 'CitaPsicologica',
      entidadId: cita.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { expedienteId, modalidad: datos.modalidad },
    });

    return cita;
  }

  async actualizarCita(
    citaId: string,
    datos: ActualizarCitaInput,
    contexto: ContextoAuditoria,
  ): Promise<CitaResumen> {
    await this.exigirAccesoCita(citaId);

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

    const acceso = await this.exigirAccesoCita(citaId);

    const claveR2 = `citas-psicologicas/${acceso.expedienteId}/${citaId}/${randomUUID()}`;
    await this.objectStorage.subirObjeto(
      claveR2,
      archivo.buffer,
      archivo.mimetype,
    );

    let documento: DocumentoCitaDto;
    try {
      documento = await this.citasRepository.crearDocumento({
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
    await this.exigirAccesoCita(citaId);

    const documento =
      await this.citasRepository.buscarDocumentoParaDescarga(citaId);
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
      detalles: { citaId },
    });

    return { url };
  }

  async listarAgenda(query: RangoFechasQuery): Promise<AgendaCita[]> {
    return this.citasRepository.listarAgenda({
      desde: inicioDiaGT(query.desde),
      hasta: finDiaGT(query.hasta),
    });
  }

  async obtenerReporte(query: RangoFechasQuery): Promise<ReportePsicologia> {
    const agregado = await this.citasRepository.obtenerReporte({
      desde: inicioDiaGT(query.desde),
      hasta: finDiaGT(query.hasta),
    });
    return { desde: query.desde, hasta: query.hasta, ...agregado };
  }

  private async exigirAccesoExpediente(expedienteId: string): Promise<void> {
    const expediente =
      await this.atencionRepository.buscarExpedienteConAcceso(expedienteId);
    if (!expediente) {
      // Mismo mensaje/código tanto si el expediente no existe como si existe pero no fue
      // referido a PSICOLOGIA — no debe ser posible distinguir ambos casos desde afuera.
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_EXPEDIENTE);
    }
  }

  private async exigirAccesoCita(
    citaId: string,
  ): Promise<AccesoCitaPsicologica> {
    const acceso = await this.citasRepository.buscarAccesoCita(citaId);
    if (!acceso) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_CITA);
    }
    return acceso;
  }
}
