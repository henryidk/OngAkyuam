import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PROCESOS_REPOSITORY } from '../interfaces/procesos-repository.interface';
import type {
  AccesoProceso,
  ExpedienteAccesoJuridico,
  IProcesosRepository,
} from '../interfaces/procesos-repository.interface';
import {
  MENSAJE_SIN_ACCESO_EXPEDIENTE,
  MENSAJE_SIN_ACCESO_PROCESO,
} from './mensajes';

/**
 * Puerta única de autorización del módulo: todo servicio pasa por aquí antes de leer o
 * escribir. Responde el mismo 403 si el recurso no existe o si no fue referido a Jurídico,
 * para que desde afuera no se pueda averiguar qué ids existen.
 */
@Injectable()
export class AccesoJuridicoService {
  constructor(
    @Inject(PROCESOS_REPOSITORY)
    private readonly procesosRepository: IProcesosRepository,
  ) {}

  async exigirExpediente(
    expedienteId: string,
  ): Promise<ExpedienteAccesoJuridico> {
    const expediente =
      await this.procesosRepository.buscarExpedienteConAcceso(expedienteId);
    if (!expediente) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_EXPEDIENTE);
    }
    return expediente;
  }

  async exigirProceso(procesoId: string): Promise<AccesoProceso> {
    const acceso = await this.procesosRepository.buscarAccesoProceso(procesoId);
    if (!acceso) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_PROCESO);
    }
    return acceso;
  }
}
