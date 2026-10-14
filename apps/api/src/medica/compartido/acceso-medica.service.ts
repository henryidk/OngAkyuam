import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  ACCESO_MEDICA_REPOSITORY,
  type AccesoAtencionMedica,
  type AccesoCitaMedica,
  type AccesoConsultaMedica,
  type AccesoDocumentoMedico,
  type AccesoExpedienteMedica,
  type AccesoReferenciaMedica,
  type IAccesoMedicaRepository,
} from '../interfaces/acceso-medica-repository.interface';
import {
  MENSAJE_SIN_ACCESO_ATENCION,
  MENSAJE_SIN_ACCESO_CITA,
  MENSAJE_SIN_ACCESO_CONSULTA,
  MENSAJE_SIN_ACCESO_DOCUMENTO,
  MENSAJE_SIN_ACCESO_EXPEDIENTE,
  MENSAJE_SIN_ACCESO_REFERENCIA,
  MENSAJE_SIN_ACCESO_USUARIA,
} from './mensajes';

/**
 * Único punto de autorización del módulo (§8.1 del plan): cada recurso se resuelve hasta su
 * expediente y se exige que esté referido a Medicina. "No existe" y "no es de Medicina" dan el
 * mismo 403, para no revelar qué ids existen.
 */
@Injectable()
export class AccesoMedicaService {
  constructor(
    @Inject(ACCESO_MEDICA_REPOSITORY)
    private readonly repository: IAccesoMedicaRepository,
  ) {}

  exigirExpediente(expedienteId: string): Promise<AccesoExpedienteMedica> {
    return this.exigir(
      this.repository.buscarExpediente(expedienteId),
      MENSAJE_SIN_ACCESO_EXPEDIENTE,
    );
  }

  exigirReferencia(referidoId: string): Promise<AccesoReferenciaMedica> {
    return this.exigir(
      this.repository.buscarReferencia(referidoId),
      MENSAJE_SIN_ACCESO_REFERENCIA,
    );
  }

  exigirAtencion(atencionId: string): Promise<AccesoAtencionMedica> {
    return this.exigir(
      this.repository.buscarAtencion(atencionId),
      MENSAJE_SIN_ACCESO_ATENCION,
    );
  }

  exigirCita(citaId: string): Promise<AccesoCitaMedica> {
    return this.exigir(
      this.repository.buscarCita(citaId),
      MENSAJE_SIN_ACCESO_CITA,
    );
  }

  exigirConsulta(consultaId: string): Promise<AccesoConsultaMedica> {
    return this.exigir(
      this.repository.buscarConsulta(consultaId),
      MENSAJE_SIN_ACCESO_CONSULTA,
    );
  }

  exigirDocumento(documentoId: string): Promise<AccesoDocumentoMedico> {
    return this.exigir(
      this.repository.buscarDocumento(documentoId),
      MENSAJE_SIN_ACCESO_DOCUMENTO,
    );
  }

  async exigirUsuaria(usuariaId: string): Promise<void> {
    if (!(await this.repository.usuariaReferida(usuariaId))) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_USUARIA);
    }
  }

  /** El hijo/a atendido debe ser del mismo expediente; `null` es la usuaria. */
  async personaDelExpediente(
    ninoId: string | null,
    expedienteId: string,
  ): Promise<boolean> {
    return (
      ninoId === null ||
      this.repository.ninoPerteneceAExpediente(ninoId, expedienteId)
    );
  }

  private async exigir<T>(
    busqueda: Promise<T | null>,
    mensaje: string,
  ): Promise<T> {
    const encontrado = await busqueda;
    if (!encontrado) {
      throw new ForbiddenException(mensaje);
    }
    return encontrado;
  }
}
