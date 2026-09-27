import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CrearExpedienteInput,
  DatosAgresor as DatosAgresorInput,
  DatosCaso,
  ExpedienteCreado,
  ExpedienteDetalleCaso,
  IdentidadUsuaria,
} from '@akyuam/shared';
import type { MunicipioAltaVerapaz } from '@prisma/client';
import { AREA_NOTIFIER } from '../areas/interfaces/area-notifier.interface';
import type { IAreaNotifier } from '../areas/interfaces/area-notifier.interface';
import { AuditService } from '../auth/services/audit.service';
import type { ContextoAuditoria } from '../common/types/contexto-auditoria';
import {
  DpiUsuariaDuplicadoError,
  EXPEDIENTES_REPOSITORY,
  UsuariaNoEncontradaError,
} from './interfaces/expedientes-repository.interface';
import type {
  DatosCasoParams,
  DatosIdentidadUsuaria,
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

@Injectable()
export class ExpedientesService {
  constructor(
    @Inject(EXPEDIENTES_REPOSITORY)
    private readonly expedientesRepository: IExpedientesRepository,
    private readonly auditService: AuditService,
    @Inject(AREA_NOTIFIER)
    private readonly areaNotifier: IAreaNotifier,
  ) {}

  async crear(
    datos: CrearExpedienteInput,
    contexto: ContextoAuditoria,
  ): Promise<ExpedienteCreado> {
    let resultado: ExpedienteCreado;
    try {
      resultado = await this.expedientesRepository.crearConUsuariaNueva({
        identidadUsuaria: this.mapearIdentidad(datos.datosUsuaria),
        datosCaso: this.mapearDatosCaso(datos.datosCaso, contexto.usuarioId),
      });
    } catch (error) {
      if (error instanceof DpiUsuariaDuplicadoError) {
        // Mensaje genérico a propósito — no filtra si la usuaria existente coincide en nombre,
        // solo indica que hay que buscarla primero (evita enumeración, ver CLAUDE.md).
        throw new ConflictException(
          'Ya existe una usuaria registrada con este DPI. Búscala en Expediente antes de continuar.',
        );
      }
      throw error;
    }

    await this.registrarCreacionYReferidos(
      resultado,
      datos.datosCaso.areasReferidas,
      contexto,
    );
    return resultado;
  }

  async crearCasoParaUsuariaExistente(
    usuariaId: string,
    datosCaso: DatosCaso,
    contexto: ContextoAuditoria,
  ): Promise<ExpedienteCreado> {
    let resultado: ExpedienteCreado;
    try {
      resultado = await this.expedientesRepository.crearParaUsuariaExistente(
        usuariaId,
        this.mapearDatosCaso(datosCaso, contexto.usuarioId),
      );
    } catch (error) {
      if (error instanceof UsuariaNoEncontradaError) {
        throw new NotFoundException('Usuaria no encontrada');
      }
      throw error;
    }

    await this.registrarCreacionYReferidos(
      resultado,
      datosCaso.areasReferidas,
      contexto,
    );
    return resultado;
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

  private async registrarCreacionYReferidos(
    resultado: ExpedienteCreado,
    areasReferidas: DatosCaso['areasReferidas'],
    contexto: ContextoAuditoria,
  ): Promise<void> {
    // Nunca nombres/DPI en `detalles` — solo el número, que no es dato sensible por sí mismo (RNF-02).
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

    for (const area of areasReferidas) {
      await this.auditService.registrar({
        usuarioId: contexto.usuarioId,
        username: contexto.username,
        accion: 'EXPEDIENTE_REFERIDO',
        entidad: 'Expediente',
        entidadId: resultado.id,
        ipAddress: contexto.ipAddress,
        userAgent: contexto.userAgent,
        detalles: { area },
      });

      this.areaNotifier.notificarReferido(area, {
        id: resultado.id,
        numero: resultado.numero,
        fecha: resultado.fecha,
        municipio: resultado.municipio,
        tipoRegistro: resultado.tipoRegistro,
        usuariaNombreCompleto: resultado.usuariaNombreCompleto,
      });
    }
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
    creadoPorId: string,
  ): DatosCasoParams {
    return {
      fecha: datosCaso.fecha,
      tipoRegistro: datosCaso.tipoRegistro,
      tipologiaDelito: datosCaso.tipologiaDelito,
      areasReferidas: datosCaso.areasReferidas,
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
    };
  }
}
