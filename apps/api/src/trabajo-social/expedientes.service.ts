import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  CrearCasoInput,
  CrearExpedienteInput,
  DatosAgresor as DatosAgresorInput,
  DatosCaso,
  ExpedienteCreado,
  ExpedienteDetalleCaso,
  IdentidadUsuaria,
} from '@akyuam/shared';
import type { MunicipioAltaVerapaz } from '@prisma/client';
import { AuditService } from '../auth/services/audit.service';
import type { ContextoAuditoria } from '../common/types/contexto-auditoria';
import {
  DocumentoPendienteNoAplicaError,
  DocumentoPendienteNoDisponibleError,
  DpiUsuariaDuplicadoError,
  EXPEDIENTES_REPOSITORY,
  UsuariaNoEncontradaError,
} from './interfaces/expedientes-repository.interface';
import type {
  DatosCasoParams,
  DatosIdentidadUsuaria,
  ExpedienteCreadoResultado,
  IExpedientesRepository,
} from './interfaces/expedientes-repository.interface';

function vacioANulo(valor: string): string | null {
  return valor === '' ? null : valor;
}

function tieneDatosAgresor(agresor: DatosAgresorInput): boolean {
  return Boolean(
    agresor.nombres ||
    agresor.apellidos ||
    agresor.telefono ||
    agresor.direccion,
  );
}

// El catálogo compartido usa códigos cortos ('M'/'H') para el formulario; Prisma persiste
// el enum GeneroPersona con nombres completos.
const GENERO_A_ENUM = { M: 'MUJER', H: 'HOMBRE' } as const;

/**
 * Errores de los documentos ya subidos que se adjuntan al registrar. 422 y no 409: el formulario
 * interpreta cualquier 409 al registrar como DPI duplicado.
 */
function traducirErrorDocumentoPendiente(error: unknown): void {
  if (error instanceof DocumentoPendienteNoDisponibleError) {
    throw new UnprocessableEntityException(
      'Uno de los documentos ya no está disponible. Vuelve a subirlo en el paso Documentos.',
    );
  }
  if (error instanceof DocumentoPendienteNoAplicaError) {
    throw new BadRequestException(
      'Uno de los documentos solo aplica a registros internos (solicitud de albergue). Quítalo en el paso Documentos.',
    );
  }
}

@Injectable()
export class ExpedientesService {
  constructor(
    @Inject(EXPEDIENTES_REPOSITORY)
    private readonly expedientesRepository: IExpedientesRepository,
    private readonly auditService: AuditService,
  ) {}

  async crear(
    datos: CrearExpedienteInput,
    contexto: ContextoAuditoria,
  ): Promise<ExpedienteCreado> {
    let resultado: ExpedienteCreadoResultado;
    try {
      resultado = await this.expedientesRepository.crearConUsuariaNueva({
        identidadUsuaria: this.mapearIdentidad(datos.datosUsuaria),
        datosCaso: this.mapearDatosCaso(
          datos.datosCaso,
          datos.documentosPendientesIds ?? [],
          contexto.usuarioId,
        ),
      });
    } catch (error) {
      traducirErrorDocumentoPendiente(error);
      if (error instanceof DpiUsuariaDuplicadoError) {
        // Mensaje genérico a propósito — no filtra si la usuaria existente coincide en nombre,
        // solo indica que hay que buscarla primero (evita enumeración, ver CLAUDE.md).
        throw new ConflictException(
          'Ya existe una usuaria registrada con este DPI. Búscala en Expediente antes de continuar.',
        );
      }
      throw error;
    }

    return this.registrarCreacion(resultado, contexto);
  }

  async crearCasoParaUsuariaExistente(
    usuariaId: string,
    datos: CrearCasoInput,
    contexto: ContextoAuditoria,
  ): Promise<ExpedienteCreado> {
    const { documentosPendientesIds, ...datosCaso } = datos;
    let resultado: ExpedienteCreadoResultado;
    try {
      resultado = await this.expedientesRepository.crearParaUsuariaExistente(
        usuariaId,
        this.mapearDatosCaso(
          datosCaso,
          documentosPendientesIds ?? [],
          contexto.usuarioId,
        ),
      );
    } catch (error) {
      traducirErrorDocumentoPendiente(error);
      if (error instanceof UsuariaNoEncontradaError) {
        throw new NotFoundException('Usuaria no encontrada');
      }
      throw error;
    }

    return this.registrarCreacion(resultado, contexto);
  }

  async obtenerDetalle(
    id: string,
    contexto: ContextoAuditoria,
  ): Promise<ExpedienteDetalleCaso> {
    const expediente = await this.expedientesRepository.obtenerDetalle(id);
    if (!expediente) {
      throw new NotFoundException('Expediente no encontrado');
    }

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'EXPEDIENTE_CONSULTADO',
      entidad: 'Expediente',
      entidadId: id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });

    return expediente;
  }

  /** Audita la creación y cada documento adjuntado; devuelve lo que ve el cliente. */
  private async registrarCreacion(
    resultado: ExpedienteCreadoResultado,
    contexto: ContextoAuditoria,
  ): Promise<ExpedienteCreado> {
    const { documentosAdjuntados, ...expediente } = resultado;
    // Nunca nombres/DPI en `detalles` — solo el número, que no es dato sensible por sí mismo (RNF-02).
    // Referir ya no ocurre aquí: se audita y notifica en ReferidosService.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'EXPEDIENTE_CREADO',
      entidad: 'Expediente',
      entidadId: resultado.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { numero: resultado.numero },
    });

    // Mismo evento que una subida desde la pestaña Documentos: el historial de un documento no
    // depende de por dónde entró. Nunca el nombre del archivo en `detalles`.
    for (const documento of documentosAdjuntados) {
      await this.auditService.registrar({
        usuarioId: contexto.usuarioId,
        username: contexto.username,
        accion: 'DOCUMENTO_SUBIDO',
        entidad: 'Documento',
        entidadId: documento.id,
        ipAddress: contexto.ipAddress,
        userAgent: contexto.userAgent,
        detalles: { expedienteId: resultado.id, tipo: documento.tipo },
      });
    }

    return expediente;
  }

  private mapearIdentidad(
    datosUsuaria: IdentidadUsuaria,
  ): DatosIdentidadUsuaria {
    return {
      nombres: datosUsuaria.nombres,
      apellidos: datosUsuaria.apellidos,
      dpi: vacioANulo(datosUsuaria.dpi),
      telefono: vacioANulo(datosUsuaria.telefono),
      direccion: vacioANulo(datosUsuaria.direccion),
      fechaNacimiento: datosUsuaria.fechaNacimiento,
      grupoEtnico: datosUsuaria.grupoEtnico,
      municipio: datosUsuaria.fueraDeAltaVerapaz
        ? null
        : (datosUsuaria.municipio as MunicipioAltaVerapaz),
      departamentoOtro: datosUsuaria.fueraDeAltaVerapaz
        ? vacioANulo(datosUsuaria.departamentoOtro)
        : null,
      municipioOtro: datosUsuaria.fueraDeAltaVerapaz
        ? vacioANulo(datosUsuaria.municipioOtro)
        : null,
      ubicacionGeografica: datosUsuaria.ubicacionGeografica,
    };
  }

  private mapearDatosCaso(
    datosCaso: DatosCaso,
    documentosPendientesIds: string[],
    creadoPorId: string,
  ): DatosCasoParams {
    return {
      fecha: datosCaso.fecha,
      tipoRegistro: datosCaso.tipoRegistro,
      tipologiaDelito: datosCaso.tipologiaDelito,
      fechaIngresoAlbergue:
        datosCaso.tipoRegistro === 'INTERNA'
          ? datosCaso.fechaIngresoAlbergue
          : null,
      observaciones: vacioANulo(datosCaso.observaciones),
      creadoPorId,
      agresor: tieneDatosAgresor(datosCaso.datosAgresor)
        ? {
            nombres: vacioANulo(datosCaso.datosAgresor.nombres),
            apellidos: vacioANulo(datosCaso.datosAgresor.apellidos),
            telefono: vacioANulo(datosCaso.datosAgresor.telefono),
            direccion: vacioANulo(datosCaso.datosAgresor.direccion),
          }
        : null,
      ninos: datosCaso.ninos.map((nino) => ({
        nombres: nino.nombres,
        apellidos: nino.apellidos,
        fechaNacimiento: nino.fechaNacimiento,
        genero: GENERO_A_ENUM[nino.genero],
      })),
      documentosPendientesIds,
    };
  }
}
