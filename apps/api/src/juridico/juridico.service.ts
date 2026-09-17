import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  mimeTypePermitido,
  subirDocumentoProcesoSchema,
  type AgregarNotaAvanceInput,
  type CerrarProcesoInput,
  type CrearProcesoJuridicoInput,
  type DocumentoProcesoDto,
  type EditarAsignacionProcesoInput,
  type ListarProcesosQuery,
  type NotaAvanceDto,
  type ProcesoDetalle,
  type ProcesoResumen,
  type ProcesosPaginados,
  type RegistrarAbandonoInput,
} from '@akyuam/shared';
import { AuditService } from '../auth/services/audit.service';
import { OBJECT_STORAGE } from '../storage/interfaces/object-storage.interface';
import type { IObjectStorage } from '../storage/interfaces/object-storage.interface';
import { PROCESOS_JURIDICOS_REPOSITORY } from './interfaces/procesos-juridicos-repository.interface';
import type {
  AccesoProceso,
  IProcesosJuridicosRepository,
} from './interfaces/procesos-juridicos-repository.interface';
import { NOTAS_AVANCE_REPOSITORY } from './interfaces/notas-avance-repository.interface';
import type { INotasAvanceRepository } from './interfaces/notas-avance-repository.interface';
import { DOCUMENTOS_PROCESO_REPOSITORY } from './interfaces/documentos-proceso-repository.interface';
import type { IDocumentosProcesoRepository } from './interfaces/documentos-proceso-repository.interface';
import { PERSONAL_REPOSITORY } from '../personal/interfaces/personal-repository.interface';
import type { IPersonalRepository } from '../personal/interfaces/personal-repository.interface';

interface ContextoAuditoria {
  usuarioId: string;
  username: string;
  ipAddress?: string;
  userAgent?: string;
}

interface SubirDocumentoProcesoParams {
  nombreVisible: string | undefined;
  archivo: Express.Multer.File;
}

/** "" (sin seleccionar todavía, ver idPersonalOpcionalSchema) -> null para la base de datos. */
function vacioANulo(valor: string): string | null {
  return valor === '' ? null : valor;
}

const MENSAJE_SIN_ACCESO_EXPEDIENTE = 'No tiene acceso a este expediente';
const MENSAJE_SIN_ACCESO_PROCESO = 'No tiene acceso a este proceso';

@Injectable()
export class JuridicoService {
  constructor(
    @Inject(PROCESOS_JURIDICOS_REPOSITORY)
    private readonly procesosRepository: IProcesosJuridicosRepository,
    @Inject(NOTAS_AVANCE_REPOSITORY)
    private readonly notasRepository: INotasAvanceRepository,
    @Inject(DOCUMENTOS_PROCESO_REPOSITORY)
    private readonly documentosRepository: IDocumentosProcesoRepository,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: IObjectStorage,
    @Inject(PERSONAL_REPOSITORY)
    private readonly personalRepository: IPersonalRepository,
    private readonly auditService: AuditService,
  ) {}

  async listarPorExpediente(expedienteId: string): Promise<ProcesoResumen[]> {
    await this.exigirAccesoExpediente(expedienteId);
    return this.procesosRepository.listarPorExpediente(expedienteId);
  }

  async crearProceso(
    expedienteId: string,
    datos: CrearProcesoJuridicoInput,
    contexto: ContextoAuditoria,
  ): Promise<{ id: string }> {
    await this.exigirAccesoExpediente(expedienteId);

    const abogadaId = vacioANulo(datos.abogadaId);
    const procuradoraId = vacioANulo(datos.procuradoraId);
    await this.validarAsignacion(abogadaId, procuradoraId);

    const creado = await this.procesosRepository.crear({
      expedienteId,
      tipo: datos.tipo,
      abogadaId,
      procuradoraId,
      fechaInicio: datos.fechaInicio,
      creadoPorId: contexto.usuarioId,
    });
    if (!creado) {
      // Defensa en profundidad: la validación de arriba ya cubre el caso esperado; esto
      // solo cabría ante una carrera con una desactivación concurrente.
      throw new BadRequestException(
        'La abogada o procuradora seleccionada no existe',
      );
    }

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'PROCESO_JURIDICO_CREADO',
      entidad: 'ProcesoJuridico',
      entidadId: creado.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { expedienteId, tipo: datos.tipo },
    });

    return creado;
  }

  async obtenerDetalle(
    procesoId: string,
    contexto: ContextoAuditoria,
  ): Promise<ProcesoDetalle> {
    await this.exigirAccesoProceso(procesoId);

    const [base, notas, documentos] = await Promise.all([
      this.procesosRepository.obtenerDetalle(procesoId),
      this.notasRepository.listarPorProceso(procesoId),
      this.documentosRepository.listarPorProceso(procesoId),
    ]);
    if (!base) {
      // El acceso ya se confirmó justo arriba; solo cabe aquí una carrera con un borrado
      // concurrente, no un problema de autorización — se reporta como 404, no 403.
      throw new NotFoundException('Proceso no encontrado');
    }

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'PROCESO_JURIDICO_CONSULTADO',
      entidad: 'ProcesoJuridico',
      entidadId: procesoId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });

    return { ...base, notas, documentos };
  }

  async editarAsignacion(
    procesoId: string,
    datos: EditarAsignacionProcesoInput,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    await this.exigirAccesoProceso(procesoId);

    const abogadaId = vacioANulo(datos.abogadaId);
    const procuradoraId = vacioANulo(datos.procuradoraId);
    await this.validarAsignacion(abogadaId, procuradoraId);

    const actualizado = await this.procesosRepository.actualizarAsignacion({
      procesoId,
      abogadaId,
      procuradoraId,
    });
    if (!actualizado) {
      throw new BadRequestException(
        'La abogada o procuradora seleccionada no existe',
      );
    }

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'PROCESO_JURIDICO_ASIGNACION_ACTUALIZADA',
      entidad: 'ProcesoJuridico',
      entidadId: procesoId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });
  }

  async cerrarProceso(
    procesoId: string,
    datos: CerrarProcesoInput,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    await this.exigirAccesoProceso(procesoId);

    await this.procesosRepository.cerrar({
      procesoId,
      fechaCierre: datos.fechaCierre,
    });

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'PROCESO_JURIDICO_CERRADO',
      entidad: 'ProcesoJuridico',
      entidadId: procesoId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });
  }

  async agregarNota(
    procesoId: string,
    datos: AgregarNotaAvanceInput,
    contexto: ContextoAuditoria,
  ): Promise<NotaAvanceDto> {
    await this.exigirAccesoProceso(procesoId);

    const nota = await this.notasRepository.crear({
      procesoId,
      contenido: datos.contenido,
      registradoPorId: contexto.usuarioId,
    });

    // Nunca el contenido de la nota en `detalles` — mismo criterio que nombreArchivo en
    // DocumentosService.subir: el audit log guarda IDs/tipos, nunca texto libre personal.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'NOTA_AVANCE_AGREGADA',
      entidad: 'NotaAvanceProceso',
      entidadId: nota.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { procesoId },
    });

    return nota;
  }

  async registrarAbandono(
    procesoId: string,
    datos: RegistrarAbandonoInput,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    await this.exigirAccesoProceso(procesoId);

    await this.procesosRepository.registrarAbandono({
      procesoId,
      fecha: datos.fecha,
      motivo: vacioANulo(datos.motivo),
      registradoPorId: contexto.usuarioId,
    });

    // Nunca el motivo del abandono en `detalles` — mismo criterio que las notas de avance.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'ABANDONO_REGISTRADO',
      entidad: 'ProcesoJuridico',
      entidadId: procesoId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });
  }

  async subirDocumento(
    procesoId: string,
    params: SubirDocumentoProcesoParams,
    contexto: ContextoAuditoria,
  ): Promise<DocumentoProcesoDto> {
    if (!params.archivo) {
      throw new BadRequestException('Debe adjuntar un archivo');
    }

    const datosValidados = subirDocumentoProcesoSchema.safeParse({
      nombreVisible: params.nombreVisible,
    });
    if (!datosValidados.success) {
      throw new BadRequestException(
        datosValidados.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; '),
      );
    }

    // Reusa la misma lista blanca de MIME y el mismo límite de tamaño que trabajo social —
    // no se inventa una segunda regla de validación de archivos para jurídico.
    if (!mimeTypePermitido(params.archivo.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido');
    }

    const acceso = await this.exigirAccesoProceso(procesoId);

    const claveR2 = `procesos-juridicos/${acceso.expedienteId}/${procesoId}/${randomUUID()}`;
    await this.objectStorage.subirObjeto(
      claveR2,
      params.archivo.buffer,
      params.archivo.mimetype,
    );

    let documento: DocumentoProcesoDto;
    try {
      documento = await this.documentosRepository.crear({
        procesoId,
        nombreVisible: datosValidados.data.nombreVisible,
        nombreArchivo: params.archivo.originalname,
        claveR2,
        mimeType: params.archivo.mimetype,
        tamanioBytes: params.archivo.size,
        subidoPorId: contexto.usuarioId,
      });
    } catch (error) {
      await this.objectStorage.eliminarObjeto(claveR2).catch(() => undefined);
      throw error;
    }

    // Nunca nombreVisible ni nombreArchivo en `detalles` — mismo criterio que DOCUMENTO_SUBIDO.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'DOCUMENTO_PROCESO_SUBIDO',
      entidad: 'DocumentoProceso',
      entidadId: documento.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { procesoId },
    });

    return documento;
  }

  async obtenerUrlDescarga(
    procesoId: string,
    documentoId: string,
    contexto: ContextoAuditoria,
  ): Promise<{ url: string }> {
    await this.exigirAccesoProceso(procesoId);

    const documento = await this.documentosRepository.buscarParaDescarga(
      documentoId,
      procesoId,
    );
    if (!documento) {
      // Mismo criterio uniforme que el resto del módulo: no se distingue "no existe" de
      // "existe pero no es de este proceso" (sin IDOR).
      throw new ForbiddenException('No tiene acceso a este documento');
    }

    const url = await this.objectStorage.generarUrlDescarga(
      documento.claveR2,
      documento.nombreVisible,
    );

    // Leer un archivo sensible se audita igual que subirlo (ver planjuridico.md, punto 12).
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'DOCUMENTO_PROCESO_DESCARGADO',
      entidad: 'DocumentoProceso',
      entidadId: documentoId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { procesoId },
    });

    return { url };
  }

  async listarGlobal(query: ListarProcesosQuery): Promise<ProcesosPaginados> {
    return this.procesosRepository.listarGlobalPaginado({
      estado: query.estado,
      page: query.page,
    });
  }

  private async exigirAccesoExpediente(expedienteId: string): Promise<void> {
    const expediente =
      await this.procesosRepository.buscarExpedienteConAcceso(expedienteId);
    if (!expediente) {
      // Mismo mensaje/código tanto si el expediente no existe como si existe pero no fue
      // referido a JURIDICO — no debe ser posible distinguir ambos casos desde afuera.
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_EXPEDIENTE);
    }
  }

  private async exigirAccesoProceso(procesoId: string): Promise<AccesoProceso> {
    const acceso = await this.procesosRepository.buscarAccesoProceso(procesoId);
    if (!acceso) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_PROCESO);
    }
    return acceso;
  }

  /**
   * Valida explícitamente contra `Personal` (existe, área JURIDICO, cargo correcto,
   * activo) en vez de depender solo de la violación de la FK de Postgres — da mensajes
   * específicos por campo y distingue "no existe/inactiva" antes de intentar guardar
   * (resuelve el punto abierto 1 de pendientes.md).
   */
  private async validarAsignacion(
    abogadaId: string | null,
    procuradoraId: string | null,
  ): Promise<void> {
    if (abogadaId) {
      const existe = await this.personalRepository.buscarActivo({
        id: abogadaId,
        area: 'JURIDICO',
        tipo: 'ABOGADA',
      });
      if (!existe) {
        throw new BadRequestException(
          'La abogada seleccionada no existe o no está activa',
        );
      }
    }
    if (procuradoraId) {
      const existe = await this.personalRepository.buscarActivo({
        id: procuradoraId,
        area: 'JURIDICO',
        tipo: 'PROCURADORA',
      });
      if (!existe) {
        throw new BadRequestException(
          'La procuradora seleccionada no existe o no está activa',
        );
      }
    }
  }
}
