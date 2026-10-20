import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { HORAS_VIDA_DOCUMENTO_MEDICO_PENDIENTE } from '@akyuam/shared';
import type {
  DocumentoMedicoDto,
  DocumentoMedicoSubidoDto,
  SubirDocumentoMedicoInput,
  SubirDocumentoMedicoPendienteInput,
  TipoDocumentoMedico,
  UrlDocumentoMedicoQuery,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import {
  resolverNombreVisible,
  validarArchivo,
} from '../../common/archivos/validador-archivo';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import {
  OBJECT_STORAGE,
  type IObjectStorage,
} from '../../storage/interfaces/object-storage.interface';
import { AccesoMedicaService } from '../compartido/acceso-medica.service';
import { eventoAuditoria } from '../compartido/auditoria';
import {
  MENSAJE_ARCHIVO_REQUERIDO,
  MENSAJE_ATENCION_NO_ACTIVA,
  MENSAJE_SIN_ACCESO_DOCUMENTO,
  MENSAJES_ARCHIVO,
} from '../compartido/mensajes';
import { RELOJ, type IReloj } from '../../common/reloj';
import {
  DOCUMENTOS_MEDICOS_REPOSITORY,
  type ArchivoMedicoGuardado,
  type IDocumentosMedicosRepository,
  type PendienteMedico,
} from '../interfaces/documentos-medicos-repository.interface';

const VIDA_PENDIENTE_MS =
  HORAS_VIDA_DOCUMENTO_MEDICO_PENDIENTE * 60 * 60 * 1000;

/**
 * Documentos de las consultas. Se sube un archivo por petición: antes de guardar la consulta
 * queda como pendiente de un lote (y pasa a la consulta al guardarla); después, directo a la
 * consulta. La clave del objeto es aleatoria: el nombre original nunca forma parte de ella.
 */
@Injectable()
export class DocumentosMedicosService {
  constructor(
    @Inject(DOCUMENTOS_MEDICOS_REPOSITORY)
    private readonly documentosRepository: IDocumentosMedicosRepository,
    @Inject(OBJECT_STORAGE) private readonly objectStorage: IObjectStorage,
    @Inject(RELOJ) private readonly reloj: IReloj,
    private readonly acceso: AccesoMedicaService,
    private readonly auditService: AuditService,
  ) {}

  async subirPendiente(
    archivo: Express.Multer.File | undefined,
    datos: SubirDocumentoMedicoPendienteInput,
    contexto: ContextoAuditoria,
  ): Promise<DocumentoMedicoSubidoDto> {
    const valido = this.exigirArchivoValido(archivo);
    const atencion = await this.acceso.exigirAtencion(datos.atencionId);
    if (atencion.estado !== 'ACTIVA') {
      throw new ConflictException(MENSAJE_ATENCION_NO_ACTIVA);
    }
    const expiraEn = new Date(this.reloj.ahora().getTime() + VIDA_PENDIENTE_MS);

    const subido = await this.guardarObjeto(
      valido,
      datos,
      `medica/${atencion.expedienteId}/${atencion.atencionId}/${randomUUID()}`,
      contexto.usuarioId,
      (guardado) =>
        this.documentosRepository.crearPendiente({
          ...guardado,
          lote: datos.lote,
          atencionId: atencion.atencionId,
          expiraEn,
        }),
    );
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'DOCUMENTO_MEDICO_PENDIENTE_SUBIDO',
        entidad: 'DocumentoMedicoPendiente',
        entidadId: subido.id,
        detalles: {
          expedienteId: atencion.expedienteId,
          atencionId: atencion.atencionId,
          tipo: subido.tipo,
        },
      }),
    );
    return subido;
  }

  async cambiarTipoPendiente(
    id: string,
    tipo: TipoDocumentoMedico,
    contexto: ContextoAuditoria,
  ): Promise<DocumentoMedicoSubidoDto> {
    await this.exigirPendiente(id, contexto.usuarioId);
    return this.documentosRepository.cambiarTipoPendiente(id, tipo);
  }

  async eliminarPendiente(
    id: string,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    const pendiente = await this.exigirPendiente(id, contexto.usuarioId);
    // Primero el objeto: si falla, la fila sigue y la limpieza lo reintenta.
    await this.objectStorage.eliminarObjeto(pendiente.claveObjeto);
    await this.documentosRepository.eliminarPendiente(id);
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'DOCUMENTO_MEDICO_PENDIENTE_ELIMINADO',
        entidad: 'DocumentoMedicoPendiente',
        entidadId: id,
        detalles: { atencionId: pendiente.atencionId },
      }),
    );
  }

  /** Agregar un documento a una consulta ya guardada (un resultado que llegó después). */
  async subirAConsulta(
    consultaId: string,
    archivo: Express.Multer.File | undefined,
    datos: SubirDocumentoMedicoInput,
    contexto: ContextoAuditoria,
  ): Promise<DocumentoMedicoSubidoDto> {
    const valido = this.exigirArchivoValido(archivo);
    const consulta = await this.acceso.exigirConsulta(consultaId);

    const subido = await this.guardarObjeto(
      valido,
      datos,
      `medica/${consulta.expedienteId}/${consulta.atencionId}/${randomUUID()}`,
      contexto.usuarioId,
      (guardado) =>
        this.documentosRepository.crearEnConsulta(consultaId, guardado),
    );
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'DOCUMENTO_MEDICO_SUBIDO',
        entidad: 'DocumentoMedico',
        entidadId: subido.id,
        detalles: {
          expedienteId: consulta.expedienteId,
          atencionId: consulta.atencionId,
          consultaId,
          tipo: subido.tipo,
        },
      }),
    );
    return subido;
  }

  /** URL firmada de corta duración. Ver y descargar se auditan igual. */
  async url(
    documentoId: string,
    query: UrlDocumentoMedicoQuery,
    contexto: ContextoAuditoria,
  ): Promise<{ url: string }> {
    const documento = await this.acceso.exigirDocumento(documentoId);
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
        accion:
          query.modo === 'vista'
            ? 'DOCUMENTO_MEDICO_VISTO'
            : 'DOCUMENTO_MEDICO_DESCARGADO',
        entidad: 'DocumentoMedico',
        entidadId: documentoId,
        detalles: { expedienteId: documento.expedienteId },
      }),
    );
    return { url };
  }

  async listarPorUsuaria(usuariaId: string): Promise<DocumentoMedicoDto[]> {
    await this.acceso.exigirUsuaria(usuariaId);
    return this.documentosRepository.listarPorUsuaria(usuariaId);
  }

  /** No basta el tipo que declara el navegador: se revisan los primeros bytes del archivo. */
  private exigirArchivoValido(
    archivo: Express.Multer.File | undefined,
  ): Express.Multer.File {
    if (!archivo) {
      throw new BadRequestException(MENSAJE_ARCHIVO_REQUERIDO);
    }
    const motivo = validarArchivo({
      mimeType: archivo.mimetype,
      contenido: archivo.buffer,
    });
    if (motivo) {
      throw new BadRequestException(MENSAJES_ARCHIVO[motivo]);
    }
    return archivo;
  }

  private async exigirPendiente(
    id: string,
    usuarioId: string,
  ): Promise<PendienteMedico> {
    const pendiente = await this.documentosRepository.buscarPendiente(
      id,
      usuarioId,
    );
    if (!pendiente) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_DOCUMENTO);
    }
    // Defensa en profundidad: la atención también debe seguir siendo de Medicina.
    await this.acceso.exigirAtencion(pendiente.atencionId);
    return pendiente;
  }

  /** Sube el objeto y crea la fila; si la fila falla, borra el objeto para no dejarlo huérfano. */
  private async guardarObjeto(
    archivo: Express.Multer.File,
    datos: SubirDocumentoMedicoInput,
    claveObjeto: string,
    subidoPorId: string,
    crear: (
      guardado: ArchivoMedicoGuardado,
    ) => Promise<DocumentoMedicoSubidoDto>,
  ): Promise<DocumentoMedicoSubidoDto> {
    await this.objectStorage.subirObjeto(
      claveObjeto,
      archivo.buffer,
      archivo.mimetype,
    );
    try {
      return await crear({
        tipo: datos.tipo,
        nombreVisible: resolverNombreVisible(
          datos.nombreVisible ?? undefined,
          archivo.originalname,
        ),
        nombreArchivo: archivo.originalname.slice(0, 255),
        claveObjeto,
        mimeType: archivo.mimetype,
        tamanioBytes: archivo.size,
        subidoPorId,
      });
    } catch (error) {
      await this.objectStorage
        .eliminarObjeto(claveObjeto)
        .catch(() => undefined);
      throw error;
    }
  }
}
