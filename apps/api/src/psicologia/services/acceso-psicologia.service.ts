import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ATENCION_PSICOLOGICA_REPOSITORY } from '../interfaces/atencion-psicologica-repository.interface';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type {
  AccesoCitaPsicologica,
  ICitasPsicologicasRepository,
} from '../interfaces/citas-psicologicas-repository.interface';

const MENSAJE_SIN_ACCESO_EXPEDIENTE = 'No tiene acceso a este expediente';
const MENSAJE_SIN_ACCESO_CITA = 'No tiene acceso a esta cita';

/**
 * Cadena anti-IDOR del módulo de psicología — existe una sola vez aquí y la comparten todos
 * los demás servicios del módulo (§7.1 del plan), en vez de reimplementarla cada uno.
 */
@Injectable()
export class AccesoPsicologiaService {
  constructor(
    @Inject(ATENCION_PSICOLOGICA_REPOSITORY)
    private readonly atencionRepository: IAtencionPsicologicaRepository,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
  ) {}

  async exigirAccesoExpediente(
    expedienteId: string,
    psicologaId: string,
  ): Promise<void> {
    const expediente = await this.atencionRepository.buscarExpedienteConAcceso(
      expedienteId,
      psicologaId,
    );
    if (!expediente) {
      // Mismo mensaje/código sin importar el motivo real: expediente inexistente, no referido
      // a PSICOLOGIA, referido pero aún sin tomar, o tomado por otra psicóloga — los cuatro
      // casos son indistinguibles desde afuera (§7.4 del plan, anti-enumeración).
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_EXPEDIENTE);
    }
  }

  async exigirAccesoCita(
    citaId: string,
    psicologaId: string,
  ): Promise<AccesoCitaPsicologica> {
    const acceso = await this.citasRepository.buscarAccesoCita(
      citaId,
      psicologaId,
    );
    if (!acceso) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_CITA);
    }
    return acceso;
  }

  /**
   * Usado solo por `tomarCaso` — el referido a PSICOLOGIA debe existir, pero la reclamación es
   * precisamente lo que esa acción establece, así que aquí no se exige todavía tener
   * `psicologaAsignadaId` asignado (a diferencia de `exigirAccesoExpediente`).
   */
  async exigirReferidoPsicologia(expedienteId: string): Promise<void> {
    const existe =
      await this.atencionRepository.existeReferidoPsicologia(expedienteId);
    if (!existe) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_EXPEDIENTE);
    }
  }
}
