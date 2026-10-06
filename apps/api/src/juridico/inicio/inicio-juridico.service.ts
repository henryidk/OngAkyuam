import { Inject, Injectable } from '@nestjs/common';
import {
  FILAS_COLA_INICIO,
  FILAS_MIS_PROCESOS_INICIO,
  NOVEDADES_TS_INICIO,
  hoyGT,
  type InicioJuridicoDto,
  type ReferenciaBandejaDto,
  type ReferenciaInicioDto,
} from '@akyuam/shared';
import { INICIO_REPOSITORY } from '../interfaces/inicio-repository.interface';
import type { IInicioRepository } from '../interfaces/inicio-repository.interface';
import { REFERENCIAS_REPOSITORY } from '../interfaces/referencias-repository.interface';
import type { IReferenciasRepository } from '../interfaces/referencias-repository.interface';

/** Filas de actividad reciente: las mismas que caben junto a las novedades de TS. */
const FILAS_ACTIVIDAD_RECIENTE = 6;

/** Solo lo que la tarjeta de Inicio muestra: el DPI y el motivo se quedan en el Área de atención. */
function referenciaInicio(
  referencia: ReferenciaBandejaDto,
): ReferenciaInicioDto {
  return {
    referidoId: referencia.referidoId,
    expedienteId: referencia.expedienteId,
    expedienteNumero: referencia.expedienteNumero,
    usuaria: {
      id: referencia.usuaria.id,
      nombreCompleto: referencia.usuaria.nombreCompleto,
    },
    referidoEn: referencia.referidoEn,
  };
}

@Injectable()
export class InicioJuridicoService {
  constructor(
    @Inject(INICIO_REPOSITORY)
    private readonly inicioRepository: IInicioRepository,
    @Inject(REFERENCIAS_REPOSITORY)
    private readonly referenciasRepository: IReferenciasRepository,
  ) {}

  /**
   * Sin auditoría de lectura, igual que la bandeja y la lista de procesos: son listados de
   * trabajo, no la consulta de un expediente en particular.
   */
  async obtener(usuarioId: string): Promise<InicioJuridicoDto> {
    const anio = Number(hoyGT().slice(0, 4));
    const [
      pendientes,
      resumenAnio,
      requierenAtencion,
      tieneFicha,
      actividadReciente,
      novedadesTs,
    ] = await Promise.all([
      this.referenciasRepository.listar('pendientes'),
      this.inicioRepository.resumenAnio(anio),
      this.inicioRepository.colaProcesos(
        { cola: 'ATENCION' },
        FILAS_COLA_INICIO,
      ),
      this.inicioRepository.tieneFichaPersonal(usuarioId),
      this.inicioRepository.colaProcesos(
        { cola: 'RECIENTES' },
        FILAS_ACTIVIDAD_RECIENTE,
      ),
      this.inicioRepository.novedadesTs(NOVEDADES_TS_INICIO),
    ]);

    // Una cuenta sin ficha de personal nunca está asignada a nada: no hay cola que pedir.
    const misProcesos = tieneFicha
      ? await this.inicioRepository.colaProcesos(
          { cola: 'MIOS', usuarioId },
          FILAS_MIS_PROCESOS_INICIO,
        )
      : null;

    return {
      anio,
      resumenAnio,
      referenciasNuevas: {
        items: pendientes.slice(0, FILAS_COLA_INICIO).map(referenciaInicio),
        total: pendientes.length,
      },
      requierenAtencion,
      misProcesos,
      actividadReciente: actividadReciente.items,
      novedadesTs,
    };
  }
}
