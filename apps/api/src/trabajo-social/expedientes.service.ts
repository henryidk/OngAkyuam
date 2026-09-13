import { Inject, Injectable } from '@nestjs/common';
import type { CrearExpedienteInput, ExpedienteCreado } from '@akyuam/shared';
import type { MunicipioAltaVerapaz } from '@prisma/client';
import { AREA_NOTIFIER } from '../areas/interfaces/area-notifier.interface';
import type { IAreaNotifier } from '../areas/interfaces/area-notifier.interface';
import { AuditService } from '../auth/services/audit.service';
import { EXPEDIENTES_REPOSITORY } from './interfaces/expedientes-repository.interface';
import type {
  CrearExpedienteConUsuariaParams,
  IExpedientesRepository,
} from './interfaces/expedientes-repository.interface';

interface ContextoAuditoria {
  usuarioId: string;
  username: string;
  ipAddress?: string;
  userAgent?: string;
}

function vacioANulo(valor: string): string | null {
  return valor === '' ? null : valor;
}

function tieneDatosAgresor(
  agresor: CrearExpedienteInput['datosAgresor'],
): boolean {
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
    const params = this.mapearAParametros(datos, contexto.usuarioId);
    const resultado = await this.expedientesRepository.crearConUsuaria(params);

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

    for (const area of datos.areasReferidas) {
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

    return resultado;
  }

  private mapearAParametros(
    datos: CrearExpedienteInput,
    creadoPorId: string,
  ): CrearExpedienteConUsuariaParams {
    const { datosCaso, datosUsuaria, datosAgresor } = datos;

    return {
      identidadUsuaria: {
        nombres: datosUsuaria.nombres,
        apellidos: datosUsuaria.apellidos,
        dpi: vacioANulo(datosUsuaria.dpi),
        telefono: vacioANulo(datosUsuaria.telefono),
        direccion: vacioANulo(datosUsuaria.direccion),
        fechaNacimiento: datosUsuaria.fechaNacimiento,
        grupoEtnico: datosUsuaria.grupoEtnico,
      },
      fecha: datosCaso.fecha,
      municipio: datosCaso.fueraDeAltaVerapaz
        ? null
        : (datosCaso.municipio as MunicipioAltaVerapaz),
      departamentoOtro: datosCaso.fueraDeAltaVerapaz
        ? vacioANulo(datosCaso.departamentoOtro)
        : null,
      municipioOtro: datosCaso.fueraDeAltaVerapaz
        ? vacioANulo(datosCaso.municipioOtro)
        : null,
      ubicacionGeografica: datosCaso.ubicacionGeografica,
      tipoRegistro: datos.tipoRegistro,
      tipologiaDelito: datosUsuaria.tipologiaDelito,
      areasReferidas: datos.areasReferidas,
      creadoPorId,
      agresor: tieneDatosAgresor(datosAgresor)
        ? {
            nombres: vacioANulo(datosAgresor.nombres),
            apellidos: vacioANulo(datosAgresor.apellidos),
            telefono: vacioANulo(datosAgresor.telefono),
            direccion: vacioANulo(datosAgresor.direccion),
          }
        : null,
      ninos: datos.ninos.map((nino) => ({
        nombres: nino.nombres,
        apellidos: nino.apellidos,
        fechaNacimiento: nino.fechaNacimiento,
        genero: GENERO_A_ENUM[nino.genero],
      })),
    };
  }
}
